import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { createRouter } from './router';
import { ArgoCdPreviewSource } from './previews';

/**
 * Lists the ephemeral pull request environments of a catalog entity, as
 * created by the platform's previews ApplicationSet.
 *
 * @public
 */
export const previewsPlugin = createBackendPlugin({
  pluginId: 'previews',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        catalog: catalogServiceRef,
      },
      async init({ config, httpAuth, httpRouter, catalog }) {
        httpRouter.use(
          await createRouter({
            httpAuth,
            catalog,
            previews: new ArgoCdPreviewSource(
              config.getOptionalString('argocd.namespace') ?? 'argocd',
            ),
          }),
        );
      },
    });
  },
});
