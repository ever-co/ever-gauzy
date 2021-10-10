import log from 'electron-log';
import { screen, BrowserWindow, ipcMain } from 'electron';
import * as url from 'url';

export function createServerWindow(serverWindow, config, filePath) {

    let mainWindowSettings: Electron.BrowserWindowConstructorOptions = null;
    mainWindowSettings = windowSetting();

    serverWindow = new BrowserWindow(mainWindowSettings);

    let launchPath;

	launchPath = url.format({
        pathname: filePath,
        protocol: 'file:',
        slashes: true,
        hash: '/server-dashboard'
    });

    serverWindow.loadURL(launchPath);

	console.log('launched electron with:', launchPath);
	// serverWindow.webContents.toggleDevTools();

	serverWindow.on('close', (e) => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		e.preventDefault();
		serverWindow.hide(); // gauzyWindow = null;
	});

	return serverWindow;
}

const windowSetting = () => {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: false,
		focusable: true,
		fullscreenable: true,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			enableRemoteModule: true,
			contextIsolation: false
		},
		width: 380,
		height: 400,
		title: '',
		show: false,
		center: true
	};
	return mainWindowSettings;
};
