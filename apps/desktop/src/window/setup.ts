import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as url from 'url';

export function createSetupWindow(setupWindow, value) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting();

	setupWindow = new BrowserWindow(mainWindowSettings);

	const launchPath = url.format({
		pathname: path.join(__dirname, '../ui/index.html'),
		protocol: 'file:',
		slashes: true
	});

	setupWindow.loadURL(launchPath);

	if (value) {
		setupWindow.hide();
	}
	return setupWindow;
}

const windowSetting = () => {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: true,
		focusable: true,
		fullscreenable: true,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false
		},
		width: 800,
		height: 800,
		title: 'Setup'
	};

	return mainWindowSettings;
};
