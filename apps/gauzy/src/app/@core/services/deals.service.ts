import { Injectable } from '@angular/core';
import { Service } from './service';
import { Deal, DealCreateInput, DealFindInput } from '@gauzy/models';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class DealsService extends Service<
	Deal,
	DealFindInput,
	DealCreateInput
> {
	public constructor(protected http: HttpClient) {
		super({ http, basePath: '/api/deals' });
	}
}
