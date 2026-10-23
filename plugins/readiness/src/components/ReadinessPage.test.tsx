import {
  renderInTestApp,
  TestApiProvider,
} from '@backstage/frontend-test-utils';
import { entityRouteRef } from '@backstage/plugin-catalog-react';
import { screen } from '@testing-library/react';
import { readinessApiRef, ScoreSummary } from '../api';
import { ReadinessPage } from './ReadinessPage';

const summary = (name: string, score: number, grade: ScoreSummary['grade']) =>
  ({
    entityRef: `component:default/${name}`,
    title: name,
    owner: 'group:default/backend-team',
    lifecycle: 'production',
    score,
    grade,
    evaluatedAt: '2026-10-23T08:00:00.000Z',
    checks: [
      {
        id: 'ci-status',
        title: 'Default branch CI is green',
        category: 'delivery',
        weight: 2,
        status: score < 50 ? 'fail' : 'pass',
        message: '',
      },
    ],
  } as ScoreSummary);

describe('ReadinessPage', () => {
  it('lists services with their average and what needs attention', async () => {
    await renderInTestApp(
      <TestApiProvider
        apis={[
          [
            readinessApiRef,
            {
              listScores: async () => [
                summary('orders-api', 95, 'A'),
                summary('payments-api', 35, 'F'),
              ],
            },
          ],
        ]}
      >
        <ReadinessPage />
      </TestApiProvider>,
      { mountedRoutes: { '/catalog/:namespace/:kind/:name': entityRouteRef } },
    );

    expect(
      await screen.findByText('2 services, average score 65'),
    ).toBeInTheDocument();
    expect(screen.getByText('payments-api')).toBeInTheDocument();
    expect(screen.getByText('Default branch CI is green')).toBeInTheDocument();
    expect(screen.getByText('Nothing to fix')).toBeInTheDocument();
  });
});
