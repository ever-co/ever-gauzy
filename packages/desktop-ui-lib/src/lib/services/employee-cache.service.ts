import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { IEmployee } from '@gauzy/contracts';
import { StorageService } from './storage.service';
import { Store } from '../services';

@Injectable({
	providedIn: 'root',
})
export class EmployeeCacheService extends AbstractCacheService<IEmployee> {
	constructor(
		protected _storageService: StorageService<IEmployee>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = EmployeeCacheService.name.toString();
	}
}
