import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class SwitchThemeService {
	private _isAlreadyLoaded: boolean = false;
	constructor() {}

	public get isAlreadyLoaded() {
		return this._isAlreadyLoaded;
	}

	public set isAlreadyLoaded(value: boolean) {
		this._isAlreadyLoaded = value;
	}
}
