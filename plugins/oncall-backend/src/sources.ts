import {
  CoreV1Api,
  CustomObjectsApi,
  KubeConfig,
  V1Pod,
} from '@kubernetes/client-node';
import {
  DefaultGithubCredentialsProvider,
  ScmIntegrations,
} from '@backstage/integration';
import { Config } from '@backstage/config';
import { Octokit } from '@octokit/rest';

export type PodStatus = {
  name: string;
  phase: string;
  ready: boolean;
  restarts: number;
  /** e.g. CrashLoopBackOff, ImagePullBackOff */
  waitingReason?: string;
  /** e.g. OOMKilled, Error */
  lastTerminationReason?: string;
  startedAt?: string;
};

export type ClusterEvent = {
  reason?: string;
  message?: string;
  object: string;
  count: number;
  lastSeen?: string;
};

export type DeploymentStatus = {
  application: string;
  health: string;
  healthMessage?: string;
  sync: string;
  revision?: string;
  lastOperation?: {
    phase?: string;
    message?: string;
    finishedAt?: string;
  };
  history: Array<{ revision?: string; deployedAt?: string }>;
};

export type FiringAlert = {
  name: string;
  severity?: string;
  summary?: string;
  description?: string;
  startsAt: string;
};

export type Commit = {
  sha: string;
  message: string;
  author?: string;
  date?: string;
  url: string;
};

export interface ClusterSource {
  listPods(namespace: string, labelSelector: string): Promise<PodStatus[]>;
  listWarningEvents(namespace: string, limit: number): Promise<ClusterEvent[]>;
  getDeployment(kubernetesId: string): Promise<DeploymentStatus | undefined>;
}

export interface AlertSource {
  /** Undefined when no Alertmanager is configured. */
  firingAlerts(namespace: string): Promise<FiringAlert[] | undefined>;
}

export interface ChangeSource {
  recentCommits(slug: string, limit: number): Promise<Commit[]>;
}

function summarizePod(pod: V1Pod): PodStatus {
  const statuses = pod.status?.containerStatuses ?? [];
  return {
    name: pod.metadata?.name ?? 'unknown',
    phase: pod.status?.phase ?? 'Unknown',
    ready: statuses.length > 0 && statuses.every(s => s.ready),
    restarts: statuses.reduce((sum, s) => sum + s.restartCount, 0),
    waitingReason: statuses.find(s => s.state?.waiting)?.state?.waiting?.reason,
    lastTerminationReason: statuses.find(s => s.lastState?.terminated)
      ?.lastState?.terminated?.reason,
    startedAt: pod.status?.startTime
      ? new Date(pod.status.startTime).toISOString()
      : undefined,
  };
}

type ArgoApplication = {
  metadata: { name: string };
  status?: {
    health?: { status?: string; message?: string };
    sync?: { status?: string; revision?: string };
    operationState?: { phase?: string; message?: string; finishedAt?: string };
    history?: Array<{ revision?: string; deployedAt?: string }>;
  };
};

export class KubernetesClusterSource implements ClusterSource {
  private kc?: KubeConfig;

  constructor(private readonly argoNamespace: string) {}

  // Lazily loaded so the backend can start without cluster credentials.
  private config() {
    if (!this.kc) {
      this.kc = new KubeConfig();
      this.kc.loadFromDefault();
    }
    return this.kc;
  }

  async listPods(namespace: string, labelSelector: string) {
    const pods = await this.config()
      .makeApiClient(CoreV1Api)
      .listNamespacedPod({ namespace, labelSelector });
    return pods.items.map(summarizePod);
  }

  async listWarningEvents(namespace: string, limit: number) {
    const events = await this.config()
      .makeApiClient(CoreV1Api)
      .listNamespacedEvent({ namespace, fieldSelector: 'type=Warning' });
    return events.items
      .map(e => {
        const lastSeen = e.lastTimestamp ?? e.eventTime ?? e.firstTimestamp;
        return {
          reason: e.reason,
          message: e.message,
          object: `${e.involvedObject.kind}/${e.involvedObject.name}`,
          count: e.count ?? 1,
          lastSeen: lastSeen ? new Date(lastSeen).toISOString() : undefined,
        };
      })
      .sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''))
      .slice(0, limit);
  }

  async getDeployment(kubernetesId: string) {
    const res: { items?: ArgoApplication[] } = await this.config()
      .makeApiClient(CustomObjectsApi)
      .listNamespacedCustomObject({
        group: 'argoproj.io',
        version: 'v1alpha1',
        namespace: this.argoNamespace,
        plural: 'applications',
        labelSelector: `backstage.io/kubernetes-id=${kubernetesId}`,
      });
    const app = res.items?.[0];
    if (!app) return undefined;
    const { status } = app;
    return {
      application: app.metadata.name,
      health: status?.health?.status ?? 'Unknown',
      healthMessage: status?.health?.message,
      sync: status?.sync?.status ?? 'Unknown',
      revision: status?.sync?.revision,
      lastOperation: status?.operationState && {
        phase: status.operationState.phase,
        message: status.operationState.message,
        finishedAt: status.operationState.finishedAt,
      },
      history: (status?.history ?? [])
        .slice(-3)
        .reverse()
        .map(h => ({ revision: h.revision, deployedAt: h.deployedAt })),
    };
  }
}

type AlertmanagerAlert = {
  labels: Record<string, string>;
  annotations?: Record<string, string>;
  startsAt: string;
};

export class AlertmanagerSource implements AlertSource {
  constructor(private readonly baseUrl?: string) {}

  async firingAlerts(namespace: string) {
    if (!this.baseUrl) return undefined;
    const params = new URLSearchParams({
      active: 'true',
      silenced: 'false',
      inhibited: 'false',
      filter: `namespace="${namespace}"`,
    });
    const res = await fetch(`${this.baseUrl}/api/v2/alerts?${params}`);
    if (!res.ok) {
      throw new Error(`Alertmanager responded with ${res.status}`);
    }
    const alerts = (await res.json()) as AlertmanagerAlert[];
    return alerts.map(a => ({
      name: a.labels.alertname,
      severity: a.labels.severity,
      summary: a.annotations?.summary,
      description: a.annotations?.description,
      startsAt: a.startsAt,
    }));
  }
}

export class GithubChangeSource implements ChangeSource {
  private readonly credentials: DefaultGithubCredentialsProvider;
  private readonly apiBaseUrl?: string;

  constructor(config: Config) {
    const integrations = ScmIntegrations.fromConfig(config);
    this.credentials =
      DefaultGithubCredentialsProvider.fromIntegrations(integrations);
    this.apiBaseUrl =
      integrations.github.byHost('github.com')?.config.apiBaseUrl;
  }

  async recentCommits(slug: string, limit: number) {
    const [owner, repo] = slug.split('/');
    const { token } = await this.credentials.getCredentials({
      url: `https://github.com/${owner}/${repo}`,
    });
    const octokit = new Octokit({ auth: token, baseUrl: this.apiBaseUrl });
    const { data } = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: limit,
    });
    return data.map(c => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0],
      author: c.commit.author?.name ?? c.author?.login,
      date: c.commit.author?.date,
      url: c.html_url,
    }));
  }
}
