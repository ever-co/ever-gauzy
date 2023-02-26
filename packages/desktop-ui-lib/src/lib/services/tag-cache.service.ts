import { Injectable } from '@angular/core';
import { AbstractCacheService } from './abstract-cache.service';
import { ITag } from '@gauzy/contracts';
import { StorageService } from './storage.service';

@Injectable({
	providedIn: 'root',
})
export class TagCacheService extends AbstractCacheService<{
	items: ITag[];
	total: number;
}> {
	constructor(
		protected _storageService: StorageService<{
			items: ITag[];
			total: number;
		}>
	) {
		super(_storageService);
		this.prefix = TagCacheService.name.toString();
	}
}
