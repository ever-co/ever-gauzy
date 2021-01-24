import log from 'electron-log';
import { screen, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as url from 'url';
import { environment } from '../../../../apps/desktop/src/environments/environment';
import { LocalStore } from '../../../desktop-timer/src';
export function createGauzyWindow(gauzyWindow, serve) {
	log.info('createGauzyWindow started');

	let mainWindowSettings: Electron.BrowserWindowConstructorOptions = null;
	mainWindowSettings = windowSetting();
	gauzyWindow = new BrowserWindow(mainWindowSettings);
	let launchPath;
	const appConfig = LocalStore.getStore('configs');
	if (!appConfig.gauzyWindow) {
		gauzyWindow.hide();
	}

	if (serve) {
		require('electron-reload')(__dirname, {
			electron: require(`${__dirname}/../../../../node_modules/electron`)
		});

		launchPath = `http://localhost:${environment.GAUZY_UI_DEFAULT_PORT}`;

		gauzyWindow.loadURL(launchPath);
	} else {
		launchPath = url.format({
			pathname: path.join(__dirname, '../../../../index.html'),
			protocol: 'file:',
			slashes: true
		});

		gauzyWindow.loadURL(launchPath);
	}

	// console.log('launched electron with:', launchPath);
	// gauzyWindow.webContents.toggleDevTools();

	gauzyWindow.on('close', (e) => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		e.preventDefault();
		gauzyWindow.hide(); // gauzyWindow = null;
	});

	initMainListener();

	log.info('createGauzyWindow completed');

	return gauzyWindow;
}

const windowSetting = () => {
	const sizes = screen.getPrimaryDisplay().workAreaSize;
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: true,
		focusable: true,
		fullscreenable: true,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			enableRemoteModule: true
		},
		width: sizes.width,
		height: sizes.height,
		x: 0,
		y: 0,
		title: 'Gauzy'
	};
	return mainWindowSettings;
};

function initMainListener() {
	ipcMain.on('ELECTRON_BRIDGE_HOST', (event, msg) => {
		console.log('msg received', msg);
		if (msg === 'ping') {
			event.sender.send('ELECTRON_BRIDGE_CLIENT', 'pong');
		}
	});
}

export function getApiBaseUrl(configs) {
	if (configs.serverUrl) return configs.serverUrl;
	else {
		return configs.port
			? `http://localhost:${configs.port}`
			: `http://localhost:${environment.API_DEFAULT_PORT}`;
	}
}

export function gauzyPage() {
	return url.format({
		pathname: path.join(__dirname, '../../../../index.html'),
		protocol: 'file:',
		slashes: true
	});
}
