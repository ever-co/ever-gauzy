import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as url from 'url';

export function createUpdaterWindow(updaterWindow) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting();

	updaterWindow = new BrowserWindow(mainWindowSettings);

	const launchPath = url.format({
		pathname: path.join(__dirname, '../../../../ui/index.html'),
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
			enableRemoteModule: true
		},
		width: 700,
		height: 600,
		title: 'Gauzy Updater',
		maximizable: false
	};

	return mainWindowSettings;
};
