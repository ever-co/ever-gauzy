import { Injectable } from '@angular/core';
import { Service } from './service';
import { IDeal, IDealCreateInput, IDealFindInput } from '@gauzy/models';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class DealsService extends Service<
	IDeal,
	IDealFindInput,
	IDealCreateInput
> {
	public constructor(protected http: HttpClient) {
		super({ http, basePath: '/api/deals' });
	}
}
