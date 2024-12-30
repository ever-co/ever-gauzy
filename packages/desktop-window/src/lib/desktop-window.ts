import * as remoteMain from '@electron/remote/main';
import { BrowserWindow, ipcMain, screen } from 'electron';
import * as url from 'url';
import { attachTitlebarToWindow } from 'custom-electron-titlebar/main';

import log from 'electron-log';
import Store from 'electron-store';
import { WindowManager, RegisteredWindow } from '@gauzy/desktop-core';
console.log = log.log;
Object.assign(console, log.functions);

const store = new Store();

export async function createGauzyWindow(gauzyWindow, serve, config, filePath, preloadPath?) {
	log.info('createGauzyWindow started');

	const manager = WindowManager.getInstance();

	let mainWindowSettings: Electron.BrowserWindowConstructorOptions = null;

	mainWindowSettings = windowSetting(preloadPath);

	gauzyWindow = new BrowserWindow(mainWindowSettings);

	remoteMain.enable(gauzyWindow.webContents);

	let launchPath;

	if (!config.gauzyWindow) {
		gauzyWindow.hide();
	}

	if (serve) {
		require('electron-reload')(__dirname, {
			electron: require(`${__dirname}/../../../../node_modules/electron`)
		});

		launchPath = `http://localhost:${config.GAUZY_UI_DEFAULT_PORT}`;

		await gauzyWindow.loadURL(launchPath);
	} else {
		launchPath = url.format({
			pathname: filePath,
			protocol: 'file:',
			slashes: true
		});

		await gauzyWindow.loadURL(launchPath);
	}

	console.log('launched electron with:', launchPath);
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

	manager.register(RegisteredWindow.MAIN, gauzyWindow);
	if (preloadPath) {
		attachTitlebarToWindow(gauzyWindow);
		gauzyWindow.webContents.send('adjust_view');
	}

	return gauzyWindow;
}

const windowSetting = (preloadPath) => {
	const sizes = screen.getPrimaryDisplay().workAreaSize;
	const filesPath = store.get('filePath');

	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: true,
		focusable: true,
		fullscreenable: true,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			contextIsolation: false,
			sandbox: false
		},
		width: sizes.width,
		height: sizes.height,
		x: 0,
		y: 0,
		title: process.env.DESCRIPTION || 'Gauzy Desktop',
		show: false,
		icon: filesPath.iconPath
	};
	if (preloadPath) {
		mainWindowSettings.webPreferences.preload = preloadPath;
		mainWindowSettings.titleBarOverlay = true;
		mainWindowSettings.titleBarStyle = 'hidden';
		if (process.platform === 'linux') {
			mainWindowSettings.frame = false;
		}
	}
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

export function getApiBaseUrl(configs, envConfig) {
	if (configs.serverUrl) return configs.serverUrl;
	else {
		return configs.port ? `http://localhost:${configs.port}` : `http://localhost:${envConfig.API_DEFAULT_PORT}`;
	}
}

export function gauzyPage(filePath) {
	return url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true
	});
}
