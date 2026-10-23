import { mockServices } from '@backstage/backend-test-utils';
import { Entity } from '@backstage/catalog-model';
import { computeScore, ReadinessEvaluator, toGrade } from './scoring';
import { CheckResult, ReadinessCheck } from './types';

const result = (
  status: CheckResult['status'],
  weight: number,
): CheckResult => ({
  id: `${status}-${weight}`,
  title: 'check',
  category: 'delivery',
  weight,
  status,
  message: '',
});

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'orders-api', namespace: 'default' },
};

describe('computeScore', () => {
  it('weights checks and gives half credit for warnings', () => {
    expect(computeScore([result('pass', 3), result('warn', 2)])).toBe(80);
  });

  it('ignores checks that were skipped or could not be evaluated', () => {
    expect(
      computeScore([result('pass', 1), result('skip', 5), result('error', 5)]),
    ).toBe(100);
  });

  it('returns null when nothing produced a verdict', () => {
    expect(computeScore([result('skip', 1), result('error', 1)])).toBeNull();
  });
});

describe('toGrade', () => {
  it.each([
    [100, 'A'],
    [90, 'A'],
    [89, 'B'],
    [60, 'C'],
    [40, 'D'],
    [39, 'F'],
    [null, null],
  ])('grades %p as %p', (score, grade) => {
    expect(toGrade(score)).toBe(grade);
  });
});

describe('ReadinessEvaluator', () => {
  const passing: ReadinessCheck = {
    id: 'passing',
    title: 'Passing',
    category: 'ownership',
    weight: 1,
    run: async () => ({ status: 'pass', message: 'ok' }),
  };
  const broken: ReadinessCheck = {
    id: 'broken',
    title: 'Broken',
    category: 'security',
    weight: 10,
    run: async () => {
      throw new Error('GitHub is down');
    },
  };

  it('reports a throwing check as an error instead of failing the evaluation', async () => {
    const evaluator = new ReadinessEvaluator(
      [passing, broken],
      mockServices.logger.mock(),
    );

    const evaluation = await evaluator.evaluate(entity);

    expect(evaluation.entityRef).toBe('component:default/orders-api');
    expect(evaluation.score).toBe(100);
    expect(evaluation.grade).toBe('A');
    expect(evaluation.checks.find(c => c.id === 'broken')).toMatchObject({
      status: 'error',
      message: 'Could not evaluate: GitHub is down',
      weight: 10,
    });
  });
});
