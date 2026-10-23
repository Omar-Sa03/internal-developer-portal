import { getCompoundEntityRef } from '@backstage/catalog-model';
import {
  Gauge,
  InfoCard,
  Link,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { alertApiRef, useApi } from '@backstage/frontend-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import RefreshIcon from '@material-ui/icons/Refresh';
import { useState } from 'react';
import useAsyncRetry from 'react-use/esm/useAsyncRetry';
import { readinessApiRef } from '../api';
import { scoreColor, sortChecks, StatusIcon } from './status';

export const ReadinessCard = () => {
  const { entity } = useEntity();
  const readinessApi = useApi(readinessApiRef);
  const alertApi = useApi(alertApiRef);
  const ref = getCompoundEntityRef(entity);
  const [evaluating, setEvaluating] = useState(false);

  const { value, loading, error, retry } = useAsyncRetry(
    () => readinessApi.getEntityReadiness(ref),
    [readinessApi, ref.kind, ref.namespace, ref.name],
  );

  const evaluate = async () => {
    setEvaluating(true);
    try {
      await readinessApi.evaluateEntity(ref);
      retry();
    } catch (e) {
      alertApi.post({
        message: `Could not evaluate readiness: ${(e as Error).message}`,
        severity: 'error',
      });
    } finally {
      setEvaluating(false);
    }
  };

  const action = (
    <Tooltip title="Re-evaluate now">
      <span>
        <IconButton
          aria-label="Re-evaluate now"
          onClick={evaluate}
          disabled={evaluating}
        >
          <RefreshIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  let body;
  if (loading || evaluating) {
    body = <Progress />;
  } else if (error) {
    body = <ResponseErrorPanel error={error} />;
  } else if (!value?.latest) {
    body = (
      <Box textAlign="center" py={2}>
        <Typography paragraph>
          This service has not been evaluated yet. Scores refresh every 30
          minutes.
        </Typography>
        <Button variant="contained" color="primary" onClick={evaluate}>
          Evaluate now
        </Button>
      </Box>
    );
  } else {
    const { latest } = value;
    body = (
      <Box display="flex" flexWrap="wrap" style={{ gap: 16 }}>
        <Box width={140} textAlign="center">
          {latest.score === null ? (
            <Typography variant="h4">n/a</Typography>
          ) : (
            <Gauge
              value={latest.score}
              max={100}
              fractional={false}
              unit=""
              getColor={scoreColor}
            />
          )}
          <Typography variant="h6">Grade {latest.grade ?? '-'}</Typography>
          <Typography variant="caption" color="textSecondary">
            Evaluated {new Date(latest.evaluatedAt).toLocaleString()}
          </Typography>
        </Box>
        <List dense style={{ flex: 1, minWidth: 260 }}>
          {sortChecks(latest.checks).map(check => (
            <ListItem key={check.id} alignItems="flex-start">
              <ListItemIcon>
                <StatusIcon status={check.status} />
              </ListItemIcon>
              <ListItemText
                primary={check.title}
                secondary={
                  <>
                    {check.message}
                    {check.remediation && (
                      <>
                        <br />
                        <strong>Fix:</strong> {check.remediation}
                      </>
                    )}
                    {check.link && (
                      <>
                        {' '}
                        <Link to={check.link}>Details</Link>
                      </>
                    )}
                  </>
                }
              />
            </ListItem>
          ))}
        </List>
      </Box>
    );
  }

  return (
    <InfoCard title="Production readiness" action={action}>
      {body}
    </InfoCard>
  );
};
