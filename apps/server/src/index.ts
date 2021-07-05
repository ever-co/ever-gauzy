// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

import { app, BrowserWindow, ipcMain } from 'electron';
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

const docPath = app.getPath('userData');

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

const createServer = (typeServer) => {
	let fileServe = 'desktop-server-ui.js';
	let serviceName = `GauzyServe${typeServer}`;
	if (typeServer === 'Api') {
		fileServe = 'desktop-server-api.js';
	}
	const platform = os.platform();
	const serverPath = path.join(docPath, 'preload', fileServe);
	console.log('server location', serverPath);
	let Service:any | null = null;
	let svc:any | null = null;
	switch (platform) {
		case 'win32':
			Service = require('node-windows').Service;
			break;
		case 'darwin':
			Service = require('node-mac').Service;
			break;
		default:
			break;
	}

	svc = new Service({
		name: serviceName,
		description: 'gauzy ui service',
		script: serverPath
	});
	if (svc.exists) {
		svc.on('uninstall',function(){
			console.log('Uninstall complete.');
			console.log('The service exists: ',svc.exists);
		  });
		svc.uninstall();
	} else {
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
	}
}

ipcMain.on('save_config', (event, arg) => {
	initializeConfig(arg);
})

app.on('ready', () => {
	createServer('Ui');
})

ipcMain.on('run_server_ui', () => {
	createServer('Ui');
})

ipcMain.on('run_server_api', () => {
	createServer('Api');
})

ipcMain.on('quit', quit);

function quit() {
	if (process.platform !== 'darwin') {
		app.quit();
	}
}

app.on('window-all-closed', quit);





