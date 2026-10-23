import { Entity } from '@backstage/catalog-model';
import { KubernetesReader } from '../clients/kubernetes';
import { ReadinessCheck } from '../types';

export const KUBERNETES_ID_ANNOTATION = 'backstage.io/kubernetes-id';
export const KUBERNETES_NAMESPACE_ANNOTATION =
  'backstage.io/kubernetes-namespace';

const SEVERE = new Set(['critical', 'high']);

function kubernetesId(entity: Entity) {
  return entity.metadata.annotations?.[KUBERNETES_ID_ANNOTATION];
}

export function policyComplianceCheck(k8s: KubernetesReader): ReadinessCheck {
  return {
    id: 'policy-compliance',
    title: 'Complies with cluster policies',
    category: 'security',
    weight: 3,
    async run(entity) {
      const namespace =
        entity.metadata.annotations?.[KUBERNETES_NAMESPACE_ANNOTATION];
      if (!namespace) {
        return {
          status: 'skip',
          message: `No "${KUBERNETES_NAMESPACE_ANNOTATION}" annotation`,
        };
      }

      const reports = await k8s.listPolicyReports(namespace);
      const results = reports.flatMap(r => r.results ?? []);
      if (results.length === 0) {
        return {
          status: 'warn',
          message: `No Kyverno policy reports in namespace ${namespace}`,
          remediation:
            'Make sure the service is deployed and Kyverno background scanning is running.',
        };
      }

      // One entry per violated rule, not per pod, so replicas don't inflate the list.
      const violations = new Map<string, string | undefined>();
      for (const result of results) {
        if (result.result === 'fail') {
          violations.set(
            `${result.policy}/${result.rule ?? ''}`,
            result.severity,
          );
        }
      }

      if (violations.size === 0) {
        return {
          status: 'pass',
          message: `All ${results.length} policy results pass`,
        };
      }

      const severe = [...violations.values()].some(s => s && SEVERE.has(s));
      const rules = [...violations.keys()].join(', ');
      return {
        status: severe ? 'fail' : 'warn',
        message: `${violations.size} policy rule(s) violated: ${rules}`,
        remediation:
          'Fix the Helm chart (probes, resources, non-root, approved registry), then let Argo CD sync.',
      };
    },
  };
}

const HEALTH_FAIL = new Set(['Degraded', 'Missing', 'Unknown']);

export function gitOpsDeploymentCheck(k8s: KubernetesReader): ReadinessCheck {
  return {
    id: 'gitops-deployment',
    title: 'Deployed and healthy via Argo CD',
    category: 'delivery',
    weight: 3,
    async run(entity) {
      const id = kubernetesId(entity);
      if (!id) {
        return {
          status: 'skip',
          message: `No "${KUBERNETES_ID_ANNOTATION}" annotation`,
        };
      }

      const [app] = await k8s.findArgoApplications(id);
      if (!app) {
        return {
          status: 'fail',
          message: 'No Argo CD Application manages this service',
          remediation:
            'Create it with the argoCd:createApplication scaffolder action so deployments are declarative.',
        };
      }

      const health = app.status?.health?.status ?? 'Unknown';
      const sync = app.status?.sync?.status ?? 'Unknown';
      const message = `Application ${app.metadata.name} is ${health} and ${sync}`;

      if (HEALTH_FAIL.has(health)) {
        return {
          status: 'fail',
          message: app.status?.health?.message
            ? `${message}: ${app.status.health.message}`
            : message,
          remediation:
            'Open the application in Argo CD and inspect the failing resources and events.',
        };
      }
      if (health !== 'Healthy' || sync !== 'Synced') {
        return {
          status: 'warn',
          message,
          remediation:
            'The live state differs from Git. Wait for the sync to finish or check for manual drift.',
        };
      }
      return { status: 'pass', message };
    },
  };
}
