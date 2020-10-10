// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

import { app, dialog, BrowserWindow, ipcMain } from 'electron';

// setup logger to catch all unhandled errors and submit as bug reports to our repo
log.catchErrors({
	showDialog: false,
	onError(error, versions, submitIssue) {
		dialog
			.showMessageBox({
				title: 'An error occurred',
				message: error.message,
				detail: error.stack,
				type: 'error',
				buttons: ['Ignore', 'Report', 'Exit']
			})
			.then((result) => {
				if (result.response === 1) {
					submitIssue('https://github.com/ever-co/gauzy/issues/new', {
						title: `Automatic error report for Desktop App ${versions.app}`,
						body:
							'Error:\n```' +
							error.stack +
							'\n```\n' +
							`OS: ${versions.os}`
					});
					return;
				}

				if (result.response === 2) {
					app.quit();
				}
			});
	}
});

import * as path from 'path';
require('module').globalPaths.push(path.join(__dirname, 'node_modules'));
require('sqlite3');
const Store = require('electron-store');
import { ipcMainHandler, ipcTimer } from './libs/ipc';
import TrayIcon from './libs/tray-icon';
import AppMenu from './libs/menu';
import DataModel from './local-data/local-table';
import { LocalStore } from './libs/getSetStore';
import { createGauzyWindow } from './window/gauzy';
import { createSetupWindow } from './window/setup';
import { createTimeTrackerWindow } from './window/timeTracker';
import { fork } from 'child_process';

// the folder where all app data will be stored (e.g. sqlite DB, settings, cache, etc)
// C:\Users\USERNAME\AppData\Roaming\gauzy-desktop
process.env.GAUZY_USER_PATH = app.getPath('userData');
log.info(`GAUZY_USER_PATH: ${process.env.GAUZY_USER_PATH}`);

const sqlite3filename = `${process.env.GAUZY_USER_PATH}/gauzy.sqlite3`;
log.info(`Sqlite DB path: ${sqlite3filename}`);

const knex = require('knex')({
	client: 'sqlite3',
	connection: {
		filename: sqlite3filename
	}
});

const dataModel = new DataModel();
dataModel.createNewTable(knex);

const store = new Store();

let serve: boolean;
const args = process.argv.slice(1);
serve = args.some((val) => val === '--serve');

let gauzyWindow: BrowserWindow = null;
let setupWindow: BrowserWindow = null;
let timeTrackerWindow: BrowserWindow = null;
let NotificationWindow: BrowserWindow = null;
let settingsWindow: BrowserWindow = null;

let tray = null;
let appMenu = null;
let isAlreadyRun = false;
let willQuit = false;
let onWaitingServer = false;
let alreadyQuit = false;
let serverGauzy = null;
let serverDesktop = null;

function startServer(value) {
	process.env.IS_ELECTRON = 'true';
	if (value.db === 'sqlite') {
		process.env.DB_PATH = sqlite3filename;
		process.env.DB_TYPE = 'sqlite';
	} else {
		process.env.DB_TYPE = 'postgres';
		process.env.DB_HOST = value.dbHost;
		process.env.DB_PORT = value.dbPort;
		process.env.DB_NAME = value.dbName;
		process.env.DB_USER = value.dbUsername;
		process.env.DB_PASS = value.dbPassword;
	}
	if (value.isLocalServer) {
		process.env.port = value.port;
		// require(path.join(__dirname, 'api/main.js'));
		serverGauzy = fork(path.join(__dirname, 'api/main.js'));
	}

	try {
		const config: any = {
			...value,
			isSetup: true
		};
		store.set({
			configs: config
		});
	} catch (error) {}

	/* ping server before launch the ui */
	ipcMain.on('app_is_init', () => {
		if (!isAlreadyRun && value) {
			onWaitingServer = true;
			setupWindow.webContents.send('server_ping', {
				host: value.serverUrl
					? value.serverUrl
					: value.port
					? `http://localhost:${value.port}`
					: 'http://localhost:3000'
			});
		}
	});

	return true;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Added 5000 ms to fix the black background issue while using transparent window.
// More details at https://github.com/electron/electron/issues/15947

app.on('ready', async () => {
	// require(path.join(__dirname, 'desktop-api/main.js'));
	serverDesktop = fork(path.join(__dirname, 'desktop-api/main.js'));

	const configs: any = store.get('configs');
	if (configs && configs.isSetup) {
		global.variableGlobal = {
			API_BASE_URL: configs.serverUrl
				? configs.serverUrl
				: configs.port
				? `http://localhost:${configs.port}`
				: 'http://localhost:3000'
		};
		setupWindow = createSetupWindow(setupWindow, true);
		startServer(configs);
	} else {
		setupWindow = createSetupWindow(setupWindow, false);
	}

	ipcMainHandler(store, startServer, knex);
});

app.on('window-all-closed', quit);

ipcMain.on('server_is_ready', () => {
	LocalStore.setDefaultApplicationSetting();

	onWaitingServer = false;

	timeTrackerWindow = createTimeTrackerWindow(timeTrackerWindow);

	if (!isAlreadyRun) {
		setTimeout(() => {
			setupWindow.hide();

			if (!gauzyWindow)
				gauzyWindow = createGauzyWindow(gauzyWindow, serve);

			ipcTimer(
				store,
				knex,
				setupWindow,
				timeTrackerWindow,
				NotificationWindow
			);

			const auth = store.get('auth');

			appMenu = new AppMenu(timeTrackerWindow, settingsWindow, knex);

			tray = new TrayIcon(
				setupWindow,
				knex,
				timeTrackerWindow,
				auth,
				settingsWindow
			);

			timeTrackerWindow.on('close', (event) => {
				if (willQuit) {
					app.quit();
				} else {
					event.preventDefault();
					timeTrackerWindow.hide();
				}
			});
		}, 1000);
		isAlreadyRun = true;
	}
});

ipcMain.on('quit', quit);

ipcMain.on('minimize', () => {
	gauzyWindow.minimize();
});

ipcMain.on('maximize', () => {
	gauzyWindow.maximize();
});

ipcMain.on('restore', () => {
	gauzyWindow.restore();
});

app.on('activate', () => {
	if (gauzyWindow) {
		gauzyWindow.show();
	} else if (!onWaitingServer) {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		createGauzyWindow(gauzyWindow, serve);
	}
});

app.on('before-quit', (e) => {
	e.preventDefault();
	const appSetting = LocalStore.getStore('appSetting');
	if (appSetting && appSetting.timerStarted) {
		e.preventDefault();
		setTimeout(() => {
			willQuit = true;
			timeTrackerWindow.webContents.send('stop_from_tray', {
				quitApp: true
			});
		}, 1000);
	} else {
		app.exit(0);
		serverDesktop.kill();
		serverGauzy.kill();
	}
});

// On OS X it is common for applications and their menu bar
// to stay active until the user quits explicitly with Cmd + Q
function quit() {
	if (process.platform !== 'darwin') {
		app.quit();
	}
}
