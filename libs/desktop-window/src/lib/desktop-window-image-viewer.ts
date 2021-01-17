import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as url from 'url';

export function createImageViewerWindow(imageViewWindow) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting();

	imageViewWindow = new BrowserWindow(mainWindowSettings);

	const launchPath = url.format({
		pathname: path.join(
			__dirname,
			'../../../../apps/desktop/ui/index.html'
		),
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
		width: 1024,
		height: 768,
		title: '',
		maximizable: false
	};

	return mainWindowSettings;
};
