import { Injectable } from '@angular/core';
import { StorageService, Store } from '../services';
import { IOrganizationTeam } from '@gauzy/contracts';
import { AbstractCacheService } from './abstract-cache.service';

@Injectable({
	providedIn: 'root',
})
export class TeamsCacheService extends AbstractCacheService<
	IOrganizationTeam[]
> {
	constructor(
		protected _storageService: StorageService<IOrganizationTeam[]>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = TeamsCacheService.name.toString();
	}
}
