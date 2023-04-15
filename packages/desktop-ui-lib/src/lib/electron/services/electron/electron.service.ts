import { Injectable } from '@angular/core';
import { ipcRenderer, desktopCapturer, shell } from 'electron';
import * as remote from '@electron/remote';

@Injectable()
export class ElectronService {
	ipcRenderer: typeof ipcRenderer;
	remote: typeof remote;
	desktopCapturer: typeof desktopCapturer;
	shell: typeof shell;

	get isElectron(): boolean {
		return !!(window && window.process && window.process.type);
	}

	constructor() {
		// Conditional imports because we only want to load modules inside Electron App
		if (this.isElectron) {
			// Previously we used that class to on-demand load the electron-log module, but now we load it in the header of this file.
			// Still we want to keep that way to "require" it for now
			this.ipcRenderer = window.require('electron').ipcRenderer;
			this.remote = window.require('@electron/remote');
			this.shell = window.require('electron').shell;
			this.desktopCapturer = {
				getSources: async (opts) =>
					await this.ipcRenderer.invoke(
						'DESKTOP_CAPTURER_GET_SOURCES',
						opts
					),
			};
		}
	}
}
