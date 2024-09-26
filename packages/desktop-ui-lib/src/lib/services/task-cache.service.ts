import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { ITask } from '@gauzy/contracts';
import { StorageService } from './storage.service';
import { Store } from '../services';

@Injectable({
	providedIn: 'root',
})
export class TaskCacheService extends AbstractCacheService<ITask[]> {
	constructor(
		protected _storageService: StorageService<ITask[]>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = TaskCacheService.name.toString();
		this.duration = 24 * 3600 * 1000; // 1 day
	}
}
