import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as url from 'url';

export function createImageViewerWindow(imageViewWindow, filePath) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting();

	imageViewWindow = new BrowserWindow(mainWindowSettings);

	const launchPath = url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/viewer'
	});

	imageViewWindow.hide();
	imageViewWindow.loadURL(launchPath);
	imageViewWindow.setMenu(null);

	// imageViewWindow.webContents.toggleDevTools();
	imageViewWindow.on('close', (event) => {
		imageViewWindow.hide();
		event.preventDefault();
	});

	return imageViewWindow;
}

const windowSetting = () => {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: false,
		resizable: false,
		focusable: true,
		fullscreenable: false,
		transparent: true,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			devTools: true,
			enableRemoteModule: true
		},
		width: 1000,
		height: 728,
		title: '',
		maximizable: false
	};

	return mainWindowSettings;
};
