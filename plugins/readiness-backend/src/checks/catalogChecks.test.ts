import { mockCredentials } from '@backstage/backend-test-utils';
import { Entity } from '@backstage/catalog-model';
import { catalogServiceMock } from '@backstage/plugin-catalog-node/testUtils';
import { dashboardCheck, ownerCheck, techDocsCheck } from './catalogChecks';

const component = (
  owner?: string,
  annotations: Record<string, string> = {},
): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'orders-api', annotations },
  spec: owner ? { owner } : {},
});

const team: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Group',
  metadata: { name: 'backend-team', namespace: 'default' },
  spec: { type: 'team', children: [] },
};

describe('ownerCheck', () => {
  const check = ownerCheck(catalogServiceMock({ entities: [team] }), async () =>
    mockCredentials.service(),
  );

  it('passes when owned by an existing group', async () => {
    expect(
      (await check.run(component('group:default/backend-team'))).status,
    ).toBe('pass');
  });

  it('treats a bare owner name as a group', async () => {
    expect((await check.run(component('backend-team'))).status).toBe('pass');
  });

  it('fails when the owning group does not exist', async () => {
    expect(
      (await check.run(component('group:default/ghost-team'))).status,
    ).toBe('fail');
  });

  it('warns when owned by a single user', async () => {
    expect((await check.run(component('user:default/alice'))).status).toBe(
      'warn',
    );
  });

  it('fails without an owner', async () => {
    expect((await check.run(component())).status).toBe('fail');
  });
});

describe('annotation checks', () => {
  it('detects TechDocs', async () => {
    expect(
      (
        await techDocsCheck.run(
          component('team', { 'backstage.io/techdocs-ref': 'dir:.' }),
        )
      ).status,
    ).toBe('pass');
    expect((await techDocsCheck.run(component('team'))).status).toBe('warn');
  });

  it('detects Grafana dashboards', async () => {
    expect(
      (
        await dashboardCheck.run(
          component('team', { 'grafana/dashboard-selector': 'tag:orders' }),
        )
      ).status,
    ).toBe('pass');
    expect((await dashboardCheck.run(component('team'))).status).toBe('warn');
  });
});
