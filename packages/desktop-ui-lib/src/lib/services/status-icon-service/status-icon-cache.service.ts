import { Injectable } from '@angular/core';
import { StorageService, Store } from '../index';
import { AbstractCacheService } from '../abstract-cache.service';

@Injectable({
	providedIn: 'root',
})
export class StatusIconCacheService extends AbstractCacheService<string> {
	constructor(
		protected _storageService: StorageService<string>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = StatusIconCacheService.name.toString();
		this.duration = Infinity; // No expiration
	}
}
