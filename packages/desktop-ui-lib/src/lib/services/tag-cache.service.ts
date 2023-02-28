import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { ITag } from '@gauzy/contracts';
import { StorageService } from './storage.service';
import { Store } from 'apps/desktop-timer/src/app/auth/services/store.service';

@Injectable({
	providedIn: 'root'
})
export class TagCacheService extends AbstractCacheService<{
	items: ITag[];
	total: number;
}> {
	constructor(
		protected _storageService: StorageService<{
			items: ITag[];
			total: number;
		}>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = TagCacheService.name.toString();
		this.duration = 10080; // 1 week
	}
}
