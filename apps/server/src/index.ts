// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

// Import logging for electron and override default console logging
import log from 'electron-log';
console.log = log.log;
Object.assign(console, log.functions);

import * as path from 'path';
import {
	app,
	BrowserWindow,
	ipcMain,
	Tray,
	nativeImage,
	Menu,
	shell,
	MenuItemConstructorOptions,
	screen,
} from 'electron';
import { environment } from './environments/environment';

// setup logger to catch all unhandled errors and submit as bug reports to our repo

require('module').globalPaths.push(path.join(__dirname, 'node_modules'));
require('sqlite3');

app.setName('gauzy-server');

console.log('Node Modules Path', path.join(__dirname, 'node_modules'));

import {
	LocalStore,
	apiServer,
	AppMenu,
	DesktopUpdater,
	TranslateLoader,
	TranslateService,
	ApiProxyServer,
	UiProxyServer,
	IProxyServer,
	IPathWindow,
	ProxyConfig,
	ReadWriteFile
} from '@gauzy/desktop-libs';
import {
	createSetupWindow,
	createServerWindow,
	createSettingsWindow,
	SplashScreen,
	createAboutWindow,
} from '@gauzy/desktop-window';
import { initSentry } from './sentry';
import { readFileSync, writeFileSync, accessSync, constants } from 'fs';
import * as remoteMain from '@electron/remote/main';
import { autoUpdater } from 'electron-updater';
remoteMain.initialize();

// the folder where all app data will be stored (e.g. sqlite DB, settings, cache, etc)
// C:\Users\USERNAME\AppData\Roaming\gauzy-server

process.env.GAUZY_USER_PATH = app.getPath('userData');
log.info(`GAUZY_USER_PATH: ${process.env.GAUZY_USER_PATH}`);

const sqlite3filename = `${process.env.GAUZY_USER_PATH}/gauzy.sqlite3`;
log.info(`Sqlite DB path: ${sqlite3filename}`);

initSentry();

let setupWindow: BrowserWindow;
let serverWindow: BrowserWindow;
let settingsWindow: BrowserWindow;
let splashScreen: SplashScreen;
let tray: Tray;
let isServerRun: boolean;

const updater = new DesktopUpdater({
	repository: 'ever-gauzy-server',
	owner: 'ever-co',
	typeRelease: 'releases',
});

const pathWindow: IPathWindow = {
	gauzyUi: app.isPackaged
		? path.join(__dirname, '../data/ui/index.html')
		: path.join(__dirname, './data/ui/index.html'),
	ui: path.join(__dirname, 'index.html'),
	dir: app.isPackaged
		? path.join(__dirname, '../data/ui')
		: path.join(__dirname, './data/ui'),
	timeTrackerUi: path.join(__dirname, 'index.html'),
};

const uiProxy: IProxyServer = new UiProxyServer(new ProxyConfig());
const apiProxy: IProxyServer = new ApiProxyServer(
	new ProxyConfig(new ReadWriteFile(pathWindow))
);


/* Load translations */
TranslateLoader.load(__dirname + '/assets/i18n/');
/* Setting the app user model id for the app. */
if (process.platform === 'win32') {
	app.setAppUserModelId('com.ever.gauzyserver');
}

LocalStore.setFilePath({
	iconPath: path.join(__dirname, 'icons', 'icon.png'),
});

// Set unlimited listeners
ipcMain.setMaxListeners(0);

/* Remove handler if exist */
ipcMain.removeHandler('PREFERRED_LANGUAGE');

const runSetup = async () => {
	splashScreen.close();
	if (setupWindow) {
		setupWindow.show();
		return;
	}
	setupWindow = await createSetupWindow(setupWindow, false, pathWindow.ui);
	setupWindow.show();
};

const appState = async () => {
	const config = LocalStore.getStore('configs');
	if (!config) {
		await runSetup();
		return;
	}

	await runMainWindow();
	return;
};

const runMainWindow = async () => {
	serverWindow = await createServerWindow(serverWindow, null, pathWindow.ui);
	splashScreen.close();
	serverWindow.show();
	if (!tray) {
		createTray();
	}

	new AppMenu(
		null,
		settingsWindow,
		null,
		null,
		pathWindow,
		serverWindow,
		false
	);
	const menuWindowSetting =
		Menu.getApplicationMenu().getMenuItemById('window-setting');
	if (menuWindowSetting) menuWindowSetting.enabled = true;
	if (setupWindow) setupWindow.hide();
};

const initializeConfig = async (val) => {
	try {
		LocalStore.updateConfigSetting(val);
		updateConfigUi(val);
		await runMainWindow();
	} catch (error) {
		console.log(error)
	}
};

const getApiBaseUrl = (config) => {
	if (config.serverUrl) return config.serverUrl;
	else {
		return config.port
			? `http://localhost:${config.port}`
			: `http://localhost:${environment.API_DEFAULT_PORT}`;
	}
};

const updateConfigUi = (config) => {
	const apiBaseUrl = getApiBaseUrl(config);
	let fileStr = readFileSync(pathWindow.gauzyUi, 'utf8');

	const configStr = `
		<script> window._env = { api: '${apiBaseUrl}' };
		if (typeof global === "undefined") {
			var global = window;
		}; </script>`;

	const elementToReplace = '</body>';

	fileStr = fileStr.replace(elementToReplace, configStr.concat('\n').concat(elementToReplace));

	// write file new html

	try {
		accessSync(pathWindow.dir, constants.W_OK);
	} catch (e) {
		console.error('Cannot access directory');
	}

	try {
		writeFileSync(pathWindow.gauzyUi, fileStr);
	} catch (error) {
		console.log('Cannot change html file', error);
	}
};

const controller = new AbortController()
const { signal } = controller;
const runServer = (isRestart) => {
	const envVal = getEnvApi();
	const uiPort = getUiPort();
	apiServer(
		{
			ui: path.join(__dirname, 'preload', 'ui-server.js'),
			api: path.join(__dirname, 'api/main.js'),
		},
		envVal,
		serverWindow,
		uiPort,
		isRestart,
		signal
	);
};

const getEnvApi = () => {
	const config = LocalStore.getStore('configs');
	updateConfigUi(config);
	const addsConfig = LocalStore.getAdditionalConfig();
	const provider = config.db;
	return {
		IS_ELECTRON: 'true',
		DB_PATH: sqlite3filename,
		DB_TYPE: provider,
		...(provider === 'postgres' && {
			DB_HOST: config[provider]?.dbHost,
			DB_PORT: String(config[provider]?.dbPort),
			DB_NAME: config[provider]?.dbName,
			DB_USER: config[provider]?.dbUsername,
			DB_PASS: config[provider]?.dbPassword,
		}),
		API_PORT: String(config.port),
		...addsConfig,
	};
};

const getUiPort = () => {
	const config = LocalStore.getStore('configs');
	return config.portUi;
};

const createTray = () => {
	const iconNativePath = nativeImage.createFromPath(
		path.join(__dirname, 'assets', 'icons', 'icon.png')
	);
	iconNativePath.resize({ width: 16, height: 16 });
	tray = new Tray(iconNativePath);
	const serverMenu = contextMenu();
	tray.setContextMenu(Menu.buildFromTemplate(serverMenu));
};

const contextMenu = () => {
	const serverMenu: MenuItemConstructorOptions[] = [
		{
			id: 'server_browser',
			label: TranslateService.instant('MENU.OPEN_GA_BROWSER'),
			click() {
				const config = LocalStore.getStore('configs');
				shell.openExternal(`http://localhost:${config.portUi}`);
			},
		},
		{
			id: 'check_for_update',
			label: TranslateService.instant('BUTTONS.CHECK_UPDATE'),
			click() {
				settingsWindow.show();
				settingsWindow.webContents.send('goto_update');
					settingsWindow.webContents.send(
						'app_setting',
						LocalStore.getApplicationConfig()
					);
			},
		},
		{
			type: 'separator',
		},
		{
			id: 'start_server',
			label: TranslateService.instant('MENU.START_SERVER'),
			click() {
				runServer(false);
			},
		},
		{
			id: 'stop_server',
			label: TranslateService.instant('MENU.STOP_SERVER'),
			click() {
				stopServer(false);
			},
		},
		{
			type: 'separator',
		},
		{
			id: 'server_help',
			label: TranslateService.instant('TIMER_TRACKER.MENU.HELP'),
			click() {
				shell.openExternal('https://gauzy.co');
			},
		},
		{
			id: 'gauzy-about',
			label: TranslateService.instant('MENU.ABOUT'),
			enabled: true,
			async click() {
				const window: BrowserWindow =
					await createAboutWindow(
						pathWindow.ui
					);
				window.show();
			},
		},
		{
			id: 'server_exit',
			label: TranslateService.instant('BUTTONS.EXIT'),
			click() {
				app.quit();
			},
		},
	];

	return serverMenu;
};

ipcMain.on('start_server', async (event, arg) => {
	await initializeConfig(arg);
});

ipcMain.on('run_gauzy_server', (event, arg) => {
	console.log('run Gauzy Server');
	runServer(false);
});

const stopServer = (isRestart) => {
	const config = LocalStore.getStore('configs');
	console.log('api pid', config.apiPid);
	console.log('api pid', config.uiPid);
	if (config.apiPid) {
		try {
			process.kill(config.apiPid);
			LocalStore.updateConfigSetting({
				apiPid: null,
			});
			serverWindow.webContents.send('log_state', { msg: 'Api stopped' });
		} catch (error) {
			console.log('error api', error);
		}
	}
	if (config.uiPid) {
		try {
			process.kill(config.uiPid);
			LocalStore.updateConfigSetting({
				uiPid: null,
			});
			serverWindow.webContents.send('log_state', { msg: 'UI stopped' });
			if (isRestart) {
				runServer(true);
			}
		} catch (error) {
			console.log('error ui', error);
		}
	}
	serverWindow.webContents.send('running_state', false);
};

ipcMain.on('stop_gauzy_server', (event, arg) => {
	stopServer(false);
});

app.on('ready', async () => {
	splashScreen = new SplashScreen(pathWindow.ui);
	await splashScreen.loadURL();
	splashScreen.show();
	LocalStore.setDefaultApplicationSetting();
	if (!settingsWindow) {
		settingsWindow = await createSettingsWindow(settingsWindow, pathWindow.ui);
	}
	await appState();
	updater.settingWindow = settingsWindow;
	updater.gauzyWindow = serverWindow;
	await updater.checkUpdate();
	TranslateService.onLanguageChange(() => {
		const menuWindowSetting =
			Menu.getApplicationMenu().getMenuItemById('window-setting');
		new AppMenu(
			null,
			settingsWindow,
			null,
			null,
			pathWindow,
			serverWindow,
			false
		);
		if (tray) tray.destroy();
		createTray();
		if (menuWindowSetting) menuWindowSetting.enabled = true;
	})
});

ipcMain.on('restart_app', (event, arg) => {
	console.log('Restarting Server', arg);
	if (arg.apiPid) delete arg.apiPid;
	if (arg.uiPid) delete arg.uiPid;
	LocalStore.updateConfigSetting(arg);
	updateConfigUi(arg);
	event.sender.send('resp_msg', { type: 'update_config', status: 'success' });
	if (isServerRun) {
		stopServer(true);
	}
});

ipcMain.on('save_additional_setting', (event, arg) => {
	console.log('arg', arg);
	LocalStore.updateAdditionalSetting(arg);
});

ipcMain.on('quit', quit);

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
					filename: sqlite3filename,
				},
			};
		}
		const dbConn = require('knex')(databaseOptions);
		await dbConn.raw('select 1+1 as result');
		event.sender.send('database_status', {
			status: true,
			message: TranslateService.instant(
				'TIMER_TRACKER.DIALOG.CONNECTION_DRIVER',
				{ driver: provider === 'postgres' ? 'PostgresSQL' : 'SQLite' }
			)
		});
	} catch (error) {
		event.sender.send('database_status', {
			status: false,
			message: error.message,
		});
	}
});

ipcMain.on('resp_msg_server', (event, arg) => {
	settingsWindow.webContents.send('resp_msg', arg);
});

ipcMain.on('running_state', (event, arg) => {
	settingsWindow.webContents.send('server_status', arg);
	const trayContextMenu = contextMenu();
	if (arg) {
		const start = trayContextMenu[3];
		start.enabled = false;
	} else {
		const stop = trayContextMenu[4];
		stop.enabled = false;
	}
	tray.setContextMenu(Menu.buildFromTemplate(trayContextMenu));
	isServerRun = arg;
});

ipcMain.on('loading_state', (event, arg) => {
	const trayContextMenu = contextMenu();
	trayContextMenu[3].enabled = false;
	trayContextMenu[4].enabled = false;
	tray.setContextMenu(Menu.buildFromTemplate(trayContextMenu));
});

ipcMain.on('expand_window', (event, arg) => {
	const display = screen.getPrimaryDisplay();
	const { width, height } = display.workArea;
	console.log('width ', width);
	console.log('height ', height);
	const wx = 640;
	const hx = 480;
	switch (process.platform) {
		case 'linux':
			{
				serverWindow.setMinimumSize(wx, hx);
				serverWindow.setSize(wx, hx, true);
				serverWindow.setResizable(false);
			}
			break;
		case 'darwin':
			{
				serverWindow.setSize(wx, hx, true);
				if (serverWindow) serverWindow.center();
			}
			break;
		default:
			{
	serverWindow.setBounds(
		{
			width: wx,
			height: hx,
			x: (width - wx) * 0.5,
			y: (height - hx) * 0.5
		},
		true
	);
			}
			break;
	}
});

function quit() {
	if (process.platform !== 'darwin') {
		app.quit();
	}
}

ipcMain.on('restart_and_update', () => {
	setImmediate(() => {
		app.removeAllListeners('window-all-closed');
		autoUpdater.quitAndInstall(false);
		app.exit(0);
	});
});

app.on('before-quit', (e) => {
	e.preventDefault();
	// Kill child processes
	controller.abort();
	// soft download cancellation
	try {
		updater.cancel();
	} catch (e) {}
	app.exit(0);
});

app.on('window-all-closed', quit);

app.commandLine.appendSwitch('disable-http2');
app.commandLine.appendSwitch('in-process-gpu');

ipcMain.on('update_app_setting', (event, arg) => {
	LocalStore.updateApplicationSetting(arg.values);
});

app.on('browser-window-created', (_, window) => {
	require("@electron/remote/main").enable(window.webContents)
})

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
})


ipcMain.on('start_proxies', (_, arg) => {
	const notify = (message: string) => {
		serverWindow.webContents.send('log_state', { msg: message });
	};

	apiProxy.start();
	uiProxy.start();

	notify(uiProxy.message);
	notify(apiProxy.message);

	uiProxy.onError((error: string) => notify('[UIPROXYERR]' + error));
	apiProxy.onError((error: string) => notify('[APIPROXYERR]' + error));

	uiProxy.onStop(() => notify(uiProxy.message));
	apiProxy.onStop(() => notify(apiProxy.message));
});


ipcMain.on('stop_proxies', (_, arg) => {
	apiProxy.stop();
	uiProxy.stop();
});
