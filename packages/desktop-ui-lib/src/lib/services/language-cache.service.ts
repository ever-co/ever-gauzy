import { Injectable } from '@angular/core';
import { ILanguage } from '@gauzy/contracts';
import { AbstractCacheService, Store } from '../services';
import { StorageService } from './storage.service';

@Injectable({
	providedIn: 'root',
})
export class LanguageCacheService extends AbstractCacheService<{
	items: ILanguage[];
}> {
	constructor(
		protected _storageService: StorageService<{ items: ILanguage[] }>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = LanguageCacheService.name.toString();
		this.duration = 24 * 3600 * 1000; // 24 Hours
	}
}
