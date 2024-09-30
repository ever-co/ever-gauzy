// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

import {
	app,
	BrowserWindow,
	ipcMain,
	Menu,
	MenuItemConstructorOptions,
	nativeImage,
	nativeTheme,
	screen,
	shell,
	Tray
} from 'electron';
import * as path from 'path';

import { environment } from './environments/environment';

require('module').globalPaths.push(path.join(__dirname, 'node_modules'));

require('sqlite3');

process.env = Object.assign(process.env, environment);

app.setName(process.env.NAME);

console.log('Node Modules Path', path.join(__dirname, 'node_modules'));

import * as remoteMain from '@electron/remote/main';
import {
	AppError,
	AppMenu,
	DesktopDialog,
	DesktopServer,
	DesktopThemeListener,
	DesktopUpdater,
	DialogErrorHandler,
	DialogOpenFile,
	DialogStopServerExitConfirmation,
	ErrorEventManager,
	ErrorReport,
	ErrorReportRepository,
	ILocalServer,
	IPathWindow,
	IServerConfig,
	LocalStore,
	ReadWriteFile,
	ReverseProxy,
	ReverseUiProxy,
	ServerConfig,
	TranslateLoader,
	TranslateService
} from '@gauzy/desktop-libs';
import {
	createAboutWindow,
	createServerWindow,
	createSettingsWindow,
	createSetupWindow,
	SplashScreen
} from '@gauzy/desktop-window';
import * as Sentry from '@sentry/electron';
import { setupTitlebar } from 'custom-electron-titlebar/main';
import { autoUpdater } from 'electron-updater';
import { initSentry } from './sentry';

remoteMain.initialize();

// the folder where all app data will be stored (e.g. sqlite DB, settings, cache, etc)
// C:\Users\USERNAME\AppData\Roaming\gauzy-server

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

let setupWindow: BrowserWindow;
let serverWindow: BrowserWindow;
let settingsWindow: BrowserWindow;
let splashScreen: SplashScreen;
let tray: Tray;
let isServerRun: boolean;
let willQuit = false;

setupTitlebar();

const updater = new DesktopUpdater({
	repository: process.env.REPO_NAME,
	owner: process.env.REPO_OWNER,
	typeRelease: 'releases'
});

console.log('App is packaged', app.isPackaged);

const gauzyUIPath = app.isPackaged
	? path.join(__dirname, '../data/ui/index.html')
	: path.join(__dirname, './data/ui/index.html');
console.log('Gauzy UI path', gauzyUIPath);

const uiPath = path.join(__dirname, 'index.html');
console.log('UI path', uiPath);

const dirPath = app.isPackaged ? path.join(__dirname, '../data/ui') : path.join(__dirname, './data/ui');
console.log('Dir path', dirPath);

const timeTrackerUIPath = path.join(__dirname, 'index.html');

const pathWindow: IPathWindow = {
	gauzyUi: gauzyUIPath,
	ui: uiPath,
	dir: dirPath,
	timeTrackerUi: timeTrackerUIPath,
	preloadPath: path.join(__dirname, 'preload/preload.js')
};

ipcMain.handle('SAVED_THEME', () => {
	return LocalStore.getStore('appSetting').theme;
});

const readWriteFile = new ReadWriteFile(pathWindow);

const serverConfig: IServerConfig = new ServerConfig(readWriteFile);

const reverseProxy: ILocalServer = new ReverseProxy(serverConfig);
const reverseUiProxy: ILocalServer = new ReverseUiProxy(serverConfig);

const executableName = path.basename(process.execPath);

const eventErrorManager = ErrorEventManager.instance;
const report = new ErrorReport(new ErrorReportRepository(process.env.REPO_OWNER, process.env.REPO_NAME));

const controller = new AbortController();
const { signal } = controller;

const desktopServer = new DesktopServer();

/* Load translations */
TranslateLoader.load(__dirname + '/assets/i18n/');

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
		dialog.show().then(async (result) => {
			if (result.response === 1) {
				report.description = error.stack;
				await report.submit();
				app.exit(0);
				return;
			}

			if (result.response === 2) {
				app.exit(0);
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
	console.log('Send report event', message);
	if (!serverWindow) return;
	serverWindow.focus();
	const dialog = new DialogErrorHandler(message, serverWindow);
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
	console.log('Show error event', message);
	if (!serverWindow) return;
	serverWindow.focus();
	const dialog = new DialogErrorHandler(message, serverWindow);
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

const runSetup = async () => {
	// Set default configuration
	LocalStore.setDefaultServerConfig();
	if (!setupWindow) {
		setupWindow = await createSetupWindow(setupWindow, false, pathWindow.ui);
	}
	setupWindow.show();
	splashScreen.close();
};

const appState = async () => {
	const config = serverConfig.setting;
	if (!config) {
		await runSetup();
		return;
	}

	await runMainWindow();
	return;
};

const runMainWindow = async () => {
	serverWindow = await createServerWindow(serverWindow, null, pathWindow.ui, pathWindow.preloadPath);

	serverWindow.show();

	splashScreen.close();

	if (!tray) {
		createTray();
	}

	new AppMenu(null, settingsWindow, null, null, pathWindow, serverWindow, false);

	const menuWindowSetting = Menu.getApplicationMenu().getMenuItemById('window-setting');

	if (menuWindowSetting) menuWindowSetting.enabled = true;

	if (setupWindow) setupWindow.hide();

	serverWindow.webContents.send('dashboard_ready', {
		setting: serverConfig.setting
	});

	new DesktopThemeListener();
};

const initializeConfig = async (val) => {
	try {
		serverConfig.setting = val;
		serverConfig.update();
	} catch (error) {
		console.error('Error in initializeConfig for Server Config', error);
		throw new AppError('MAINWININIT', error);
	}

	try {
		await runMainWindow();
	} catch (error) {
		console.error('Error in initializeConfig for running Main Window', error);
		throw new AppError('MAINWININIT', error);
	}
};

const runServer = async () => {
	console.log('Run the Server...');
	try {
		const envVal = getEnvApi();
		const uiPort = serverConfig.uiPort;

		// Instantiate API and UI servers
		await desktopServer.start(
			{ api: path.join(__dirname, 'api/main.js'), ui: path.join(__dirname, 'preload', 'ui-server.js') },
			envVal,
			serverWindow,
			signal,
			uiPort
		);
	} catch (error) {
		if (error.name === 'AbortError') {
			console.log('You exit without to stop the server');
			return;
		}
		throw new AppError('MAINSTRSERVER', error);
	}
};

const getEnvApi = () => {
	const config = serverConfig.setting;
	serverConfig.update();
	const addsConfig = LocalStore.getAdditionalConfig();
	const provider = config.db === 'better-sqlite' ? 'better-sqlite3' : config.db;
	return {
		IS_ELECTRON: 'true',
		DB_PATH: sqlite3filename,
		DB_TYPE: provider,
		...(provider === 'postgres' && {
			DB_HOST: config[provider]?.dbHost,
			DB_PORT: String(config[provider]?.dbPort),
			DB_NAME: config[provider]?.dbName,
			DB_USER: config[provider]?.dbUsername,
			DB_PASS: config[provider]?.dbPassword
		}),
		API_PORT: String(config.port),
		...addsConfig
	};
};

const createTray = () => {
	try {
		const iconNativePath = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icons', 'tray', 'icon.png'));
		iconNativePath.resize({ width: 16, height: 16 });
		tray = new Tray(iconNativePath);
		const serverMenu = contextMenu();
		tray.setContextMenu(Menu.buildFromTemplate(serverMenu));
	} catch (error) {
		console.error('Error in createTray', error);
	}
};

const contextMenu = () => {
	const serverMenu: MenuItemConstructorOptions[] = [
		{
			id: 'server_browser',
			label: TranslateService.instant('MENU.OPEN_GA_BROWSER'),
			click() {
				shell.openExternal(serverConfig.uiUrl);
			}
		},
		{
			id: 'check_for_update',
			label: TranslateService.instant('BUTTONS.CHECK_UPDATE'),
			click() {
				settingsWindow.show();
				settingsWindow.webContents.send('goto_update');
				settingsWindow.webContents.send('app_setting', LocalStore.getApplicationConfig());
			}
		},
		{
			type: 'separator'
		},
		{
			id: 'start_server',
			label: TranslateService.instant('MENU.START_SERVER'),
			async click() {
				await runServer();
			}
		},
		{
			id: 'stop_server',
			label: TranslateService.instant('MENU.STOP_SERVER'),
			click() {
				stopServer();
			}
		},
		{
			type: 'separator'
		},
		{
			id: 'server_help',
			label: TranslateService.instant('TIMER_TRACKER.MENU.HELP'),
			click() {
				shell.openExternal('https://gauzy.co');
			}
		},
		{
			id: 'gauzy-about',
			label: TranslateService.instant('MENU.ABOUT'),
			enabled: true,
			async click() {
				const window: BrowserWindow = await createAboutWindow(pathWindow.ui);
				window.show();
			}
		},
		{
			id: 'server_exit',
			label: TranslateService.instant('BUTTONS.EXIT'),
			click() {
				app.quit();
			}
		}
	];

	return serverMenu;
};

ipcMain.on('start_server', async (event, arg) => {
	console.log('Start Server Event Handler');
	await initializeConfig(arg);
});

ipcMain.on('run_gauzy_server', async (event, arg) => {
	console.log('Run Ever Gauzy Server Event Handler');
	await runServer();
});

const stopServer = () => {
	desktopServer.stop();
};

ipcMain.on('stop_gauzy_server', (event, arg) => {
	console.log('Stop Ever Gauzy Server Event Handler');
	stopServer();
});

app.on('ready', async () => {
	console.log('App is ready');

	try {
		splashScreen = new SplashScreen(pathWindow.ui);

		await splashScreen.loadURL();

		splashScreen.show();

		if (!serverConfig.setting) {
			LocalStore.setDefaultApplicationSetting();
			launchAtStartup(true, false);
		}

		global.variableGlobal = {
			API_BASE_URL: serverConfig.apiUrl,
			IS_INTEGRATED_DESKTOP: false
		};

		if (!settingsWindow) {
			settingsWindow = await createSettingsWindow(settingsWindow, pathWindow.ui, pathWindow.preloadPath);
		}

		await appState();

		updater.settingWindow = settingsWindow;
		updater.gauzyWindow = serverWindow;

		await updater.checkUpdate();
	} catch (error) {
		throw new AppError('MAINWININIT', error);
	}

	TranslateService.onLanguageChange(() => {
		const menuWindowSetting = Menu.getApplicationMenu().getMenuItemById('window-setting');
		new AppMenu(null, settingsWindow, null, null, pathWindow, serverWindow, false);
		if (tray) tray.destroy();
		createTray();
		if (menuWindowSetting) menuWindowSetting.enabled = true;
	});
});

ipcMain.on('restart_app', async (event, arg) => {
	console.log('Restarting Server', arg);
	serverConfig.setting = arg;
	serverConfig.update();
	event.sender.send('resp_msg', {
		type: 'update_config',
		status: 'success',
		...(!desktopServer.running && { message: 'TOASTR.MESSAGE.UPDATED' })
	});
	await desktopServer.restart();
});

ipcMain.on('save_additional_setting', (event, arg) => {
	console.log('save_additional_setting', arg);
	LocalStore.updateAdditionalSetting(arg);
});

ipcMain.on('quit', quit);

ipcMain.on('check_database_connection', async (event, arg) => {
	console.log('Check Database Connection');

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
			message: TranslateService.instant('TIMER_TRACKER.DIALOG.CONNECTION_DRIVER', {
				driver: provider === 'postgres' ? 'PostgresSQL' : 'SQLite'
			})
		});
	} catch (error) {
		console.error('Error in check_database_connection', error);
		event.sender.send('database_status', {
			status: false,
			message: error.message
		});
	}
});

ipcMain.on('resp_msg_server', (event, arg) => {
	console.log('resp_msg_server');
	settingsWindow.webContents.send('resp_msg', arg);
});

ipcMain.on('running_state', (event, arg) => {
	console.log('running_state');

	settingsWindow.webContents.send('server_status', arg);

	const trayContextMenu = contextMenu();

	if (arg) {
		const start = trayContextMenu[3];
		start.enabled = false;
		reverseProxy.start();
		reverseUiProxy.start();
	} else {
		const stop = trayContextMenu[4];
		stop.enabled = false;
		reverseProxy.stop();
		reverseUiProxy.stop();
	}

	tray.setContextMenu(Menu.buildFromTemplate(trayContextMenu));

	isServerRun = arg;

	// Closed the server if marked.
	if (willQuit) {
		console.log('Quit the app');
		app.quit();
	}
});

ipcMain.on('loading_state', (event, arg) => {
	console.log('loading_state');
	const trayContextMenu = contextMenu();
	trayContextMenu[3].enabled = false;
	trayContextMenu[4].enabled = false;
	tray.setContextMenu(Menu.buildFromTemplate(trayContextMenu));
});

ipcMain.on('expand_window', (event, arg) => {
	console.log('expand_window');

	try {
		const display = screen.getPrimaryDisplay();

		const { height, width } = display.workAreaSize; // e.g. { 768, 1429 }

		console.log('workAreaSize', { height, width });

		// Set the max height and width for default window
		const maxHeight = 480;
		const maxWidth = 640;

		switch (process.platform) {
			case 'linux':
				{
					serverWindow.setMinimumSize(maxWidth, maxHeight);
					serverWindow.setSize(maxWidth, maxHeight, true);
					serverWindow.setResizable(false);
				}
				break;

			case 'darwin':
				{
					serverWindow.setSize(maxWidth, maxHeight, true);
					if (serverWindow) serverWindow.center();
				}
				break;

			default:
				{
					let calculatedX = (width - maxWidth) * 0.5;
					let calculatedY = (height - maxHeight) * 0.5;

					// Ensure x and y are not negative
					calculatedX = Math.max(0, calculatedX);
					calculatedY = Math.max(0, calculatedY);

					// Ensure window does not exceed screen bounds
					calculatedX = Math.min(calculatedX, width - maxWidth);
					calculatedY = Math.min(calculatedY, height - maxHeight);

					const bounds = {
						width: maxWidth,
						height: maxHeight,
						x: Math.round(calculatedX), // e.g. 1429 - 640 = 789 / 2 = 394.5
						y: Math.round(calculatedY) // e.g. 768 - 480 = 288 / 2 = 144
					};

					console.log('Bounds', JSON.stringify(bounds));

					serverWindow.setBounds(bounds, true);
				}

				break;
		}
	} catch (err) {
		console.error('Error in expand_window', err);
	}
});

function quit() {
	console.log('Quit the app');
	if (process.platform !== 'darwin') {
		app.quit();
	}
}

ipcMain.on('restart_and_update', () => {
	console.log('Restart and Update');
	setImmediate(() => {
		try {
			app.removeAllListeners('window-all-closed');
			autoUpdater.quitAndInstall(false);
		} catch (error) {
			console.error('Error in restart_and_update', error);
		}

		app.exit(0);
	});
});

app.on('before-quit', async (e) => {
	console.log('Before Quit');

	e.preventDefault();

	if (isServerRun) {
		const exitConfirmationDialog = new DialogStopServerExitConfirmation(
			new DesktopDialog(
				process.env.DESCRIPTION,
				TranslateService.instant('TIMER_TRACKER.DIALOG.EXIT'),
				serverWindow
			)
		);

		const button = await exitConfirmationDialog.show();

		if (button.response === 0) {
			// Stop the server from main
			stopServer();
			// Mark as will quit
			willQuit = true;
		}
	} else {
		// soft download cancellation
		try {
			updater.cancel();
		} catch (e) {
			console.error('Error in before-quit', e);
		}

		app.exit(0);
	}
});

app.on('window-all-closed', quit);

app.commandLine.appendSwitch('disable-http2');
app.commandLine.appendSwitch('in-process-gpu');

ipcMain.on('update_app_setting', (event, arg) => {
	LocalStore.updateApplicationSetting(arg.values);
});

app.on('browser-window-created', (_, window) => {
	require('@electron/remote/main').enable(window.webContents);
});

ipcMain.handle('PREFERRED_LANGUAGE', (event, arg) => {
	const setting = LocalStore.getStore('appSetting');
	if (arg) {
		if (!setting) LocalStore.setDefaultApplicationSetting();
		TranslateService.preferredLanguage = arg;
		settingsWindow?.webContents?.send('preferred_language_change', arg);
	}
	return TranslateService.preferredLanguage;
});

ipcMain.on('preferred_language_change', (event, arg) => {
	TranslateService.preferredLanguage = arg;
	serverWindow?.webContents?.send('preferred_language_change', arg);
});

ipcMain.on('launch_on_startup', (event, arg) => {
	launchAtStartup(arg.autoLaunch, arg.hidden);
});

ipcMain.on('minimize_on_startup', (event, arg) => {
	launchAtStartup(arg.autoLaunch, arg.hidden);
});

ipcMain.on('update_server_config', (event, arg) => {
	serverConfig.setting = arg;
});

function launchAtStartup(autoLaunch: boolean, hidden: boolean): void {
	console.log('Launch at startup', autoLaunch, hidden);
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
					? ['--processStart', `"${executableName}"`, '--process-start-args', `"--hidden"`]
					: ['--processStart', `"${executableName}"`, '--process-start-args']
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

ipcMain.on('save_encrypted_file', (event, value) => {
	console.log('Save Encrypted File');
	try {
		const { secureProxy = { enable: false, secure: true, ssl: { key: '', cert: '' } } } =
			serverConfig.setting || {};
		// Get the current window
		const currentWindow = BrowserWindow.getFocusedWindow();
		const dialog = new DialogOpenFile(currentWindow, 'ssl');
		const filePath = dialog.save();
		if (filePath) {
			secureProxy.ssl[value] = filePath;
			serverConfig.setting = {
				secureProxy
			};
			event.sender.send('app_setting', LocalStore.getApplicationConfig());
		}
	} catch (error) {
		console.error(error);
	}
});

ipcMain.handle('get-app-path', () => app.getAppPath());
