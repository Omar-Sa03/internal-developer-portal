import { BackstagePalette } from '@backstage/theme';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';
import WarningIcon from '@material-ui/icons/Warning';
import { CheckStatus, EntityReadiness } from '../api';

export function StatusIcon({ status }: { status: CheckStatus }) {
  switch (status) {
    case 'pass':
      return (
        <CheckCircleIcon style={{ color: '#2e7d32' }} titleAccess="Pass" />
      );
    case 'warn':
      return <WarningIcon style={{ color: '#ed6c02' }} titleAccess="Warning" />;
    case 'fail':
      return <ErrorIcon color="error" titleAccess="Fail" />;
    case 'skip':
      return (
        <RemoveCircleOutlineIcon
          color="disabled"
          titleAccess="Not applicable"
        />
      );
    default:
      return <HelpOutlineIcon color="disabled" titleAccess="Unknown" />;
  }
}

/** Gauge colour that matches the grade boundaries used by the backend. */
export function scoreColor({
  palette,
  value,
}: {
  palette: BackstagePalette;
  value: number;
}) {
  if (value >= 90) return palette.status.ok;
  if (value >= 60) return palette.status.warning;
  return palette.status.error;
}

/** Fail first, then warnings, then the rest; keeps the actionable items on top. */
const ORDER: Record<CheckStatus, number> = {
  fail: 0,
  warn: 1,
  error: 2,
  pass: 3,
  skip: 4,
};

export function sortChecks(checks: EntityReadiness['checks']) {
  return [...checks].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || b.weight - a.weight,
  );
}
