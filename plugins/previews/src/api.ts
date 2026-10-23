import { CompoundEntityRef } from '@backstage/catalog-model';
import { ResponseError } from '@backstage/errors';
import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/frontend-plugin-api';

// Mirrors the response of @internal/backstage-plugin-previews-backend.
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

export interface PreviewsApi {
  listPreviews(ref: CompoundEntityRef): Promise<Preview[]>;
}

export const previewsApiRef = createApiRef<PreviewsApi>({
  id: 'plugin.previews.api',
});

export class PreviewsClient implements PreviewsApi {
  constructor(
    private readonly options: {
      discoveryApi: DiscoveryApi;
      fetchApi: FetchApi;
    },
  ) {}

  async listPreviews({ kind, namespace, name }: CompoundEntityRef) {
    const baseUrl = await this.options.discoveryApi.getBaseUrl('previews');
    const path = [kind, namespace, name].map(encodeURIComponent).join('/');
    const response = await this.options.fetchApi.fetch(
      `${baseUrl}/entities/${path}`,
    );
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    const { items } = (await response.json()) as { items: Preview[] };
    return items;
  }
}
