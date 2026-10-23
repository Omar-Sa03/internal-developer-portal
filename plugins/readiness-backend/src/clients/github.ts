import {
  DefaultGithubCredentialsProvider,
  ScmIntegrations,
} from '@backstage/integration';
import { Config } from '@backstage/config';
import { Octokit } from '@octokit/rest';

export type WorkflowRunSummary = {
  name: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
};

export type CodeScanningSummary =
  | { enabled: false }
  | {
      enabled: true;
      counts: Record<'critical' | 'high' | 'medium' | 'low', number>;
      url: string;
    };

export interface GithubReader {
  latestDefaultBranchRun(slug: string): Promise<WorkflowRunSummary | undefined>;
  openCodeScanningAlerts(slug: string): Promise<CodeScanningSummary>;
}

const GITHUB_HOST = 'github.com';
/** 1000 alerts is plenty to grade a service; stop paging there. */
const MAX_ALERT_PAGES = 10;

export class GithubApiReader implements GithubReader {
  private readonly credentials: DefaultGithubCredentialsProvider;
  private readonly apiBaseUrl?: string;

  constructor(config: Config) {
    const integrations = ScmIntegrations.fromConfig(config);
    this.credentials =
      DefaultGithubCredentialsProvider.fromIntegrations(integrations);
    this.apiBaseUrl =
      integrations.github.byHost(GITHUB_HOST)?.config.apiBaseUrl;
  }

  private async client(slug: string) {
    const [owner, repo] = slug.split('/');
    const { token } = await this.credentials.getCredentials({
      url: `https://${GITHUB_HOST}/${owner}/${repo}`,
    });
    return {
      owner,
      repo,
      octokit: new Octokit({ auth: token, baseUrl: this.apiBaseUrl }),
    };
  }

  async latestDefaultBranchRun(
    slug: string,
  ): Promise<WorkflowRunSummary | undefined> {
    const { owner, repo, octokit } = await this.client(slug);
    const { data: repository } = await octokit.repos.get({ owner, repo });
    const { data } = await octokit.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      branch: repository.default_branch,
      status: 'completed',
      per_page: 1,
    });
    const run = data.workflow_runs[0];
    return run
      ? {
          name: run.name ?? 'workflow',
          conclusion: run.conclusion,
          url: run.html_url,
          createdAt: run.created_at,
        }
      : undefined;
  }

  async openCodeScanningAlerts(slug: string): Promise<CodeScanningSummary> {
    const { owner, repo, octokit } = await this.client(slug);
    try {
      const counts = { critical: 0, high: 0, medium: 0, low: 0 };
      for (let page = 1; page <= MAX_ALERT_PAGES; page++) {
        const { data: alerts } = await octokit.codeScanning.listAlertsForRepo({
          owner,
          repo,
          state: 'open',
          per_page: 100,
          page,
        });
        for (const alert of alerts) {
          // Returned by the API but missing from the Octokit v19 type definitions.
          const level = (alert.rule as { security_severity_level?: string })
            .security_severity_level;
          if (level && level in counts) {
            counts[level as keyof typeof counts] += 1;
          }
        }
        if (alerts.length < 100) break;
      }
      return {
        enabled: true,
        counts,
        url: `https://${GITHUB_HOST}/${owner}/${repo}/security/code-scanning`,
      };
    } catch (e) {
      // 404: no analysis uploaded yet. 403: code scanning disabled for the repo.
      const status = (e as { status?: number }).status;
      if (status === 404 || status === 403) {
        return { enabled: false };
      }
      throw e;
    }
  }
}
