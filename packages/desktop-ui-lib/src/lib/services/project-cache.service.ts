import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { IOrganizationProject } from '@gauzy/contracts';
import { StorageService } from './storage.service';
import { Store } from 'apps/desktop-timer/src/app/auth/services/store.service';

@Injectable({
	providedIn: 'root',
})
export class ProjectCacheService extends AbstractCacheService<
	IOrganizationProject[]
> {
	constructor(
		protected _storageService: StorageService<IOrganizationProject[]>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = ProjectCacheService.name.toString();
	}
}
