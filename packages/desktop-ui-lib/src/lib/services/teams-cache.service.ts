import { Injectable } from '@angular/core';
import { IOrganizationTeam, IPagination } from '@gauzy/contracts';
import { StorageService, Store } from '../services';
import { AbstractCacheService } from './abstract-cache.service';

@Injectable({
	providedIn: 'root'
})
export class TeamsCacheService extends AbstractCacheService<IOrganizationTeam[] | IPagination<IOrganizationTeam>> {
	constructor(
		protected _storageService: StorageService<IOrganizationTeam[] | IPagination<IOrganizationTeam>>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = TeamsCacheService.name.toString();
		this.duration = 24 * 3600 * 1000; // 1 day
	}
}
