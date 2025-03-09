import { Injectable } from '@angular/core';

@Injectable()
export class ElectronService {
	ipcRenderer: any;
	remote: any;
	desktopCapturer: any;
	shell: any;

	/**
	 * Checks if the application is running in the Electron environment.
	 */
	get isElectron(): boolean {
		return !!(window && (window as any).process && (window as any).process.type);
	}

	get isContextBridge(): boolean {
		return !!(window && (window as any).electronAPI);
	}

	constructor() {
		// Conditional imports
		if (this.isElectron) {
			this.ipcRenderer = (window as any)['require']('electron').ipcRenderer;
			this.remote = (window as any)['require']('@electron/remote');
			this.shell = (window as any)['require']('electron').shell;
			this.desktopCapturer = {
				getSources: async (opts: any) => await this.ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', opts)
			};
		} else if (this.isContextBridge) {
			const electronAPI = (window as any).electronAPI;
			this.ipcRenderer = electronAPI.ipcRenderer;
			this.remote = electronAPI.remote;
			this.shell = electronAPI.shell;
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
