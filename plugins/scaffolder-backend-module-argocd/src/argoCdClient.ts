import {
  ApiException,
  CustomObjectsApi,
  KubeConfig,
} from '@kubernetes/client-node';

const GROUP = 'argoproj.io';
const VERSION = 'v1alpha1';
const PLURAL = 'applications';

export type ArgoCdApplicationSpec = {
  name: string;
  /** Namespace the Argo CD control plane watches for Application resources. */
  argoNamespace: string;
  project: string;
  repoUrl: string;
  path: string;
  targetRevision: string;
  destinationServer: string;
  destinationNamespace: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
};

export type ApplyResult = 'created' | 'updated';

/**
 * Minimal surface the scaffolder action needs, kept behind an interface so the
 * action can be unit tested without a cluster.
 */
export interface ArgoCdClient {
  applyApplication(spec: ArgoCdApplicationSpec): Promise<ApplyResult>;
}

export function buildApplicationManifest(spec: ArgoCdApplicationSpec) {
  return {
    apiVersion: `${GROUP}/${VERSION}`,
    kind: 'Application',
    metadata: {
      name: spec.name,
      namespace: spec.argoNamespace,
      labels: spec.labels ?? {},
      annotations: spec.annotations ?? {},
      // Deleting the Application also prunes the workloads it created.
      finalizers: ['resources-finalizer.argocd.argoproj.io'],
    },
    spec: {
      project: spec.project,
      source: {
        repoURL: spec.repoUrl,
        targetRevision: spec.targetRevision,
        path: spec.path,
      },
      destination: {
        server: spec.destinationServer,
        namespace: spec.destinationNamespace,
      },
      syncPolicy: {
        automated: { prune: true, selfHeal: true },
        syncOptions: ['CreateNamespace=true'],
      },
    },
  };
}

export class KubernetesArgoCdClient implements ArgoCdClient {
  constructor(private readonly api: CustomObjectsApi) {}

  static fromDefaultKubeConfig(): KubernetesArgoCdClient {
    // Picks up in-cluster service account credentials or the local kubeconfig.
    const kc = new KubeConfig();
    kc.loadFromDefault();
    return new KubernetesArgoCdClient(kc.makeApiClient(CustomObjectsApi));
  }

  async applyApplication(spec: ArgoCdApplicationSpec): Promise<ApplyResult> {
    const body = buildApplicationManifest(spec);
    const ref = {
      group: GROUP,
      version: VERSION,
      namespace: spec.argoNamespace,
      plural: PLURAL,
    };

    let existing: { metadata?: { resourceVersion?: string } } | undefined;
    try {
      existing = await this.api.getNamespacedCustomObject({
        ...ref,
        name: spec.name,
      });
    } catch (e) {
      if (!(e instanceof ApiException && e.code === 404)) {
        throw e;
      }
    }

    if (!existing) {
      await this.api.createNamespacedCustomObject({ ...ref, body });
      return 'created';
    }

    await this.api.replaceNamespacedCustomObject({
      ...ref,
      name: spec.name,
      body: {
        ...body,
        metadata: {
          ...body.metadata,
          resourceVersion: existing.metadata?.resourceVersion,
        },
      },
    });
    return 'updated';
  }
}
