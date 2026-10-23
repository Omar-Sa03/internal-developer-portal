import {
  HttpAuthService,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import { NotAllowedError, NotFoundError } from '@backstage/errors';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import express from 'express';
import Router from 'express-promise-router';
import { readinessEvaluatePermission } from './permissions';
import { ReadinessService } from './service';

export async function createRouter({
  httpAuth,
  permissions,
  readiness,
}: {
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
  readiness: ReadinessService;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  const entityPath = '/entities/:kind/:namespace/:name';

  async function resolveEntity(req: express.Request) {
    const credentials = await httpAuth.credentials(req);
    const { kind, namespace, name } = req.params;
    const entity = await readiness.getEntity(
      { kind, namespace, name },
      credentials,
    );
    if (!entity) {
      throw new NotFoundError(`No entity ${kind}:${namespace}/${name}`);
    }
    return { entity, credentials };
  }

  router.get('/scores', async (req, res) => {
    const credentials = await httpAuth.credentials(req);
    res.json({ items: await readiness.summary(credentials) });
  });

  router.get(entityPath, async (req, res) => {
    const { entity } = await resolveEntity(req);
    res.json(await readiness.latest(entity));
  });

  router.post(`${entityPath}/evaluate`, async (req, res) => {
    const { entity, credentials } = await resolveEntity(req);
    const [decision] = await permissions.authorize(
      [{ permission: readinessEvaluatePermission }],
      { credentials },
    );
    if (decision.result !== AuthorizeResult.ALLOW) {
      throw new NotAllowedError('Not allowed to trigger an evaluation');
    }
    res.json(await readiness.evaluate(entity));
  });

  return router;
}
