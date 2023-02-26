import { Injectable } from '@angular/core';
import { ICountsStatistics } from '@gauzy/contracts';
import { StorageService } from './storage.service';
import { AbstractCacheService } from './abstract-cache.service';

@Injectable({
	providedIn: 'root',
})
export class TimeLogCacheService extends AbstractCacheService<ICountsStatistics> {
	constructor(protected _storageService: StorageService<ICountsStatistics>) {
		super(_storageService);
		this.duration = 0;
		this.prefix = TimeLogCacheService.name.toString();
	}
}
