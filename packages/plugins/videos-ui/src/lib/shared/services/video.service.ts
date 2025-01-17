import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { toParams } from '@gauzy/ui-core/common';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { IVideo } from '../models/video.model';
import { IPagination } from '@gauzy/contracts';
import { Observable } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class VideoService {
	private readonly API_ENDPOINT = `${API_PREFIX}/plugins/videos`;
	constructor(private readonly http: HttpClient) {}

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
}
