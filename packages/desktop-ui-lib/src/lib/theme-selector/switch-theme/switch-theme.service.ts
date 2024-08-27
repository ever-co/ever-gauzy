import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class SwitchThemeService {
	private _isAlreadyLoaded: boolean = false;
	private _hasAlreadyPreferredTheme: boolean = false;

	constructor() {
		this._hasAlreadyPreferredTheme = null;
	}

	public get isAlreadyLoaded() {
		return this._isAlreadyLoaded;
	}

	public set isAlreadyLoaded(value: boolean) {
		this._isAlreadyLoaded = value;
	}

	public get hasAlreadyPreferredTheme() {
		return this._hasAlreadyPreferredTheme;
	}
}
