import {
  AuthService,
  BackstageCredentials,
  LoggerService,
} from '@backstage/backend-plugin-api';
import {
  CompoundEntityRef,
  Entity,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { ReadinessEvaluator } from './scoring';
import { ReadinessStore } from './store';
import { EntityReadiness } from './types';

/** Entities that get a readiness score. */
export const SCORED_ENTITY_FILTER = { kind: 'Component' };

const REFRESH_CONCURRENCY = 5;

export type ScoreSummary = EntityReadiness & {
  title: string;
  owner?: string;
  type?: string;
  lifecycle?: string;
};

export class ReadinessService {
  constructor(
    private readonly options: {
      evaluator: ReadinessEvaluator;
      store: ReadinessStore;
      catalog: CatalogService;
      auth: AuthService;
      logger: LoggerService;
    },
  ) {}

  /** Returns undefined when the entity does not exist or the caller can't see it. */
  async getEntity(
    ref: CompoundEntityRef,
    credentials: BackstageCredentials,
  ): Promise<Entity | undefined> {
    return this.options.catalog.getEntityByRef(ref, { credentials });
  }

  async evaluate(entity: Entity): Promise<EntityReadiness> {
    const evaluation = await this.options.evaluator.evaluate(entity);
    await this.options.store.save(evaluation);
    return evaluation;
  }

  async latest(entity: Entity) {
    const entityRef = stringifyEntityRef(entity);
    const [latest, history] = await Promise.all([
      this.options.store.latest(entityRef),
      this.options.store.history(entityRef),
    ]);
    return { latest, history };
  }

  /** Latest scores, limited to entities visible to the caller. */
  async summary(credentials: BackstageCredentials): Promise<ScoreSummary[]> {
    const [{ items }, scores] = await Promise.all([
      this.options.catalog.getEntities(
        {
          filter: SCORED_ENTITY_FILTER,
          fields: [
            'kind',
            'metadata.name',
            'metadata.namespace',
            'metadata.title',
            'spec.owner',
            'spec.type',
            'spec.lifecycle',
          ],
        },
        { credentials },
      ),
      this.options.store.latestForAll(),
    ]);

    const byRef = new Map(scores.map(s => [s.entityRef, s]));
    return items.flatMap(entity => {
      const score = byRef.get(stringifyEntityRef(entity));
      if (!score) return [];
      return [
        {
          ...score,
          title: entity.metadata.title ?? entity.metadata.name,
          owner: entity.spec?.owner as string | undefined,
          type: entity.spec?.type as string | undefined,
          lifecycle: entity.spec?.lifecycle as string | undefined,
        },
      ];
    });
  }

  /** Re-scores every component; run on a schedule. */
  async refreshAll(): Promise<void> {
    const { items } = await this.options.catalog.getEntities(
      { filter: SCORED_ENTITY_FILTER },
      { credentials: await this.options.auth.getOwnServiceCredentials() },
    );

    let failures = 0;
    for (let i = 0; i < items.length; i += REFRESH_CONCURRENCY) {
      const batch = items.slice(i, i + REFRESH_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(e => this.evaluate(e)),
      );
      failures += results.filter(r => r.status === 'rejected').length;
    }
    this.options.logger.info(
      `Evaluated readiness of ${items.length - failures}/${
        items.length
      } components`,
    );
  }
}
