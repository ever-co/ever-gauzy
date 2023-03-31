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
					submitIssue('https://github.com/ever-co/ever-gauzy-desktop/issues/new', {
						title: `Automatic error report for Desktop App ${versions.app}`,
						body: 'Error:\n```' + error.stack + '\n```\n' + `OS: ${versions.os}`
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

app.setName('gauzy-desktop');

console.log('Node Modules Path', path.join(__dirname, 'node_modules'));

const Store = require('electron-store');
import * as remoteMain from '@electron/remote/main';
remoteMain.initialize();

import {
	ipcMainHandler,
	ipcTimer,
	TrayIcon,
	LocalStore,
	DataModel,
	AppMenu,
	DesktopUpdater,
	removeMainListener,
	removeTimerListener,
	ProviderFactory
} from '@gauzy/desktop-libs';
import {
	createGauzyWindow,
	gauzyPage,
	createSetupWindow,
	createTimeTrackerWindow,
	createSettingsWindow,
	createUpdaterWindow,
	createImageViewerWindow
} from '@gauzy/desktop-window';
import { fork } from 'child_process';
import { autoUpdater } from 'electron-updater';
import { initSentry } from './sentry';

initSentry();

// the folder where all app data will be stored (e.g. sqlite DB, settings, cache, etc)
// C:\Users\USERNAME\AppData\Roaming\gauzy-desktop
process.env.GAUZY_USER_PATH = app.getPath('userData');
log.info(`GAUZY_USER_PATH: ${process.env.GAUZY_USER_PATH}`);

const sqlite3filename = `${process.env.GAUZY_USER_PATH}/gauzy.sqlite3`;
log.info(`Sqlite DB path: ${sqlite3filename}`);

const provider = ProviderFactory.instance;
const knex = provider.connection;

const exeName = path.basename(process.execPath);

const dataModel = new DataModel();
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

console.log('App UI Render Path:', path.join(__dirname, './index.html'));

const pathWindow = {
	gauzyWindow: path.join(__dirname, './index.html'),
	timeTrackerUi: path.join(__dirname, './ui/index.html'),
	screenshotWindow: path.join(__dirname, './ui/index.html')
};

const updater = new DesktopUpdater({
	repository: 'ever-gauzy-desktop',
	owner: 'ever-co',
	typeRelease: 'releases'
});

let tray = null;
let isAlreadyRun = false;
let onWaitingServer = false;
let serverGauzy = null;
let serverDesktop = null;
let dialogErr = false;

LocalStore.setFilePath({
	iconPath: path.join(__dirname, 'icons', 'icon.png')
});

// Instance detection
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
	app.quit();
} else {
	app.on('second-instance', () => {
		// if someone tried to run a second instance, we should focus our window and show warning message.
		if (gauzyWindow) {
			if (gauzyWindow.isMinimized()) gauzyWindow.restore();
			gauzyWindow.focus();
			dialog.showMessageBoxSync(gauzyWindow, {
				type: 'warning',
				title: 'Gauzy',
				message: 'You already have a running instance'
			});
		}
	});
}

/* Setting the app user model id for the app. */
if (process.platform === 'win32') {
	app.setAppUserModelId('com.ever.gauzydesktop');
}

async function startServer(value, restart = false) {
	process.env.IS_ELECTRON = 'true';
	if (value.db === 'sqlite') {
		process.env.DB_PATH = sqlite3filename;
		process.env.DB_TYPE = 'sqlite';
	} else {
		process.env.DB_TYPE = 'postgres';
		process.env.DB_HOST = value['postgres']?.dbHost;
		process.env.DB_PORT = value['postgres']?.dbPort;
		process.env.DB_NAME = value['postgres']?.dbName;
		process.env.DB_USER = value['postgres']?.dbUsername;
		process.env.DB_PASS = value['postgres']?.dbPassword;
	}
	if (value.isLocalServer) {
		process.env.API_PORT = value.port || environment.API_DEFAULT_PORT;
		process.env.API_HOST = '0.0.0.0';
		process.env.API_BASE_URL = `http://localhost:${value.port || environment.API_DEFAULT_PORT}`;
		setEnvAdditional();
		// require(path.join(__dirname, 'api/main.js'));
		serverGauzy = fork(path.join(__dirname, './api/main.js'), {
			silent: true
		});
		serverGauzy.stdout.on('data', async (data) => {
			const msgData = data.toString();
			console.log('log -- ', msgData);
			setupWindow.webContents.send('setup-progress', {
				msg: msgData
			});
			if (!value.isSetup && !value.serverConfigConnected) {
				if (msgData.indexOf('Listening at http') > -1) {
					setupWindow.hide();
					// isAlreadyRun = true;
					gauzyWindow = await createGauzyWindow(
						gauzyWindow,
						serve,
						{ ...environment, gauzyWindow: value.gauzyWindow },
						pathWindow.gauzyWindow
					);
					gauzyWindow.show();
				}
			}
			if (msgData.indexOf('Unable to connect to the database') > -1 && !dialogErr) {
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
		const aw = {
			host: value.awHost,
			isAw: value.aw
		};
		store.set({
			configs: config,
			project: {
				projectId: null,
				taskId: null,
				note: null,
				aw,
				organizationContactId: null
			}
		});
	} catch (error) {}

	/* create main window */
	if (value.serverConfigConnected || !value.isLocalServer) {
		setupWindow.hide();
		gauzyWindow = await createGauzyWindow(
			gauzyWindow,
			serve,
			{ ...environment, gauzyWindow: value.gauzyWindow },
			pathWindow.gauzyWindow
		);
		gauzyWindow.show();
	}
	const auth = store.get('auth');

	if (tray) {
		tray.destroy();
	}
	tray = new TrayIcon(
		setupWindow,
		knex,
		timeTrackerWindow,
		auth,
		settingsWindow,
		{ ...environment },
		pathWindow,
		path.join(__dirname, 'assets', 'icons', 'icon_16x16.png'),
		gauzyWindow
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

function setEnvAdditional() {
	const additionalConfig = LocalStore.getAdditionalConfig();
	Object.keys(additionalConfig).forEach((key) => {
		if (additionalConfig[key]) {
			process.env[key] = additionalConfig[key];
		}
	});
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

	dialog.showMessageBox(null, options).then(async (response) => {
		if (response.response === 1) app.quit();
		else {
			if (settingsWindow) settingsWindow.show();
			else {
				if (!settingsWindow) {
					settingsWindow = await createSettingsWindow(settingsWindow, pathWindow.timeTrackerUi);
				}
				settingsWindow.show();
				setTimeout(() => {
					settingsWindow.webContents.send('app_setting', LocalStore.getApplicationConfig());
				}, 500);
			}
		}
	});
};

const getApiBaseUrl = (configs) => {
	if (configs.serverUrl) return configs.serverUrl;
	else {
		return configs.port ? `http://localhost:${configs.port}` : `http://localhost:${environment.API_DEFAULT_PORT}`;
	}
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Added 5000 ms to fix the black background issue while using transparent window.
// More details at https://github.com/electron/electron/issues/15947

app.on('ready', async () => {
	const configs: any = store.get('configs');
	const settings: any = store.get('appSetting');
	const autoLaunch: boolean = settings && typeof settings.autoLaunch === 'boolean' ? settings.autoLaunch : true;
	if (provider.dialect === 'sqlite') {
		try {
			const res = await knex.raw(`pragma journal_mode = WAL;`);
			console.log(res);
		} catch (error) {
			console.log('ERROR', error);
		}
	}
	try {
		await provider.createDatabase();
		await provider.migrate();
		await dataModel.createNewTable(knex);
	} catch (error) {
		console.log('ERROR', error);
	}
	launchAtStartup(autoLaunch, false);
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
	timeTrackerWindow = await createTimeTrackerWindow(timeTrackerWindow, pathWindow.timeTrackerUi);
	settingsWindow = await createSettingsWindow(settingsWindow, pathWindow.timeTrackerUi);
	updaterWindow = await createUpdaterWindow(updaterWindow, pathWindow.timeTrackerUi);
	imageView = await createImageViewerWindow(imageView, pathWindow.timeTrackerUi);

	/* Set Menu */
	new AppMenu(timeTrackerWindow, settingsWindow, updaterWindow, knex, pathWindow, null, true);

	if (configs && configs.isSetup) {
		if (!configs.serverConfigConnected) {
			setupWindow = await createSetupWindow(setupWindow, false, pathWindow.timeTrackerUi);
			setupWindow.show();
			setupWindow.webContents.send('setup-data', {
				...configs
			});
		} else {
			global.variableGlobal = {
				API_BASE_URL: getApiBaseUrl(configs),
				IS_INTEGRATED_DESKTOP: configs.isLocalServer
			};
			setupWindow = await createSetupWindow(setupWindow, true, pathWindow.timeTrackerUi);
			await startServer(configs);
		}
	} else {
		setupWindow = await createSetupWindow(setupWindow, false, pathWindow.timeTrackerUi);
		setupWindow.show();
	}
	updater.settingWindow = settingsWindow;
	updater.gauzyWindow = gauzyWindow;
	updater.checkUpdate();
	removeMainListener();
	ipcMainHandler(store, startServer, knex, { ...environment }, timeTrackerWindow);
	if (gauzyWindow) {
		gauzyWindow.webContents.setZoomFactor(1.0);
		gauzyWindow.webContents
			.setVisualZoomLevelLimits(1, 5)
			.then(() => console.log('Zoom levels have been set between 100% and 500%'))
			.catch((err) => console.log(err));
	}
});

app.on('window-all-closed', quit);

app.commandLine.appendSwitch('disable-http2');

ipcMain.on('server_is_ready', async () => {
	LocalStore.setDefaultApplicationSetting();
	const appConfig = LocalStore.getStore('configs');
	appConfig.serverConfigConnected = true;
	store.set({
		configs: appConfig
	});
	onWaitingServer = false;
	if (!isAlreadyRun) {
		serverDesktop = fork(path.join(__dirname, './desktop-api/main.js'));
		await gauzyWindow.loadURL(gauzyPage(pathWindow.gauzyWindow));
		removeTimerListener();
		ipcTimer(
			store,
			knex,
			setupWindow,
			timeTrackerWindow,
			NotificationWindow,
			settingsWindow,
			imageView,
			{ ...environment },
			createSettingsWindow,
			pathWindow,
			path.join(__dirname, '..', 'data', 'sound', 'snapshot-sound.wav')
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

ipcMain.on('restart_app', async (event, arg) => {
	dialogErr = false;
	LocalStore.updateConfigSetting(arg);
	if (serverGauzy) serverGauzy.kill();
	if (gauzyWindow) gauzyWindow.destroy();
	gauzyWindow = null;
	isAlreadyRun = false;
	const configs = LocalStore.getStore('configs');
	global.variableGlobal = {
		API_BASE_URL: getApiBaseUrl(configs),
		IS_INTEGRATED_DESKTOP: configs.isLocalServer
	};
	await startServer(configs, tray ? true : false);
	setupWindow.webContents.send('server_ping_restart', {
		host: getApiBaseUrl(configs)
	});
});

ipcMain.on('save_additional_setting', (event, arg) => {
	LocalStore.updateAdditionalSetting(arg);
});

ipcMain.on('server_already_start', async () => {
	if (!gauzyWindow && !isAlreadyRun) {
		const configs: any = store.get('configs');
		gauzyWindow = await createGauzyWindow(
			gauzyWindow,
			serve,
			{ ...environment, gauzyWindow: configs.gauzyWindow },
			pathWindow.gauzyWindow
		);
		isAlreadyRun = true;
	}
});

ipcMain.on('open_browser', (event, arg) => {
	shell.openExternal(arg.url);
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
	try {
		const provider = arg.db;
		let databaseOptions;
		if (provider === 'postgres') {
			databaseOptions = {
				client: 'pg',
				connection: {
					host: arg[provider].dbHost,
					user: arg[provider].dbUsername,
					password: arg[provider].dbPassword,
					database: arg[provider].dbName,
					port: arg[provider].dbPort
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
		await dbConn.raw('select 1+1 as result');
		event.sender.send('database_status', {
			status: true,
			message:
				provider === 'postgres' ? 'Connection to PostgresSQL DB Succeeds' : 'Connection to SQLITE DB Succeeds'
		});
	} catch (error) {
		event.sender.send('database_status', {
			status: false,
			message: error.message
		});
	}
});

app.on('activate', async () => {
	if (gauzyWindow) {
		if (LocalStore.getStore('configs').gauzyWindow) {
			gauzyWindow.show();
		}
	} else if (!onWaitingServer && LocalStore.getStore('configs') && LocalStore.getStore('configs').isSetup) {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		await createGauzyWindow(gauzyWindow, serve, { ...environment }, pathWindow.timeTrackerUi);
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
			timeTrackerWindow.webContents.send('stop_from_tray', {
				quitApp: true
			});
		}, 1000);
	} else {
		// soft download cancellation
		try {
			updater.cancel();
		} catch (e) {}
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

function launchAtStartup(autoLaunch, hidden) {
	switch (process.platform) {
		case 'darwin':
			app.setLoginItemSettings({
				openAtLogin: autoLaunch,
				openAsHidden: hidden
			});
			break;
		case 'win32':
			app.setLoginItemSettings({
				openAtLogin: autoLaunch,
				openAsHidden: hidden,
				path: app.getPath('exe'),
				args: hidden
					? ['--processStart', `"${exeName}"`, '--process-start-args', `"--hidden"`]
					: ['--processStart', `"${exeName}"`, '--process-start-args']
			});
			break;
		case 'linux':
			app.setLoginItemSettings({
				openAtLogin: autoLaunch,
				openAsHidden: hidden
			});
			break;
		default:
			break;
	}
}

app.on('browser-window-created', (_, window) => {
	require('@electron/remote/main').enable(window.webContents);
});
