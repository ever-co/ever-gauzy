import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { IOrganizationContact } from '@gauzy/contracts';
import { StorageService } from './storage.service';

@Injectable({
	providedIn: 'root',
})
export class ClientCacheService extends AbstractCacheService<
	IOrganizationContact[]
> {
	constructor(
		protected _storageService: StorageService<IOrganizationContact[]>
	) {
		super(_storageService);
		this.prefix = ClientCacheService.name.toString();
	}
}
