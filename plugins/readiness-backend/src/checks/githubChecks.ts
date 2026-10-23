import { Entity } from '@backstage/catalog-model';
import { GithubReader } from '../clients/github';
import { ReadinessCheck } from '../types';

export const GITHUB_SLUG_ANNOTATION = 'github.com/project-slug';

function slug(entity: Entity) {
  return entity.metadata.annotations?.[GITHUB_SLUG_ANNOTATION];
}

const notOnGithub = {
  status: 'skip' as const,
  message: `No "${GITHUB_SLUG_ANNOTATION}" annotation`,
};

export function ciStatusCheck(github: GithubReader): ReadinessCheck {
  return {
    id: 'ci-status',
    title: 'Default branch CI is green',
    category: 'delivery',
    weight: 2,
    async run(entity) {
      const repo = slug(entity);
      if (!repo) return notOnGithub;

      const run = await github.latestDefaultBranchRun(repo);
      if (!run) {
        return {
          status: 'warn',
          message: 'No completed CI runs on the default branch',
          remediation:
            'Add a GitHub Actions workflow that runs on push to main.',
        };
      }
      if (run.conclusion === 'success') {
        return {
          status: 'pass',
          message: `Latest run "${run.name}" succeeded`,
          link: run.url,
        };
      }
      return {
        status: 'fail',
        message: `Latest run "${run.name}" ended with ${
          run.conclusion ?? 'no conclusion'
        }`,
        remediation:
          'Fix the failing workflow; main should always be releasable.',
        link: run.url,
      };
    },
  };
}

export function vulnerabilityCheck(github: GithubReader): ReadinessCheck {
  return {
    id: 'vulnerabilities',
    title: 'No critical vulnerabilities',
    category: 'security',
    weight: 3,
    async run(entity) {
      const repo = slug(entity);
      if (!repo) return notOnGithub;

      const scan = await github.openCodeScanningAlerts(repo);
      if (!scan.enabled) {
        return {
          status: 'warn',
          message: 'No code scanning results uploaded',
          remediation:
            'Upload Trivy SARIF results with github/codeql-action/upload-sarif (included in the service template).',
        };
      }

      const { critical, high } = scan.counts;
      if (critical > 0) {
        return {
          status: 'fail',
          message: `${critical} critical and ${high} high open alerts`,
          remediation: 'Upgrade the affected dependencies or base image.',
          link: scan.url,
        };
      }
      if (high > 0) {
        return {
          status: 'warn',
          message: `${high} high severity open alerts`,
          remediation: 'Plan upgrades for the affected dependencies.',
          link: scan.url,
        };
      }
      return {
        status: 'pass',
        message: 'No open critical or high alerts',
        link: scan.url,
      };
    },
  };
}
