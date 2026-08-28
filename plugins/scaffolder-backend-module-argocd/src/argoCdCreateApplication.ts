import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const argoCdCreateApplication = () =>
  createTemplateAction({
    id: 'argoCd:createApplication',

    description:
      'Creates an Argo CD Application for a generated service.',

    schema: {
      input: z.object({
        name: z.string(),
        repoUrl: z.string().url(),
        path: z.string().default('helm/service'),
        namespace: z.string(),
      }),
    },

    async handler(ctx) {
      const { name, repoUrl, path, namespace } = ctx.input;

      const manifest = `
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ${name}
  namespace: argocd
spec:
  project: default

  source:
    repoURL: ${repoUrl}
    targetRevision: main
    path: ${path}

  destination:
    server: https://kubernetes.default.svc
    namespace: ${namespace}

  syncPolicy:
    automated:
      prune: true
      selfHeal: true

    syncOptions:
      - CreateNamespace=true
`;

      ctx.logger.info(
        `Creating Argo CD Application '${name}'`,
      );

      await execFileAsync(
        'kubectl',
        ['apply', '-f', '-'],
        {
          input: manifest,
        },
      );

      ctx.output('applicationName', name);
      ctx.output(
        'applicationNamespace',
        namespace,
      );
    },
  });