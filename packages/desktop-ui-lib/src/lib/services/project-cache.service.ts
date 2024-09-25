import { Injectable } from '@angular/core';
import { IOrganizationProject, IPagination } from '@gauzy/contracts';
import { Store } from '../services';
import { AbstractCacheService } from './abstract-cache.service';
import { StorageService } from './storage.service';

@Injectable({
	providedIn: 'root'
})
export class ProjectCacheService extends AbstractCacheService<
	IOrganizationProject[] | IPagination<IOrganizationProject>
> {
	constructor(
		protected _storageService: StorageService<IOrganizationProject[] | IPagination<IOrganizationProject>>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = ProjectCacheService.name.toString();
		this.duration = 24 * 3600 * 1000; // 1 day
	}
}
