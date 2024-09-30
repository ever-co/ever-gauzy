// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

import * as remoteMain from '@electron/remote/main';
import * as Sentry from '@sentry/electron';
import { setupTitlebar } from 'custom-electron-titlebar/main';
import { app, BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions, nativeTheme, shell } from 'electron';
import * as path from 'path';
import * as Url from 'url';
import { environment } from './environments/environment';

require('module').globalPaths.push(path.join(__dirname, 'node_modules'));
require('sqlite3');

process.env = Object.assign(process.env, environment);

app.setName(process.env.NAME);

log.log('Node Modules Path', path.join(__dirname, 'node_modules'));

const Store = require('electron-store');
remoteMain.initialize();

import {
	AppError,
	AppMenu,
	DesktopDialog,
	DesktopThemeListener,
	DesktopUpdater,
	DialogErrorHandler,
	DialogStopTimerExitConfirmation,
	ErrorEventManager,
	ErrorReport,
	ErrorReportRepository,
	ipcMainHandler,
	ipcTimer,
	LocalStore,
	ProviderFactory,
	removeMainListener,
	removeTimerListener,
	TranslateLoader,
	TranslateService,
	TrayIcon,
	UIError
} from '@gauzy/desktop-libs';
import {
	AlwaysOn,
	createImageViewerWindow,
	createSettingsWindow,
	createSetupWindow,
	createTimeTrackerWindow,
	createUpdaterWindow,
	SplashScreen
} from '@gauzy/desktop-window';
import { fork } from 'child_process';
import { autoUpdater } from 'electron-updater';
import { initSentry } from './sentry';

// Can be like this: import fetch from '@gauzy/desktop-libs' for v3 of node-fetch;

initSentry();

// the folder where all app data will be stored (e.g. sqlite DB, settings, cache, etc)
// C:\Users\USERNAME\AppData\Roaming\gauzy-desktop-timer

process.env.GAUZY_USER_PATH = app.getPath('userData');
log.info(`GAUZY_USER_PATH: ${process.env.GAUZY_USER_PATH}`);

const sqlite3filename = `${process.env.GAUZY_USER_PATH}/gauzy.sqlite3`;
log.info(`Sqlite DB path: ${sqlite3filename}`);

const provider = ProviderFactory.instance;
const knex = provider.connection;

const exeName = path.basename(process.execPath);
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const store = new Store();

const args = process.argv.slice(1);
const serverGauzy = null;
const updater = new DesktopUpdater({
	repository: process.env.REPO_NAME,
	owner: process.env.REPO_OWNER,
	typeRelease: 'releases'
});
const report = new ErrorReport(new ErrorReportRepository(process.env.REPO_OWNER, process.env.REPO_NAME));
const eventErrorManager = ErrorEventManager.instance;
args.some((val) => val === '--serve');

ipcMain.handle('PREFERRED_THEME', () => {
	const setting = LocalStore.getStore('appSetting');
	return setting?.theme || (nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
});

let notificationWindow = null;
let gauzyWindow: BrowserWindow = null;
let setupWindow: BrowserWindow = null;
let timeTrackerWindow: BrowserWindow = null;
let settingsWindow: BrowserWindow = null;
let updaterWindow: BrowserWindow = null;
let imageView: BrowserWindow = null;
let tray = null;
let menu = null;
let isAlreadyRun = false;
let onWaitingServer = false;
let dialogErr = false;
let willQuit = true;
let serverDesktop = null;
let popupWin: BrowserWindow | null = null;
let splashScreen: SplashScreen = null;
let alwaysOn: AlwaysOn = null;

setupTitlebar();

console.log('Time Tracker UI Render Path:', path.join(__dirname, './index.html'));

const pathWindow = {
	timeTrackerUi: path.join(__dirname, './index.html'),
	preloadPath: path.join(__dirname, 'preload.js')
};

LocalStore.setFilePath({
	iconPath: path.join(__dirname, 'assets', 'icons', 'menu', 'icon.png')
});
// Instance detection
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
	app.quit();
} else {
	app.on('second-instance', () => {
		// if someone tried to run a second instance, we should only show and focus on current window instance.
		if (gauzyWindow) {
			// show window if it hides
			gauzyWindow.show();
			// restore window if it's minified
			gauzyWindow.restore();
			// focus on the main window
			gauzyWindow.focus();
		}
	});
}

/* Load translations */
TranslateLoader.load(__dirname + '/assets/i18n/');
/* Setting the app user model id for the app. */
if (process.platform === 'win32') {
	app.setAppUserModelId(process.env.APP_ID);
}

/* Set unlimited listeners */
ipcMain.setMaxListeners(0);
/* Remove handler if exist */
ipcMain.removeHandler('PREFERRED_LANGUAGE');

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
					title: `Automatic error report for Desktop Timer App ${versions.app}`,
					body: 'Error:\n```' + error.stack + '\n```\n' + `OS: ${versions.os}`
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

process.on('uncaughtException', (error) => {
	throw new AppError('MAINUNEXCEPTION', error.message);
});

eventErrorManager.onSendReport(async (message) => {
	if (!timeTrackerWindow) return;
	timeTrackerWindow.focus();
	const dialog = new DialogErrorHandler(message, timeTrackerWindow);
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

eventErrorManager.onShowError(async (message) => {
	if (!timeTrackerWindow) return;
	timeTrackerWindow.focus();
	const dialog = new DialogErrorHandler(message, timeTrackerWindow);
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

async function startServer() {
	try {
		const appConfig = LocalStore.getStore('configs');
		appConfig.serverConfigConnected = true;
		store.set({ configs: appConfig });

		onWaitingServer = false;

		if (!isAlreadyRun) {
			console.log('Server is ready, starting the Desktop API...');

			// Start the Desktop API server
			serverDesktop = fork(path.join(__dirname, './desktop-api/main.js'));

			// Remove any existing timer listener to avoid duplication
			removeTimerListener();

			// Initialize the IPC timer with relevant dependencies
			ipcTimer(
				store,
				knex,
				null,
				timeTrackerWindow,
				null,
				settingsWindow,
				imageView,
				{ ...environment }, // Spread the environment object to pass its properties
				createSettingsWindow,
				pathWindow,
				path.join(__dirname, '..', 'data', 'sound', 'snapshot-sound.wav'),
				alwaysOn
			);

			// Mark the server as already running
			isAlreadyRun = true;

			// Show timer
			timeTrackerWindow.setVisibleOnAllWorkspaces(false);
			splashScreen.close();
			timeTrackerWindow.show();

			// Notify the time tracker window that the server is ready to show
			timeTrackerWindow.webContents.send('ready_to_show_renderer');
		}
	} catch (error) {
		console.error('Error starting the server:', error);
		// Handle server startup error (logging, notifying the user, etc.)
	}
}

const getApiBaseUrl = (configs) => {
	return configs?.serverUrl || `http://localhost:${configs?.port || environment.API_DEFAULT_PORT}`;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Added 5000 ms to fix the black background issue while using transparent window.
// More details at https://github.com/electron/electron/issues/15947

app.on('ready', async () => {
	/** Set Default Menu **/
	setDefaultMenu();

	// Set up theme listener for desktop windows
	new DesktopThemeListener();

	/** Get configurations and appllication settings */
	const configs: any = store.get('configs');
	const settings: any = store.get('appSetting');

	/** Initialize global variables **/
	await initializeGlobalVariables(configs);

	// Initialize splashScreen
	await initializeSplashScreen();

	// if no settings, launch at startup by default
	if (!settings) {
		launchAtStartup(true, false);
	}

	/** Set Default Configuration*/
	LocalStore.setDefaultApplicationSetting();

	/* Initialize Database */
	await initializeDatabase();

	/* create main window */
	try {
		if (configs && configs.isSetup) {
			// Create necessary windows
			await createWindows();

			// Assign time tracker to gauzy winodw
			gauzyWindow = timeTrackerWindow;

			// Initialize "Always On" window
			await initializeAlwaysOn();

			// Remove main listener
			removeMainListener();

			// Create app menu
			createMenu();

			// Create tray
			createTray();

			TranslateService.onLanguageChange(() => {
				createMenu();
				createTray();
			});

			// Setup IPC handler
			ipcMainHandler(store, null, knex, { ...environment }, timeTrackerWindow);

			// start Server
			await startServer();

			// Initialize updater with windows
			await initializeUpdater();
		} else {
			// Initialize "Setup" window
			setupWindow = await createSetupWindow(setupWindow, false, pathWindow.timeTrackerUi);
			// Show setup window
			setupWindow.show();
			// Close splash screen
			splashScreen.close();
		}
	} catch (error) {
		throw new AppError('MAINWININIT', error);
	}
});

app.on('window-all-closed', () => {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.commandLine.appendSwitch('disable-http2');

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
	/** Update configuration */
	LocalStore.updateConfigSetting(arg);
	/* Killing the provider. */
	await provider.kill();
	/* Creating a database if not exit. */
	await ProviderFactory.instance.createDatabase();
	/* Kill all windows */
	if (alwaysOn) alwaysOn.close();
	if (settingsWindow && !settingsWindow.isDestroyed()) {
		settingsWindow.hide();
		settingsWindow.destroy();
	}
	if (timeTrackerWindow && !timeTrackerWindow.isDestroyed()) {
		timeTrackerWindow.destroy();
	}
	if (serverGauzy) serverGauzy.kill();
	if (gauzyWindow && !gauzyWindow.isDestroyed()) {
		gauzyWindow.destroy();
		gauzyWindow = null;
	}
	app.relaunch({ args: process.argv.slice(1).concat(['--relaunch']) });
	app.exit(0);
});

ipcMain.on('save_additional_setting', (event, arg) => {
	LocalStore.updateAdditionalSetting(arg);
});

ipcMain.on('server_already_start', () => {
	if (!gauzyWindow && !isAlreadyRun) {
		gauzyWindow = timeTrackerWindow;
		gauzyWindow.show();
		isAlreadyRun = true;
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
			message: TranslateService.instant('TIMER_TRACKER.DIALOG.CONNECTION_DRIVER', { driver })
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

app.on('activate', () => {
	if (gauzyWindow) {
		if (LocalStore.getStore('configs').gauzyWindow) {
			gauzyWindow.show();
		}
	} else if (
		!onWaitingServer &&
		LocalStore.getStore('configs') &&
		LocalStore.getStore('configs').isSetup &&
		timeTrackerWindow
	) {
		// On macOS, it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		gauzyWindow = timeTrackerWindow;
		gauzyWindow.show();
	} else {
		if (setupWindow) {
			setupWindow.show();
			splashScreen.close();
		}
	}
});

ipcMain.handle('PREFERRED_LANGUAGE', (event, arg) => {
	const setting = store.get('appSetting');
	if (arg) {
		if (!setting) LocalStore.setDefaultApplicationSetting();
		TranslateService.preferredLanguage = arg;
		settingsWindow?.webContents?.send('preferred_language_change', arg);
	}
	return TranslateService.preferredLanguage;
});

app.on('before-quit', async (e) => {
	console.log('App is quitting');
	e.preventDefault();

	const appSetting = LocalStore.getStore('appSetting');

	if (appSetting && appSetting.timerStarted) {
		e.preventDefault();

		const exitConfirmationDialog = new DialogStopTimerExitConfirmation(
			new DesktopDialog(
				process.env.DESCRIPTION,
				TranslateService.instant('TIMER_TRACKER.DIALOG.EXIT'),
				timeTrackerWindow
			)
		);

		const button = await exitConfirmationDialog.show();

		if (button.response === 0) {
			willQuit = true;
			timeTrackerWindow.webContents.send('stop_from_tray', {
				quitApp: true
			});
		}
	} else {
		// soft download cancellation
		try {
			updater.cancel();
		} catch (e) {
			console.error('ERROR: Occurred while cancel update:' + e);
			throw new AppError('MAINUPDTABORT', e);
		}

		if (serverDesktop) {
			try {
				serverDesktop.kill();
			} catch (error) {
				console.error('ERROR: Occurred while serverDesktop stop:' + error);
			}
		}

		if (serverGauzy) {
			try {
				serverGauzy.kill();
			} catch (error) {
				console.error('ERROR: Occurred while serverGauzy stop:' + error);
			}
		}

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

app.on('web-contents-created', (event, contents) => {
	contents.on('will-redirect', async (event, url) => {
		const defaultBrowserConfig = {
			title: '',
			width: 1280,
			height: 600,
			webPreferences: {
				allowRunningInsecureContent: false,
				contextIsolation: true,
				enableRemoteModule: true,
				javascript: true,
				webSecurity: false,
				webviewTag: false,
				nodeIntegration: true
			}
		};

		const isLinkedInOAuth = url.includes('https://www.linkedin.com/oauth');
		const isGoogleOAuth = url.includes('https://accounts.google.com');
		const isSignInSuccess = url.includes('sign-in/success?jwt');
		const isAuthRegister = url.includes('/auth/register');
		const targetUrl = new URL(url);

		if (!ALLOWED_PROTOCOLS.has(targetUrl.protocol)) {
			return;
		}

		if (isLinkedInOAuth || isGoogleOAuth) {
			try {
				event.preventDefault();
				await showPopup(url, defaultBrowserConfig);
			} catch (_) {
				// Soft fail
			}
			return;
		}

		if (isSignInSuccess) {
			const urlParse = Url.parse(url, true);
			const urlParsed = Url.parse(urlFormat(urlParse.hash, urlParse.host), true);
			const { jwt, userId } = urlParsed.query;
			if (popupWin) popupWin.destroy();
			const params = LocalStore.beforeRequestParams();
			timeTrackerWindow.webContents.send('social_auth_success', {
				...params,
				token: jwt,
				userId
			});
		}

		if (isAuthRegister) {
			try {
				await shell.openExternal(url);
			} catch (error) {
				console.error('Error opening external URL:', error);
			}
		}
	});
});

const urlFormat = (hash: string, host: string) => {
	const uri = hash.substring(1);
	return `${host}${uri}`;
};

const showPopup = async (url: string, options: Electron.BrowserWindowConstructorOptions) => {
	const { width = 1280, height = 768, ...otherOptions } = options;

	// Close existing popup window if it exists
	if (popupWin) {
		popupWin.destroy();
	}

	// Create a new BrowserWindow with specified options
	popupWin = new BrowserWindow({
		width,
		height,
		...otherOptions
	});

	// Set a custom user agent to emulate a specific browser version
	const userAgent = 'Chrome/104.0.0.0';
	await popupWin.loadURL(url, { userAgent });

	// Show the popup window
	popupWin.show();
};

app.on('browser-window-created', (_, window) => {
	require('@electron/remote/main').enable(window.webContents);
});

ipcMain.handle('get-app-path', () => app.getAppPath());

export function setDefaultMenu() {
	const menu: MenuItemConstructorOptions[] = [
		{
			label: app.getName(),
			submenu: [
				{
					role: 'about',
					label: TranslateService.instant('MENU.ABOUT')
				},
				{ type: 'separator' },
				{ type: 'separator' },
				{
					role: 'quit',
					label: TranslateService.instant('BUTTONS.EXIT')
				}
			]
		}
	];
	Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
}

async function initializeDatabase() {
	if (['sqlite', 'better-sqlite'].includes(provider.dialect)) {
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
		throw new AppError('MAINDB', error);
	}
}

async function initializeGlobalVariables(configs) {
	if (!configs) {
		console.warn('Configs are not provided');
		return;
	}
	global.variableGlobal = {
		API_BASE_URL: getApiBaseUrl(configs),
		IS_INTEGRATED_DESKTOP: configs.isLocalServer || false
	};
}

async function createWindows() {
	try {
		const [createdTimeTrackerWindow, createdSettingsWindow, createdUpdaterWindow, createdImageView] =
			await Promise.all([
				createTimeTrackerWindow(timeTrackerWindow, pathWindow.timeTrackerUi, pathWindow.preloadPath),
				createSettingsWindow(settingsWindow, pathWindow.timeTrackerUi, pathWindow.preloadPath),
				createUpdaterWindow(updaterWindow, pathWindow.timeTrackerUi, pathWindow.preloadPath),
				createImageViewerWindow(imageView, pathWindow.timeTrackerUi, pathWindow.preloadPath)
			]);

		// Assign the created windows to their respective variables
		timeTrackerWindow = createdTimeTrackerWindow;
		settingsWindow = createdSettingsWindow;
		updaterWindow = createdUpdaterWindow;
		imageView = createdImageView;
	} catch (error) {
		console.error('Error creating windows:', error); // Log the error for debugging
		throw new UIError('400', error.message || 'Failed to create windows', 'WINDOW_CREATION_ERROR');
	}
}

async function initializeAlwaysOn() {
	alwaysOn = new AlwaysOn(pathWindow.timeTrackerUi);
	await alwaysOn.loadURL();
	return alwaysOn;
}

async function initializeSplashScreen() {
	try {
		splashScreen = new SplashScreen(pathWindow.timeTrackerUi);
		await splashScreen.loadURL();
		splashScreen.show();
	} catch (error) {
		console.error(error);
	}
}

async function initializeUpdater() {
	updater.settingWindow = settingsWindow;
	updater.gauzyWindow = gauzyWindow;
	try {
		await updater.checkUpdate();
	} catch (error) {
		throw new UIError('400', error, 'UPDATE_CHECK_ERROR');
	}
}

function createMenu() {
	// If menu exists, destroy it
	if (menu) {
		menu = null;
	}
	menu = new AppMenu(timeTrackerWindow, settingsWindow, updaterWindow, knex, pathWindow, null, false);
}

function createTray() {
	// Get stored authentication configuration
	const auth = store.get('auth');
	// If tray exists, destroy it
	if (tray) {
		tray.destroy();
		tray = null;
	}
	// Initialize new tray with icon
	tray = new TrayIcon(
		null,
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
}
