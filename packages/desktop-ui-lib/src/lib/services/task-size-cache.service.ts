import { Injectable } from '@angular/core';
import { StorageService, Store } from '../services';
import { ITaskSize } from '@gauzy/contracts';
import { AbstractCacheService } from './abstract-cache.service';

@Injectable({
	providedIn: 'root',
})
export class TaskSizeCacheService extends AbstractCacheService<ITaskSize[]> {
	constructor(
		protected _storageService: StorageService<ITaskSize[]>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = TaskSizeCacheService.name.toString();
		this.duration = 24 * 3600 * 1000 * 7; // 1 week
	}
}
