import { createPermission } from '@backstage/plugin-permission-common';

/**
 * Triggering an on-demand evaluation calls the cluster and GitHub, so it is
 * an 'update' action: read-only users (guests) are denied by the portal policy.
 */
export const readinessEvaluatePermission = createPermission({
  name: 'readiness.evaluate',
  attributes: { action: 'update' },
});
