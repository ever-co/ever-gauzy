import { Injectable } from '@angular/core';
import { Service } from './service';
import { IDeal, IDealCreateInput, IDealFindInput } from '@gauzy/contracts';
import { HttpClient } from '@angular/common/http';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class DealsService extends Service<
	IDeal,
	IDealFindInput,
	IDealCreateInput
> {
	public constructor(protected http: HttpClient) {
		super({ http, basePath: `${API_PREFIX}/deals` });
	}

	getAll(findInput?: IDealFindInput, relations?: string[]): Promise<IDeal[]> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<IDeal[]>(`${this.basePath}`, { params: { data } })
			.pipe()
			.toPromise();
	}

	getOne(
		id: string,
		findInput?: IDealFindInput,
		relations?: string[]
	): Promise<IDeal> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<IDeal>(`${this.basePath}/${id}`, { params: { data } })
			.pipe()
			.toPromise();
	}
}
