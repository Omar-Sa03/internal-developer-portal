import { CustomObjectsApi, KubeConfig } from '@kubernetes/client-node';

/** Subset of the wgpolicyk8s.io PolicyReport that the checks read. */
export type PolicyReport = {
  metadata: { name: string; namespace?: string };
  scope?: { kind?: string; name?: string };
  results?: Array<{
    policy: string;
    rule?: string;
    result: 'pass' | 'fail' | 'warn' | 'error' | 'skip';
    severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
    message?: string;
  }>;
};

/** Subset of the Argo CD Application status that the checks read. */
export type ArgoApplication = {
  metadata: { name: string; namespace?: string };
  status?: {
    health?: { status?: string; message?: string };
    sync?: { status?: string; revision?: string };
  };
};

export interface KubernetesReader {
  listPolicyReports(namespace: string): Promise<PolicyReport[]>;
  findArgoApplications(kubernetesId: string): Promise<ArgoApplication[]>;
}

type ListResponse<T> = { items?: T[] };

export class KubernetesClusterReader implements KubernetesReader {
  private api?: CustomObjectsApi;

  constructor(private readonly argoNamespace: string) {}

  // Lazily created so the backend can start without cluster credentials.
  private getApi(): CustomObjectsApi {
    if (!this.api) {
      const kc = new KubeConfig();
      kc.loadFromDefault();
      this.api = kc.makeApiClient(CustomObjectsApi);
    }
    return this.api;
  }

  async listPolicyReports(namespace: string): Promise<PolicyReport[]> {
    const res: ListResponse<PolicyReport> =
      await this.getApi().listNamespacedCustomObject({
        group: 'wgpolicyk8s.io',
        version: 'v1alpha2',
        namespace,
        plural: 'policyreports',
      });
    return res.items ?? [];
  }

  async findArgoApplications(kubernetesId: string): Promise<ArgoApplication[]> {
    const res: ListResponse<ArgoApplication> =
      await this.getApi().listNamespacedCustomObject({
        group: 'argoproj.io',
        version: 'v1alpha1',
        namespace: this.argoNamespace,
        plural: 'applications',
        labelSelector: `backstage.io/kubernetes-id=${kubernetesId}`,
      });
    return res.items ?? [];
  }
}
