import { Injectable } from '@angular/core';
import { ITaskStatus } from '@gauzy/contracts';
import { AbstractCacheService } from './abstract-cache.service';
import { StorageService } from './storage.service';
import { Store } from './store.service';

@Injectable({
	providedIn: 'root',
})
export class TaskStatusCacheService extends AbstractCacheService<
	ITaskStatus[]
> {
	constructor(
		protected _storageService: StorageService<ITaskStatus[]>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = TaskStatusCacheService.name.toString();
		this.duration = 24 * 3600 * 1000 * 7; // 1 week
	}
}
