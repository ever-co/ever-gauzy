// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

import * as path from 'path';
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
					return;
				}
				return;
			});
	}
});

require('module').globalPaths.push(path.join(__dirname, 'node_modules'));
require('sqlite3');
app.setName('gauzy-desktop-timer');

console.log('Node Modules Path', path.join(__dirname, 'node_modules'));

const Store = require('electron-store');
import {
	ipcMainHandler,
	ipcTimer,
	TrayIcon,
	LocalStore,
	DataModel,
	AppMenu
} from '@gauzy/desktop-libs';
import {
	createSetupWindow,
	createTimeTrackerWindow,
	createSettingsWindow,
	createUpdaterWindow,
	createImageViewerWindow
} from '@gauzy/desktop-window';
import { fork } from 'child_process';
import { autoUpdater } from 'electron-updater';
import { CancellationToken } from "builder-util-runtime";
import fetch from 'node-fetch';
import { initSentry } from './sentry';

initSentry();

// the folder where all app data will be stored (e.g. sqlite DB, settings, cache, etc)
// C:\Users\USERNAME\AppData\Roaming\gauzy-desktop-timer

process.env.GAUZY_USER_PATH = app.getPath('userData');
log.info(`GAUZY_USER_PATH: ${process.env.GAUZY_USER_PATH}`);

const sqlite3filename = `${process.env.GAUZY_USER_PATH}/gauzy.sqlite3`;
log.info(`Sqlite DB path: ${sqlite3filename}`);

const knex = require('knex')({
	client: 'sqlite3',
	connection: {
		filename: sqlite3filename
	},
	useNullAsDefault: true
});

const exeName = path.basename(process.execPath);

const dataModel = new DataModel();
dataModel.createNewTable(knex);

const store = new Store();

const args = process.argv.slice(1);
const serve: boolean = args.some((val) => val === '--serve');

let gauzyWindow: BrowserWindow = null;
let setupWindow: BrowserWindow = null;
let timeTrackerWindow: BrowserWindow = null;
let notificationWindow: BrowserWindow = null;
let settingsWindow: BrowserWindow = null;
let updaterWindow: BrowserWindow = null;
let imageView: BrowserWindow = null;
let tray = null;
let isAlreadyRun = false;
let willQuit = false;
let onWaitingServer = false;
let alreadyQuit = false;
let serverGauzy = null;
let serverDesktop = null;
let dialogErr = false;
let cancellationToken = null;

try {
	cancellationToken = new CancellationToken();
} catch (error) {}

console.log(
	'Time Tracker UI Render Path:',
	path.join(__dirname, './index.html')
);
const pathWindow = {
	timeTrackerUi: path.join(__dirname, './index.html')
};

function startServer(value, restart = false) {
	try {
		const config: any = {
			...value,
			isSetup: true
		};
		const aw = {
			host: value.awHost,
			isAw: value.aw
		};
		const projectConfig = store.get('project');
		store.set({
			configs: config,
			project: projectConfig ? projectConfig : {
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
		timeTrackerWindow.destroy();
		timeTrackerWindow = createTimeTrackerWindow(
			timeTrackerWindow,
			pathWindow.timeTrackerUi
		);
		gauzyWindow = timeTrackerWindow;
		gauzyWindow.show();
	}
	const auth = store.get('auth');
	new AppMenu(
		timeTrackerWindow,
		settingsWindow,
		updaterWindow,
		knex,
		pathWindow
	);

	if (!tray) {
		tray = new TrayIcon(
			setupWindow,
			knex,
			timeTrackerWindow,
			auth,
			settingsWindow,
			{ ...environment },
			pathWindow,
			path.join(
				__dirname,
				'assets',
				'icons',
				'icon_16x16.png'
			)
		);
	}

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
				const addSetting = LocalStore.getStore('additionalSetting');
				if (!settingsWindow) {
					settingsWindow = createSettingsWindow(
						settingsWindow,
						pathWindow.timeTrackerUi
					);
				}
				settingsWindow.show();
				setTimeout(() => {
					settingsWindow.webContents.send('app_setting', {
						setting: appSetting,
						config: config,
						additionalSetting: addSetting
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
	const configs: any = store.get('configs');
	if (configs && typeof configs.autoLaunch === 'undefined') {
		launchAtStartup(true, false);
	}
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
	timeTrackerWindow = createTimeTrackerWindow(
		timeTrackerWindow,
		pathWindow.timeTrackerUi
	);
	settingsWindow = createSettingsWindow(
		settingsWindow,
		pathWindow.timeTrackerUi
	);
	updaterWindow = createUpdaterWindow(
		updaterWindow,
		pathWindow.timeTrackerUi
	);
	imageView = createImageViewerWindow(imageView, pathWindow.timeTrackerUi);

	/* Set Menu */

	if (configs && configs.isSetup) {
		global.variableGlobal = {
			API_BASE_URL: getApiBaseUrl(configs),
			IS_INTEGRATED_DESKTOP: configs.isLocalServer
		};
		setupWindow = createSetupWindow(
			setupWindow,
			true,
			pathWindow.timeTrackerUi
		);
		startServer(configs);
	} else {
		setupWindow = createSetupWindow(
			setupWindow,
			false,
			pathWindow.timeTrackerUi
		);
		setupWindow.show();
	}

	ipcMainHandler(store, startServer, knex, { ...environment });
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
			path.join(__dirname, './desktop-api/main.js')
		);
		ipcTimer(
			store,
			knex,
			setupWindow,
			timeTrackerWindow,
			notificationWindow,
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

ipcMain.on('save_additional_setting', (event, arg) => {
	LocalStore.updateAdditionalSetting(arg);
})

ipcMain.on('server_already_start', () => {
	if (!gauzyWindow && !isAlreadyRun) {
		gauzyWindow = timeTrackerWindow;
		gauzyWindow.show();
		isAlreadyRun = true;
	}
});

ipcMain.on('open_browser', (event, arg) => {
	shell.openExternal(arg.url);
});

ipcMain.on('check_for_update', async (event, arg) => {
	const updaterConfig = {
		repo: 'gauzy',
		owner: 'ever-co',
		typeRelease: 'releases'
	};
	let latestReleaseTag = null;
	try {
		latestReleaseTag = await fetch(
			`https://github.com/${updaterConfig.owner}/${updaterConfig.repo}/${updaterConfig.typeRelease}/latest`,
			{
				method: 'GET',
				headers: {
					Accept: 'application/json'
				}
			}
		).then((res) => res.json());
	} catch (error) {}

	if (latestReleaseTag) {
		autoUpdater.setFeedURL({
			channel: 'desktop-timer-latest',
			provider: 'generic',
			url: `https://github.com/${updaterConfig.owner}/${updaterConfig.repo}/${updaterConfig.typeRelease}/download/${latestReleaseTag.tag_name}`
		});
		autoUpdater.checkForUpdatesAndNotify().then((downloadPromise) => {
			if (cancellationToken)
				cancellationToken = downloadPromise.cancellationToken;
		});
	} else {
		settingsWindow.webContents.send('error_update');
	}
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

ipcMain.on('launch_on_startup', (event, arg) => {
	launchAtStartup(arg.autoLaunch, arg.hidden);
});

ipcMain.on('minimize_on_startup', (event, arg) => {
	launchAtStartup(arg.autoLaunch, arg.hidden);
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
		gauzyWindow = timeTrackerWindow;
		gauzyWindow.show();
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
		if (cancellationToken) {
			cancellationToken.cancel();
		}
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
					? [
							'--processStart',
							`"${exeName}"`,
							'--process-start-args',
							`"--hidden"`
					  ]
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
