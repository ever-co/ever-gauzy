// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

import * as remoteMain from '@electron/remote/main';
import { setupTitlebar } from 'custom-electron-titlebar/main';
import { BrowserWindow, Menu, MenuItemConstructorOptions, app, dialog, ipcMain, nativeTheme, shell } from 'electron';
import * as path from 'path';
import * as Store from 'electron-store';

import { environment } from './environments/environment';

require('module').globalPaths.push(path.join(__dirname, 'node_modules'));
console.log('Desktop Node Modules Path', path.join(__dirname, 'node_modules'));

Object.assign(process.env, environment);

app.setName(process.env.NAME);

remoteMain.initialize();

import {
	AppError,
	AppMenu,
	DesktopServer,
	DesktopThemeListener,
	DesktopUpdater,
	DialogErrorHandler,
	ErrorEventManager,
	ErrorReport,
	ErrorReportRepository,
	LocalStore,
	ProviderFactory,
	TranslateLoader,
	TranslateService,
	TrayIcon,
	UIError,
	ipcMainHandler,
	ipcTimer,
	removeMainListener,
	removeTimerListener
} from '@gauzy/desktop-lib';
import {
	AlwaysOn,
	ScreenCaptureNotification,
	SplashScreen,
	createGauzyWindow,
	createImageViewerWindow,
	createSettingsWindow,
	createSetupWindow,
	createTimeTrackerWindow,
	createUpdaterWindow
} from '@gauzy/desktop-window';
import * as Sentry from '@sentry/electron';
import { fork } from 'child_process';
import { autoUpdater } from 'electron-updater';
import { initSentry } from './sentry';

/**
 * Describes the configuration for building the Gauzy API base URL.
 */
export interface ApiConfig {
	/**
	 * A custom server URL, if provided (e.g. 'https://mydomain.com/api').
	 */
	serverUrl?: string;

	/**
	 * The protocol to use (e.g. 'http', 'https').
	 * Defaults to 'http' if not provided.
	 */
	protocol?: string;

	/**
	 * The hostname or IP address.
	 * Defaults to '127.0.0.1' if not provided.
	 */
	host?: string;

	/**
	 * The port number for the local environment.
	 * Defaults to environment.API_DEFAULT_PORT if not provided.
	 */
	port?: number;
}

// the folder where all app data will be stored (e.g. sqlite DB, settings, cache, etc)
// C:\Users\USERNAME\AppData\Roaming\gauzy-desktop
process.env.GAUZY_USER_PATH = app.getPath('userData');
log.info(`GAUZY_USER_PATH: ${process.env.GAUZY_USER_PATH}`);

process.env.GAUZY_SEED_PATH = path.join(__dirname, 'api', 'assets', 'seed');
log.info(`GAUZY_SEED_PATH: ${process.env.GAUZY_SEED_PATH}`);

const sqlite3filename = `${process.env.GAUZY_USER_PATH}/gauzy.sqlite3`;
log.info(`Sqlite DB path: ${sqlite3filename}`);

try {
	initSentry();
} catch (error) {
	log.error(error);
}

const provider = ProviderFactory.instance;
const knex = provider.connection;

const exeName = path.basename(process.execPath);

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
setupTitlebar();

console.log('App UI Render Path:', path.join(__dirname, './index.html'));

const pathWindow = {
	gauzyWindow: path.join(__dirname, './index.html'),
	timeTrackerUi: path.join(__dirname, './ui/index.html'),
	screenshotWindow: path.join(__dirname, './ui/index.html'),
	preloadPath: path.join(__dirname, 'preload/preload.js')
};

const updater = new DesktopUpdater({
	repository: process.env.REPO_NAME,
	owner: process.env.REPO_OWNER,
	typeRelease: 'releases'
});

const report = new ErrorReport(new ErrorReportRepository(process.env.REPO_OWNER, process.env.REPO_NAME));

const eventErrorManager = ErrorEventManager.instance;

const server = new DesktopServer(true);
const controller = new AbortController();
const { signal } = controller;

let tray = null;
let isAlreadyRun = false;
let onWaitingServer = false;
let serverDesktop = null;

/* Load translations */
TranslateLoader.load(path.join(__dirname, 'ui', 'assets', 'i18n'));

/* Setting the app user model id for the app. */
if (process.platform === 'win32') {
	app.setAppUserModelId(process.env.APP_ID);
}

LocalStore.setFilePath({
	iconPath: path.join(__dirname, 'assets', 'icons', 'menu', 'icon.png')
});

// Set unlimited listeners
ipcMain.setMaxListeners(0);

/* Remove handler if exist */
ipcMain.removeHandler('PREFERRED_LANGUAGE');

ipcMain.handle('PREFERRED_THEME', () => {
	const setting = LocalStore.getStore('appSetting');
	if (!setting) {
		LocalStore.setDefaultApplicationSetting();
		const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
		LocalStore.updateApplicationSetting({ theme });
		return theme;
	} else {
		return setting.theme;
	}
});

// setup logger to catch all unhandled errors and submit as bug reports to our repo
log.catchErrors({
	showDialog: false,
	onError(error, versions, submitIssue) {
		// Set user information, as well as tags and further extras
		const scope = new Sentry.Scope();
		scope.setExtra('Version', versions.app);
		scope.setTag('OS', versions.os);
		// Capture exceptions, messages
		Sentry.captureMessage(error.message);
		Sentry.captureException(new Error(error.stack), scope);
		const dialog = new DialogErrorHandler(error.message);
		dialog.options.detail = error.stack;
		dialog.show().then((result) => {
			if (result.response === 1) {
				submitIssue(`https://github.com/${process.env.REPO_OWNER}/${process.env.REPO_NAME}/issues/new`, {
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

process.on('uncaughtException', (error) => {
	throw new AppError('MAINUNEXCEPTION', error.message);
});

eventErrorManager.onSendReport(async (message: string) => {
	console.log('Send report event', message);
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
	console.log('Show error event', message);
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

// Instance detection
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
	console.log('Another instance is already running, quitting...');
	app.quit();
} else {
	app.on('second-instance', () => {
		console.log('Another instance is already running...');
		// if someone tried to run a second instance, we should focus our window and show warning message.
		if (gauzyWindow) {
			if (gauzyWindow.isMinimized()) gauzyWindow.restore();
			gauzyWindow.focus();
			dialog.showMessageBoxSync(gauzyWindow, {
				type: 'warning',
				title: process.env.DESCRIPTION,
				message: 'You already have a running instance'
			});
		}
	});
}

async function startServer(value, restart = false) {
	console.log('Starting the Server...');

	global.variableGlobal = {
		API_BASE_URL: getApiBaseUrl(value),
		IS_INTEGRATED_DESKTOP: value.isLocalServer
	};

	process.env.IS_ELECTRON = 'true';

	if (value.db === 'sqlite') {
		process.env.DB_PATH = sqlite3filename;
		process.env.DB_TYPE = 'sqlite';
	} else if (value.db === 'better-sqlite' || value.db === 'better-sqlite3') {
		process.env.DB_PATH = sqlite3filename;
		process.env.DB_TYPE = 'better-sqlite3';
	} else {
		process.env.DB_TYPE = 'postgres';
		process.env.DB_HOST = value['postgres']?.dbHost;
		process.env.DB_PORT = value['postgres']?.dbPort;
		process.env.DB_NAME = value['postgres']?.dbName;
		process.env.DB_USER = value['postgres']?.dbUsername;
		process.env.DB_PASS = value['postgres']?.dbPassword;
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
	} catch (error) {
		throw new AppError('MAINSTRSERVER', error);
	}

	if (value.isLocalServer) {
		console.log(`Starting local server on port ${value.port || environment.API_DEFAULT_PORT}`);
		process.env.API_PORT = value.port || environment.API_DEFAULT_PORT;
		process.env.API_HOST = '0.0.0.0';
		process.env.API_BASE_URL = `http://127.0.0.1:${value.port || environment.API_DEFAULT_PORT}`;

		console.log('Setting additional environment variables...', process.env.API_PORT);
		console.log('Setting additional environment variables...', process.env.API_HOST);
		console.log('Setting additional environment variables...', process.env.API_BASE_URL);

		setEnvAdditional();

		try {
			console.log('Starting local server...', path.join(__dirname, 'api/main.js'));
			await server.start({ api: path.join(__dirname, 'api/main.js') }, process.env, setupWindow, signal);
		} catch (error) {
			console.error('ERROR: Occurred while server start:' + error);
			throw new AppError('MAINWININIT', error);
		}
	}

	/* create main window */
	try {
		gauzyWindow = await createGauzyWindow(
			gauzyWindow,
			serve,
			{ ...environment, gauzyWindow: value.gauzyWindow },
			pathWindow.gauzyWindow,
			pathWindow.preloadPath
		);
	} catch (error) {
		throw new AppError('MAINWININIT', error);
	}

	createTrayMenu();

	notificationWindow = new ScreenCaptureNotification(pathWindow.screenshotWindow);
	await notificationWindow.loadURL();

	setupWindow?.hide();

	if (gauzyWindow) {
		gauzyWindow.setVisibleOnAllWorkspaces(false);
		gauzyWindow.show();
	}

	splashScreen?.close();

	TranslateService.onLanguageChange(() => {
		new AppMenu(timeTrackerWindow, settingsWindow, updaterWindow, knex, pathWindow, null, true);
		createTrayMenu();
	});

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

function createTrayMenu() {
	try {
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
	} catch (error) {
		console.error('ERROR: Occurred while create tray menu:' + error);
	}
}

function setEnvAdditional() {
	const additionalConfig = LocalStore.getAdditionalConfig();
	const config = LocalStore.getStore('configs');
	Object.keys(additionalConfig).forEach((key) => {
		if (additionalConfig[key]) {
			process.env[key] = additionalConfig[key];
		}
	});
	global.variableGlobal = {
		API_BASE_URL: getApiBaseUrl(config),
		IS_INTEGRATED_DESKTOP: config.isLocalServer
	};
}

/**
 * Retrieves the base URL for the Gauzy API based on a configuration object.
 *
 * If `configs.serverUrl` is defined, this function returns that URL directly.
 * Otherwise, it constructs a local address using `configs.host`, `configs.protocol`,
 * and `configs.port` or falls back to sensible defaults.
 *
 * @param {ApiConfig} configs - The configuration object.
 * @returns {string} - The resulting base URL for the API.
 */
export const getApiBaseUrl = (configs: ApiConfig): string => {
	console.log('get configs', configs);

	// If a full server URL is provided, return it directly
	if (configs.serverUrl) {
		console.log('get configs.serverUrl', configs.serverUrl);
		return configs.serverUrl;
	}

	// Otherwise, build the URL dynamically using the host, protocol, and port
	const protocol = configs.protocol ?? 'http'; // default protocol
	const host = '127.0.0.1'; // default host
	const port = configs.port ?? environment.API_DEFAULT_PORT; // default port

	console.log('get configs.protocol', configs.protocol);
	console.log('get configs.host', configs.host);
	console.log('get configs.port', configs.port);

	console.log('Building API URL...', `${protocol}://${host}:${port}`);
	return `${protocol}://${host}:${port}`;
};

/**
 * Closes the splash screen.
 */
const closeSplashScreen = () => {
	if (splashScreen) {
		splashScreen.close();
		splashScreen = null;
	}
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Added 5000 ms to fix the black background issue while using transparent window.
// More details at https://github.com/electron/electron/issues/15947

app.on('ready', async () => {
	console.log('App is ready');

	const configs: any = store.get('configs');
	const settings: any = store.get('appSetting');

	// default global
	global.variableGlobal = {
		API_BASE_URL: getApiBaseUrl(configs || {}),
		IS_INTEGRATED_DESKTOP: configs?.isLocalServer
	};

	try {
		splashScreen = new SplashScreen(pathWindow.timeTrackerUi);
		await splashScreen.loadURL();

		splashScreen.show();
	} catch (error) {
		throw new AppError('MAINWININIT', error);
	}

	if (['sqlite', 'better-sqlite', 'better-sqlite3'].includes(provider.dialect)) {
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
	} catch (error) {
		console.error('ERROR: Occurred while database migration:' + error);
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
			pathWindow.timeTrackerUi,
			pathWindow.preloadPath
		);
		settingsWindow = await createSettingsWindow(settingsWindow, pathWindow.timeTrackerUi, pathWindow.preloadPath);
		updaterWindow = await createUpdaterWindow(updaterWindow, pathWindow.timeTrackerUi, pathWindow.preloadPath);
		imageView = await createImageViewerWindow(imageView, pathWindow.timeTrackerUi, pathWindow.preloadPath);

		alwaysOn = new AlwaysOn(pathWindow.timeTrackerUi);
		await alwaysOn.loadURL();

		/* Set Menu */
		new AppMenu(timeTrackerWindow, settingsWindow, updaterWindow, knex, pathWindow, null, true);

		if (configs && configs.isSetup) {
			if (!configs.serverConfigConnected && !configs?.isLocalServer) {
				setupWindow = await createSetupWindow(setupWindow, false, pathWindow.timeTrackerUi);
				setupWindow.show();
				closeSplashScreen()
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
			closeSplashScreen();
		}
	} catch (error) {
		console.error('ERROR: Occurred while create window:' + error);
		throw new AppError('MAINWININIT', error);
	}

	updater.settingWindow = settingsWindow;
	updater.gauzyWindow = gauzyWindow;

	try {
		await updater.checkUpdate();
	} catch (error) {
		console.error('ERROR: Occurred while check update:' + error);
		throw new UIError('400', error, 'MAINWININIT');
	}

	removeMainListener();

	ipcMainHandler(store, startServer, knex, { ...environment }, timeTrackerWindow);

	if (gauzyWindow) {
		try {
			gauzyWindow.webContents.setZoomFactor(1.0);
			await gauzyWindow.webContents.setVisualZoomLevelLimits(1, 5);
			console.log('Zoom levels have been set between 100% and 500%');
		} catch (error) {
			console.error('ERROR: Occurred while set zoom level:' + error);
			throw new UIError('400', error, 'MAINWININIT');
		}
	}

	new DesktopThemeListener();
});

app.on('window-all-closed', () => {
	console.log('All windows are closed');
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.commandLine.appendSwitch('disable-http2');

ipcMain.on('server_is_ready', async () => {
	console.log('Server is ready event received');

	LocalStore.setDefaultApplicationSetting();

	const appConfig = LocalStore.getStore('configs');

	appConfig.serverConfigConnected = true;

	store.set({
		configs: appConfig
	});

	onWaitingServer = false;

	if (!isAlreadyRun) {
		console.log('Server is ready, starting the Desktop API...');

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
	console.log('Minimize event received');
	gauzyWindow.minimize();
});

ipcMain.on('maximize', () => {
	console.log('Maximize event received');
	gauzyWindow.maximize();
});

ipcMain.on('restore', () => {
	console.log('Restore event received');
	gauzyWindow.restore();
});

ipcMain.on('restart_app', async (event, arg) => {
	console.log('Restart app event received');
	try {
		LocalStore.updateConfigSetting(arg);
		isAlreadyRun = false;
		const configs = LocalStore.getStore('configs');
		global.variableGlobal = {
			API_BASE_URL: getApiBaseUrl(configs),
			IS_INTEGRATED_DESKTOP: configs.isLocalServer
		};
		await server.stop();
		closeAllWindows();
	} catch (error) {
		console.error('ERROR: Occurred while server restart:' + error);
	}

	try {
		app.relaunch({ args: process.argv.slice(1).concat(['--relaunch']) });
	} catch (error) {
		console.error('ERROR: Occurred while relaunch:' + error);
	}

	app.exit(0);
});

ipcMain.on('save_additional_setting', (event, arg) => {
	console.log('Save additional setting event received');
	LocalStore.updateAdditionalSetting(arg);
});

ipcMain.on('server_already_start', async () => {
	console.log('Server already start event received');
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
			console.error('ERROR: Occurred while server already start:' + error);
			throw new AppError('MAINWININIT', error);
		}
	}
});

ipcMain.on('open_browser', async (event, arg) => {
	console.log('Open browser event received');
	try {
		await shell.openExternal(arg.url);
	} catch (error) {
		console.error('ERROR: Occurred while open browser:' + error);
		throw new AppError('MAINOPENEXT', error);
	}
});

ipcMain.on('restart_and_update', () => {
	console.log('Restart and update event received');
	setImmediate(async () => {
		try {
			app.removeAllListeners('window-all-closed');
			autoUpdater.quitAndInstall(false);
			if (serverDesktop) serverDesktop.kill();
			await server.stop();
			closeAllWindows();
		} catch (error) {
			console.error('ERROR: Occurred while server restart and update:' + error);
		}
		app.exit(0);
	});
});

ipcMain.on('check_database_connection', async (event, arg) => {
	console.log('Check database connection event received');
	try {
		const driver = await provider.check(arg);
		event.sender.send('database_status', {
			status: true,
			message: TranslateService.instant('TIMER_TRACKER.DIALOG.CONNECTION_DRIVER', { driver })
		});
	} catch (error) {
		console.error('ERROR: Occurred while check database connection:' + error);
		event.sender.send('database_status', {
			status: false,
			message: error.message
		});
	}
});

app.on('activate', async () => {
	console.log('App is activated');

	if (gauzyWindow) {
		if (LocalStore.getStore('configs').gauzyWindow) {
			gauzyWindow.show();
		}
	} else if (!onWaitingServer && LocalStore.getStore('configs') && LocalStore.getStore('configs').isSetup) {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		await createGauzyWindow(
			gauzyWindow,
			serve,
			{ ...environment },
			pathWindow.timeTrackerUi,
			pathWindow.preloadPath
		);
	} else {
		if (setupWindow) {
			setupWindow.show();
			closeSplashScreen();
		}
	}
});

app.on('before-quit', async (e) => {
	console.log('App is quitting');
	e.preventDefault();

	const appSetting = LocalStore.getStore('appSetting');

	if (appSetting && appSetting.timerStarted) {
		timeTrackerWindow.webContents.send('stop_from_tray', {
			quitApp: true
		});
	} else {
		// soft download cancellation
		try {
			updater.cancel();
		} catch (e) {
			console.error('ERROR: Occurred while cancel update:' + e);
			throw new UIError('500', 'MAINUPDTABORT', e);
		}

		try {
			if (serverDesktop) serverDesktop.kill();
			await server.stop();
			closeAllWindows();
		} catch (error) {
			console.error('ERROR: Occurred while server stop:' + error);
		}

		app.exit(0);
	}
});

// On OS X it is common for applications and their menu bar
// to stay active until the user quits explicitly with Cmd + Q
function quit() {
	console.log('Quit called');
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
	require('@electron/remote/main').enable(window.webContents);
});

ipcMain.on('launch_on_startup', (event, arg) => {
	launchAtStartup(arg.autoLaunch, arg.hidden);
});

ipcMain.on('minimize_on_startup', (event, arg) => {
	launchAtStartup(arg.autoLaunch, arg.hidden);
});

ipcMain.handle('get-app-path', () => app.getAppPath());

/**
 * Closes all application windows.
 *
 * The function handles two types of windows:
 * 1. A set of general windows (`notificationWindow`, `splashScreen`, `alwaysOn`), which are closed using the `.close()` method.
 * 2. Browser windows (e.g., `gauzyWindow`, `timeTrackerWindow`, `settingsWindow`, etc.), which are first checked if they are not destroyed using `.isDestroyed()`
 *    before being destroyed using the `.destroy()` method.
 *
 * Note: This function assumes that the relevant windows are globally defined variables of their respective types.
 *
 * @void
 */
function closeAllWindows(): void {
	const windows = [notificationWindow, splashScreen, alwaysOn];
	const browserWindows: BrowserWindow[] = [
		gauzyWindow,
		timeTrackerWindow,
		settingsWindow,
		updaterWindow,
		imageView,
		setupWindow
	];

	// Close general windows
	windows.forEach((window) => {
		if (window) window.close();
	});

	// Destroy browser windows
	browserWindows.forEach((window) => {
		if (!window?.isDestroyed()) window.destroy();
	});
}
