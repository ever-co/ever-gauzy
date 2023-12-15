import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { ITag } from '@gauzy/contracts';
import { StorageService } from './storage.service';
import { Store } from '../services';

@Injectable({
	providedIn: 'root',
})
export class TagCacheService extends AbstractCacheService<ITag[]> {
	constructor(
		protected _storageService: StorageService<ITag[]>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = TagCacheService.name.toString();
		this.duration = 24 * 3600 * 7 * 1000; // 1 week
	}
}
