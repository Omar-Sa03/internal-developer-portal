import { mockServices } from '@backstage/backend-test-utils';
import { PassThrough } from 'stream';
import { argoCdCreateApplication } from './argoCdCreateApplication';
import { ArgoCdClient, buildApplicationManifest } from './argoCdClient';

describe('argoCd:createApplication', () => {
  const applyApplication = jest.fn();
  const client: ArgoCdClient = { applyApplication };

  const action = argoCdCreateApplication({
    getClient: () => client,
    argoNamespace: 'argocd',
    destinationServer: 'https://kubernetes.default.svc',
    project: 'idp-services',
    reservedNamespaces: ['argocd'],
  });

  const createContext = (input: Record<string, unknown>, extra = {}) => ({
    input,
    output: jest.fn(),
    logger: mockServices.logger.mock(),
    logStream: new PassThrough(),
    workspacePath: '/tmp',
    createTemporaryDirectory: jest.fn(),
    checkpoint: jest.fn(({ fn }) => fn()),
    getInitiatorCredentials: jest.fn(),
    templateInfo: { entityRef: 'template:default/python-fastapi-service' },
    ...extra,
  });

  beforeEach(() => jest.resetAllMocks());

  it('applies an Application with the expected spec', async () => {
    applyApplication.mockResolvedValue('created');
    const ctx = createContext({
      name: 'orders-api',
      repoUrl: 'https://github.com/acme/orders-api',
      namespace: 'orders-api',
    });

    await action.handler(ctx as any);

    expect(applyApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'orders-api',
        argoNamespace: 'argocd',
        path: 'helm/service',
        targetRevision: 'main',
        project: 'idp-services',
        destinationNamespace: 'orders-api',
        labels: expect.objectContaining({
          'backstage.io/kubernetes-id': 'orders-api',
        }),
        annotations: {
          'backstage.io/source-template':
            'template:default/python-fastapi-service',
        },
      }),
    );
    expect(ctx.output).toHaveBeenCalledWith('operation', 'created');
    expect(ctx.output).toHaveBeenCalledWith('applicationName', 'orders-api');
  });

  it('does not touch the cluster on dry run', async () => {
    const ctx = createContext(
      {
        name: 'orders-api',
        repoUrl: 'https://github.com/acme/orders-api',
        namespace: 'orders-api',
      },
      { isDryRun: true },
    );

    await action.handler(ctx as any);

    expect(applyApplication).not.toHaveBeenCalled();
    expect(ctx.output).toHaveBeenCalledWith('operation', 'dry-run');
  });

  it.each(['argocd', 'kube-system'])(
    'refuses to deploy into the reserved namespace %s',
    async namespace => {
      const ctx = createContext({
        name: 'orders-api',
        repoUrl: 'https://github.com/acme/orders-api',
        namespace,
      });

      await expect(action.handler(ctx as any)).rejects.toThrow(/reserved/);
      expect(applyApplication).not.toHaveBeenCalled();
    },
  );

  it('propagates cluster errors', async () => {
    applyApplication.mockRejectedValue(new Error('forbidden'));
    const ctx = createContext({
      name: 'orders-api',
      repoUrl: 'https://github.com/acme/orders-api',
      namespace: 'orders-api',
    });

    await expect(action.handler(ctx as any)).rejects.toThrow('forbidden');
  });
});

describe('buildApplicationManifest', () => {
  it('keeps user input as data rather than templated YAML', () => {
    const manifest = buildApplicationManifest({
      name: 'svc',
      argoNamespace: 'argocd',
      project: 'default',
      repoUrl: 'https://github.com/acme/svc\n  injected: true',
      path: 'helm/service',
      targetRevision: 'main',
      destinationServer: 'https://kubernetes.default.svc',
      destinationNamespace: 'svc',
    });

    expect(manifest.spec.source.repoURL).toBe(
      'https://github.com/acme/svc\n  injected: true',
    );
    expect(manifest.spec).not.toHaveProperty('injected');
    expect(manifest.metadata.finalizers).toContain(
      'resources-finalizer.argocd.argoproj.io',
    );
  });
});
