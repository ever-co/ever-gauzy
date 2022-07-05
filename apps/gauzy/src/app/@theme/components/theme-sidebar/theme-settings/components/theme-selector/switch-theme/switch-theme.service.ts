import { Injectable } from '@angular/core';
import { Store } from 'apps/gauzy/src/app/@core';

@Injectable({
	providedIn: 'root'
})
export class SwitchThemeService {
	private _isAlreadyLoaded: boolean = false;
	private _hasAlreadyPreferedTheme: boolean = false;

	constructor(private readonly store: Store) {
		this._hasAlreadyPreferedTheme = this.store.currentTheme ? true : false;
	}

	public get isAlreadyLoaded() {
		return this._isAlreadyLoaded;
	}

	public set isAlreadyLoaded(value: boolean) {
		this._isAlreadyLoaded = value;
	}

	public get hasAlreadyPreferedTheme() {
		return this._hasAlreadyPreferedTheme;
	}
}
