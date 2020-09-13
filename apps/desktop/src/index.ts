// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

// import { dialog } from 'electron';
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
require('module').globalPaths.push(path.join(__dirname, 'node_modules'));
require('sqlite3');
const Store = require('electron-store');
import { ipcMainHandler, ipcTimer } from './libs/ipc';
import TrayIcon from './libs/tray-icon';
import DataModel from './local-data/local-table';
import { LocalStore } from './libs/getSetStore';
import {
	hasPromptedForPermission,
	hasScreenCapturePermission,
	openSystemPreferences
} from 'mac-screen-capture-permissions';
import { createGauzyWindow } from './window/gauzy';
import { createSetupWindow } from './window/setup';
import { createTimeTrackerWindow } from './window/timeTracker';
const knex = require('knex')({
	client: 'sqlite3',
	connection: {
		filename: `${app.getPath('userData')}/gauzy.sqlite3`
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
let isAlreadyRun = false;
let willquit = false;
let onWaitingServer = false;

function startServer(value) {
	process.env.IS_ELECTRON = 'true';
	if (value.db === 'sqlite') {
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
		require(path.join(__dirname, 'api/main.js'));
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
		console.log('app is init');
		try {
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
		} catch (error) {
			console.log(error);
		}
	});
	return true;
}

try {
	// app.allowRendererProcessReuse = true;

	// This method will be called when Electron has finished
	// initialization and is ready to create browser windows.
	// Some APIs can only be used after this event occurs.
	// Added 5000 ms to fix the black background issue while using transparent window.
	// More details at https://github.com/electron/electron/issues/15947
	app.on('ready', async () => {
		// check premission for mac os
		if (process.platform === 'darwin') {
			const screenCapturePermission = hasScreenCapturePermission();
			if (!screenCapturePermission) {
				const haspromp = hasPromptedForPermission();
				const sysPref = await openSystemPreferences();
			}
		}
		// the folder where all app data will be stored (e.g. sqlite DB, settings, cache, etc)
		process.env.GAUZY_USER_PATH = app.getPath('userData');
		// C:\Users\USERNAME\AppData\Roaming\gauzy-desktop
		// dialog.showMessageBox(null, { message: `GAUZY_USER_PATH: ${process.env.GAUZY_USER_PATH}` });

		require(path.join(__dirname, 'desktop-api/main.js'));
		try {
			const configs: any = store.get('configs');
			if (configs.isSetup) {
				global.variableGlobal = {
					API_BASE_URL: configs.serverUrl
						? configs.serverUrl
						: configs.port
						? `http://localhost:${configs.port}`
						: 'http://localhost:3000'
				};
				setupWindow = createSetupWindow(setupWindow, true);
				startServer(configs);
			}
		} catch (e) {
			setupWindow = createSetupWindow(setupWindow, false);
		}

		ipcMainHandler(store, startServer, knex);
	});

	app.on('window-all-closed', quit);

	ipcMain.on('server_is_ready', () => {
		console.log('this server is ready');
		LocalStore.setDefaultApplicationSetting();
		try {
			onWaitingServer = false;
			isAlreadyRun = true;
			timeTrackerWindow = createTimeTrackerWindow(timeTrackerWindow);
			setTimeout(() => {
				setupWindow.hide();
				gauzyWindow = createGauzyWindow(gauzyWindow, serve);
				ipcTimer(
					store,
					knex,
					setupWindow,
					timeTrackerWindow,
					NotificationWindow
				);
				const auth = store.get('auth');
				tray = new TrayIcon(
					setupWindow,
					knex,
					timeTrackerWindow,
					auth,
					settingsWindow
				);
				timeTrackerWindow.on('close', (event) => {
					if (willquit) {
						app.quit();
					} else {
						event.preventDefault();
						timeTrackerWindow.hide();
					}
				});
			}, 1000);
		} catch (error) {
			console.log(error);
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
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (gauzyWindow === null && !onWaitingServer) {
			createGauzyWindow(gauzyWindow, serve);
		}
	});

	app.on('before-quit', () => {
		willquit = true;
	});
} catch (err) {}

// On OS X it is common for applications and their menu bar
// to stay active until the user quits explicitly with Cmd + Q
function quit() {
	if (process.platform !== 'darwin') {
		app.quit();
	}
}
