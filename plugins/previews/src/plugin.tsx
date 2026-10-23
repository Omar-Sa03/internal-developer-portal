import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { PreviewsClient, previewsApiRef } from './api';

const previewsApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: previewsApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: deps => new PreviewsClient(deps),
    }),
});

const previewsContent = EntityContentBlueprint.make({
  params: {
    path: 'previews',
    title: 'Previews',
    filter: entity =>
      Boolean(entity.metadata.annotations?.['backstage.io/kubernetes-id']),
    loader: () =>
      import('./components/PreviewsContent').then(m => <m.PreviewsContent />),
  },
});

export const previewsPlugin = createFrontendPlugin({
  pluginId: 'previews',
  extensions: [previewsApi, previewsContent],
});
