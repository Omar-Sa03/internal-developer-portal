import { Entity } from '@backstage/catalog-model';

/**
 * - pass / warn / fail: the check ran and produced a verdict
 * - skip: the check does not apply to this entity (e.g. no Kubernetes annotation)
 * - error: the check could not be evaluated (e.g. GitHub API unavailable)
 */
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip' | 'error';

export type CheckResult = {
  id: string;
  title: string;
  category: CheckCategory;
  weight: number;
  status: CheckStatus;
  message: string;
  /** What to do to make the check pass. Only set when status is warn or fail. */
  remediation?: string;
  /** Optional link to the place where the problem can be seen or fixed. */
  link?: string;
};

export type CheckCategory =
  | 'ownership'
  | 'reliability'
  | 'security'
  | 'delivery';

export type CheckOutcome = Pick<
  CheckResult,
  'status' | 'message' | 'remediation' | 'link'
>;

export interface ReadinessCheck {
  id: string;
  title: string;
  category: CheckCategory;
  /** Relative importance in the overall score. */
  weight: number;
  run(entity: Entity): Promise<CheckOutcome>;
}

export type EntityReadiness = {
  entityRef: string;
  /** 0-100, or null when no check could produce a verdict. */
  score: number | null;
  grade: Grade | null;
  checks: CheckResult[];
  evaluatedAt: string;
};

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
