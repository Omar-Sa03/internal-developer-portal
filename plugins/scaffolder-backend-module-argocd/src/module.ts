import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { argoCdCreateApplication } from './argoCdCreateApplication';
import { ArgoCdClient, KubernetesArgoCdClient } from './argoCdClient';

export const scaffolderModuleArgocd = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'argocd',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        scaffolder: scaffolderActionsExtensionPoint,
      },
      async init({ config, scaffolder }) {
        let client: ArgoCdClient | undefined;

        scaffolder.addActions(
          argoCdCreateApplication({
            getClient: () =>
              (client ??= KubernetesArgoCdClient.fromDefaultKubeConfig()),
            argoNamespace:
              config.getOptionalString('argocd.namespace') ?? 'argocd',
            destinationServer:
              config.getOptionalString('argocd.destinationServer') ??
              'https://kubernetes.default.svc',
            project:
              config.getOptionalString('argocd.project') ?? 'idp-services',
            reservedNamespaces: config.getOptionalStringArray(
              'argocd.reservedNamespaces',
            ) ?? [
              'default',
              'argocd',
              'kyverno',
              'monitoring',
              'ingress-nginx',
              'local-path-storage',
            ],
          }),
        );
      },
    });
  },
});
