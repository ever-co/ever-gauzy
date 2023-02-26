import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { ITimeSlot } from '@gauzy/contracts';
import { StorageService } from './storage.service';

@Injectable({
	providedIn: 'root',
})
export class TimeSlotCacheService extends AbstractCacheService<ITimeSlot[]> {
	constructor(protected _storageService: StorageService<ITimeSlot[]>) {
		super(_storageService);
		this.prefix = TimeSlotCacheService.name.toString();
	}
}
