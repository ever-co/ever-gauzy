import { Store } from './store.service';
import { HttpClient } from '@angular/common/http';
import { Service } from './service';
import {
	Pipeline,
	PipelineCreateInput,
	PipelineFindInput
} from '@gauzy/models';
import { Injectable } from '@angular/core';

@Injectable()
export class PipelinesService extends Service<
	Pipeline,
  PipelineFindInput,
	PipelineCreateInput
> {
	public constructor(protected store: Store, protected http: HttpClient) {
		super({ http, basePath: '/api/pipelines' });
	}
}
