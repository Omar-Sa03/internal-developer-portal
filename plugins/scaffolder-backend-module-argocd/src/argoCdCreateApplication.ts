import { InputError } from '@backstage/errors';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { ArgoCdApplicationSpec, ArgoCdClient } from './argoCdClient';

// RFC 1123 label: what Kubernetes accepts for names and namespaces.
const DNS_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export type ArgoCdActionOptions = {
  /** Resolved lazily so the backend can start without cluster credentials. */
  getClient: () => ArgoCdClient;
  argoNamespace: string;
  destinationServer: string;
  /** Argo CD AppProject that restricts which repos and namespaces apps may use. */
  project: string;
  /** Namespaces scaffolded services may never deploy into. */
  reservedNamespaces: string[];
};

export const argoCdCreateApplication = (options: ArgoCdActionOptions) =>
  createTemplateAction({
    id: 'argoCd:createApplication',
    description:
      'Creates or updates an Argo CD Application that continuously deploys the generated service.',
    supportsDryRun: true,
    examples: [
      {
        description: 'Deploy the Helm chart of a freshly published repository',
        example: [
          'steps:',
          '  - id: deploy',
          '    action: argoCd:createApplication',
          '    input:',
          '      name: orders-api',
          '      repoUrl: https://github.com/acme/orders-api',
          '      namespace: orders-api',
        ].join('\n'),
      },
    ],
    schema: {
      input: {
        name: z =>
          z
            .string()
            .max(63)
            .regex(DNS_LABEL, 'must be a valid Kubernetes name')
            .describe('Argo CD Application name'),
        repoUrl: z => z.string().url().describe('Git repository URL'),
        path: z =>
          z
            .string()
            .default('helm/service')
            .describe('Path to the Helm chart in the repository'),
        namespace: z =>
          z
            .string()
            .max(63)
            .regex(DNS_LABEL, 'must be a valid Kubernetes namespace')
            .describe('Namespace the service is deployed to'),
        targetRevision: z =>
          z.string().default('main').describe('Git revision to track'),
      },
      output: {
        applicationName: z => z.string(),
        applicationNamespace: z => z.string(),
        operation: z => z.enum(['created', 'updated', 'dry-run']),
      },
    },

    async handler(ctx) {
      const { name, repoUrl, namespace } = ctx.input;
      if (
        namespace.startsWith('kube-') ||
        options.reservedNamespaces.includes(namespace)
      ) {
        throw new InputError(
          `Namespace '${namespace}' is reserved for the platform`,
        );
      }

      const spec: ArgoCdApplicationSpec = {
        name,
        argoNamespace: options.argoNamespace,
        project: options.project,
        repoUrl,
        path: ctx.input.path ?? 'helm/service',
        targetRevision: ctx.input.targetRevision ?? 'main',
        destinationServer: options.destinationServer,
        destinationNamespace: namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'backstage',
          'backstage.io/kubernetes-id': name,
        },
        annotations: ctx.templateInfo?.entityRef
          ? { 'backstage.io/source-template': ctx.templateInfo.entityRef }
          : {},
      };

      ctx.output('applicationName', name);
      ctx.output('applicationNamespace', namespace);

      if (ctx.isDryRun) {
        ctx.logger.info(
          `Dry run: would apply Argo CD Application '${name}' in '${options.argoNamespace}'`,
        );
        ctx.output('operation', 'dry-run');
        return;
      }

      const operation = await ctx.checkpoint({
        key: `argocd-apply-${options.argoNamespace}-${name}`,
        fn: () => options.getClient().applyApplication(spec),
      });

      ctx.logger.info(`Argo CD Application '${name}' ${operation}`);
      ctx.output('operation', operation);
    },
  });
