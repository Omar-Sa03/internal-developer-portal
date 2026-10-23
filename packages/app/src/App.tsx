import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import grafanaPlugin from '@backstage-community/plugin-grafana/alpha';
import { navModule } from './modules/nav';
import { homeModule } from './modules/home';
import { signInModule } from './modules/signIn';

export default createApp({
  features: [catalogPlugin, grafanaPlugin, navModule, homeModule, signInModule],
});
