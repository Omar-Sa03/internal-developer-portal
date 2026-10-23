import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { actionsRegistryServiceRef } from '@backstage/backend-plugin-api/alpha';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { registerOncallActions } from './actions';
import {
  AlertmanagerSource,
  GithubChangeSource,
  KubernetesClusterSource,
} from './sources';

/**
 * Read-only MCP actions that let an AI agent investigate an incident through
 * the portal: workload status, deployment state, firing alerts and recent
 * changes, always scoped to what the caller may see in the catalog.
 *
 * @public
 */
export const oncallPlugin = createBackendPlugin({
  pluginId: 'oncall',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        catalog: catalogServiceRef,
        actionsRegistry: actionsRegistryServiceRef,
      },
      async init({ config, catalog, actionsRegistry }) {
        registerOncallActions(actionsRegistry, {
          catalog,
          cluster: new KubernetesClusterSource(
            config.getOptionalString('argocd.namespace') ?? 'argocd',
          ),
          alerts: new AlertmanagerSource(
            config.getOptionalString('oncall.alertmanager.baseUrl'),
          ),
          changes: new GithubChangeSource(config),
        });
      },
    });
  },
});
