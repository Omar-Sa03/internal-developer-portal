import { SignInPage } from '@backstage/core-components';
import {
  createFrontendModule,
  githubAuthApiRef,
} from '@backstage/frontend-plugin-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';

const signInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => props =>
      (
        <SignInPage
          {...props}
          title="Sign in to the Internal Developer Portal"
          align="center"
          providers={[
            {
              id: 'github-auth-provider',
              title: 'GitHub',
              message: 'Sign in with your GitHub organization account',
              apiRef: githubAuthApiRef,
            },
            // Read-only access for local exploration, see the permission policy.
            'guest',
          ]}
        />
      ),
  },
});

export const signInModule = createFrontendModule({
  pluginId: 'app',
  extensions: [signInPage],
});
