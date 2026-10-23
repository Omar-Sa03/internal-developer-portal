import { Entity } from '@backstage/catalog-model';
import {
  renderInTestApp,
  TestApiProvider,
} from '@backstage/frontend-test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { screen } from '@testing-library/react';
import { Preview, previewsApiRef } from '../api';
import { PreviewsContent } from './PreviewsContent';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'orders-api', namespace: 'default' },
};

const render = (items: Preview[]) =>
  renderInTestApp(
    <TestApiProvider
      apis={[[previewsApiRef, { listPreviews: async () => items }]]}
    >
      <EntityProvider entity={entity}>
        <PreviewsContent />
      </EntityProvider>
    </TestApiProvider>,
  );

describe('PreviewsContent', () => {
  it('lists previews with their environment link and health', async () => {
    await render([
      {
        name: 'orders-api-pr-7',
        pullRequest: 7,
        pullRequestUrl: 'https://github.com/acme/orders-api/pull/7',
        branch: 'feature-login',
        url: 'http://orders-api-pr-7.localtest.me:8080',
        revision: 'abcdef1234',
        health: 'Healthy',
        sync: 'Synced',
      },
    ]);

    expect(await screen.findByText('#7')).toBeInTheDocument();
    expect(screen.getByText('feature-login')).toBeInTheDocument();
    expect(
      screen.getByText('http://orders-api-pr-7.localtest.me:8080'),
    ).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('abcdef1')).toBeInTheDocument();
  });

  it('explains how to get a preview when there are none', async () => {
    await render([]);
    expect(await screen.findByText(/No active previews/)).toBeInTheDocument();
  });
});
