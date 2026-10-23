import { CustomObjectsApi, KubeConfig } from '@kubernetes/client-node';

export const PREVIEW_OF_LABEL = 'idp.io/preview-of';
const PR_NUMBER_LABEL = 'idp.io/pr-number';
const PREVIEW_URL_ANNOTATION = 'idp.io/preview-url';
const PULL_REQUEST_URL_ANNOTATION = 'idp.io/pull-request-url';
const BRANCH_ANNOTATION = 'idp.io/branch';

/** Subset of an Argo CD Application created by the previews ApplicationSet. */
export type PreviewApplication = {
  metadata: {
    name: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: { destination?: { namespace?: string } };
  status?: {
    health?: { status?: string };
    sync?: { status?: string; revision?: string };
  };
};

export type Preview = {
  name: string;
  pullRequest: number | null;
  pullRequestUrl?: string;
  branch?: string;
  url?: string;
  namespace?: string;
  revision?: string;
  health: string;
  sync: string;
  createdAt?: string;
};

export interface PreviewSource {
  list(kubernetesId: string): Promise<PreviewApplication[]>;
}

export class ArgoCdPreviewSource implements PreviewSource {
  private api?: CustomObjectsApi;

  constructor(private readonly argoNamespace: string) {}

  private getApi() {
    if (!this.api) {
      const kc = new KubeConfig();
      kc.loadFromDefault();
      this.api = kc.makeApiClient(CustomObjectsApi);
    }
    return this.api;
  }

  async list(kubernetesId: string): Promise<PreviewApplication[]> {
    const res: { items?: PreviewApplication[] } =
      await this.getApi().listNamespacedCustomObject({
        group: 'argoproj.io',
        version: 'v1alpha1',
        namespace: this.argoNamespace,
        plural: 'applications',
        labelSelector: `${PREVIEW_OF_LABEL}=${kubernetesId}`,
      });
    return res.items ?? [];
  }
}

export function toPreview(app: PreviewApplication): Preview {
  const { labels = {}, annotations = {} } = app.metadata;
  const number = Number(labels[PR_NUMBER_LABEL]);
  return {
    name: app.metadata.name,
    pullRequest: Number.isInteger(number) ? number : null,
    pullRequestUrl: annotations[PULL_REQUEST_URL_ANNOTATION],
    branch: annotations[BRANCH_ANNOTATION],
    url: annotations[PREVIEW_URL_ANNOTATION],
    namespace: app.spec?.destination?.namespace,
    revision: app.status?.sync?.revision,
    health: app.status?.health?.status ?? 'Unknown',
    sync: app.status?.sync?.status ?? 'Unknown',
    createdAt: app.metadata.creationTimestamp,
  };
}
