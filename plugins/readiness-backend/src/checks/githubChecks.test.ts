import { Entity } from '@backstage/catalog-model';
import { GithubReader } from '../clients/github';
import { ciStatusCheck, vulnerabilityCheck } from './githubChecks';

const onGithub: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'orders-api',
    annotations: { 'github.com/project-slug': 'acme/orders-api' },
  },
};

const notOnGithub: Entity = {
  ...onGithub,
  metadata: { name: 'orders-api' },
};

function github(overrides: Partial<GithubReader>): GithubReader {
  return {
    latestDefaultBranchRun: jest.fn(),
    openCodeScanningAlerts: jest.fn(),
    ...overrides,
  };
}

const counts = (critical: number, high: number) => ({
  critical,
  high,
  medium: 0,
  low: 0,
});

describe('ciStatusCheck', () => {
  it('skips entities without a GitHub repository', async () => {
    expect((await ciStatusCheck(github({})).run(notOnGithub)).status).toBe(
      'skip',
    );
  });

  it('passes on a successful run and links to it', async () => {
    const check = ciStatusCheck(
      github({
        latestDefaultBranchRun: async () => ({
          name: 'CI',
          conclusion: 'success',
          url: 'https://github.com/acme/orders-api/actions/runs/1',
          createdAt: '2026-10-23T00:00:00Z',
        }),
      }),
    );
    expect(await check.run(onGithub)).toMatchObject({
      status: 'pass',
      link: 'https://github.com/acme/orders-api/actions/runs/1',
    });
  });

  it('fails on a failed run', async () => {
    const check = ciStatusCheck(
      github({
        latestDefaultBranchRun: async () => ({
          name: 'CI',
          conclusion: 'failure',
          url: 'u',
          createdAt: '',
        }),
      }),
    );
    expect((await check.run(onGithub)).status).toBe('fail');
  });

  it('warns when there are no runs', async () => {
    const check = ciStatusCheck(
      github({ latestDefaultBranchRun: async () => undefined }),
    );
    expect((await check.run(onGithub)).status).toBe('warn');
  });
});

describe('vulnerabilityCheck', () => {
  const scanned = (critical: number, high: number) =>
    vulnerabilityCheck(
      github({
        openCodeScanningAlerts: async () => ({
          enabled: true,
          counts: counts(critical, high),
          url: 'https://github.com/acme/orders-api/security/code-scanning',
        }),
      }),
    );

  it('fails with critical alerts', async () => {
    expect((await scanned(1, 2).run(onGithub)).status).toBe('fail');
  });

  it('warns with only high alerts', async () => {
    expect((await scanned(0, 2).run(onGithub)).status).toBe('warn');
  });

  it('passes with no severe alerts', async () => {
    expect((await scanned(0, 0).run(onGithub)).status).toBe('pass');
  });

  it('warns when no scan results were uploaded', async () => {
    const check = vulnerabilityCheck(
      github({ openCodeScanningAlerts: async () => ({ enabled: false }) }),
    );
    expect((await check.run(onGithub)).status).toBe('warn');
  });
});
