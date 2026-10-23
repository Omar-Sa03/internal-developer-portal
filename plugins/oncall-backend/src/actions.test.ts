import { mockCredentials, mockServices } from '@backstage/backend-test-utils';
import { MockActionsRegistry } from '@backstage/backend-test-utils/alpha';
import { Entity } from '@backstage/catalog-model';
import { catalogServiceMock } from '@backstage/plugin-catalog-node/testUtils';
import { registerOncallActions } from './actions';
import { AlertSource, ChangeSource, ClusterSource } from './sources';

const service: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'orders-api',
    namespace: 'default',
    annotations: {
      'backstage.io/kubernetes-id': 'orders-api',
      'backstage.io/kubernetes-namespace': 'orders-api',
      'github.com/project-slug': 'acme/orders-api',
    },
  },
};

const website: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'website', namespace: 'default' },
};

function setup(overrides: {
  cluster?: Partial<ClusterSource>;
  alerts?: Partial<AlertSource>;
  changes?: Partial<ChangeSource>;
}) {
  const registry = MockActionsRegistry.create({
    logger: mockServices.logger.mock(),
  });
  const cluster: ClusterSource = {
    listPods: jest.fn(async () => []),
    listWarningEvents: jest.fn(async () => []),
    getDeployment: jest.fn(async () => undefined),
    ...overrides.cluster,
  };
  const alerts: AlertSource = {
    firingAlerts: jest.fn(async () => undefined),
    ...overrides.alerts,
  };
  const changes: ChangeSource = {
    recentCommits: jest.fn(async () => []),
    ...overrides.changes,
  };
  registerOncallActions(registry, {
    catalog: catalogServiceMock({ entities: [service, website] }),
    cluster,
    alerts,
    changes,
  });
  const invoke = (id: string, input: Record<string, unknown>) =>
    registry.invoke({
      id: `test:${id}`,
      input: input as any,
      credentials: mockCredentials.user(),
    });
  return { invoke, cluster, alerts, changes, registry };
}

describe('on-call actions', () => {
  it('registers four read-only actions', async () => {
    const { registry } = setup({});
    const { actions } = await registry.list();
    expect(actions.map(a => a.name).sort()).toEqual([
      'get-deployment-status',
      'get-firing-alerts',
      'get-recent-changes',
      'get-workload-status',
    ]);
    expect(actions.every(a => a.attributes.readOnly)).toBe(true);
  });

  it('returns pods and warning events for the service namespace', async () => {
    const pod = {
      name: 'orders-api-7d9f',
      phase: 'Running',
      ready: false,
      restarts: 6,
      waitingReason: 'CrashLoopBackOff',
      lastTerminationReason: 'OOMKilled',
    };
    const event = {
      reason: 'BackOff',
      message: 'Back-off restarting failed container',
      object: 'Pod/orders-api-7d9f',
      count: 6,
    };
    const { invoke, cluster } = setup({
      cluster: {
        listPods: jest.fn(async () => [pod]),
        listWarningEvents: jest.fn(async () => [event]),
      },
    });

    const { output } = await invoke('get-workload-status', {
      entityRef: 'orders-api',
    });

    expect(cluster.listPods).toHaveBeenCalledWith(
      'orders-api',
      'app=orders-api',
    );
    expect(output).toEqual({
      namespace: 'orders-api',
      pods: [pod],
      warningEvents: [event],
    });
  });

  it('reports when a service is not deployed by Argo CD', async () => {
    const { invoke } = setup({});
    const { output } = await invoke('get-deployment-status', {
      entityRef: 'component:default/orders-api',
    });
    expect(output).toEqual({ deployed: false });
  });

  it('says whether alerting is configured', async () => {
    const { invoke } = setup({});
    await expect(
      invoke('get-firing-alerts', { entityRef: 'orders-api' }),
    ).resolves.toEqual({ output: { configured: false, alerts: [] } });
  });

  it('returns recent commits with a default limit', async () => {
    const recentCommits = jest.fn(async () => [
      { sha: 'abc1234', message: 'feat: cache', url: 'u' },
    ]);
    const { invoke } = setup({ changes: { recentCommits } });

    const { output } = await invoke('get-recent-changes', {
      entityRef: 'orders-api',
    });

    expect(recentCommits).toHaveBeenCalledWith('acme/orders-api', 10);
    expect(output).toEqual({
      commits: [{ sha: 'abc1234', message: 'feat: cache', url: 'u' }],
    });
  });

  it('refuses services the caller cannot see', async () => {
    const { invoke } = setup({});
    await expect(
      invoke('get-workload-status', { entityRef: 'payments-api' }),
    ).rejects.toThrow(/No entity payments-api/);
  });

  it('explains when a service is not deployed to Kubernetes', async () => {
    const { invoke } = setup({});
    await expect(
      invoke('get-workload-status', { entityRef: 'website' }),
    ).rejects.toThrow(/backstage.io\/kubernetes-id/);
  });
});
