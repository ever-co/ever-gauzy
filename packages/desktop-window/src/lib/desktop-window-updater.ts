import { BrowserWindow } from 'electron';
import * as url from 'url';
import * as remoteMain from '@electron/remote/main';
export function createUpdaterWindow(updaterWindow, filePath) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting();
	updaterWindow = new BrowserWindow(mainWindowSettings);
	remoteMain.enable(updaterWindow.webContents);
	const launchPath = url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/updater'
	});

	updaterWindow.hide();
	updaterWindow.loadURL(launchPath);
	updaterWindow.setMenu(null);

	// updaterWindow.webContents.toggleDevTools();

	updaterWindow.on('close', (event) => {
		updaterWindow.hide();
		event.preventDefault();
	});

	return updaterWindow;
}

const windowSetting = () => {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: false,
		focusable: true,
		fullscreenable: false,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			devTools: true,			
			contextIsolation: false
		},
		width: 700,
		height: 600,
		title: 'Gauzy Updater',
		maximizable: false,
		show: false
	};

	return mainWindowSettings;
};
