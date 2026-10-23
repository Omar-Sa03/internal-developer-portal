import { getCompoundEntityRef } from '@backstage/catalog-model';
import {
  Content,
  Link,
  ResponseErrorPanel,
  StatusError,
  StatusOK,
  StatusPending,
  StatusWarning,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { useApi } from '@backstage/frontend-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import Typography from '@material-ui/core/Typography';
import useAsyncRetry from 'react-use/esm/useAsyncRetry';
import useInterval from 'react-use/esm/useInterval';
import { Preview, previewsApiRef } from '../api';

const REFRESH_MS = 15_000;

function Health({ health }: { health: string }) {
  switch (health) {
    case 'Healthy':
      return <StatusOK>Healthy</StatusOK>;
    case 'Progressing':
      return <StatusPending>Progressing</StatusPending>;
    case 'Degraded':
    case 'Missing':
      return <StatusError>{health}</StatusError>;
    default:
      return <StatusWarning>{health}</StatusWarning>;
  }
}

const columns: TableColumn<Preview>[] = [
  {
    title: 'Pull request',
    field: 'pullRequest',
    render: p =>
      p.pullRequestUrl ? (
        <Link to={p.pullRequestUrl}>#{p.pullRequest}</Link>
      ) : (
        `#${p.pullRequest ?? '?'}`
      ),
  },
  { title: 'Branch', field: 'branch' },
  {
    title: 'Environment',
    field: 'url',
    render: p => (p.url ? <Link to={p.url}>{p.url}</Link> : '-'),
  },
  {
    title: 'Health',
    field: 'health',
    render: p => <Health health={p.health} />,
  },
  { title: 'Sync', field: 'sync' },
  {
    title: 'Commit',
    field: 'revision',
    render: p => (p.revision ? <code>{p.revision.slice(0, 7)}</code> : '-'),
  },
  {
    title: 'Created',
    field: 'createdAt',
    render: p => (p.createdAt ? new Date(p.createdAt).toLocaleString() : '-'),
  },
];

export const PreviewsContent = () => {
  const { entity } = useEntity();
  const previewsApi = useApi(previewsApiRef);
  const ref = getCompoundEntityRef(entity);

  const { value, loading, error, retry } = useAsyncRetry(
    () => previewsApi.listPreviews(ref),
    [previewsApi, ref.kind, ref.namespace, ref.name],
  );
  // Previews come and go with pull requests; keep the list current.
  useInterval(retry, REFRESH_MS);

  if (error) {
    return (
      <Content>
        <ResponseErrorPanel error={error} />
      </Content>
    );
  }

  return (
    <Content>
      <Table<Preview>
        title="Pull request previews"
        subtitle="Add the preview label to a pull request to get an environment for it"
        isLoading={loading && !value}
        columns={columns}
        data={value ?? []}
        options={{ paging: false, search: false, padding: 'dense' }}
        emptyContent={
          <Typography style={{ padding: 16 }}>
            No active previews. Label a pull request with <code>preview</code>{' '}
            and Argo CD will deploy it to its own namespace.
          </Typography>
        }
      />
    </Content>
  );
};
