import {
  coreServices,
  createBackendPlugin,
  readSchedulerServiceTaskScheduleDefinitionFromConfig,
} from '@backstage/backend-plugin-api';
import { actionsRegistryServiceRef } from '@backstage/backend-plugin-api/alpha';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { registerReadinessActions } from './actions';
import {
  dashboardCheck,
  ownerCheck,
  techDocsCheck,
} from './checks/catalogChecks';
import { ciStatusCheck, vulnerabilityCheck } from './checks/githubChecks';
import { goldenPathCheck } from './checks/goldenPathCheck';
import {
  gitOpsDeploymentCheck,
  policyComplianceCheck,
} from './checks/kubernetesChecks';
import { GithubApiReader } from './clients/github';
import { KubernetesClusterReader } from './clients/kubernetes';
import { readinessEvaluatePermission } from './permissions';
import { createRouter } from './router';
import { ReadinessEvaluator } from './scoring';
import { ReadinessService } from './service';
import { ReadinessStore } from './store';

/**
 * Scores every catalog component on production readiness, using live signals
 * from the catalog, Kubernetes (Kyverno, Argo CD) and GitHub (CI, code scanning).
 *
 * @public
 */
export const readinessPlugin = createBackendPlugin({
  pluginId: 'readiness',
  register(env) {
    env.registerInit({
      deps: {
        auth: coreServices.auth,
        config: coreServices.rootConfig,
        database: coreServices.database,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        permissions: coreServices.permissions,
        permissionsRegistry: coreServices.permissionsRegistry,
        scheduler: coreServices.scheduler,
        catalog: catalogServiceRef,
        actionsRegistry: actionsRegistryServiceRef,
      },
      async init(deps) {
        const { auth, config, logger, catalog } = deps;

        const k8s = new KubernetesClusterReader(
          config.getOptionalString('argocd.namespace') ?? 'argocd',
        );
        const github = new GithubApiReader(config);

        const evaluator = new ReadinessEvaluator(
          [
            ownerCheck(catalog, () => auth.getOwnServiceCredentials()),
            techDocsCheck,
            dashboardCheck,
            policyComplianceCheck(k8s),
            gitOpsDeploymentCheck(k8s),
            ciStatusCheck(github),
            vulnerabilityCheck(github),
            goldenPathCheck(catalog, () => auth.getOwnServiceCredentials()),
          ],
          logger,
        );

        const readiness = new ReadinessService({
          evaluator,
          store: await ReadinessStore.create(deps.database),
          catalog,
          auth,
          logger,
        });

        deps.permissionsRegistry.addPermissions([readinessEvaluatePermission]);
        registerReadinessActions(deps.actionsRegistry, readiness);

        const schedule = config.has('readiness.schedule')
          ? readSchedulerServiceTaskScheduleDefinitionFromConfig(
              config.getConfig('readiness.schedule'),
            )
          : {
              frequency: { minutes: 30 },
              timeout: { minutes: 10 },
              initialDelay: { seconds: 30 },
            };
        await deps.scheduler.scheduleTask({
          id: 'readiness-refresh',
          ...schedule,
          fn: () => readiness.refreshAll(),
        });

        deps.httpRouter.use(
          await createRouter({
            httpAuth: deps.httpAuth,
            permissions: deps.permissions,
            readiness,
          }),
        );
      },
    });
  },
});
