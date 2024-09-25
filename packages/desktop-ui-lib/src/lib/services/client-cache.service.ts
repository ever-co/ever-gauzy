import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { IOrganizationContact, IPagination } from '@gauzy/contracts';
import { StorageService } from './storage.service';
import { Store } from '../services';

@Injectable({
	providedIn: 'root',
})
export class ClientCacheService extends AbstractCacheService<
	IOrganizationContact[] | IPagination<IOrganizationContact>
> {
	constructor(
		protected _storageService: StorageService<IOrganizationContact[] | IPagination<IOrganizationContact>>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = ClientCacheService.name.toString();
		this.duration = 24 * 3600 * 1000; // 1 day
	}
}
