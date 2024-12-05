import * as moment from 'moment';
import { Observable } from 'rxjs';
import { ICache, StorageService } from './storage.service';
import { Store } from '../services';
import hash from 'hash-it';

export abstract class AbstractCacheService<T> {
	private readonly _DEFAULT_KEY = 'DEFAULT';
	private _duration: number; // Cache duration value in minutes;
	private _prefix: string;
	private _cache: {
		[id: string]: ICache<T>;
	} = {};

	constructor(
		protected _storageService: StorageService<T>,
		protected _store: Store
	) {
		this._duration = 500; // Default cache set to 500 milliseconds
		this._prefix = '';
	}

	public getValue(object?: any): Observable<T> {
		const key = object
			? this.prefix.concat(hash(object).toString())
			: this._DEFAULT_KEY;
		const item = this._cache[key]
			? this._cache[key]
			: this._storageService.getItem(key);

		if (!item) {
			return null;
		}
		if (this._store.isOffline) {
			/*
			^_^ Ignore expire date
			 */
		} else if (moment(new Date()).isAfter(item.expiresAt)) {
			return null;
		}
		return item.value;
	}

	public setValue(value: Observable<T>, object?: any) {
		const key = object
			? this.prefix.concat(hash(object).toString())
			: this._DEFAULT_KEY;
		const expiresAt = moment(new Date())
			.add(this._duration, 'milliseconds')
			.toDate();
		this._cache[key] = { expiresAt, value };
		this._storageService.setItem({ key, cache: this._cache[key] });
	}

	public clear() {
		this._cache = {};
		this._storageService.getAllKeys().forEach((key: string) => {
			if (key.includes(this.prefix)) {
				this._storageService.removeItem(key);
			}
		});
	}

	protected get duration(): number {
		return this._duration;
	}

	protected set duration(value: number) {
		this._duration = value;
	}

	protected get prefix(): string {
		return this._prefix;
	}

	protected set prefix(value: string) {
		this._prefix = hash(value).toString().concat('_');
	}
}
