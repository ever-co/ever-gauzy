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
		// Conditional imports
		if (this.isElectron) {
			this.ipcRenderer = window.require('electron').ipcRenderer;
			this.remote = window.require('@electron/remote');
			this.shell = window.require('electron').shell;
			this.desktopCapturer = {
				getSources: (opts) =>
					this.ipcRenderer.invoke(
						'DESKTOP_CAPTURER_GET_SOURCES',
						opts
					)
			};
		}
	}
}
