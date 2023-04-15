export class ElectronService {
	static ipcRenderer: any;
	static remote: any;
	static desktopCapturer: any;
	static shell: any;

	static get isElectron(): boolean {
		return !!(window && window.process && window.process.type);
	}

	constructor() {
		// Conditional imports
		if (ElectronService.isElectron) {
			ElectronService.ipcRenderer =
				window.require('electron').ipcRenderer;
			ElectronService.remote = window.require('@electron/remote');
			ElectronService.shell = window.require('electron').shell;
			ElectronService.desktopCapturer = {
				getSources: async (opts) =>
					await ElectronService.ipcRenderer.invoke(
						'DESKTOP_CAPTURER_GET_SOURCES',
						opts
					),
			};
		}
	}
}
