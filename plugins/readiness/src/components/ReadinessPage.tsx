import { parseEntityRef } from '@backstage/catalog-model';
import {
  Content,
  ContentHeader,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { useApi } from '@backstage/frontend-plugin-api';
import { EntityRefLink } from '@backstage/plugin-catalog-react';
import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
import useAsync from 'react-use/esm/useAsync';
import { readinessApiRef, ScoreSummary } from '../api';
import { sortChecks, StatusIcon } from './status';

const GRADE_COLORS: Record<string, string> = {
  A: '#2e7d32',
  B: '#558b2f',
  C: '#ed6c02',
  D: '#d84315',
  F: '#c62828',
};

const columns: TableColumn<ScoreSummary>[] = [
  {
    title: 'Service',
    field: 'title',
    highlight: true,
    render: row => (
      <EntityRefLink
        entityRef={parseEntityRef(row.entityRef)}
        title={row.title}
      />
    ),
  },
  {
    title: 'Owner',
    field: 'owner',
    render: row =>
      row.owner ? (
        <EntityRefLink
          entityRef={parseEntityRef(row.owner, { defaultKind: 'group' })}
          defaultKind="group"
        />
      ) : (
        '-'
      ),
  },
  { title: 'Lifecycle', field: 'lifecycle' },
  {
    title: 'Score',
    field: 'score',
    type: 'numeric',
    defaultSort: 'asc',
    render: row => (row.score === null ? 'n/a' : row.score),
  },
  {
    title: 'Grade',
    field: 'grade',
    render: row =>
      row.grade ? (
        <Chip
          label={row.grade}
          size="small"
          style={{ backgroundColor: GRADE_COLORS[row.grade], color: '#fff' }}
        />
      ) : (
        '-'
      ),
  },
  {
    title: 'Needs attention',
    sorting: false,
    render: row => {
      const issues = sortChecks(row.checks).filter(
        c => c.status === 'fail' || c.status === 'warn',
      );
      return issues.length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          Nothing to fix
        </Typography>
      ) : (
        issues.map(c => (
          <div
            key={c.id}
            style={{ display: 'flex', gap: 4, alignItems: 'center' }}
          >
            <StatusIcon status={c.status} />
            <Typography variant="body2">{c.title}</Typography>
          </div>
        ))
      );
    },
  },
  {
    title: 'Evaluated',
    field: 'evaluatedAt',
    render: row => new Date(row.evaluatedAt).toLocaleString(),
  },
];

export const ReadinessPage = () => {
  const readinessApi = useApi(readinessApiRef);
  const { value, loading, error } = useAsync(
    () => readinessApi.listScores(),
    [readinessApi],
  );

  const scored = (value ?? []).filter(s => s.score !== null);
  const average = scored.length
    ? Math.round(
        scored.reduce((sum, s) => sum + (s.score ?? 0), 0) / scored.length,
      )
    : undefined;

  return (
    <Content>
      <ContentHeader
        title="Production readiness"
        description="Every service is scored on ownership, docs, monitoring, policy compliance, GitOps health, CI and vulnerabilities."
      />
      {error ? (
        <ResponseErrorPanel error={error} />
      ) : (
        <Table<ScoreSummary>
          title={
            average === undefined
              ? 'Services'
              : `${value?.length} services, average score ${average}`
          }
          isLoading={loading}
          options={{
            paging: true,
            pageSize: 20,
            search: true,
            padding: 'dense',
          }}
          columns={columns}
          data={value ?? []}
          emptyContent={
            <Typography style={{ padding: 16 }}>
              No scores yet. Services are evaluated every 30 minutes.
            </Typography>
          }
        />
      )}
    </Content>
  );
};
