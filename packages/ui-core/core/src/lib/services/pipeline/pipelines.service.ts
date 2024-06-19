import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IDeal, IPagination, IPipeline, IPipelineCreateInput, IPipelineFindInput } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { Service } from '../crud/service';

@Injectable()
export class PipelinesService extends Service<IPipeline, IPipelineFindInput, IPipelineCreateInput> {
	public constructor(http: HttpClient) {
		super({ http, basePath: `${API_PREFIX}/pipelines` });
	}

	getAll(relations?: string[], findInput?: IPipelineFindInput): Promise<IPagination<IPipeline>> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http.get<IPagination<IPipeline>>(`${this.basePath}`, {
				params: { data }
			})
		);
	}

	public findDeals(id: string, findInput?: IPipelineFindInput): Promise<IPagination<IDeal>> {
		const data = JSON.stringify({ findInput });
		return firstValueFrom(this.http.get<IPagination<IDeal>>(`${this.basePath}/${id}/deals`, { params: { data } }));
	}
}
