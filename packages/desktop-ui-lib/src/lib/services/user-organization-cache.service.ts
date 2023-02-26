import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { IUserOrganization } from '@gauzy/contracts';
import { StorageService } from './storage.service';

@Injectable({
	providedIn: 'root',
})
export class UserOrganizationCacheService extends AbstractCacheService<IUserOrganization> {
	constructor(protected _storageService: StorageService<IUserOrganization>) {
		super(_storageService);
		this.prefix = UserOrganizationCacheService.name.toString();
	}
}
