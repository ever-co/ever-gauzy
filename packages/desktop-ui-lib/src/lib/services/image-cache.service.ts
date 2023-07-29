import { Injectable } from '@angular/core';
import { Store } from './store.service';
import { AbstractCacheService } from './abstract-cache.service';
import { StorageService } from './storage.service';
import * as moment from 'moment';

@Injectable({
	providedIn: 'root',
})
export class ImageCacheService extends AbstractCacheService<string> {
	private _lastCached: Date;
	constructor(
		protected _storageService: StorageService<string>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = ImageCacheService.name.toString();
		this.duration = 10 * 60 * 1000; // 10 minutes
		this._lastCached = null;
	}

	public clear() {
		if (
			!this._lastCached ||
			moment(new Date()).diff(this._lastCached, 'milliseconds') >
			this.duration
		) {
			super.clear();
			this._lastCached = new Date();
		}
	}
}
