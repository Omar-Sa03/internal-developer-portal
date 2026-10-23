import { HttpAuthService } from '@backstage/backend-plugin-api';
import { NotFoundError } from '@backstage/errors';
import { CatalogService } from '@backstage/plugin-catalog-node';
import express from 'express';
import Router from 'express-promise-router';
import { PreviewSource, toPreview } from './previews';

const KUBERNETES_ID_ANNOTATION = 'backstage.io/kubernetes-id';

export async function createRouter({
  httpAuth,
  catalog,
  previews,
}: {
  httpAuth: HttpAuthService;
  catalog: CatalogService;
  previews: PreviewSource;
}): Promise<express.Router> {
  const router = Router();

  router.get('/entities/:kind/:namespace/:name', async (req, res) => {
    const { kind, namespace, name } = req.params;
    // Resolved as the caller, so catalog permissions decide visibility.
    const entity = await catalog.getEntityByRef(
      { kind, namespace, name },
      { credentials: await httpAuth.credentials(req) },
    );
    if (!entity) {
      throw new NotFoundError(`No entity ${kind}:${namespace}/${name}`);
    }

    const kubernetesId =
      entity.metadata.annotations?.[KUBERNETES_ID_ANNOTATION];
    if (!kubernetesId) {
      res.json({ items: [] });
      return;
    }

    const apps = await previews.list(kubernetesId);
    const items = apps
      .map(toPreview)
      .sort((a, b) => (b.pullRequest ?? 0) - (a.pullRequest ?? 0));
    res.json({ items });
  });

  return router;
}
