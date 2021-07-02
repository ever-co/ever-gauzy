// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron';
import { environment } from './environments/environment';
// setup logger to catch all unhandled errors and submit as bug reports to our repo

import * as path from 'path';
require('module').globalPaths.push(path.join(__dirname, 'node_modules'));
require('sqlite3');
import {
	LocalStore
} from '@gauzy/desktop-libs';
import {
	createSetupWindow,
} from '@gauzy/desktop-window';
import { initSentry } from './sentry';
import os from 'os';

initSentry();

// the folder where all app data will be stored (e.g. sqlite DB, settings, cache, etc)
// C:\Users\USERNAME\AppData\Roaming\gauzy-desktop

let setupWindow:BrowserWindow;
const pathWindow: {
	gauzyUi: string,
	ui: string
} = {
	gauzyUi: path.join(__dirname, './index.html'),
	ui: path.join(__dirname, './ui/index.html')
};

const runSetup = () => {
	if (setupWindow) {
		setupWindow.show();
		return;
	}
	setupWindow = createSetupWindow(setupWindow, false, pathWindow.ui);
	setupWindow.show();
}


const appState = () => {
	const { isSetup } = LocalStore.getStore('configs');
	if (isSetup) {
		runSetup();
		return;
	}
}

const initializeConfig = (val) => {
	LocalStore.updateConfigSetting(val);
}

const createServerApi = () => {
	const platform = os.platform();
	switch (platform) {
		case 'win32':
			const uiServer = path.join(__dirname, 'preload', 'desktop-server-api.js');
			const Service = require('node-windows').Service;
			let svc = new Service({
				name: 'GauzyServerUi',
				description: 'gauzy ui service',
				script: uiServer
			});
			svc.on('install',function(){
				console.log('on install');
				svc.on('start', () => {
					console.log('service start');
				})
				svc.start();
			});
			svc.on('error', () => {
				console.log('service install error');
			});
			svc.on('invalidinstallation ', () => {
				console.log('service invalid installation');
			})
			svc.install();
			break;
		default:
			break;
	}
}

ipcMain.on('save_config', (event, arg) => {
	initializeConfig(arg);
})

app.on('ready', () => {
	createServerApi();
})

ipcMain.on('quit', quit);

function quit() {
	if (process.platform !== 'darwin') {
		app.quit();
	}
}

app.on('window-all-closed', quit);





