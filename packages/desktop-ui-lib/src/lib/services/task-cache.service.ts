import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { ITask } from '@gauzy/contracts';
import { StorageService } from './storage.service';

@Injectable({
	providedIn: 'root',
})
export class TaskCacheService extends AbstractCacheService<ITask[]> {
	constructor(protected _storageService: StorageService<ITask[]>) {
		super(_storageService);
		this.prefix = TaskCacheService.name.toString();
	}
}
