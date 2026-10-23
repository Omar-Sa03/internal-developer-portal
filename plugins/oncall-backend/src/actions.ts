import { BackstageCredentials } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { Entity, parseEntityRef } from '@backstage/catalog-model';
import { InputError, NotFoundError } from '@backstage/errors';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { AlertSource, ChangeSource, ClusterSource } from './sources';

const KUBERNETES_ID = 'backstage.io/kubernetes-id';
const KUBERNETES_NAMESPACE = 'backstage.io/kubernetes-namespace';
const KUBERNETES_SELECTOR = 'backstage.io/kubernetes-label-selector';
const GITHUB_SLUG = 'github.com/project-slug';
const DNS_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export type OncallSources = {
  catalog: CatalogService;
  cluster: ClusterSource;
  alerts: AlertSource;
  changes: ChangeSource;
};

const entityRefInput = (z: any) =>
  z.object({
    entityRef: z
      .string()
      .describe(
        'Service to inspect, e.g. "component:default/orders-api" or just "orders-api"',
      ),
  });

const readOnly = { readOnly: true, destructive: false, idempotent: true };

export function registerOncallActions(
  registry: ActionsRegistryService,
  { catalog, cluster, alerts, changes }: OncallSources,
) {
  /**
   * Resolved with the caller's credentials, so an agent can only investigate
   * services its user is allowed to see in the catalog.
   */
  async function resolve(entityRef: string, credentials: BackstageCredentials) {
    const ref = parseEntityRef(entityRef, {
      defaultKind: 'component',
      defaultNamespace: 'default',
    });
    const entity = await catalog.getEntityByRef(ref, { credentials });
    if (!entity) {
      throw new NotFoundError(`No entity ${entityRef}`);
    }
    return entity;
  }

  function kubernetesTarget(entity: Entity) {
    const annotations = entity.metadata.annotations ?? {};
    const id = annotations[KUBERNETES_ID];
    const namespace = annotations[KUBERNETES_NAMESPACE];
    if (!id || !namespace) {
      throw new InputError(
        `${entity.metadata.name} has no "${KUBERNETES_ID}" and "${KUBERNETES_NAMESPACE}" annotations`,
      );
    }
    if (!DNS_LABEL.test(namespace)) {
      throw new InputError(`Invalid namespace "${namespace}"`);
    }
    return {
      id,
      namespace,
      selector: annotations[KUBERNETES_SELECTOR] ?? `app=${id}`,
    };
  }

  registry.register({
    name: 'get-workload-status',
    title: 'Get Workload Status',
    description: `
Returns the live Kubernetes state of a service: every pod with phase, readiness,
restart count, waiting reason (e.g. CrashLoopBackOff, ImagePullBackOff) and last
termination reason (e.g. OOMKilled), plus the most recent Warning events in its
namespace. Start here when a service is reported as down or unhealthy.
`,
    attributes: readOnly,
    schema: {
      input: entityRefInput,
      output: z =>
        z.object({
          namespace: z.string(),
          pods: z.array(z.object({}).passthrough()),
          warningEvents: z.array(z.object({}).passthrough()),
        }),
    },
    action: async ({ input, credentials }) => {
      const target = kubernetesTarget(
        await resolve(input.entityRef, credentials),
      );
      const [pods, warningEvents] = await Promise.all([
        cluster.listPods(target.namespace, target.selector),
        cluster.listWarningEvents(target.namespace, 20),
      ]);
      return { output: { namespace: target.namespace, pods, warningEvents } };
    },
  });

  registry.register({
    name: 'get-deployment-status',
    title: 'Get Deployment Status',
    description: `
Returns how a service is deployed by Argo CD: health, sync state, the deployed Git
revision, the result of the last sync operation and the last three deployments.
Use it to find out whether a recent deployment correlates with an incident.
`,
    attributes: readOnly,
    schema: {
      input: entityRefInput,
      output: z =>
        z.object({
          deployed: z.boolean(),
          deployment: z.object({}).passthrough().optional(),
        }),
    },
    action: async ({ input, credentials }) => {
      const { id } = kubernetesTarget(
        await resolve(input.entityRef, credentials),
      );
      const deployment = await cluster.getDeployment(id);
      return {
        output: deployment
          ? { deployed: true, deployment }
          : { deployed: false },
      };
    },
  });

  registry.register({
    name: 'get-firing-alerts',
    title: 'Get Firing Alerts',
    description: `
Returns the Prometheus alerts currently firing for a service's namespace (from
Alertmanager, excluding silenced and inhibited alerts), with severity, summary and
start time.
`,
    attributes: readOnly,
    schema: {
      input: entityRefInput,
      output: z =>
        z.object({
          configured: z.boolean(),
          alerts: z.array(z.object({}).passthrough()),
        }),
    },
    action: async ({ input, credentials }) => {
      const { namespace } = kubernetesTarget(
        await resolve(input.entityRef, credentials),
      );
      const firing = await alerts.firingAlerts(namespace);
      return {
        output: { configured: firing !== undefined, alerts: firing ?? [] },
      };
    },
  });

  registry.register({
    name: 'get-recent-changes',
    title: 'Get Recent Changes',
    description: `
Returns the latest commits on a service's default branch (short SHA, first line of the
message, author, date, link). Combine with get-deployment-status to answer "what
changed right before this broke?".
`,
    attributes: readOnly,
    schema: {
      input: z =>
        entityRefInput(z).extend({
          limit: z
            .number()
            .int()
            .min(1)
            .max(30)
            .optional()
            .describe('Number of commits, default 10'),
        }),
      output: z => z.object({ commits: z.array(z.object({}).passthrough()) }),
    },
    action: async ({ input, credentials }) => {
      const entity = await resolve(input.entityRef, credentials);
      const slug = entity.metadata.annotations?.[GITHUB_SLUG];
      if (!slug) {
        throw new InputError(
          `${entity.metadata.name} has no "${GITHUB_SLUG}" annotation`,
        );
      }
      return {
        output: {
          commits: await changes.recentCommits(slug, input.limit ?? 10),
        },
      };
    },
  });
}
