import { Injectable } from '@angular/core';
import { Store } from './store.service';
import { AbstractCacheService } from './abstract-cache.service';
import { StorageService } from './storage.service';
import * as moment from 'moment';
import { LinkedList } from '../offline-sync';
import { Observable } from 'rxjs';
import hash from 'hash-it';

interface IImageCache<T> {
	value: Observable<T>;
	object: T;
}

@Injectable({
	providedIn: 'root',
})
export class ImageCacheService extends AbstractCacheService<string> {
	private _lastCached: Date;
	private _limit: number;
	private _imageCacheList: LinkedList<IImageCache<string>>;

	constructor(
		protected _storageService: StorageService<string>,
		protected _store: Store
	) {
		super(_storageService, _store);
		this.prefix = ImageCacheService.name.toString();
		this.duration = 10 * 60 * 1000; // 10 minutes;
		this._lastCached = new Date();
		this._imageCacheList = new LinkedList();
		this._limit = 10; // Max 10 images in local storage;
	}

	public clear() {
		if (
			moment(new Date()).diff(this._lastCached, 'milliseconds') >
			this.duration
		) {
			super.clear();
			this._lastCached = new Date();
		}
	}

	public setValue(value: Observable<string>, object: string) {
		if (this._size > this._limit) {
			const imageCache = this._imageCacheList.tail;
			imageCache
				? this._storageService.removeItem(this._key(imageCache.data.object))
				: super.clear();
		}
		this._imageCacheList.append({ value, object });
		super.setValue(value, object);
	}

	public getValue(object: string): Observable<string> {
		let temp = this._imageCacheList.head;
		let item = null;
		while (!!temp) {
			if (temp.data.object === object) {
				item = temp.data.value;
				break;
			}
			temp = temp.next;
		}
		return !!item ? item : super.getValue(object);
	}

	private _key(object: string): string {
		return this.prefix.concat(hash(object).toString());
	}

	private get _size(): number {
		return this._storageService
			.getAllKeys()
			.filter((key: string) => key.includes(this.prefix)).length;
	}

	public get limit(): number {
		return this._limit;
	}

	public set limit(value: number) {
		this._limit = value;
	}
}
