import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { IEmployee } from 'packages/contracts/dist';
import { StorageService } from './storage.service';

@Injectable({
	providedIn: 'root',
})
export class EmployeeCacheService extends AbstractCacheService<IEmployee> {
	constructor(protected _storageService: StorageService<IEmployee>) {
		super(_storageService);
		this.prefix = EmployeeCacheService.name.toString();
	}
}
