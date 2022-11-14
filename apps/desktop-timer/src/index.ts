// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

import * as path from 'path';
import { app, dialog, BrowserWindow, ipcMain, shell, Menu } from 'electron';
import { environment } from './environments/environment';
import Url from 'url';


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
					submitIssue('https://github.com/ever-co/ever-gauzy-desktop-timer/issues/new', {
						title: `Automatic error report for Desktop Timer App ${versions.app}`,
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
import * as remoteMain from '@electron/remote/main';
remoteMain.initialize();

import {
	ipcMainHandler,
	ipcTimer,
	TrayIcon,
	LocalStore,
	DataModel,
	AppMenu,
	removeMainListener,
	removeTimerListener,
	appUpdateNotification,
	DesktopDialog,
	DialogConfirmUpgradeDownload,
	DialogConfirmInstallDownload
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
import { initSentry } from './sentry';

// Can be like this: import fetch from '@gauzy/desktop-libs' for v3 of node-fetch;
import fetch from 'node-fetch';

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
	pool: {
		min: 2,
		max: 15,
		createTimeoutMillis: 3000,
		acquireTimeoutMillis: 60 * 1000 * 2,
		idleTimeoutMillis: 30000,
		reapIntervalMillis: 1000,
		createRetryIntervalMillis: 100
	},
	useNullAsDefault: true
});

const exeName = path.basename(process.execPath);

const store = new Store();

const args = process.argv.slice(1);
args.some((val) => val === '--serve');
let gauzyWindow: BrowserWindow = null;
let setupWindow: BrowserWindow = null;
let timeTrackerWindow: BrowserWindow = null;
const notificationWindow: BrowserWindow = null;
let settingsWindow: BrowserWindow = null;
let updaterWindow: BrowserWindow = null;
let imageView: BrowserWindow = null;
let tray = null;
let isAlreadyRun = false;
let willQuit = false;
let onWaitingServer = false;
const serverGauzy = null;
let serverDesktop = null;
let dialogErr = false;
let cancellationToken;
let popupWin: BrowserWindow | null = null;
let isDownloadTriggered: boolean = false;

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

LocalStore.setFilePath({
	iconPath: path.join(__dirname, 'icons', 'icon.png')
})
// Instance detection
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
	app.quit()
} else {
	app.on('second-instance', () => {
		// if someone tried to run a second instance, we should focus our window and show warning message.
		if (gauzyWindow) {
			if (gauzyWindow.isMinimized()) gauzyWindow.restore();
			gauzyWindow.focus();
			dialog.showMessageBoxSync(gauzyWindow, {
				type: "warning",
				title: "Gauzy",
				message: "You already have a running instance"
			});
		}
	})
}

async function startServer(value, restart = false) {
	await knex.raw(`pragma journal_mode = WAL;`).then((res) => console.log(res));
	const dataModel = new DataModel();
	await dataModel.createNewTable(knex);
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
		if (timeTrackerWindow) {
			timeTrackerWindow.destroy();
		}
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
		path.join(
			__dirname,
			'assets',
			'icons',
			'icon.png'
		),
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
				if (!settingsWindow) {
					settingsWindow = createSettingsWindow(
						settingsWindow,
						pathWindow.timeTrackerUi
					);
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
	setTimeout(async () => {
		try {
			await checkForUpdateNotify();
		} catch (e) {
			console.log('Error on checking update:', e);
		}
	}, 5000);
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
	// default global
	global.variableGlobal = {
		API_BASE_URL: getApiBaseUrl({}),
		IS_INTEGRATED_DESKTOP: false
	};
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
		await startServer(configs);
	} else {
		setupWindow = createSetupWindow(
			setupWindow,
			false,
			pathWindow.timeTrackerUi
		);
		setupWindow.show();
	}

	removeMainListener();
	ipcMainHandler(store, startServer, knex, { ...environment }, timeTrackerWindow);
});

app.on('window-all-closed', quit);

app.commandLine.appendSwitch('disable-http2');

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
		removeTimerListener();
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
	setTimeout(async () => {
		if (!gauzyWindow) {
			const configs = LocalStore.getStore('configs');
			global.variableGlobal = {
				API_BASE_URL: getApiBaseUrl(configs),
				IS_INTEGRATED_DESKTOP: configs.isLocalServer
			};
			await startServer(configs, !!tray);
			removeMainListener();
			ipcMainHandler(store, startServer, knex, { ...environment }, timeTrackerWindow);
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

ipcMain.on('open_browser', async (event, arg) => {
	await shell.openExternal(arg.url);
});

ipcMain.on('check_for_update', async () => {
	await checkUpdate();
});

autoUpdater.once('update-available', () => {
	const setting = LocalStore.getStore('appSetting');
	settingsWindow.webContents.send('update_available');
	if(setting && !setting.automaticUpdate) return;
	const dialog = new DialogConfirmUpgradeDownload(
		new DesktopDialog(
			'Gauzy',
			'Update Ready to Download',
			gauzyWindow
		)
	);
	dialog.show().then(async (button) => {
		if (button.response === 0) {
			await checkUpdate();
		}
	});
});

autoUpdater.on('update-downloaded', () => {
	const setting = LocalStore.getStore('appSetting');
	settingsWindow.webContents.send('update_downloaded');
	if(setting && !setting.automaticUpdate) return;
	const dialog = new DialogConfirmInstallDownload(
		new DesktopDialog(
			'Gauzy',
			'Update Ready to Install',
			gauzyWindow
		)
	);
	dialog.show().then((button) => {
		if (button.response === 0) autoUpdater.quitAndInstall();
	  })
});

autoUpdater.requestHeaders = {
	'Cache-Control':
		'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
};

autoUpdater.on('update-not-available', () => {
	settingsWindow.webContents.send('update_not_available');
});

autoUpdater.on('download-progress', (event) => {
	console.log('update log', event);
	if (settingsWindow) {
		settingsWindow.webContents.send('download_on_progress', event);
	}
});

autoUpdater.on('error', (e) => {
	settingsWindow.webContents.send('error_update', e);
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
	let databaseOptions;
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
					? 'Connection to PostgresSQL DB Succeeds'
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
	console.log('error');
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
		// On macOS, it's common to re-create a window in the app when the
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

async function getUpdaterConfig() {
	const updaterConfig = {
		repo: 'ever-gauzy-desktop-timer',
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
		return `https://github.com/${updaterConfig.owner}/${updaterConfig.repo}/${updaterConfig.typeRelease}/download/${latestReleaseTag.tag_name}`;
	}
	return null;
}

async function checkForUpdateNotify() {
	const updateFeedUrl = await getUpdaterConfig();
	await appUpdateNotification(updateFeedUrl);
}
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

app.on('web-contents-created', (e, contents) => {
	contents.on(
		'will-redirect',
		async (e, url) => {
			const defaultBrowserConfig: any = {
				title: '',
				width: 1280,
				height: 600,
				webPreferences: {
					allowRunningInsecureContent: false,
					contextIsolation: true,
					enableRemoteModule: true,
					javascript: true,
					webSecurity: false,
					webviewTag: false
				}
			};
			if (
				[
					'https://www.linkedin.com/oauth',
					'https://accounts.google.com'
				].findIndex((str) => url.indexOf(str) > -1) > -1
			) {
				e.preventDefault();
				await showPopup(url, defaultBrowserConfig);
				return;
			}

		if (url.indexOf('sign-in/success?jwt') > -1) {
			if (popupWin) popupWin.destroy();
			const urlParse = Url.parse(url, true);
				const urlParsed = Url.parse(
					urlFormat(urlParse.hash, urlParse.host),
					true
				);
			const query = urlParsed.query;
			const params = LocalStore.beforeRequestParams();
				timeTrackerWindow.webContents.send('social_auth_success', {
					...params,
				token: query.jwt,
				userId: query.userId
				});
		}

		if (url.indexOf('/auth/register') > -1) {
			await shell.openExternal(url);
		}
		}
	);
});

const urlFormat = (hash: string, host: string) => {
	const uri = hash.substring(1);
	return `${host}${uri}`;
};

const showPopup = async (url: string, options: any) => {
	options.width = 1280;
	options.height = 768;
	if (popupWin) popupWin.destroy();
	popupWin = new BrowserWindow(options);
	let userAgentWb = 'Chrome/104.0.0.0';
	await popupWin.loadURL(url, {userAgent: userAgentWb});
	popupWin.show();
 };

const checkUpdate = async () => {
	autoUpdater.autoDownload = !isDownloadTriggered;
	const updateFeedUrl = await getUpdaterConfig();
	if (updateFeedUrl) {
		autoUpdater.setFeedURL({
			channel: 'latest',
			provider: 'generic',
			url: updateFeedUrl
		});
		autoUpdater.checkForUpdatesAndNotify().then((downloadPromise) => {
			if (cancellationToken){
				cancellationToken = downloadPromise.cancellationToken;
			}else {
				 isDownloadTriggered = true;
			}
		}).catch((e) => {
			console.log('Error occurred', e);
		});
	} else {
		settingsWindow.webContents.send('error_update');
	}
}