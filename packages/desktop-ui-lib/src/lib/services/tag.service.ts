import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { concatMap, firstValueFrom, map, shareReplay } from 'rxjs';
import { IPagination, ITag } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { TagCacheService } from './tag-cache.service';
import { Store } from './store.service';
import { API_PREFIX } from '../constants';

@Injectable({
	providedIn: 'root'
})
export class TagService {
	constructor(
		private readonly _http: HttpClient,
		private readonly _tagCacheService: TagCacheService,
		private readonly _store: Store
	) {}

	public create(tag: Partial<ITag>): Promise<ITag[]> {
		return firstValueFrom(
			this._http.post<ITag>(`${API_PREFIX}/tags`, tag).pipe(
				concatMap(() => {
					this._tagCacheService.clear();
					return this.getTags();
				})
			)
		);
	}

	public getTags(): Promise<ITag[]> {
		const params = {
			organizationId: this._store.organizationId,
			tenantId: this._store.tenantId
		};
		let tags$ = this._tagCacheService.getValue(params);
		if (!tags$) {
			tags$ = this._http
				.get(`${API_PREFIX}/tags/level`, {
					params: toParams(params)
				})
				.pipe(
					map((response: IPagination<ITag>) => response.items),
					shareReplay(1)
				);
			this._tagCacheService.setValue(tags$, params);
		}
		return firstValueFrom(tags$);
	}
}
