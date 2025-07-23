import { app, ipcMain, systemPreferences, powerMonitor } from 'electron';
import * as path from 'path';
import { logger as log, store } from '@gauzy/desktop-core';
import {
	AppError,
	LocalStore,
	DesktopThemeListener,
	ProviderFactory,
	TranslateService
} from '@gauzy/desktop-lib';
import {
	getApiBaseUrl,
	getAuthConfig,
	getTrayIcon
} from '../util';
import AppWindow from '../window-manager';
import TrayMenu from '../tray';
import { checkUserAuthentication } from '../auth';
import PullActivities from '../workers/pull-activities';
import PushActivities from '../workers/push-activities';
import EventHandler from '../events/event-handler';
import { environment } from '../../environments/environment';
import MainEvent from '../events/events';
import { MAIN_EVENT, MAIN_EVENT_TYPE } from '../../constant';
import { handleSplashScreen } from './splash';

const provider = ProviderFactory.instance;
const knex = provider.connection;

const exeName = path.basename(process.execPath);

LocalStore.setFilePath({
	iconPath: path.join(__dirname, 'assets', 'icons', 'menu', 'icon.png')
});
const appRootPath: string = path.join(__dirname, '../..');
const appWindow = AppWindow.getInstance(appRootPath);
const mainEvent = MainEvent.getInstance();
const eventHandler = EventHandler.getInstance();
eventHandler.mainListener();


let trayMenu: TrayMenu;


function launchAtStartup(autoLaunch: boolean, hidden: boolean) {
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

async function handleSetupWindow() {
	await appWindow.initSetupWindow()
	appWindow.setupWindow.show();
}

export async function startServer(value: any) {
	try {
		// Update the setting
		LocalStore.updateConfigSetting({
			...value,
			isSetup: true
		});
	} catch (error) {
		throw new AppError('MAINSTRSERVER', error);
	}

	/* create main window */
	if (value.serverConfigConnected || !value.isLocalServer) {
		appWindow?.setupWindow?.destroy();
		appWindow?.splashScreenWindow?.close();
		// timeTrackerWindow.webContents.toggleDevTools();
	}
	trayMenu = TrayMenu.getInstance(
		getTrayIcon(),
		true,
		{ helpSiteUrl: environment.COMPANY_SITE_LINK },
	);
	trayMenu.build();

	TranslateService.onLanguageChange(() => {
		console.log('Translation language change');
		trayMenu.updateTryMenu();
	});

	try {
		const isAuthenticated = await checkUserAuthentication(appRootPath);
		if (isAuthenticated) {
			listenIO();
			runActivityConsumer();
		}
	} catch (error) {
		throw new AppError('MAIN_AUTH', error);
	}

	return true;
}

async function initiationLocalDatabase() {
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
		throw new AppError('MAINDB', error);
	}
}

async function appReady() {
	const configs: any = store.get('configs');
	const settings: any = store.get('appSetting');
	if (!settings) {
		launchAtStartup(true, false);
		LocalStore.setAllDefaultConfig();
	}

	// handle theme change listener
	new DesktopThemeListener();

	// set global variable


	setVariableGlobal(configs);
	// initiation splashScreen
	await handleSplashScreen();

	try {
		if (configs && configs.isSetup) {
			await startServer(configs);
		} else {
			await handleSetupWindow();
			appWindow.splashScreenWindow.close();
		}
	} catch (error) {
		throw new AppError('MAINWININIT', error);
	}
}

function listenGrantAccess(pullActivities: PullActivities) {
	const grantCheckInterval = setInterval(() => {
		const isPermissionGrant = systemPreferences.isTrustedAccessibilityClient(false);
		if (isPermissionGrant) {
			clearInterval(grantCheckInterval);
			pullActivities.startTracking();
		}
	}, 1000);
}

function listenIO() {
	const auth = getAuthConfig();
	const pullActivities = PullActivities.getInstance();
	pullActivities.updateAppUserAuth({
		tenantId: auth.user.employee.tenantId,
		organizationId: auth.user.employee.organizationId,
		remoteId: auth.user.id
	});
	if (process.platform === 'darwin') {
		const isPermissionGrant = systemPreferences.isTrustedAccessibilityClient(true);
		if (isPermissionGrant) {
			pullActivities.startTracking();
		} else {
			listenGrantAccess(pullActivities);
		}
	} else {
		pullActivities.startTracking();
	}
}

function runActivityConsumer() {
	try {
		const pushActivities = PushActivities.getInstance();
		pushActivities.startPooling();
	} catch (error) {
		log.error('Failed to start activity consumer', error);
	}
}


function setVariableGlobal(configs: {
	serverUrl?: string,
	port?: number,
	isLocalServer?: boolean
}) {
	global.variableGlobal = {
		API_BASE_URL: getApiBaseUrl({
			serverUrl: configs?.serverUrl,
			port: configs?.port
		}),
		IS_INTEGRATED_DESKTOP: configs?.isLocalServer
	};
}

export async function InitApp() {
	require('module').globalPaths.push(path.join(__dirname, 'node_modules'));

	app.setName(process.env.NAME || 'Agent App');

	// Add node modules path
	log.info('Gauzy Agent Node Modules Path', path.join(__dirname, 'node_modules'));

	process.env.GAUZY_USER_PATH = app.getPath('userData');
	log.info(`GAUZY_USER_PATH: ${process.env.GAUZY_USER_PATH}`);

	process.on('uncaughtException', (error) => {
		throw new AppError('MAINUNEXCEPTION', error.message);
	});

	ipcMain.on('launch_on_startup', (_, arg) => {
		launchAtStartup(arg.autoLaunch, arg.hidden);
	});

	ipcMain.on('minimize_on_startup', (_, arg) => {
		launchAtStartup(arg.autoLaunch, arg.hidden);
	});

	ipcMain.on('app_is_init', () => {
		console.log('app is waiting triggered');
	});

	ipcMain.on('check_database_connection', async (event, arg) => {
		try {
			const driver = await provider.check(arg);
			event.sender.send('setting_page_ipc', {
				type: 'database_status',
				data: {
					status: true,
					message: TranslateService.instant('TIMER_TRACKER.DIALOG.CONNECTION_DRIVER', { driver })
				}
			});
		} catch (error) {
			event.sender.send('setting_page_ipc', {
				type: 'database_status',
				data: {
					status: false,
					message: error.message
				}
			});
		}
	});

	app.on('window-all-closed', (event: Event) => {
		// On OS X it is common for applications and their menu bar
		// to stay active until the user quits explicitly with Cmd + Q
		event.preventDefault();
		if (process.platform === 'darwin') {
			app.dock.hide();
		}
	});

	app.on('browser-window-focus', () => {
		try {
			if (process.platform === 'darwin') {
				if (!app.dock.isVisible) {
					app.dock.show();
				}
			}
		} catch (error) {
			console.error('Error to show back icon to dock', error);
		}
	});

	await app.whenReady();
	await initiationLocalDatabase();
	await appReady();

	powerMonitor.on('shutdown', () => {
		mainEvent.emit(MAIN_EVENT, {
			type: MAIN_EVENT_TYPE.STOP_TIMER
		});
	});
	powerMonitor.on('suspend', () => {
		mainEvent.emit(MAIN_EVENT, {
			type: MAIN_EVENT_TYPE.STOP_TIMER
		});
	});
	powerMonitor.on('lock-screen', () => {
		mainEvent.emit(MAIN_EVENT, {
			type: MAIN_EVENT_TYPE.STOP_TIMER
		});
	});
	powerMonitor.on('unlock-screen', () => {
		mainEvent.emit(MAIN_EVENT, {
			type: MAIN_EVENT_TYPE.START_TIMER
		});
	});
	powerMonitor.on('resume', () => {
		mainEvent.emit(MAIN_EVENT, {
			type: MAIN_EVENT_TYPE.START_TIMER
		});
	});
}


