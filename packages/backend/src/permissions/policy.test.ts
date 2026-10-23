import { mockCredentials } from '@backstage/backend-test-utils';
import {
  catalogEntityDeletePermission,
  catalogEntityReadPermission,
  catalogLocationDeletePermission,
} from '@backstage/plugin-catalog-common/alpha';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import {
  taskCancelPermission,
  taskCreatePermission,
} from '@backstage/plugin-scaffolder-common/alpha';
import { PolicyQueryUser } from '@backstage/plugin-permission-node';
import { IdpPermissionPolicy } from './policy';

const identity = (
  userEntityRef: string,
  groups: string[] = [],
): PolicyQueryUser => ({
  credentials: mockCredentials.user(userEntityRef),
  info: {
    userEntityRef,
    ownershipEntityRefs: [userEntityRef, ...groups],
  },
});

describe('IdpPermissionPolicy', () => {
  const policy = new IdpPermissionPolicy({
    adminRefs: ['group:default/platform-team'],
    readOnlyRefs: ['user:development/guest'],
  });

  const admin = identity('user:default/alice', ['group:default/platform-team']);
  const developer = identity('user:default/bob', [
    'group:default/backend-team',
  ]);
  const guest = identity('user:development/guest');

  it('allows admins to do anything', async () => {
    const decision = await policy.handle(
      { permission: catalogLocationDeletePermission },
      admin,
    );
    expect(decision).toEqual({ result: AuthorizeResult.ALLOW });
  });

  it('gives guests read-only access', async () => {
    await expect(
      policy.handle({ permission: catalogEntityReadPermission }, guest),
    ).resolves.toEqual({ result: AuthorizeResult.ALLOW });
    await expect(
      policy.handle({ permission: taskCreatePermission }, guest),
    ).resolves.toEqual({ result: AuthorizeResult.DENY });
  });

  it('treats unauthenticated requests as read-only', async () => {
    await expect(
      policy.handle({ permission: taskCreatePermission }),
    ).resolves.toEqual({ result: AuthorizeResult.DENY });
  });

  it('lets developers scaffold services', async () => {
    await expect(
      policy.handle({ permission: taskCreatePermission }, developer),
    ).resolves.toEqual({ result: AuthorizeResult.ALLOW });
  });

  it('only lets developers delete entities their team owns', async () => {
    const decision = await policy.handle(
      { permission: catalogEntityDeletePermission },
      developer,
    );
    expect(decision).toMatchObject({
      result: AuthorizeResult.CONDITIONAL,
      conditions: {
        rule: 'IS_ENTITY_OWNER',
        params: {
          claims: ['user:default/bob', 'group:default/backend-team'],
        },
      },
    });
  });

  it('only lets developers cancel their own scaffolder tasks', async () => {
    const decision = await policy.handle(
      { permission: taskCancelPermission },
      developer,
    );
    expect(decision).toMatchObject({
      result: AuthorizeResult.CONDITIONAL,
      conditions: { params: { createdBy: ['user:default/bob'] } },
    });
  });

  it('reserves location removal for admins', async () => {
    await expect(
      policy.handle({ permission: catalogLocationDeletePermission }, developer),
    ).resolves.toEqual({ result: AuthorizeResult.DENY });
  });
});
