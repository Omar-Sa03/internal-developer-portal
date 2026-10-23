import { BackstageCredentials } from '@backstage/backend-plugin-api';
import { parseEntityRef } from '@backstage/catalog-model';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { ReadinessCheck } from '../types';

export const TECHDOCS_ANNOTATION = 'backstage.io/techdocs-ref';
export const GRAFANA_ANNOTATION = 'grafana/dashboard-selector';

export function ownerCheck(
  catalog: CatalogService,
  getCredentials: () => Promise<BackstageCredentials>,
): ReadinessCheck {
  return {
    id: 'owner',
    title: 'Owned by a team',
    category: 'ownership',
    weight: 2,
    async run(entity) {
      const owner = entity.spec?.owner;
      if (typeof owner !== 'string' || !owner) {
        return {
          status: 'fail',
          message: 'No owner is set',
          remediation: 'Set spec.owner in catalog-info.yaml to a team group.',
        };
      }

      const ref = parseEntityRef(owner, { defaultKind: 'group' });
      if (ref.kind.toLocaleLowerCase() !== 'group') {
        return {
          status: 'warn',
          message: `Owned by an individual (${owner})`,
          remediation:
            'Services should be owned by a team so on-call does not depend on one person.',
        };
      }

      const group = await catalog.getEntityByRef(ref, {
        credentials: await getCredentials(),
      });
      return group
        ? { status: 'pass', message: `Owned by ${owner}` }
        : {
            status: 'fail',
            message: `Owner ${owner} does not exist in the catalog`,
            remediation:
              'Point spec.owner at an existing GitHub team synced into the catalog.',
          };
    },
  };
}

export const techDocsCheck: ReadinessCheck = {
  id: 'techdocs',
  title: 'Has documentation',
  category: 'ownership',
  weight: 1,
  async run(entity) {
    return entity.metadata.annotations?.[TECHDOCS_ANNOTATION]
      ? { status: 'pass', message: 'TechDocs are configured' }
      : {
          status: 'warn',
          message: 'No TechDocs configured',
          remediation: `Add an mkdocs.yml and the "${TECHDOCS_ANNOTATION}: dir:." annotation.`,
        };
  },
};

export const dashboardCheck: ReadinessCheck = {
  id: 'dashboard',
  title: 'Has a monitoring dashboard',
  category: 'reliability',
  weight: 1,
  async run(entity) {
    return entity.metadata.annotations?.[GRAFANA_ANNOTATION]
      ? { status: 'pass', message: 'Grafana dashboards are linked' }
      : {
          status: 'warn',
          message: 'No Grafana dashboard linked',
          remediation: `Add the "${GRAFANA_ANNOTATION}" annotation so on-call can find metrics.`,
        };
  },
};
