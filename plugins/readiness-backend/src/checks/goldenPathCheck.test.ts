import { mockCredentials } from '@backstage/backend-test-utils';
import { Entity } from '@backstage/catalog-model';
import { catalogServiceMock } from '@backstage/plugin-catalog-node/testUtils';
import { goldenPathCheck } from './goldenPathCheck';

const template = (version?: string): Entity => ({
  apiVersion: 'scaffolder.backstage.io/v1beta3',
  kind: 'Template',
  metadata: {
    name: 'python-fastapi-service',
    namespace: 'default',
    annotations: {
      ...(version ? { 'idp.io/template-version': version } : {}),
      'idp.io/upgrade-template':
        'template:default/upgrade-python-fastapi-service',
    },
  },
  spec: {},
});

const service = (version?: string): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'orders-api',
    annotations: {
      'idp.io/template': 'python-fastapi-service',
      ...(version ? { 'idp.io/template-version': version } : {}),
    },
  },
});

const check = (templateVersion?: string) =>
  goldenPathCheck(
    catalogServiceMock({ entities: [template(templateVersion)] }),
    async () => mockCredentials.service(),
  );

describe('goldenPathCheck', () => {
  it('skips services that were not scaffolded', async () => {
    const outcome = await check('2.0.0').run({
      ...service(),
      metadata: { name: 'legacy' },
    });
    expect(outcome.status).toBe('skip');
  });

  it('passes when on the latest version', async () => {
    expect((await check('2.0.0').run(service('2.0.0'))).status).toBe('pass');
  });

  it('warns on minor drift and links to the upgrade template', async () => {
    expect(await check('2.1.0').run(service('2.0.0'))).toMatchObject({
      status: 'warn',
      message: 'Generated from python-fastapi-service 2.0.0, latest is 2.1.0',
      link: '/create/templates/default/upgrade-python-fastapi-service',
    });
  });

  it('fails when a major version behind', async () => {
    expect((await check('2.0.0').run(service('1.1.0'))).status).toBe('fail');
  });

  it('fails when the service does not record a version', async () => {
    expect((await check('2.0.0').run(service())).status).toBe('fail');
  });

  it('warns when the template has no version', async () => {
    expect((await check().run(service('1.0.0'))).status).toBe('warn');
  });
});
