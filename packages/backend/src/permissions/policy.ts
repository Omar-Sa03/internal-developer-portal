import {
  catalogEntityDeletePermission,
  catalogLocationDeletePermission,
} from '@backstage/plugin-catalog-common/alpha';
import {
  catalogConditions,
  createCatalogConditionalDecision,
} from '@backstage/plugin-catalog-backend/alpha';
import {
  AuthorizeResult,
  isPermission,
  PolicyDecision,
} from '@backstage/plugin-permission-common';
import {
  PermissionPolicy,
  PolicyQuery,
  PolicyQueryUser,
} from '@backstage/plugin-permission-node';
import { taskCancelPermission } from '@backstage/plugin-scaffolder-common/alpha';
import {
  createScaffolderTaskConditionalDecision,
  scaffolderTaskConditions,
} from '@backstage/plugin-scaffolder-backend/alpha';

export type IdpPolicyOptions = {
  /** Members of these groups (or these users) may do anything. */
  adminRefs: string[];
  /** Identities that only get read access, e.g. the local guest user. */
  readOnlyRefs: string[];
};

/**
 * Role-based policy for the portal:
 *
 * - admins (platform team): everything
 * - read-only identities (guest): read only, cannot scaffold or change the catalog
 * - everyone else: full self-service, but can only delete catalog entities
 *   their team owns and only cancel scaffolder tasks they started
 */
export class IdpPermissionPolicy implements PermissionPolicy {
  private readonly adminRefs: Set<string>;
  private readonly readOnlyRefs: Set<string>;

  constructor(options: IdpPolicyOptions) {
    this.adminRefs = new Set(options.adminRefs.map(r => r.toLocaleLowerCase()));
    this.readOnlyRefs = new Set(
      options.readOnlyRefs.map(r => r.toLocaleLowerCase()),
    );
  }

  async handle(
    request: PolicyQuery,
    user?: PolicyQueryUser,
  ): Promise<PolicyDecision> {
    const { permission } = request;
    const userRef = user?.info.userEntityRef.toLocaleLowerCase();
    const ownershipRefs =
      user?.info.ownershipEntityRefs.map(r => r.toLocaleLowerCase()) ?? [];

    if (ownershipRefs.some(ref => this.adminRefs.has(ref))) {
      return { result: AuthorizeResult.ALLOW };
    }

    const isReadOnly = !userRef || this.readOnlyRefs.has(userRef);
    if (isReadOnly) {
      return {
        result:
          permission.attributes.action === 'read'
            ? AuthorizeResult.ALLOW
            : AuthorizeResult.DENY,
      };
    }

    if (isPermission(permission, catalogEntityDeletePermission)) {
      return createCatalogConditionalDecision(
        permission,
        catalogConditions.isEntityOwner({ claims: ownershipRefs }),
      );
    }

    if (isPermission(permission, catalogLocationDeletePermission)) {
      return { result: AuthorizeResult.DENY };
    }

    if (isPermission(permission, taskCancelPermission)) {
      return createScaffolderTaskConditionalDecision(
        permission,
        scaffolderTaskConditions.isTaskOwner({ createdBy: [userRef] }),
      );
    }

    return { result: AuthorizeResult.ALLOW };
  }
}
