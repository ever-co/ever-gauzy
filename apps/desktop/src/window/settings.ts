import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as url from 'url';

export function createSettingsWindow(settingsWindow) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting();

	settingsWindow = new BrowserWindow(mainWindowSettings);

	const launchPath = url.format({
		pathname: path.join(__dirname, '../ui/index.html'),
		protocol: 'file:',
		slashes: true,
		hash: '/settings'
	});

	settingsWindow.loadURL(launchPath);
	settingsWindow.setMenu(null);
	settingsWindow.hide();

	settingsWindow.on('close', (event) => {
		settingsWindow.hide();
		event.preventDefault();
	});

	return settingsWindow;
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
			devTools: true
		},
		width: 1000,
		height: 800,
		title: 'Settings',
		maximizable: false
	};

	return mainWindowSettings;
};
