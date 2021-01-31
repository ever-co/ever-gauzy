// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

import { app, dialog, BrowserWindow, ipcMain, shell, Menu } from 'electron';
import { environment } from './environments/environment';
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
import {
	ipcMainHandler,
	ipcTimer,
	TrayIcon,
	LocalStore,
	DataModel,
	AppMenu
} from '../../../libs/desktop-libs/src';
import {
	createGauzyWindow,
	gauzyPage,
	createSetupWindow,
	createTimeTrackerWindow,
	createSettingsWindow,
	createUpdaterWindow,
	createImageViewerWindow
} from '../../../libs/desktop-window/src';
import { fork } from 'child_process';
import { autoUpdater, CancellationToken } from 'electron-updater';

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
let updaterWindow: BrowserWindow = null;
let imageView: BrowserWindow = null;

let tray = null;
let appMenu = null;
let isAlreadyRun = false;
let willQuit = false;
let onWaitingServer = false;
let alreadyQuit = false;
let serverGauzy = null;
let serverDesktop = null;
let dialogErr = false;
let cancellationToken = new CancellationToken();

function startServer(value, restart = false) {
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
		process.env.port = value.port || environment.API_DEFAULT_PORT;
		process.env.host = 'http://localhost';
		process.env.BASE_URL = `http://localhost:${
			value.port || environment.API_DEFAULT_PORT
		}`;
		// require(path.join(__dirname, 'api/main.js'));
		serverGauzy = fork(path.join(__dirname, '../../../api/main.js'), {
			silent: true
		});
		serverGauzy.stdout.on('data', (data) => {
			const msgData = data.toString();
			console.log('log -- ', msgData);
			setupWindow.webContents.send('setup-progress', {
				msg: msgData
			});
			if (!value.isSetup && !value.serverConfigConnected) {
				if (msgData.indexOf('Listening at http') > -1) {
					setupWindow.hide();
					// isAlreadyRun = true;
					gauzyWindow = createGauzyWindow(gauzyWindow, serve);
				}
			}
			if (
				msgData.indexOf('Unable to connect to the database') > -1 &&
				!dialogErr
			) {
				const msg = 'Unable to connect to the database';
				dialogMessage(msg);
			}
		});

		serverGauzy.stderr.on('data', (data) => {
			const msgData = data.toString();
			console.log('log error--', msgData);
		});
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

	/* create main window */
	if (value.serverConfigConnected || !value.isLocalServer) {
		setupWindow.hide();
		gauzyWindow = createGauzyWindow(gauzyWindow, serve);
	}
	const auth = store.get('auth');
	tray = new TrayIcon(
		setupWindow,
		knex,
		timeTrackerWindow,
		auth,
		settingsWindow
	);

	/* ping server before launch the ui */
	ipcMain.on('app_is_init', () => {
		if (!isAlreadyRun && value && !restart) {
			onWaitingServer = true;
			setupWindow.webContents.send('server_ping', {
				host: getApiBaseUrl(value)
			});
		}
	});

	return true;
}

const dialogMessage = (msg) => {
	dialogErr = true;
	const options = {
		type: 'question',
		buttons: ['Open Setting', 'Exit'],
		defaultId: 2,
		title: 'Warning',
		message: msg
	};

	dialog.showMessageBox(null, options).then((response) => {
		if (response.response === 1) app.quit();
		else {
			if (settingsWindow) settingsWindow.show();
			else {
				const appSetting = LocalStore.getStore('appSetting');
				const config = LocalStore.getStore('configs');
				if (!settingsWindow) {
					settingsWindow = createSettingsWindow(settingsWindow);
				}
				settingsWindow.show();
				setTimeout(() => {
					settingsWindow.webContents.send('app_setting', {
						setting: appSetting,
						config: config
					});
				}, 500);
			}
		}
	});
};

const getApiBaseUrl = (configs) => {
	if (configs.serverUrl) return configs.serverUrl;
	else {
		return configs.port
			? `http://localhost:${configs.port}`
			: `http://localhost:${environment.API_DEFAULT_PORT}`;
	}
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Added 5000 ms to fix the black background issue while using transparent window.
// More details at https://github.com/electron/electron/issues/15947

app.on('ready', async () => {
	// require(path.join(__dirname, 'desktop-api/main.js'));
	/* set menu */
	Menu.setApplicationMenu(
		Menu.buildFromTemplate([
			{
				label: app.getName(),
				submenu: [
					{ role: 'about', label: 'About' },
					{ type: 'separator' },
					{ type: 'separator' },
					{ role: 'quit', label: 'Exit' }
				]
			}
		])
	);

	/* create window */
	timeTrackerWindow = createTimeTrackerWindow(timeTrackerWindow);
	settingsWindow = createSettingsWindow(settingsWindow);
	updaterWindow = createUpdaterWindow(updaterWindow);
	imageView = createImageViewerWindow(imageView);

	/* Set Menu */
	appMenu = new AppMenu(
		timeTrackerWindow,
		settingsWindow,
		updaterWindow,
		knex
	);

	const configs: any = store.get('configs');
	if (configs && configs.isSetup) {
		if (!configs.serverConfigConnected) {
			setupWindow = createSetupWindow(setupWindow, false);
			setTimeout(() => {
				setupWindow.webContents.send('setup-data', {
					...configs
				});
			}, 1000);
		} else {
			global.variableGlobal = {
				API_BASE_URL: getApiBaseUrl(configs),
				IS_INTEGRATED_DESKTOP: configs.isLocalServer
			};
			setupWindow = createSetupWindow(setupWindow, true);
			startServer(configs);
		}
	} else {
		setupWindow = createSetupWindow(setupWindow, false);
	}

	ipcMainHandler(store, startServer, knex);
});

app.on('window-all-closed', quit);

ipcMain.on('server_is_ready', () => {
	LocalStore.setDefaultApplicationSetting();
	const appConfig = LocalStore.getStore('configs');
	appConfig.serverConfigConnected = true;
	store.set({
		configs: appConfig
	});
	onWaitingServer = false;
	if (!isAlreadyRun) {
		serverDesktop = fork(
			path.join(__dirname, '../../../desktop-api/main.js')
		);
		gauzyWindow.loadURL(gauzyPage());
		ipcTimer(
			store,
			knex,
			setupWindow,
			timeTrackerWindow,
			NotificationWindow,
			settingsWindow,
			imageView
		);
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

ipcMain.on('restart_app', (event, arg) => {
	dialogErr = false;
	LocalStore.updateConfigSetting(arg);
	if (serverGauzy) serverGauzy.kill();
	if (gauzyWindow) gauzyWindow.destroy();
	gauzyWindow = null;
	isAlreadyRun = false;
	setTimeout(() => {
		if (!gauzyWindow) {
			const configs = LocalStore.getStore('configs');
			global.variableGlobal = {
				API_BASE_URL: getApiBaseUrl(configs),
				IS_INTEGRATED_DESKTOP: configs.isLocalServer
			};
			startServer(configs, tray ? true : false);
			setupWindow.webContents.send('server_ping_restart', {
				host: getApiBaseUrl(configs)
			});
		}
	}, 100);
});

ipcMain.on('server_already_start', () => {
	if (!gauzyWindow && !isAlreadyRun) {
		gauzyWindow = createGauzyWindow(gauzyWindow, serve);
		isAlreadyRun = true;
	}
});

ipcMain.on('open_browser', (event, arg) => {
	shell.openExternal(arg.url);
});

ipcMain.on('check_for_update', (event, arg) => {
	autoUpdater.checkForUpdatesAndNotify().then((downloadPromise) => {
		cancellationToken = downloadPromise.cancellationToken;
	});
});

autoUpdater.on('update-available', () => {
	settingsWindow.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
	settingsWindow.webContents.send('update_downloaded');
});

autoUpdater.on('update-not-available', () => {
	settingsWindow.webContents.send('update_not_available');
});

autoUpdater.on('download-progress', (event) => {
	if (settingsWindow) {
		settingsWindow.webContents.send('download_on_progress', event);
	}
});

autoUpdater.on('error', (e) => {
	settingsWindow.webContents.send('error_update');
});

ipcMain.on('restart_and_update', () => {
	setImmediate(() => {
		app.removeAllListeners('window-all-closed');
		autoUpdater.quitAndInstall(false);
		if (serverDesktop) serverDesktop.kill();
		if (serverGauzy) serverGauzy.kill();
		app.exit(0);
	});
});

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

autoUpdater.on('error', () => {
	console.log('eroro');
});
app.on('activate', () => {
	if (gauzyWindow) {
		if (LocalStore.getStore('configs').gauzyWindow) {
			gauzyWindow.show();
		}
	} else if (
		!onWaitingServer &&
		LocalStore.getStore('configs') &&
		LocalStore.getStore('configs').isSetup
	) {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		createGauzyWindow(gauzyWindow, serve);
	} else {
		if (setupWindow) {
			setupWindow.show();
		}
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
		cancellationToken.cancel();
		app.exit(0);
		if (serverDesktop) serverDesktop.kill();
		if (serverGauzy) serverGauzy.kill();
	}
});

// On OS X it is common for applications and their menu bar
// to stay active until the user quits explicitly with Cmd + Q
function quit() {
	if (process.platform !== 'darwin') {
		app.quit();
	}
}
