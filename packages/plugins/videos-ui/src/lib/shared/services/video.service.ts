import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { catchError, map, Observable, of } from 'rxjs';
import { IVideo } from '../models/video.model';

@Injectable({
	providedIn: 'root'
})
export class VideoService {
	private readonly API_ENDPOINT = `${API_PREFIX}/plugins/videos`;
	constructor(private readonly http: HttpClient, private readonly store: Store) {}

	public getAll<T>(params?: T): Observable<IPagination<IVideo>> {
		return this.http.get<IPagination<IVideo>>(this.API_ENDPOINT, {
			params: toParams(params)
		});
	}

	public getOne<T>(id: string, params?: T): Observable<IVideo> {
		return this.http.get<IVideo>(`${this.API_ENDPOINT}/${id}`, { params: toParams(params) });
	}

	public update(id: string, video: Partial<IVideo>): Observable<IVideo> {
		return this.http.put<IVideo>(`${this.API_ENDPOINT}/${id}`, video);
	}

	public delete(id: string): Observable<void> {
		return this.http.delete<void>(`${this.API_ENDPOINT}/${id}`);
	}

	public getCount<T>(params?: T): Observable<number> {
		return this.http.get<number>(`${this.API_ENDPOINT}/count`, {
			params: toParams(params)
		});
	}

	public get isAvailable$(): Observable<boolean> {
		const { id: selectedOrganizationId } = this.store.selectedOrganization;
		const organizationId = selectedOrganizationId || this.store.organizationId;
		const tenantId = this.store.tenantId;

		if (!organizationId || !tenantId) {
			return of(false);
		}

		return this.getCount({ organizationId, tenantId }).pipe(
			map((count) => count > 0),
			catchError(() => of(false))
		);
	}
}
