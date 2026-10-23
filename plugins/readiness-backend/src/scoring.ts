import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  CheckResult,
  CheckStatus,
  EntityReadiness,
  Grade,
  ReadinessCheck,
} from './types';

const CHECK_TIMEOUT_MS = 15_000;

/** Share of a check's weight earned per status. skip/error are excluded entirely. */
const CREDIT: Partial<Record<CheckStatus, number>> = {
  pass: 1,
  warn: 0.5,
  fail: 0,
};

export function computeScore(checks: CheckResult[]): number | null {
  let earned = 0;
  let possible = 0;
  for (const check of checks) {
    const credit = CREDIT[check.status];
    if (credit === undefined) {
      continue;
    }
    earned += check.weight * credit;
    possible += check.weight;
  }
  return possible === 0 ? null : Math.round((earned / possible) * 100);
}

export function toGrade(score: number | null): Grade | null {
  if (score === null) return null;
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`timed out after ${ms}ms`)),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

export class ReadinessEvaluator {
  constructor(
    private readonly checks: ReadinessCheck[],
    private readonly logger: LoggerService,
  ) {}

  async evaluate(entity: Entity): Promise<EntityReadiness> {
    const entityRef = stringifyEntityRef(entity);

    const results = await Promise.all(
      this.checks.map(async (check): Promise<CheckResult> => {
        const base = {
          id: check.id,
          title: check.title,
          category: check.category,
          weight: check.weight,
        };
        try {
          return {
            ...base,
            ...(await withTimeout(check.run(entity), CHECK_TIMEOUT_MS)),
          };
        } catch (e) {
          // A broken integration must not fail the service; report it instead.
          this.logger.warn(`Check ${check.id} failed for ${entityRef}: ${e}`);
          return {
            ...base,
            status: 'error',
            message: `Could not evaluate: ${(e as Error).message}`,
          };
        }
      }),
    );

    const score = computeScore(results);
    return {
      entityRef,
      score,
      grade: toGrade(score),
      checks: results,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
