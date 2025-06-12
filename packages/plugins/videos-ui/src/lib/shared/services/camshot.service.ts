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
	constructor(private readonly http: HttpClient) { }

	public getAll<T>(params?: T): Observable<IPagination<ICamshot>> {
		return this.http.get<IPagination<ICamshot>>(this.API_ENDPOINT, {
			params: toParams(params)
		});
	}
}
