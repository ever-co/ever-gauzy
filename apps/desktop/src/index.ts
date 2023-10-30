// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

import { app, dialog, BrowserWindow, ipcMain, shell, Menu, MenuItemConstructorOptions } from 'electron';
import { environment } from './environments/environment';
import * as Sentry from '@sentry/electron';
import * as path from 'path';

require('module').globalPaths.push(path.join(__dirname, 'node_modules'));
require('sqlite3');

process.env = Object.assign(process.env, environment);

app.setName(process.env.NAME);

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
	ProviderFactory,
	TranslateLoader,
	TranslateService,
	DialogErrorHandler,
	ErrorReport,
	ErrorReportRepository,
	ErrorEventManager,
	AppError,
	UIError,
} from '@gauzy/desktop-libs';
import {
	createGauzyWindow,
	createSetupWindow,
	createTimeTrackerWindow,
	createSettingsWindow,
	createUpdaterWindow,
	createImageViewerWindow,
	SplashScreen,
	AlwaysOn,
	ScreenCaptureNotification
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
let notificationWindow: ScreenCaptureNotification = null;
let settingsWindow: BrowserWindow = null;
let updaterWindow: BrowserWindow = null;
let imageView: BrowserWindow = null;
let splashScreen: SplashScreen = null;
let alwaysOn: AlwaysOn = null;

console.log('App UI Render Path:', path.join(__dirname, './index.html'));

const pathWindow = {
	gauzyWindow: path.join(__dirname, './index.html'),
	timeTrackerUi: path.join(__dirname, './ui/index.html'),
	screenshotWindow: path.join(__dirname, './ui/index.html'),
};

const updater = new DesktopUpdater({
	repository: process.env.REPO_NAME,
	owner: process.env.REPO_OWNER,
	typeRelease: 'releases',
});
const report = new ErrorReport(
	new ErrorReportRepository(
		process.env.REPO_OWNER,
		process.env.REPO_NAME
	)
);
const eventErrorManager = ErrorEventManager.instance;

let tray = null;
let isAlreadyRun = false;
let onWaitingServer = false;
let serverGauzy = null;
let serverDesktop = null;
let dialogErr = false;

LocalStore.setFilePath({
	iconPath: path.join(__dirname, 'icons', 'icon.png'),
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
				title: process.env.DESCRIPTION,
				message: 'You already have a running instance',
			});
		}
	});
}

/* Load translations */
TranslateLoader.load(path.join(__dirname, 'ui', 'assets', 'i18n'));

/* Setting the app user model id for the app. */
if (process.platform === 'win32') {
	app.setAppUserModelId(process.env.APP_ID);
}

// Set unlimited listeners
ipcMain.setMaxListeners(0);

/* Remove handler if exist */
ipcMain.removeHandler('PREFERRED_LANGUAGE');


// setup logger to catch all unhandled errors and submit as bug reports to our repo
log.catchErrors({
	showDialog: false,
	onError(error, versions, submitIssue) {
		// Set user information, as well as tags and further extras
		Sentry.configureScope((scope) => {
			scope.setExtra('Version', versions.app);
			scope.setTag('OS', versions.os);
		});
		// Capture exceptions, messages
		Sentry.captureMessage(error.message);
		Sentry.captureException(new Error(error.stack));
		const dialog = new DialogErrorHandler(error.message);
		dialog.options.detail = error.stack;
		dialog.show().then((result) => {
			if (result.response === 1) {
				submitIssue(
					`https://github.com/${process.env.REPO_OWNER}/${process.env.REPO_NAME}/issues/new`,
					{
						title: `Automatic error report for Desktop App ${versions.app}`,
						body:
							'Error:\n```' +
							error.stack +
							'\n```\n' +
							`OS: ${versions.os}`,
					}
				);
				return;
			}

			if (result.response === 2) {
				app.quit();
			}
		});
	}
});

process.on('uncaughtException', (error) => {
	throw new AppError('MAINUNEXCEPTION', error.message);
});

eventErrorManager.onSendReport(async (message: string) => {
	if (!gauzyWindow) return;
	gauzyWindow.focus();
	const dialog = new DialogErrorHandler(message, gauzyWindow);
	dialog.options.buttons.shift();
	const button = await dialog.show();
	switch (button.response) {
		case 0:
			report.description = message;
			await report.submit();
			app.exit(0);
			break;
		default:
			app.exit(0);
			break;
	}

});

eventErrorManager.onShowError(async (message: string) => {
	if (!gauzyWindow) return;
	gauzyWindow.focus();
	const dialog = new DialogErrorHandler(message, gauzyWindow);
	dialog.options.buttons.splice(1, 1);
	const button = await dialog.show();
	switch (button.response) {
		case 1:
			app.exit(0);
			break;
		default:
			// 👀
			break;
	}
});

async function startServer(value, restart = false) {
	global.variableGlobal = {
		API_BASE_URL: getApiBaseUrl(value),
		IS_INTEGRATED_DESKTOP: value.isLocalServer
	};
	process.env.IS_ELECTRON = 'true';
	if (value.db === 'sqlite') {
		process.env.DB_PATH = sqlite3filename;
		process.env.DB_TYPE = 'sqlite';
	}else if(value.db === 'better-sqlite') {
		process.env.DB_PATH = sqlite3filename;
		process.env.DB_TYPE = 'better-sqlite3';
	}else {
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
		process.env.API_BASE_URL = `http://localhost:${
			value.port || environment.API_DEFAULT_PORT
		}`;
		setEnvAdditional();
		// require(path.join(__dirname, 'api/main.js'));
		serverGauzy = fork(path.join(__dirname, './api/main.js'), {
			silent: true,
		});
		serverGauzy.stdout.on('data', async (data) => {
			const msgData = data.toString();
			console.log('log -- ', msgData);
			setupWindow.webContents.send('setup-progress', {
				msg: msgData,
			});
			if (
				!value.isSetup &&
				(!value.serverConfigConnected || value.isLocalServer)
			) {
				if (msgData.indexOf('Listening at http') > -1) {
					try {
						setupWindow.hide();
						// isAlreadyRun = true;
						gauzyWindow = await createGauzyWindow(
							gauzyWindow,
							serve,
							{ ...environment, gauzyWindow: value.gauzyWindow },
							pathWindow.gauzyWindow
						);
						gauzyWindow.show();
					} catch (error) {
						throw new AppError('MAINWININIT', error);
					}
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
			isSetup: true,
		};
		const aw = {
			host: value.awHost,
			isAw: value.aw,
		};
		store.set({
			configs: config,
			project: {
				projectId: null,
				taskId: null,
				note: null,
				aw,
				organizationContactId: null,
			},
		});
	} catch (error) {
		throw new AppError('MAINSTRSERVER', error);
	}

	/* create main window */
	if (value.serverConfigConnected || !value.isLocalServer) {
		try {
			setupWindow.hide();
			gauzyWindow = await createGauzyWindow(
				gauzyWindow,
				serve,
				{ ...environment, gauzyWindow: value.gauzyWindow },
				pathWindow.gauzyWindow
			);
		} catch (error) {
			throw new AppError('MAINWININIT', error);
		}
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
		path.join(__dirname, 'assets', 'icons', 'tray', 'icon.png'),
		gauzyWindow,
		alwaysOn
	);

	notificationWindow = new ScreenCaptureNotification(pathWindow.screenshotWindow);
	await notificationWindow.loadURL();
	if (gauzyWindow) {
		gauzyWindow.setVisibleOnAllWorkspaces(false);
		gauzyWindow.show();
	}
	splashScreen.close();

	TranslateService.onLanguageChange(() => {
		new AppMenu(
			timeTrackerWindow,
			settingsWindow,
			updaterWindow,
			knex,
			pathWindow,
			null,
			true
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
			path.join(__dirname, 'assets', 'icons', 'tray', 'icon.png'),
			gauzyWindow,
			alwaysOn
		);
	});

	/* ping server before launch the ui */
	ipcMain.on('app_is_init', () => {
		if (!isAlreadyRun && value && !restart) {
			onWaitingServer = true;
			setupWindow.webContents.send('server_ping', {
				host: getApiBaseUrl(value),
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
		message: msg,
	};

	dialog.showMessageBox(null, options).then(async (response) => {
		if (response.response === 1) app.quit();
		else {
			if (settingsWindow) settingsWindow.show();
			else {
				if (!settingsWindow) {
					settingsWindow = await createSettingsWindow(
						settingsWindow,
						pathWindow.timeTrackerUi
					);
				}
				settingsWindow.show();
				settingsWindow.webContents.send(
					'app_setting',
					LocalStore.getApplicationConfig()
				);
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
	const configs: any = store.get('configs');
	const settings: any = store.get('appSetting');
	// default global
	global.variableGlobal = {
		API_BASE_URL: getApiBaseUrl(configs || {}),
		IS_INTEGRATED_DESKTOP: configs?.isLocalServer
	};
	splashScreen = new SplashScreen(pathWindow.timeTrackerUi);
	await splashScreen.loadURL();
	splashScreen.show();
	if (['sqlite', 'better-sqlite'].includes(provider.dialect)) {
		try {
			const res = await knex.raw(`pragma journal_mode = WAL;`)
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
		throw new AppError('MAINDB', error);
	}
	if (!settings) {
		launchAtStartup(true, false);
	}
	const menu: MenuItemConstructorOptions[] = [
		{
			label: app.getName(),
			submenu: [
				{ role: 'about', label: TranslateService.instant('MENU.ABOUT') },
				{ type: 'separator' },
				{ type: 'separator' },
				{ role: 'quit', label: TranslateService.instant('BUTTONS.EXIT') }
			]
		}
	];
	Menu.setApplicationMenu(Menu.buildFromTemplate(menu));

	try {
		/* create window */
		timeTrackerWindow = await createTimeTrackerWindow(
			timeTrackerWindow,
			pathWindow.timeTrackerUi
		);
		settingsWindow = await createSettingsWindow(
			settingsWindow,
			pathWindow.timeTrackerUi
		);
		updaterWindow = await createUpdaterWindow(
			updaterWindow,
			pathWindow.timeTrackerUi
		);
		imageView = await createImageViewerWindow(
			imageView,
			pathWindow.timeTrackerUi
		);

		alwaysOn = new AlwaysOn(pathWindow.timeTrackerUi);
		await alwaysOn.loadURL();

		/* Set Menu */
		new AppMenu(
			timeTrackerWindow,
			settingsWindow,
			updaterWindow,
			knex,
			pathWindow,
			null,
			true
		);

		if (configs && configs.isSetup) {
			if (!configs.serverConfigConnected && !configs?.isLocalServer) {
				setupWindow = await createSetupWindow(
					setupWindow,
					false,
					pathWindow.timeTrackerUi
				);
				setupWindow.show();
				splashScreen.close();
				setupWindow.webContents.send('setup-data', {
					...configs,
				});
			} else {
				global.variableGlobal = {
					API_BASE_URL: getApiBaseUrl(configs),
					IS_INTEGRATED_DESKTOP: configs.isLocalServer,
				};
				setupWindow = await createSetupWindow(
					setupWindow,
					true,
					pathWindow.timeTrackerUi
				);
				await startServer(configs);
			}
		} else {
			setupWindow = await createSetupWindow(
				setupWindow,
				false,
				pathWindow.timeTrackerUi
			);
			setupWindow.show();
			splashScreen.close();
		}
	} catch (error) {
		throw new AppError('MAINWININIT', error);
	}
	updater.settingWindow = settingsWindow;
	updater.gauzyWindow = gauzyWindow;
	try {
		await updater.checkUpdate();
	} catch (error) {
		throw new UIError('400', error, 'MAINWININIT');
	}
	removeMainListener();
	ipcMainHandler(
		store,
		startServer,
		knex,
		{ ...environment },
		timeTrackerWindow
	);
	if (gauzyWindow) {
		try {
			gauzyWindow.webContents.setZoomFactor(1.0);
			await gauzyWindow.webContents.setVisualZoomLevelLimits(1, 5);
			console.log('Zoom levels have been set between 100% and 500%');
		} catch (error) {
			throw new UIError('400', error, 'MAINWININIT');
		}
	}
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.commandLine.appendSwitch('disable-http2');

ipcMain.on('server_is_ready', async () => {
	LocalStore.setDefaultApplicationSetting();
	const appConfig = LocalStore.getStore('configs');
	appConfig.serverConfigConnected = true;
	store.set({
		configs: appConfig,
	});
	onWaitingServer = false;
	if (!isAlreadyRun) {
		serverDesktop = fork(path.join(__dirname, './desktop-api/main.js'));
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
			path.join(__dirname, '..', 'data', 'sound', 'snapshot-sound.wav'),
			alwaysOn
		);
		timeTrackerWindow.webContents.send('ready_to_show_renderer');
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
	if (alwaysOn) alwaysOn.close();
	if (serverGauzy) serverGauzy.kill();
	if (gauzyWindow) gauzyWindow.destroy();
	gauzyWindow = null;
	isAlreadyRun = false;
	const configs = LocalStore.getStore('configs');
	global.variableGlobal = {
		API_BASE_URL: getApiBaseUrl(configs),
		IS_INTEGRATED_DESKTOP: configs.isLocalServer,
	};
	app.relaunch({ args: process.argv.slice(1).concat(['--relaunch']) });
	app.exit(0);
});

ipcMain.on('save_additional_setting', (event, arg) => {
	LocalStore.updateAdditionalSetting(arg);
});

ipcMain.on('server_already_start', async () => {
	if (!gauzyWindow && !isAlreadyRun) {
		try {
			const configs: any = store.get('configs');
			gauzyWindow = await createGauzyWindow(
				gauzyWindow,
				serve,
				{ ...environment, gauzyWindow: configs.gauzyWindow },
				pathWindow.gauzyWindow
			);
			isAlreadyRun = true;
		} catch (error) {
			throw new AppError('MAINWININIT', error);
		}
	}
});

ipcMain.on('open_browser', async (event, arg) => {
	try {
		await shell.openExternal(arg.url);
	} catch (error) {
		throw new AppError('MAINOPENEXT', error);
	}
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
		const driver = await provider.check(arg);
		event.sender.send('database_status', {
			status: true,
			message: TranslateService.instant(
				'TIMER_TRACKER.DIALOG.CONNECTION_DRIVER',
				{ driver }
			)
		});
	} catch (error) {
		event.sender.send('database_status', {
			status: false,
			message: error.message,
		});
	}
});

app.on('activate', async () => {
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
		await createGauzyWindow(
			gauzyWindow,
			serve,
			{ ...environment },
			pathWindow.timeTrackerUi
		);
	} else {
		if (setupWindow) {
			setupWindow.show();
			splashScreen.close();
		}
	}
});

app.on('before-quit', (e) => {
	e.preventDefault();
	const appSetting = LocalStore.getStore('appSetting');
	if (appSetting && appSetting.timerStarted) {
		e.preventDefault();
		timeTrackerWindow.webContents.send('stop_from_tray', {
			quitApp: true,
		});
	} else {
		// soft download cancellation
		try {
			updater.cancel();
		} catch (e) {
			throw new AppError('MAINUPDTABORT', e);
		}
		if (serverDesktop) serverDesktop.kill();
		if (serverGauzy) serverGauzy.kill();
		app.exit(0);
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
				openAsHidden: hidden,
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
							`"--hidden"`,
					  ]
					: [
							'--processStart',
							`"${exeName}"`,
							'--process-start-args',
					  ],
			});
			break;
		case 'linux':
			app.setLoginItemSettings({
				openAtLogin: autoLaunch,
				openAsHidden: hidden,
			});
			break;
		default:
			break;
	}
}

ipcMain.handle('PREFERRED_LANGUAGE', (event, arg) => {
	const setting = store.get('appSetting');
	if (arg) {
		if (!setting) LocalStore.setDefaultApplicationSetting();
		TranslateService.preferredLanguage = arg;
		settingsWindow?.webContents?.send('preferred_language_change', arg);
	}
	return TranslateService.preferredLanguage;
});

app.on('browser-window-created', (_, window) => {
	require("@electron/remote/main").enable(window.webContents)
});

ipcMain.on('launch_on_startup', (event, arg) => {
	launchAtStartup(arg.autoLaunch, arg.hidden);
});

ipcMain.on('minimize_on_startup', (event, arg) => {
	launchAtStartup(arg.autoLaunch, arg.hidden);
});
