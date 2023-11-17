import { Injectable } from '@angular/core';
import { StorageService, Store } from '../services';
import { ITaskPriority } from '@gauzy/contracts';
import { AbstractCacheService } from './abstract-cache.service';

@Injectable({
	providedIn: 'root',
})
export class TaskPriorityCacheService extends AbstractCacheService<
	ITaskPriority[]
> {
	constructor(
		protected _storageService: StorageService<ITaskPriority[]>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = TaskPriorityCacheService.name.toString();
		this.duration = 24 * 3600 * 1000 * 7; // 1 week
	}
}
