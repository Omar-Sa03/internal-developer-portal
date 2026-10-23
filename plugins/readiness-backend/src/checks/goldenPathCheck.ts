import { BackstageCredentials } from '@backstage/backend-plugin-api';
import { parseEntityRef } from '@backstage/catalog-model';
import { CatalogService } from '@backstage/plugin-catalog-node';
import semver from 'semver';
import { ReadinessCheck } from '../types';

export const TEMPLATE_ANNOTATION = 'idp.io/template';
export const TEMPLATE_VERSION_ANNOTATION = 'idp.io/template-version';
export const UPGRADE_TEMPLATE_ANNOTATION = 'idp.io/upgrade-template';

export function goldenPathCheck(
  catalog: CatalogService,
  getCredentials: () => Promise<BackstageCredentials>,
): ReadinessCheck {
  return {
    id: 'golden-path',
    title: 'On the latest golden path',
    category: 'delivery',
    weight: 2,
    async run(entity) {
      const templateName = entity.metadata.annotations?.[TEMPLATE_ANNOTATION];
      if (!templateName) {
        return {
          status: 'skip',
          message: 'Not generated from a golden path template',
        };
      }

      const template = await catalog.getEntityByRef(
        { kind: 'template', namespace: 'default', name: templateName },
        { credentials: await getCredentials() },
      );
      const latest = semver.valid(
        template?.metadata.annotations?.[TEMPLATE_VERSION_ANNOTATION],
      );
      if (!template || !latest) {
        return {
          status: 'warn',
          message: `Template ${templateName} is missing or has no version`,
          remediation: `Make sure the template exists and sets the "${TEMPLATE_VERSION_ANNOTATION}" annotation.`,
        };
      }

      const current = semver.valid(
        entity.metadata.annotations?.[TEMPLATE_VERSION_ANNOTATION],
      );
      if (current && semver.gte(current, latest)) {
        return {
          status: 'pass',
          message: `Up to date with ${templateName} ${latest}`,
        };
      }

      const upgradeRef =
        template.metadata.annotations?.[UPGRADE_TEMPLATE_ANNOTATION];
      const link = upgradeRef
        ? (({ namespace, name }) => `/create/templates/${namespace}/${name}`)(
            parseEntityRef(upgradeRef, { defaultKind: 'template' }),
          )
        : undefined;
      // Major versions carry breaking platform changes; anything older is required.
      const required = !current || semver.major(current) < semver.major(latest);

      return {
        status: required ? 'fail' : 'warn',
        message: current
          ? `Generated from ${templateName} ${current}, latest is ${latest}`
          : `Unknown template version, latest is ${latest}`,
        remediation: upgradeRef
          ? 'Run the upgrade template to open a pull request with the latest platform files.'
          : 'Apply the changes from the template changelog.',
        link,
      };
    },
  };
}
