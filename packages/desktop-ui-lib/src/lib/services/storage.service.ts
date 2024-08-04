import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

export interface ICache<T> {
	expiresAt: Date;
	value: Observable<T>;
}

interface IHash<S, T> {
	key: S;
	cache: ICache<T>;
}

@Injectable({
	providedIn: 'root'
})
export class StorageService<T> {
	constructor() {}

	/**
	 * If the localStorage object exists, return it, otherwise return an empty object.
	 * @returns The localStorage object.
	 */
	private get _storage(): Storage {
		return localStorage;
	}

	/**
	 * It sets the value of the key in the storage.
	 * @param value - IHash<string, any>
	 */
	public async setItem(hash: IHash<string, T>): Promise<void> {
		const { expiresAt, value } = hash.cache;
		if (value && value instanceof Observable) {
			const toStore = await firstValueFrom(value);
			this._storage.setItem(hash.key, JSON.stringify({ expiresAt, value: toStore }));
		}
	}

	/**
	 * It gets an item from the local storage
	 * @param {string} key - The key of the item you want to get.
	 * @returns The value of the key in the storage.
	 */
	public getItem(key: string): ICache<T> {
		const stored = JSON.parse(this._storage.getItem(key));
		if (stored) {
			const { expiresAt, value } = stored;
			const value$ = new BehaviorSubject<T>(value);
			return { value: value$.asObservable(), expiresAt };
		} else {
			return null;
		}
	}

	/**
	 * It removes an item from the local storage
	 * @param {string} key - The key of the item you want to remove.
	 */
	public removeItem(key: string): void {
		this._storage.removeItem(key);
	}

	/**
	 * It clears the storage.
	 */
	public clear(): void {
		this._storage.clear();
	}

	/* Returning a copy of the storage object. */
	public getAllKeys(): string[] {
		return Object.keys(this._storage);
	}
}
