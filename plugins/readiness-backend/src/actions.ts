import { NotFoundError } from '@backstage/errors';
import { parseEntityRef } from '@backstage/catalog-model';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { ReadinessService } from './service';

export function registerReadinessActions(
  actionsRegistry: ActionsRegistryService,
  readiness: ReadinessService,
) {
  actionsRegistry.register({
    name: 'get-readiness-score',
    title: 'Get Production Readiness Score',
    description: `
Returns the production readiness score (0-100, graded A-F) of a service in the
software catalog, with every check result: ownership, documentation, monitoring,
Kyverno policy compliance, Argo CD deployment health, CI status and open
vulnerabilities. Failing checks include a remediation hint. Use this to answer
"is this service ready for production?" or "why is this service unhealthy?".
`,
    attributes: { readOnly: true, destructive: false, idempotent: true },
    schema: {
      input: z =>
        z.object({
          entityRef: z
            .string()
            .describe(
              'Entity reference such as "component:default/orders-api" or just "orders-api"',
            ),
        }),
      output: z =>
        z.object({
          entityRef: z.string(),
          score: z.number().nullable(),
          grade: z.string().nullable(),
          evaluatedAt: z.string().nullable(),
          checks: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              status: z.string(),
              message: z.string(),
              remediation: z.string().optional(),
              link: z.string().optional(),
            }),
          ),
        }),
    },
    action: async ({ input, credentials }) => {
      const ref = parseEntityRef(input.entityRef, {
        defaultKind: 'component',
        defaultNamespace: 'default',
      });
      // Resolved with the caller's credentials, so the catalog's permission
      // rules decide whether the caller may see this entity at all.
      const entity = await readiness.getEntity(ref, credentials);
      if (!entity) {
        throw new NotFoundError(`No entity ${input.entityRef}`);
      }

      const { latest } = await readiness.latest(entity);
      const evaluation = latest ?? (await readiness.evaluate(entity));
      return {
        output: {
          entityRef: evaluation.entityRef,
          score: evaluation.score,
          grade: evaluation.grade,
          evaluatedAt: evaluation.evaluatedAt,
          checks: evaluation.checks.map(c => ({
            id: c.id,
            title: c.title,
            status: c.status,
            message: c.message,
            remediation: c.remediation,
            link: c.link,
          })),
        },
      };
    },
  });
}
