import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class WindowService {
	private _windows: any[] = [];

	constructor() {}

	public get windows(): any[] {
		return this._windows;
	}
	public set windows(value: any[]) {
		this._windows = value;
	}
}
