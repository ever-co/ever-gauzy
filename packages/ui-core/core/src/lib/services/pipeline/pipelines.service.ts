import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { ID, IDeal, IPagination, IPipeline, IPipelineCreateInput, IPipelineFindInput } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { Service } from '../crud/service';

@Injectable()
export class PipelinesService extends Service<IPipeline, IPipelineFindInput, IPipelineCreateInput> {
	public constructor(readonly http: HttpClient) {
		super({ http, basePath: `${API_PREFIX}/pipelines` });
	}

	/**
	 * Fetches all pipelines with optional relations and filtering conditions.
	 *
	 * @param relations - An optional array of relation names to include in the response.
	 * @param where - Optional filtering conditions.
	 * @returns A promise that resolves with the paginated pipelines.
	 */
	getAll(relations?: string[], where?: IPipelineFindInput): Promise<IPagination<IPipeline>> {
		return firstValueFrom(
			this.http.get<IPagination<IPipeline>>(`${this.basePath}`, {
				params: toParams({ where, relations })
			})
		);
	}

	/**
	 * Fetches a pipeline by its ID with optional relations.
	 *
	 * @param id - The ID of the pipeline to fetch.
	 * @param relations - An array of relation names to include in the response.
	 * @returns A promise that resolves with the pipeline.
	 */
	getById(id: ID, where?: IPipelineFindInput, relations: string[] = []): Observable<IPipeline> {
		return this.http.get<IPipeline>(`${this.basePath}/${id}`, {
			params: toParams({ where, relations })
		});
	}

	/**
	 * Find deals associated with a specific pipeline
	 *
	 * @param pipelineId The ID of the pipeline
	 * @param where Filter conditions for fetching the deals
	 * @returns A promise of paginated deals
	 */
	getPipelineDeals(pipelineId: ID, where?: IPipelineFindInput): Promise<IPagination<IDeal>> {
		return firstValueFrom(
			this.http.get<IPagination<IDeal>>(`${this.basePath}/${pipelineId}/deals`, {
				params: toParams({ where })
			})
		);
	}
}
