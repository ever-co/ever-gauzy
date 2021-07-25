// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

import { app, BrowserWindow, ipcMain, Tray, nativeImage, Menu, shell } from 'electron';
import { environment } from './environments/environment';
// setup logger to catch all unhandled errors and submit as bug reports to our repo

import * as path from 'path';
require('module').globalPaths.push(path.join(__dirname, 'node_modules'));
require('sqlite3');
import {
	LocalStore,
	apiServer,
	AppMenu
} from '@gauzy/desktop-libs';
import {
	createSetupWindow,
	createServerWindow,
	createSettingsWindow
} from '@gauzy/desktop-window';
// import { initSentry } from './sentry';
import os from 'os';
import { readFileSync, writeFileSync } from 'fs';

process.env.GAUZY_USER_PATH = app.getPath('userData');
log.info(`GAUZY_USER_PATH: ${process.env.GAUZY_USER_PATH}`);

const sqlite3filename = `${process.env.GAUZY_USER_PATH}/gauzy.sqlite3`;

// initSentry();

// the folder where all app data will be stored (e.g. sqlite DB, settings, cache, etc)
// C:\Users\USERNAME\AppData\Roaming\gauzy-desktop

const docPath = app.getPath('userData');

let setupWindow:BrowserWindow;
let serverWindow:BrowserWindow;
let settingsWindow: BrowserWindow;
let tray:Tray;
const pathWindow: {
	gauzyUi: string,
	ui: string
} = {
	gauzyUi: app.isPackaged ? path.join(__dirname, '../data/ui/index.html') : path.join(__dirname, './data/ui/index.html'),
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
	updateConfigUi(val);
	runMainWindow();
}

const getApiBaseUrl = (config) => {
	if (config.serverUrl) return config.serverUrl;
	else {
		return config.port
			? `http://localhost:${config.port}`
			: `http://localhost:${environment.API_DEFAULT_PORT}`;
	}
};

const updateConfigUi = (config) => {
	const apiBaseUrl = getApiBaseUrl(config);
	let filestr = readFileSync(pathWindow.gauzyUi, 'utf8');
	const configStr = `<script> window._env = { api: '${apiBaseUrl}' } </script>`;
	const elementToReplace = '<script src="https://cdn.ckeditor.com/4.6.1/full-all/ckeditor.js"></script>'
	filestr = filestr.replace(elementToReplace, `
		${configStr}
		${elementToReplace}
	`);

	// write file new html

	writeFileSync(pathWindow.gauzyUi, filestr);

	// console.log(filestr);
	
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

const runServer = () => {
	const envVal = getEnvApi();
	apiServer({
		ui: path.join(__dirname, 'preload', 'ui-server.js'),
		api: path.join(__dirname, 'api/main.js')
	}, envVal, serverWindow);
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

const createTray = () => {
	const iconNativePath = nativeImage.createFromPath(path.join(
		__dirname,
		'assets',
		'icons',
		'icon_16x16.png'
	));
	iconNativePath.resize({ width: 16, height: 16 });
	tray = new Tray(iconNativePath);
	const serverMenu = [
		{
			id: '1',
			label: 'Open Gauzy In Browser',
			click() {
				shell.openExternal('http://localhost:8084')
			}
		},
		{
			id: '2',
			label: 'Check For Update',
			click() {
				const appSetting = LocalStore.getStore('appSetting');
				const config = LocalStore.getStore('configs');
				settingsWindow.show();
				setTimeout(() => {
					settingsWindow.webContents.send('goto_update');
				}, 100);
				setTimeout(() => {
					settingsWindow.webContents.send('app_setting', {
						setting: appSetting,
						config: config
					});
				}, 500);
			}
		},
		{
			id: '3',
			label: 'Exit',
			click() {
				app.quit();
			}
		}
	]
	tray.setContextMenu(Menu.buildFromTemplate(serverMenu));
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
	serverWindow.webContents.send('running_state', false);
})
app.on('ready', () => {
	LocalStore.setDefaultApplicationSetting();
	appState();
	if (!settingsWindow) {
		settingsWindow = createSettingsWindow(
			settingsWindow,
			pathWindow.ui
		);
	}
	if (!tray) {
		createTray();
	}

	new AppMenu(
		null,
		settingsWindow,
		null,
		null,
		pathWindow
	);
	const menuWindowSetting = Menu.getApplicationMenu().getMenuItemById(
		'window-setting'
	);
	if (menuWindowSetting) menuWindowSetting.enabled = true;
})

ipcMain.on('restart_app', (event, arg) => {
	console.log('restart app', arg);
	LocalStore.updateConfigSetting(arg);
	updateConfigUi(arg);
});

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

app.on('before-quit', (e) => {
	e.preventDefault();
	app.exit(0);
});

app.on('window-all-closed', quit);





