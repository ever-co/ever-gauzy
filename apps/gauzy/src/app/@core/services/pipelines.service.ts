import { Store } from './store.service';
import { HttpClient } from '@angular/common/http';
import { Service } from './service';
import {
	IDeal,
	IPipeline,
	IPipelineCreateInput,
	IPipelineFindInput
} from '@gauzy/models';
import { Injectable } from '@angular/core';

@Injectable()
export class PipelinesService extends Service<
	IPipeline,
	IPipelineFindInput,
	IPipelineCreateInput
> {
	public constructor(protected store: Store, protected http: HttpClient) {
		super({ http, basePath: '/api/pipelines' });
	}

	getAll(
		relations?: string[],
		findInput?: IPipelineFindInput
	): Promise<{ items: IPipeline[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IPipeline[]; total: number }>(`${this.basePath}`, {
				params: { data }
			})
			.toPromise();
	}

	public findDeals(
		id: string,
		findInput?: IPipelineFindInput
	): Promise<{ items: IDeal[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<{ items: IDeal[]; total: number }>(
				`${this.basePath}/${id}/deals`,
				{ params: { data } }
			)
			.toPromise();
	}
}
