import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import { actionsRegistryServiceMock } from '@backstage/backend-test-utils/alpha';
import { Entity } from '@backstage/catalog-model';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { catalogServiceMock } from '@backstage/plugin-catalog-node/testUtils';
import request from 'supertest';
import { readinessPlugin } from './plugin';

const component: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'orders-api', namespace: 'default' },
  spec: { owner: 'group:default/backend-team', type: 'service' },
};

const backends: Array<{ stop(): Promise<void> }> = [];

async function startBackend(
  permissionResult: AuthorizeResult.ALLOW | AuthorizeResult.DENY,
) {
  const backend = await startTestBackend({
    features: [
      readinessPlugin,
      catalogServiceMock.factory({ entities: [component] }),
      actionsRegistryServiceMock.factory(),
      mockServices.permissions.factory({ result: permissionResult }),
    ],
  });
  backends.push(backend);
  return backend.server;
}

describe('readinessPlugin', () => {
  afterEach(async () => {
    await Promise.all(backends.splice(0).map(b => b.stop()));
  });

  it('lists no scores before the first evaluation', async () => {
    const server = await startBackend(AuthorizeResult.ALLOW);
    const res = await request(server).get('/api/readiness/scores');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  it('returns 404 for entities the caller cannot see', async () => {
    const server = await startBackend(AuthorizeResult.ALLOW);
    const res = await request(server).get(
      '/api/readiness/entities/component/default/missing',
    );
    expect(res.status).toBe(404);
  });

  it('returns an empty result for an entity that was never evaluated', async () => {
    const server = await startBackend(AuthorizeResult.ALLOW);
    const res = await request(server).get(
      '/api/readiness/entities/component/default/orders-api',
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ history: [] });
  });

  it('denies on-demand evaluation without permission', async () => {
    const server = await startBackend(AuthorizeResult.DENY);
    const res = await request(server).post(
      '/api/readiness/entities/component/default/orders-api/evaluate',
    );
    expect(res.status).toBe(403);
  });
});
