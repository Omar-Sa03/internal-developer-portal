import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';

export const scaffolderModuleArgocd = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'argocd',
  register(reg) {
    reg.registerInit({
      deps: { logger: coreServices.logger },
      async init({ logger }) {
        logger.info('Hello World!');
      },
    });
  },
});
