import { BrowserWindowConstructorOptions } from 'electron';
import Store from 'electron-store';
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

import { IWindowConfig } from '../interfaces';

const store = new Store();

interface FilePath {
    iconPath: string;
}

export class WindowConfig implements IWindowConfig {
	private _options?: BrowserWindowConstructorOptions;
	private _path: string;
	private _hash: string;

	constructor(hash: string, path: string, options?: BrowserWindowConstructorOptions) {
		this._hash = hash;
		this._path = path;

		const filePath = store.get('filePath') as FilePath;
		const icon = filePath.iconPath;

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
			icon,
			...options
		};
	}

	public get options(): BrowserWindowConstructorOptions | undefined {
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
