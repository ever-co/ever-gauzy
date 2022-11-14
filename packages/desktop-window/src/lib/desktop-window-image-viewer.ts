import { BrowserWindow } from 'electron';

import * as url from 'url';
import * as remoteMain from '@electron/remote/main';
const Store = require('electron-store');
const store = new Store();


export function createImageViewerWindow(imageViewWindow, filePath) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting();
	imageViewWindow = new BrowserWindow(mainWindowSettings);
	remoteMain.enable(imageViewWindow.webContents);
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
		frame: true,
		resizable: true,
		focusable: true,
		fullscreenable: true,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			devTools: true,			
			contextIsolation: false,
			sandbox: false
		},
		width: 1000,
		height: 728,
		title: '',
		maximizable: true,
		show: false
	};

	const filesPath = store.get('filePath');
	if (process.platform === 'linux') {
		mainWindowSettings.icon = filesPath.iconPath;
	}

	return mainWindowSettings;
};
