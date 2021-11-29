import { Injectable } from '@angular/core';
import { Service } from './service';
import { IDeal, IDealCreateInput, IDealFindInput } from '@gauzy/contracts';
import { HttpClient } from '@angular/common/http';
import { API_PREFIX } from '../constants/app.constants';
import { firstValueFrom } from 'rxjs';

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
		return firstValueFrom(
			this.http
				.get<IDeal[]>(`${this.basePath}`, { params: { data } })
		);
	}

	getOne(
		id: string,
		findInput?: IDealFindInput,
		relations?: string[]
	): Promise<IDeal> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http
				.get<IDeal>(`${this.basePath}/${id}`, { params: { data } })
		);
	}
}
