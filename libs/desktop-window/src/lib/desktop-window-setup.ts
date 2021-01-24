import { BrowserWindow, Menu, app } from 'electron';
import * as path from 'path';
import * as url from 'url';

export function createSetupWindow(setupWindow, value) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting();

	setupWindow = new BrowserWindow(mainWindowSettings);

	const launchPath = url.format({
		pathname: path.join(__dirname, '../../../../ui/index.html'),
		protocol: 'file:',
		slashes: true
	});

	if (value) {
		setupWindow.hide();
	}
	setupWindow.loadURL(launchPath);
	setupWindow.setMenu(
		Menu.buildFromTemplate([
			{
				label: app.getName(),
				submenu: [{ role: 'quit', label: 'Exit' }]
			}
		])
	);
	// setupWindow.webContents.toggleDevTools();

	setupWindow.on('close', (e) => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		e.preventDefault();
		setupWindow.hide(); // gauzyWindow = null;
	});
	return setupWindow;
}

const windowSetting = () => {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: false,
		focusable: true,
		fullscreenable: false,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false
		},
		width: 960,
		height: 680,
		title: 'Setup',
		autoHideMenuBar: true
	};

	return mainWindowSettings;
};
