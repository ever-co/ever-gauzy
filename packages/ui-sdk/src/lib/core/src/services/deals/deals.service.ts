import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IDeal, IDealCreateInput, IDealFindInput } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-sdk/common';
import { firstValueFrom } from 'rxjs';
import { Service } from '../crud/service';

@Injectable()
export class DealsService extends Service<IDeal, IDealFindInput, IDealCreateInput> {
	public constructor(protected http: HttpClient) {
		super({ http, basePath: `${API_PREFIX}/deals` });
	}

	getAll(findInput?: IDealFindInput, relations?: string[]): Promise<IDeal[]> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(this.http.get<IDeal[]>(`${this.basePath}`, { params: { data } }));
	}

	getOne(id: string, findInput?: IDealFindInput, relations?: string[]): Promise<IDeal> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(this.http.get<IDeal>(`${this.basePath}/${id}`, { params: { data } }));
	}
}
