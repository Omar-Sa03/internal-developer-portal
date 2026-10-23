import { mockServices } from '@backstage/backend-test-utils';
import { MiddlewareFactory } from '@backstage/backend-defaults/rootHttpRouter';
import { Entity } from '@backstage/catalog-model';
import { catalogServiceMock } from '@backstage/plugin-catalog-node/testUtils';
import express from 'express';
import request from 'supertest';
import { PreviewApplication, PreviewSource } from './previews';
import { createRouter } from './router';

const withKubernetes: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'orders-api',
    namespace: 'default',
    annotations: { 'backstage.io/kubernetes-id': 'orders-api' },
  },
};

const withoutKubernetes: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'docs-site', namespace: 'default' },
};

const app = (pr: number, health = 'Healthy'): PreviewApplication => ({
  metadata: {
    name: `orders-api-pr-${pr}`,
    creationTimestamp: '2026-10-23T08:00:00Z',
    labels: {
      'idp.io/preview-of': 'orders-api',
      'idp.io/pr-number': String(pr),
    },
    annotations: {
      'idp.io/preview-url': `http://orders-api-pr-${pr}.localtest.me:8080`,
      'idp.io/pull-request-url': `https://github.com/acme/orders-api/pull/${pr}`,
      'idp.io/branch': `feature-${pr}`,
    },
  },
  spec: { destination: { namespace: `pr-${pr}-orders-api` } },
  status: {
    health: { status: health },
    sync: { status: 'Synced', revision: 'abc123' },
  },
});

describe('previews router', () => {
  async function createApp(previews: PreviewSource) {
    const router = await createRouter({
      httpAuth: mockServices.httpAuth(),
      catalog: catalogServiceMock({
        entities: [withKubernetes, withoutKubernetes],
      }),
      previews,
    });
    const middleware = MiddlewareFactory.create({
      logger: mockServices.logger.mock(),
      config: mockServices.rootConfig(),
    });
    return express().use(router).use(middleware.error());
  }

  it('lists previews newest pull request first', async () => {
    const list = jest.fn(async () => [app(3), app(7, 'Progressing')]);
    const server = await createApp({ list });

    const res = await request(server).get(
      '/entities/component/default/orders-api',
    );

    expect(res.status).toBe(200);
    expect(list).toHaveBeenCalledWith('orders-api');
    expect(res.body.items).toEqual([
      expect.objectContaining({
        pullRequest: 7,
        health: 'Progressing',
        url: 'http://orders-api-pr-7.localtest.me:8080',
      }),
      expect.objectContaining({
        pullRequest: 3,
        branch: 'feature-3',
        namespace: 'pr-3-orders-api',
        revision: 'abc123',
        sync: 'Synced',
        pullRequestUrl: 'https://github.com/acme/orders-api/pull/3',
      }),
    ]);
  });

  it('returns nothing for entities that are not deployed to Kubernetes', async () => {
    const list = jest.fn();
    const server = await createApp({ list });

    const res = await request(server).get(
      '/entities/component/default/docs-site',
    );

    expect(res.body).toEqual({ items: [] });
    expect(list).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown entities', async () => {
    const server = await createApp({ list: jest.fn() });
    const res = await request(server).get('/entities/component/default/nope');
    expect(res.status).toBe(404);
  });
});
