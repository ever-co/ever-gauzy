import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import * as remoteMain from '@electron/remote/main';
import * as url from 'url';
const Store = require('electron-store');
const store = new Store();

export class SplashScreen {
	private _options: BrowserWindowConstructorOptions;
	private _window: BrowserWindow;
	private _filePath: string;

	constructor(private readonly path: string) {
		const filePath = store.get('filePath');
		if (process.platform === 'linux') {
			this._options.icon = filePath.iconPath;
		}
		this._filePath = path;
		this._options = {
			frame: false,
			transparent: true,
			width: 300,
			height: 240,
			center: true
		}
		this._window = new BrowserWindow(this._options);
		remoteMain.enable(this._window.webContents);
		this._window.setMenuBarVisibility(false);
		this._window.hide();
		this._window.on('close', (e) => {
			e.preventDefault();
			this._window.hide();
		});
	}

	public async loadURL(): Promise<void> {
		if (!this._filePath) return;
		try {
			const launchPath = url.format({
				pathname: this._filePath,
				protocol: 'file:',
				slashes: true,
				hash: '/splash-screen'
			});
			await this._window.loadURL(launchPath);
			console.log('launched electron with:', launchPath);
		} catch (error) {
			console.log(error)
		}
	}

	public show(): void {
		if (!this._window) return;
		this._window.show();
	}

	public close(): void {
		if (!this._window) return;
		this._window.hide();
		this._window.destroy();
		this._window = null;
	}
}
