import { Store } from '@gauzy/ui-sdk/common';
import { HttpClient } from '@angular/common/http';
import { Service } from './service';
import { IDeal, IPipeline, IPipelineCreateInput, IPipelineFindInput } from '@gauzy/contracts';
import { Injectable } from '@angular/core';
import { API_PREFIX } from '@gauzy/ui-sdk/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PipelinesService extends Service<IPipeline, IPipelineFindInput, IPipelineCreateInput> {
	public constructor(protected store: Store, protected http: HttpClient) {
		super({ http, basePath: `${API_PREFIX}/pipelines` });
	}

	getAll(relations?: string[], findInput?: IPipelineFindInput): Promise<{ items: IPipeline[] }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http.get<{ items: IPipeline[]; total: number }>(`${this.basePath}`, {
				params: { data }
			})
		);
	}

	public findDeals(id: string, findInput?: IPipelineFindInput): Promise<{ items: IDeal[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return firstValueFrom(
			this.http.get<{ items: IDeal[]; total: number }>(`${this.basePath}/${id}/deals`, { params: { data } })
		);
	}
}
