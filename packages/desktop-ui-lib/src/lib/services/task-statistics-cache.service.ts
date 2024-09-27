import { Injectable } from '@angular/core';
import { ITasksStatistics } from '@gauzy/contracts';
import { Store } from '.';
import { AbstractCacheService } from './abstract-cache.service';
import { StorageService } from './storage.service';

@Injectable({
	providedIn: 'root'
})
export class TaskStatisticsCacheService extends AbstractCacheService<ITasksStatistics[]> {
	constructor(protected _storageService: StorageService<ITasksStatistics[]>, protected _store: Store) {
		super(_storageService, _store);
		this.prefix = TaskStatisticsCacheService.name.toString();
		this.duration = 600 * 1000; // 1O minutes
	}
}
