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
	LocalStore,
	apiServer
} from '@gauzy/desktop-libs';
import {
	createSetupWindow,
	createServerWindow
} from '@gauzy/desktop-window';
// import { initSentry } from './sentry';
import os from 'os';

process.env.GAUZY_USER_PATH = app.getPath('userData');
log.info(`GAUZY_USER_PATH: ${process.env.GAUZY_USER_PATH}`);

const sqlite3filename = `${process.env.GAUZY_USER_PATH}/gauzy.sqlite3`;

// initSentry();

// the folder where all app data will be stored (e.g. sqlite DB, settings, cache, etc)
// C:\Users\USERNAME\AppData\Roaming\gauzy-desktop

let setupWindow:BrowserWindow;
let serverWindow:BrowserWindow
const pathWindow: {
	gauzyUi: string,
	ui: string
} = {
	gauzyUi: path.join(__dirname, './ui/index.html'),
	ui: path.join(__dirname, 'index.html')
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
	const config = LocalStore.getStore('configs');
	if (!config) {
		runSetup();
		return;
	}

	runMainWindow();
	return;
}

const runMainWindow = () => {
	serverWindow = createServerWindow(serverWindow, null, pathWindow.ui);
	serverWindow.show();
	if (setupWindow) setupWindow.hide();
}

const initializeConfig = (val) => {
	LocalStore.updateConfigSetting(val);
	runMainWindow();
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

const runServer = () => {
	const envVal = getEnvApi();
	apiServer({
		ui: path.join(__dirname, 'preload', 'ui-server.js'),
		api: path.join(__dirname, 'api/main.js')
	}, envVal);
}

const getEnvApi = () => {
	const config = LocalStore.getStore('configs');
	return {
		IS_ELECTRON: 'true',
        DB_PATH: sqlite3filename,
        DB_TYPE: config.db,
        DB_HOST: config.dbHost,
        DB_PORT: config.dbPort ? config.dbPort.toString() : '',
        DB_NAME: config.dbName,
        DB_USER: config.dbUsername,
        DB_PASS: config.dbPassword,
        PORT: config.port ? config.port.toString() : '',
	}
}

ipcMain.on('start_server', (event, arg) => {
	initializeConfig(arg);
})

ipcMain.on('run_gauzy_server', (event, arg) => {
	console.log('run gauzy server');
	runServer()
})

ipcMain.on('stop_gauzy_server', (event, arg) => {
	const config = LocalStore.getStore('configs');
	if (config.apiPid) {
		try {
			process.kill(config.apiPid);
			LocalStore.updateConfigSetting({
				apiPid: null
			})
		} catch (error) {
			
		}
	}
	if (config.uiPid) {
		try {
			process.kill(config.uiPid);
			LocalStore.updateConfigSetting({
				uiPid: null
			})
		} catch (error) {
			
		}
	} 
})
app.on('ready', () => {
	appState();
})

ipcMain.on('quit', quit);

ipcMain.on('check_database_connection', async (event, arg) => {
	let databaseOptions = {};
	if (arg.db == 'postgres') {
		databaseOptions = {
			client: 'pg',
			connection: {
				host: arg.dbHost,
				user: arg.dbUsername,
				password: arg.dbPassword,
				database: arg.dbName,
				port: arg.dbPort
			}
		};
	} else {
		databaseOptions = {
			client: 'sqlite',
			connection: {
				filename: sqlite3filename
			}
		};
	}
	const dbConn = require('knex')(databaseOptions);
	try {
		await dbConn.raw('select 1+1 as result');
		event.sender.send('database_status', {
			status: true,
			message:
				arg.db === 'postgres'
					? 'Connection to PostgreSQL DB Succeeds'
					: 'Connection to SQLITE DB Succeeds'
		});
	} catch (error) {
		event.sender.send('database_status', {
			status: false,
			message: error.message
		});
	}
});

function quit() {
	if (process.platform !== 'darwin') {
		app.quit();
	}
}

app.on('window-all-closed', quit);





