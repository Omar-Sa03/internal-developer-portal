import { DatabaseService } from '@backstage/backend-plugin-api';
import { TestDatabases } from '@backstage/backend-test-utils';
import { ReadinessStore } from './store';
import { EntityReadiness } from './types';

jest.setTimeout(60_000);

const evaluation = (
  entityRef: string,
  score: number,
  evaluatedAt: string,
): EntityReadiness => ({
  entityRef,
  score,
  grade: 'A',
  checks: [
    {
      id: 'owner',
      title: 'Owned by a team',
      category: 'ownership',
      weight: 2,
      status: 'pass',
      message: 'ok',
    },
  ],
  evaluatedAt,
});

describe('ReadinessStore', () => {
  const databases = TestDatabases.create({ ids: ['SQLITE_3'] });

  async function createStore() {
    const knex = await databases.init('SQLITE_3');
    return ReadinessStore.create({
      getClient: async () => knex,
    } as DatabaseService);
  }

  it('returns the latest evaluation and history per entity', async () => {
    const store = await createStore();
    await store.save(
      evaluation('component:default/a', 50, '2026-10-01T00:00:00.000Z'),
    );
    await store.save(
      evaluation('component:default/a', 80, '2026-10-02T00:00:00.000Z'),
    );
    await store.save(
      evaluation('component:default/b', 30, '2026-10-01T00:00:00.000Z'),
    );

    await expect(store.latest('component:default/a')).resolves.toMatchObject({
      score: 80,
      checks: [{ id: 'owner', status: 'pass' }],
      evaluatedAt: '2026-10-02T00:00:00.000Z',
    });
    await expect(store.history('component:default/a')).resolves.toEqual([
      { score: 50, evaluatedAt: '2026-10-01T00:00:00.000Z' },
      { score: 80, evaluatedAt: '2026-10-02T00:00:00.000Z' },
    ]);

    const all = await store.latestForAll();
    expect(all.map(e => [e.entityRef, e.score]).sort()).toEqual([
      ['component:default/a', 80],
      ['component:default/b', 30],
    ]);
  });

  it('keeps a bounded history per entity', async () => {
    const store = await createStore();
    for (let day = 0; day < 55; day++) {
      await store.save(
        evaluation(
          'component:default/a',
          day,
          new Date(Date.UTC(2026, 0, 1 + day)).toISOString(),
        ),
      );
    }

    const history = await store.history('component:default/a', 100);
    expect(history).toHaveLength(50);
    expect(history[0].score).toBe(5);
  });

  it('returns undefined for unknown entities', async () => {
    const store = await createStore();
    await expect(
      store.latest('component:default/nope'),
    ).resolves.toBeUndefined();
  });
});
