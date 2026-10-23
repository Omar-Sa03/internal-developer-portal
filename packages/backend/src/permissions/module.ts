import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { IdpPermissionPolicy } from './policy';

export const permissionModuleIdpPolicy = createBackendModule({
  pluginId: 'permission',
  moduleId: 'idp-policy',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        policy: policyExtensionPoint,
      },
      async init({ config, policy }) {
        policy.setPolicy(
          new IdpPermissionPolicy({
            adminRefs: config.getOptionalStringArray(
              'permission.idp.adminRefs',
            ) ?? ['group:default/platform-team'],
            readOnlyRefs: config.getOptionalStringArray(
              'permission.idp.readOnlyRefs',
            ) ?? ['user:development/guest', 'user:default/guest'],
          }),
        );
      },
    });
  },
});
