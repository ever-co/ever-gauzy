import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { ITimeSlot } from '@gauzy/contracts';
import { StorageService } from './storage.service';
import { Store } from '../services';

@Injectable({
	providedIn: 'root',
})
export class TimeSlotCacheService extends AbstractCacheService<ITimeSlot> {
	constructor(
		protected _storageService: StorageService<ITimeSlot>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = TimeSlotCacheService.name.toString();
	}
}
