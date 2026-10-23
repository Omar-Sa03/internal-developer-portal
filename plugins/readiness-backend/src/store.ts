import {
  DatabaseService,
  resolvePackagePath,
} from '@backstage/backend-plugin-api';
import { EntityReadiness, Grade } from './types';

// Use the knex instance type the backend provides instead of a separate knex copy.
type Knex = Awaited<ReturnType<DatabaseService['getClient']>>;

const TABLE = 'readiness_evaluations';
/** Evaluations kept per entity; enough for a trend line without unbounded growth. */
const HISTORY_LIMIT = 50;

type Row = {
  id: number;
  entity_ref: string;
  score: number | null;
  grade: Grade | null;
  checks: string;
  evaluated_at: Date | string;
};

function fromRow(row: Row): EntityReadiness {
  return {
    entityRef: row.entity_ref,
    score: row.score,
    grade: row.grade,
    checks: JSON.parse(row.checks),
    evaluatedAt: new Date(row.evaluated_at).toISOString(),
  };
}

export class ReadinessStore {
  static async create(database: DatabaseService): Promise<ReadinessStore> {
    const client = await database.getClient();
    if (!database.migrations?.skip) {
      await client.migrate.latest({
        directory: resolvePackagePath(
          '@internal/backstage-plugin-readiness-backend',
          'migrations',
        ),
      });
    }
    return new ReadinessStore(client);
  }

  constructor(private readonly db: Knex) {}

  async save(evaluation: EntityReadiness): Promise<void> {
    await this.db.transaction(async tx => {
      await tx<Row>(TABLE).insert({
        entity_ref: evaluation.entityRef,
        score: evaluation.score,
        grade: evaluation.grade,
        checks: JSON.stringify(evaluation.checks),
        evaluated_at: new Date(evaluation.evaluatedAt),
      });

      const stale = await tx<Row>(TABLE)
        .where('entity_ref', evaluation.entityRef)
        .orderBy('evaluated_at', 'desc')
        .offset(HISTORY_LIMIT)
        .select('id');
      if (stale.length > 0) {
        await tx<Row>(TABLE)
          .whereIn(
            'id',
            stale.map(r => r.id),
          )
          .delete();
      }
    });
  }

  async latest(entityRef: string): Promise<EntityReadiness | undefined> {
    const row = await this.db<Row>(TABLE)
      .where('entity_ref', entityRef)
      .orderBy('evaluated_at', 'desc')
      .first();
    return row ? fromRow(row) : undefined;
  }

  async history(
    entityRef: string,
    limit = 20,
  ): Promise<Array<Pick<EntityReadiness, 'score' | 'evaluatedAt'>>> {
    const rows = await this.db<Row>(TABLE)
      .where('entity_ref', entityRef)
      .orderBy('evaluated_at', 'desc')
      .limit(limit)
      .select('score', 'evaluated_at');
    return rows.reverse().map(r => ({
      score: r.score,
      evaluatedAt: new Date(r.evaluated_at).toISOString(),
    }));
  }

  /** Most recent evaluation of every entity. */
  async latestForAll(): Promise<EntityReadiness[]> {
    const newest = this.db<Row>(TABLE)
      .select('entity_ref')
      .max({ evaluated_at: 'evaluated_at' })
      .groupBy('entity_ref')
      .as('newest');

    const rows: Row[] = await this.db<Row>(`${TABLE} as e`)
      .join(newest, function onNewest() {
        this.on('e.entity_ref', '=', 'newest.entity_ref').andOn(
          'e.evaluated_at',
          '=',
          'newest.evaluated_at',
        );
      })
      .select('e.*');
    return rows.map(fromRow);
  }
}
