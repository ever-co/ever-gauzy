import { Injectable } from '@angular/core';

@Injectable()
export class ElectronService {
	ipcRenderer: any;
	remote: any;
	desktopCapturer: any;
	shell: any;

	get isElectron(): boolean {
		return !!(window && window.process && window.process.type);
	}

	constructor() {
		// Conditional imports
		if (this.isElectron) {
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
