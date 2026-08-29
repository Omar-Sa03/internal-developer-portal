import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';


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
      }) as any,
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

      await new Promise<void>((resolve, reject) => {
        const child = require('child_process').spawn('kubectl', ['apply', '-f', '-']);
        child.on('close', (code: number) => {
          if (code === 0) resolve();
          else reject(new Error(`kubectl exited with code ${code}`));
        });
        child.stdin.write(manifest);
        child.stdin.end();
      });

      ctx.output('applicationName', name);
      ctx.output(
        'applicationNamespace',
        namespace,
      );
    },
  });