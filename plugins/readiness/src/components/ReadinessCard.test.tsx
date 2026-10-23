import { Entity } from '@backstage/catalog-model';
import {
  renderInTestApp,
  TestApiProvider,
} from '@backstage/frontend-test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { EntityReadiness, ReadinessApi, readinessApiRef } from '../api';
import { ReadinessCard } from './ReadinessCard';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'orders-api', namespace: 'default' },
};

const evaluation: EntityReadiness = {
  entityRef: 'component:default/orders-api',
  score: 62,
  grade: 'C',
  evaluatedAt: '2026-10-23T08:00:00.000Z',
  checks: [
    {
      id: 'owner',
      title: 'Owned by a team',
      category: 'ownership',
      weight: 2,
      status: 'pass',
      message: 'Owned by group:default/backend-team',
    },
    {
      id: 'policy-compliance',
      title: 'Complies with cluster policies',
      category: 'security',
      weight: 3,
      status: 'fail',
      message: '1 policy rule(s) violated: require-non-root/check-containers',
      remediation: 'Fix the Helm chart',
    },
  ],
};

function renderCard(api: Partial<ReadinessApi>) {
  return renderInTestApp(
    <TestApiProvider apis={[[readinessApiRef, api]]}>
      <EntityProvider entity={entity}>
        <ReadinessCard />
      </EntityProvider>
    </TestApiProvider>,
  );
}

describe('ReadinessCard', () => {
  it('shows the grade and puts failing checks first with their fix', async () => {
    await renderCard({
      getEntityReadiness: jest.fn().mockResolvedValue({
        latest: evaluation,
        history: [],
      }),
    });

    expect(await screen.findByText('Grade C')).toBeInTheDocument();
    const titles = screen
      .getAllByText(/Owned by a team|Complies with cluster policies/)
      .map(el => el.textContent);
    expect(titles).toEqual([
      'Complies with cluster policies',
      'Owned by a team',
    ]);
    expect(screen.getByText(/Fix the Helm chart/)).toBeInTheDocument();
  });

  it('offers an evaluation when the service has no score yet', async () => {
    const getEntityReadiness = jest
      .fn()
      .mockResolvedValueOnce({ history: [] })
      .mockResolvedValue({ latest: evaluation, history: [] });
    const evaluateEntity = jest.fn().mockResolvedValue(evaluation);

    await renderCard({ getEntityReadiness, evaluateEntity });

    fireEvent.click(await screen.findByText('Evaluate now'));

    await waitFor(() =>
      expect(evaluateEntity).toHaveBeenCalledWith({
        kind: 'Component',
        namespace: 'default',
        name: 'orders-api',
      }),
    );
    expect(await screen.findByText('Grade C')).toBeInTheDocument();
  });
});
