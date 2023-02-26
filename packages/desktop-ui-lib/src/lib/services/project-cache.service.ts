import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { IOrganizationProject } from '@gauzy/contracts';
import { StorageService } from './storage.service';

@Injectable({
	providedIn: 'root',
})
export class ProjectCacheService extends AbstractCacheService<
	IOrganizationProject[]
> {
	constructor(
		protected _storageService: StorageService<IOrganizationProject[]>
	) {
		super(_storageService);
		this.prefix = ProjectCacheService.name.toString();
	}
}
