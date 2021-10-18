// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

import * as path from 'path';
import { app, BrowserWindow, ipcMain, Tray, nativeImage, Menu, shell, MenuItemConstructorOptions, screen } from 'electron';
import { environment } from './environments/environment';

// setup logger to catch all unhandled errors and submit as bug reports to our repo

require('module').globalPaths.push(path.join(__dirname, 'node_modules'));
require('sqlite3');

app.setName('gauzy-server');

console.log('Node Modules Path', path.join(__dirname, 'node_modules'));

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
import { readFileSync, writeFileSync, accessSync, constants } from 'fs';
import * as remoteMain from '@electron/remote/main';
remoteMain.initialize();

// the folder where all app data will be stored (e.g. sqlite DB, settings, cache, etc)
// C:\Users\USERNAME\AppData\Roaming\gauzy-server

process.env.GAUZY_USER_PATH = app.getPath('userData');
log.info(`GAUZY_USER_PATH: ${process.env.GAUZY_USER_PATH}`);

const sqlite3filename = `${process.env.GAUZY_USER_PATH}/gauzy.sqlite3`;
log.info(`Sqlite DB path: ${sqlite3filename}`);

// initSentry();

let setupWindow:BrowserWindow;
let serverWindow:BrowserWindow;
let settingsWindow: BrowserWindow;
let tray:Tray;
let isServerRun: boolean;
const pathWindow: {
	gauzyUi: string,
	ui: string,
	dir: string,
	timeTrackerUi: string
} = {
	gauzyUi: app.isPackaged ? path.join(__dirname, '../data/ui/index.html') : path.join(__dirname, './data/ui/index.html'),
	ui: path.join(__dirname, 'index.html'),
	dir: app.isPackaged ? path.join(__dirname, '../data/ui') : path.join(__dirname, './data/ui'),
	timeTrackerUi: path.join(__dirname, 'index.html')
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
	if (!tray) {
		createTray();
	}

	new AppMenu(
		null,
		settingsWindow,
		null,
		null,
		pathWindow,
		serverWindow
	);
	const menuWindowSetting = Menu.getApplicationMenu().getMenuItemById(
		'window-setting'
	);
	if (menuWindowSetting) menuWindowSetting.enabled = true;
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
	let fileStr = readFileSync(pathWindow.gauzyUi, 'utf8');
	
	const configStr = `
		<script> window._env = { api: '${apiBaseUrl}' }; 
		if (global === undefined) {
			var global = window;
		}; </script>`;

	const elementToReplace = '<script src="https://cdn.ckeditor.com/4.6.1/full-all/ckeditor.js"></script>';

	fileStr = fileStr.replace(elementToReplace, `
		${configStr}
		${elementToReplace}
	`);

	// write file new html

	try {
		accessSync(pathWindow.dir, constants.W_OK);
	} catch (e) {
		console.error('Cannot access directory')
	}

	try {
		writeFileSync(pathWindow.gauzyUi, fileStr);
	} catch (error) {
		console.log('Cannot change html file', error);
	}
}

const runServer = (isRestart) => {
	const envVal = getEnvApi();
	const uiPort = getUiPort();
	apiServer({
		ui: path.join(__dirname, 'preload', 'ui-server.js'),
		api: path.join(__dirname, 'api/main.js')
	}, envVal, serverWindow, uiPort, isRestart);
}

const getEnvApi = () => {
	const config = LocalStore.getStore('configs');
	updateConfigUi(config);
	const addsConfig = LocalStore.getAdditionalConfig();
	return {
		IS_ELECTRON: 'true',
        DB_PATH: sqlite3filename,
        DB_TYPE: config.db,
        DB_HOST: config.dbHost,
        DB_PORT: config.dbPort ? config.dbPort.toString() : '',
        DB_NAME: config.dbName,
        DB_USER: config.dbUsername,
        DB_PASS: config.dbPassword,
        API_PORT: config.port ? config.port.toString() : '',
		...addsConfig
	}
}

const getUiPort = () => {
	const config = LocalStore.getStore('configs');
	return config.portUi;
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
	const serverMenu = contextMenu();
	tray.setContextMenu(Menu.buildFromTemplate(serverMenu));
}

const contextMenu = () => {
	const serverMenu:MenuItemConstructorOptions[] = [
		{
			id: 'server_browser',
			label: 'Open Gauzy In Browser',
			click() {
				const config = LocalStore.getStore('configs');
				shell.openExternal(`http://localhost:${config.portUi}`)
			}
		},
		{
			id: 'check_for_update',
			label: 'Check For Update',
			click() {
				const appSetting = LocalStore.getStore('appSetting');
				const config = LocalStore.getStore('configs');
				const addSetting = LocalStore.getStore('additionalSetting');
				settingsWindow.show();
				setTimeout(() => {
					settingsWindow.webContents.send('goto_update');
				}, 100);
				setTimeout(() => {
					settingsWindow.webContents.send('app_setting', {
						setting: appSetting,
						config: config,
						additionalSetting: addSetting
					});
				}, 500);
			}
		},
		{
			type: 'separator'
		},
		{
			id: 'start_server',
			label: 'Start Server',
			click() {
				runServer(false);
			}
		},
		{
			id: 'stop_server',
			label: 'Stop Server',
			click() {
				stopServer(false);
			}
		},
		{
			type: 'separator'
		},
		{
			id: 'server_help',
			label: 'Help',
			click() {
				shell.openExternal('https://gauzy.co');
			}
		},
		{
			id: 'server_about',
			label: 'About',
			role: 'about'
		},
		{
			id: 'server_exit',
			label: 'Exit',
			click() {
				app.quit();
			}
		}
	]

	return serverMenu;
}

ipcMain.on('start_server', (event, arg) => {
	initializeConfig(arg);
})

ipcMain.on('run_gauzy_server', (event, arg) => {
	console.log('run Gauzy Server');
	runServer(false)
})

const stopServer = (isRestart) => {
	const config = LocalStore.getStore('configs');
	console.log('api pid', config.apiPid)
	console.log('api pid', config.uiPid)
	if (config.apiPid) {
		try {
			process.kill(config.apiPid);
			LocalStore.updateConfigSetting({
				apiPid: null
			})
			serverWindow.webContents.send('log_state', { msg: 'Api stopped' });
		} catch (error) {
			console.log('error api', error);
		}
	}
	if (config.uiPid) {
		try {
			process.kill(config.uiPid);
			LocalStore.updateConfigSetting({
				uiPid: null
			})
			serverWindow.webContents.send('log_state', { msg: 'UI stopped' });
			if (isRestart) {
				runServer(true);
			}
		} catch (error) {
			console.log('error ui', error);
		}
	} 
	serverWindow.webContents.send('running_state', false);
	
}

ipcMain.on('stop_gauzy_server', (event, arg) => {
	stopServer(false);
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
})

ipcMain.on('restart_app', (event, arg) => {
	console.log('Restarting Server', arg);
	if (arg.apiPid) delete arg.apiPid;
	if (arg.uiPid) delete arg.uiPid;
	LocalStore.updateConfigSetting(arg);
	updateConfigUi(arg);
	event.sender.send('resp_msg', {type: 'update_config', status: 'success'})
	if (isServerRun) {
		stopServer(true);
	}
});

ipcMain.on('save_additional_setting', (event, arg) => {
	console.log('arg', arg);
	LocalStore.updateAdditionalSetting(arg);
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

ipcMain.on('resp_msg_server', (event, arg) => {
	settingsWindow.webContents.send('resp_msg', arg);
})

ipcMain.on('running_state', (event, arg) => {
	settingsWindow.webContents.send('server_status', arg);
	const trayContextMenu = contextMenu();;
	if (arg) {
		const start = trayContextMenu[3];
		start.enabled = false;
	} else {
		const stop = trayContextMenu[4];
		stop.enabled = false;
	}
	tray.setContextMenu(Menu.buildFromTemplate(trayContextMenu))
	isServerRun = arg;

})

ipcMain.on('loading_state', (event, arg) => {
	const trayContextMenu = contextMenu();;
	trayContextMenu[3].enabled = false;
	trayContextMenu[4].enabled = false;
	tray.setContextMenu(Menu.buildFromTemplate(trayContextMenu))
})

ipcMain.on('expand_window', (event, arg) => {
	const display = screen.getPrimaryDisplay();
	const { width, height } = display.workArea;
	console.log('width ', width);
	console.log('height ', height);
	serverWindow.setBounds({
		width: 980,
		height: 860,
		x: (width - 980) * (0.5),
		y: (height - 860) * (0.5)
	}, true)
})

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
