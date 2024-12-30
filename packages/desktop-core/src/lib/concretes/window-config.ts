import { BrowserWindowConstructorOptions } from 'electron';
import { Store } from '../electron-helpers'
import { IWindowConfig } from '../interfaces';

export class WindowConfig implements IWindowConfig {
	private _options?: BrowserWindowConstructorOptions;
	private _path: string;
	private _hash: string;

	constructor(hash: string, path: string, options?: BrowserWindowConstructorOptions) {
		this._hash = hash;
		this._path = path;

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
			icon:  Store.get('filePath').iconPath,
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
