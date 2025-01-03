import { BrowserWindowConstructorOptions } from 'electron';
import { Store, setupElectronLog } from '../electron-helpers';
import { IWindowConfig } from '../interfaces';

// Set up Electron log
setupElectronLog();

export class WindowConfig implements IWindowConfig {
	private _options?: BrowserWindowConstructorOptions;
	private _path: string;
	private _hash: string;

	constructor(hash: string, path: string, options?: BrowserWindowConstructorOptions) {
		this._hash = hash;
		this._path = path;

		this._options = {
			webPreferences: {
				nodeIntegration: true,
				webSecurity: false,
				contextIsolation: false,
				sandbox: false
			},
			title: '',
			show: false,
			center: true,
			icon: Store.get('filePath')?.iconPath,
			...options
		};
	}

	// Getter and setter for BrowserWindow options
	public get options(): BrowserWindowConstructorOptions | undefined {
		return this._options;
	}
	public set options(value: BrowserWindowConstructorOptions | undefined) {
		this._options = value;
	}

	// Getter and setter for the file path
	public get path(): string {
		return this._path;
	}
	public set path(value: string) {
		this._path = value;
	}

	// Getter and setter for the hash
	public get hash(): string {
		return this._hash;
	}
	public set hash(value: string) {
		this._hash = value;
	}
}
