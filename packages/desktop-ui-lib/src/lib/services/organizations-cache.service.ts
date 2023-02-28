import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { IUserOrganization } from '@gauzy/contracts';
import { StorageService } from './storage.service';
import { Store } from 'apps/desktop-timer/src/app/auth/services/store.service';

@Injectable({
	providedIn: 'root'
})
export class OrganizationsCacheService extends AbstractCacheService<{
	items: IUserOrganization[];
	total: number;
}> {
	constructor(
		protected _storageService: StorageService<{
			items: IUserOrganization[];
			total: number;
		}>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = OrganizationsCacheService.name.toString();
	}
}
