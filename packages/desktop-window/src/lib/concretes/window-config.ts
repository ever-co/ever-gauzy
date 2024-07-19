import { BrowserWindowConstructorOptions } from 'electron';
import { IWindowConfig } from '../interfaces';

import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

const Store = require('electron-store');
const store = new Store();

export class WindowConfig implements IWindowConfig {
	private _options?: BrowserWindowConstructorOptions;
	private _path: string;
	private _hash: string;

	constructor(hash: string, path: string, options?: BrowserWindowConstructorOptions) {
		this._hash = hash;
		this.path = path;
		this.options = {
			webPreferences: {
				nodeIntegration: true,
				webSecurity: false,
				contextIsolation: false,
				sandbox: false
			},
			title: '',
			show: false,
			center: true,
			icon: store.get('filePath').iconPath,
			...options
		};
	}

	public get options(): BrowserWindowConstructorOptions {
		return this._options;
	}
	public set options(value: BrowserWindowConstructorOptions) {
		this._options = value;
	}
	public get path(): string {
		return this._path;
	}
	public set path(value: string) {
		this._path = value;
	}
	public get hash(): string {
		return this._hash;
	}
	public set hash(value: string) {
		this._hash = value;
	}
}
