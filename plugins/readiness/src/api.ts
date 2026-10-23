import { CompoundEntityRef } from '@backstage/catalog-model';
import { ResponseError } from '@backstage/errors';
import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/frontend-plugin-api';

// Mirrors the response types of @internal/backstage-plugin-readiness-backend.
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip' | 'error';

export type CheckResult = {
  id: string;
  title: string;
  category: 'ownership' | 'reliability' | 'security' | 'delivery';
  weight: number;
  status: CheckStatus;
  message: string;
  remediation?: string;
  link?: string;
};

export type EntityReadiness = {
  entityRef: string;
  score: number | null;
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | null;
  checks: CheckResult[];
  evaluatedAt: string;
};

export type ScoreSummary = EntityReadiness & {
  title: string;
  owner?: string;
  type?: string;
  lifecycle?: string;
};

export type EntityReadinessResponse = {
  latest?: EntityReadiness;
  history: Array<{ score: number | null; evaluatedAt: string }>;
};

export interface ReadinessApi {
  getEntityReadiness(ref: CompoundEntityRef): Promise<EntityReadinessResponse>;
  evaluateEntity(ref: CompoundEntityRef): Promise<EntityReadiness>;
  listScores(): Promise<ScoreSummary[]>;
}

export const readinessApiRef = createApiRef<ReadinessApi>({
  id: 'plugin.readiness.api',
});

export class ReadinessClient implements ReadinessApi {
  constructor(
    private readonly options: {
      discoveryApi: DiscoveryApi;
      fetchApi: FetchApi;
    },
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = await this.options.discoveryApi.getBaseUrl('readiness');
    const response = await this.options.fetchApi.fetch(
      `${baseUrl}${path}`,
      init,
    );
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return response.json();
  }

  private entityPath({ kind, namespace, name }: CompoundEntityRef) {
    return `/entities/${encodeURIComponent(kind)}/${encodeURIComponent(
      namespace,
    )}/${encodeURIComponent(name)}`;
  }

  getEntityReadiness(ref: CompoundEntityRef) {
    return this.request<EntityReadinessResponse>(this.entityPath(ref));
  }

  evaluateEntity(ref: CompoundEntityRef) {
    return this.request<EntityReadiness>(`${this.entityPath(ref)}/evaluate`, {
      method: 'POST',
    });
  }

  async listScores() {
    const { items } = await this.request<{ items: ScoreSummary[] }>('/scores');
    return items;
  }
}
