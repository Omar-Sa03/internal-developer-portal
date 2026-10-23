import { Entity } from '@backstage/catalog-model';
import {
  ArgoApplication,
  KubernetesReader,
  PolicyReport,
} from '../clients/kubernetes';
import {
  gitOpsDeploymentCheck,
  policyComplianceCheck,
} from './kubernetesChecks';

const entity = (annotations: Record<string, string> = {}): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'orders-api', annotations },
});

const annotated = entity({
  'backstage.io/kubernetes-id': 'orders-api',
  'backstage.io/kubernetes-namespace': 'orders-api',
});

function reader(
  reports: PolicyReport[] = [],
  apps: ArgoApplication[] = [],
): KubernetesReader {
  return {
    listPolicyReports: jest.fn(async () => reports),
    findArgoApplications: jest.fn(async () => apps),
  };
}

const report = (results: PolicyReport['results']): PolicyReport => ({
  metadata: { name: 'r', namespace: 'orders-api' },
  results,
});

describe('policyComplianceCheck', () => {
  it('skips entities that are not deployed to Kubernetes', async () => {
    const outcome = await policyComplianceCheck(reader()).run(entity());
    expect(outcome.status).toBe('skip');
  });

  it('warns when no policy reports exist yet', async () => {
    const outcome = await policyComplianceCheck(reader()).run(annotated);
    expect(outcome.status).toBe('warn');
  });

  it('passes when every result passes', async () => {
    const k8s = reader([
      report([{ policy: 'require-probes', result: 'pass' }]),
    ]);
    const outcome = await policyComplianceCheck(k8s).run(annotated);
    expect(outcome.status).toBe('pass');
    expect(k8s.listPolicyReports).toHaveBeenCalledWith('orders-api');
  });

  it('fails on high severity violations and dedupes per rule', async () => {
    const violation = {
      policy: 'require-non-root',
      rule: 'check-containers',
      result: 'fail' as const,
      severity: 'high' as const,
    };
    // Same violation reported for two replicas.
    const k8s = reader([report([violation]), report([violation])]);

    const outcome = await policyComplianceCheck(k8s).run(annotated);

    expect(outcome.status).toBe('fail');
    expect(outcome.message).toBe(
      '1 policy rule(s) violated: require-non-root/check-containers',
    );
    expect(outcome.remediation).toBeDefined();
  });

  it('only warns on medium severity violations', async () => {
    const k8s = reader([
      report([
        {
          policy: 'require-resources',
          rule: 'check-container-resources',
          result: 'fail',
          severity: 'medium',
        },
      ]),
    ]);
    const outcome = await policyComplianceCheck(k8s).run(annotated);
    expect(outcome.status).toBe('warn');
  });
});

describe('gitOpsDeploymentCheck', () => {
  const app = (health: string, sync: string): ArgoApplication => ({
    metadata: { name: 'orders-api' },
    status: { health: { status: health }, sync: { status: sync } },
  });

  it('fails when no Argo CD application manages the service', async () => {
    const outcome = await gitOpsDeploymentCheck(reader()).run(annotated);
    expect(outcome.status).toBe('fail');
  });

  it('passes when healthy and synced', async () => {
    const k8s = reader([], [app('Healthy', 'Synced')]);
    const outcome = await gitOpsDeploymentCheck(k8s).run(annotated);
    expect(outcome.status).toBe('pass');
    expect(k8s.findArgoApplications).toHaveBeenCalledWith('orders-api');
  });

  it('warns while out of sync', async () => {
    const outcome = await gitOpsDeploymentCheck(
      reader([], [app('Healthy', 'OutOfSync')]),
    ).run(annotated);
    expect(outcome.status).toBe('warn');
  });

  it('fails when degraded', async () => {
    const outcome = await gitOpsDeploymentCheck(
      reader([], [app('Degraded', 'Synced')]),
    ).run(annotated);
    expect(outcome.status).toBe('fail');
  });
});
