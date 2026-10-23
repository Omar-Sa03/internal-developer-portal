import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import AssessmentIcon from '@material-ui/icons/Assessment';
import { ReadinessClient, readinessApiRef } from './api';
import { rootRouteRef } from './routes';

const readinessApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: readinessApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: deps => new ReadinessClient(deps),
    }),
});

const readinessPage = PageBlueprint.make({
  params: {
    path: '/readiness',
    title: 'Readiness',
    icon: <AssessmentIcon />,
    routeRef: rootRouteRef,
    loader: () =>
      import('./components/ReadinessPage').then(m => <m.ReadinessPage />),
  },
});

const readinessCard = EntityCardBlueprint.make({
  name: 'scorecard',
  params: {
    filter: 'kind:component',
    loader: () =>
      import('./components/ReadinessCard').then(m => <m.ReadinessCard />),
  },
});

export const readinessPlugin = createFrontendPlugin({
  pluginId: 'readiness',
  extensions: [readinessApi, readinessPage, readinessCard],
  routes: {
    root: rootRouteRef,
  },
});
