import { Injectable } from '@angular/core';
import { ipcRenderer, desktopCapturer, shell } from 'electron';
import * as remote from '@electron/remote';

@Injectable()
export class ElectronService {
	ipcRenderer: typeof ipcRenderer;
	remote: typeof remote | any;
	desktopCapturer: typeof desktopCapturer;
	shell: typeof shell;

	/**
	 * Checks if the application is running in the Electron environment.
	 */
	get isElectron(): boolean {
		return !!(window && (window as any).process && (window as any).process.type);
	}

	get isContextBridge():boolean {
		return !!(window && (window as any).electronAPI);
	}

	constructor() {
		// Conditional imports because we only want to load modules inside Electron App
		if (this.isElectron) {
			// Previously we used that class to on-demand load the electron-log module, but now we load it in the header of this file.
			// Still we want to keep that way to "require" it for now
			this.ipcRenderer = window.require('electron').ipcRenderer;
			this.remote = window.require('@electron/remote');
			this.shell = window.require('electron').shell;
		} else if (this.isContextBridge) {
			const electronAPI = (window as any).electronAPI;
			this.ipcRenderer = electronAPI.ipcRenderer;
			this.remote = electronAPI.remote;
			this.shell = electronAPI.shell;
		}
		this.desktopCapturer = {
			getSources: async (opts) =>
				await this.ipcRenderer.invoke(
					'DESKTOP_CAPTURER_GET_SOURCES',
					opts
				),
		};
	}
}
