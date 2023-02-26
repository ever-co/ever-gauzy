import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { IUserOrganization } from '@gauzy/contracts';
import { StorageService } from './storage.service';

@Injectable({
	providedIn: 'root',
})
export class OrganizationsCacheService extends AbstractCacheService<{
	items: IUserOrganization[];
	total: number;
}> {
	constructor(
		protected _storageService: StorageService<{
			items: IUserOrganization[];
			total: number;
		}>
	) {
		super(_storageService);
		this.prefix = OrganizationsCacheService.name.toString();
	}
}
