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

	public findDeals(id: string): Promise<{ items: IDeal[]; total: number }> {
		return this.http
			.get<{ items: IDeal[]; total: number }>(
				`${this.basePath}/${id}/deals`
			)
			.toPromise();
	}
}
