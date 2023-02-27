import { Injectable } from '@angular/core';
import { ICountsStatistics } from '@gauzy/contracts';
import { StorageService } from './storage.service';
import { AbstractCacheService } from './abstract-cache.service';
import { Store } from 'apps/desktop-timer/src/app/auth/services/store.service';

@Injectable({
	providedIn: 'root',
})
export class TimeLogCacheService extends AbstractCacheService<ICountsStatistics> {
	constructor(
		protected _storageService: StorageService<ICountsStatistics>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.duration = 0;
		this.prefix = TimeLogCacheService.name.toString();
	}
}
