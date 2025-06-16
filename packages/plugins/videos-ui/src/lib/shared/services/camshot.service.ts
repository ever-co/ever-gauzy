import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { Observable } from 'rxjs';
import { ICamshot } from '../models/camshot.model';

@Injectable({
	providedIn: 'root'
})
export class CamshotService {
	private readonly API_ENDPOINT = `${API_PREFIX}/plugins/camshots`;

	constructor(private readonly http: HttpClient) {}

	public getAll<T>(params?: T): Observable<IPagination<ICamshot>> {
		return this.http.get<IPagination<ICamshot>>(this.API_ENDPOINT, {
			params: toParams(params)
		});
	}

	public getOne<T>(id: string, params?: T): Observable<ICamshot> {
		return this.http.get<ICamshot>(`${this.API_ENDPOINT}/${id}`, { params: toParams(params) });
	}

	public restore(id: string): Observable<ICamshot> {
		return this.http.patch<ICamshot>(`${this.API_ENDPOINT}/${id}`, {});
	}

	public delete<T>(id: string, params: T): Observable<void> {
		return this.http.delete<void>(`${this.API_ENDPOINT}/${id}`, {
			params: toParams(params)
		});
	}

	public getCount<T>(params?: T): Observable<number> {
		return this.http.get<number>(`${this.API_ENDPOINT}/count`, {
			params: toParams(params)
		});
	}
}
