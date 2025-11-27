import {
	ipcMain,
	nativeTheme,
	shell,
	app
} from 'electron';
import * as remoteMain from '@electron/remote/main';
import { logger as log, store } from '@gauzy/desktop-core';
import {
	LocalStore,
	TranslateService,
	AppError,
	User,
	UserService,
	pluginListeners,
	ProviderFactory,
} from '@gauzy/desktop-lib';
import { getApiBaseUrl, delaySync, getAuthConfig, getAppSetting } from '../util';
import { startServer } from './app';
import AppWindow, { WindowType } from '../window-manager';
import * as moment from 'moment';
import * as path from 'node:path';
import PullActivities from '../workers/pull-activities';
import PushActivities from '../workers/push-activities';
import { checkUserAuthentication } from '../auth';
import { ApiService } from '../api';
const rootPath = path.join(__dirname, '../..');
import { QueueAudit, AuditStatus } from '../queue/audit-queue';
import * as isOnline from 'is-online';
import { AgentLogger } from '../agent-logger';

const userService = new UserService();
const appWindow = AppWindow.getInstance(rootPath);
const apiService = ApiService.getInstance();
const provider = ProviderFactory.instance;
const agentLogger = AgentLogger.getInstance();


function getGlobalVariable(configs?: {
	serverUrl?: string,
	port?: number,
	isLocalServer?: boolean
}) {
	let appConfig = { ...configs };
	if (!configs) {
		appConfig = LocalStore.getStore('configs');
	}
	return {
		API_BASE_URL: getApiBaseUrl(appConfig),
		IS_INTEGRATED_DESKTOP: appConfig?.isLocalServer || false
	};
}

async function handleAlwaysOnWindow(isEnabled: boolean) {
	const setting = getAppSetting();
	await appWindow.initAlwaysOnWindow();
	if (!isEnabled) {
		appWindow.alwaysOnWindow.browserWindow.close();
		return;
	}

	if (setting?.alwaysOn) {
		await appWindow.alwaysOnWindow.loadURL();
		appWindow.alwaysOnWindow.show();
	}
}

async function listenIO(stop: boolean) {
	const auth = getAuthConfig();
	const pullActivities = PullActivities.getInstance();
	pullActivities.updateAppUserAuth({
		tenantId: auth?.user?.employee?.tenantId,
		organizationId: auth?.user?.employee?.organizationId,
		remoteId: auth?.user?.id
	});
	const pushActivities = PushActivities.getInstance();
	if (stop) {
		await pullActivities.stopTracking();
		await pushActivities.stopPooling();
	} else {
		pushActivities.initQueueWorker();
		await pullActivities.startTracking();
		pushActivities.startPooling();
	}
}

function kbMouseListener(activate: boolean) {
	const auth = getAuthConfig();
	const pullActivities = PullActivities.getInstance();
	pullActivities.updateAppUserAuth({
		tenantId: auth?.user?.employee?.tenantId,
		organizationId: auth?.user?.employee?.organizationId,
		remoteId: auth?.user?.id
	});
	if (activate) {
		pullActivities.startListener();
	} else {
		pullActivities.stopListener();
	}
}

async function closeLoginWindow() {
	await delaySync(2000); // delay 2s before destroy login window
	appWindow.destroyAuthWindow();
}

export default function AppIpcMain() {
	remoteMain.initialize();

	/* Set unlimited listeners */
	ipcMain.setMaxListeners(0);

	// remove all handler on initialize
	ipcMain.removeHandler('PREFERRED_LANGUAGE');

	// handle get default theme
	ipcMain.handle('PREFERRED_THEME', () => {
		const setting = LocalStore.getStore('appSetting');
		return !setting ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : setting.theme;
	});

	// handle initialize default language
	ipcMain.handle('PREFERRED_LANGUAGE', (_, arg) => {
		console.log('language get default', arg);
		const setting = store.get('appSetting');
		if (arg) {
			if (!setting) LocalStore.setDefaultApplicationSetting();
			TranslateService.preferredLanguage = arg;
		}
		return TranslateService.preferredLanguage;
	});

	ipcMain.handle('START_SERVER', async (_, arg) => {
		log.info('Handle Start Server');
		try {
			global.variableGlobal = getGlobalVariable(arg);

			return await startServer(arg);
		} catch (error) {
			log.error(error);
			return null;
		}
	});

	ipcMain.handle('getGlobalVariable', () => {
		return getGlobalVariable();
	});

	ipcMain.on('save_additional_setting', (_, arg) => {
		LocalStore.updateAdditionalSetting(arg);
	});

	ipcMain.on('open_browser', async (_, arg) => {
		try {
			await shell.openExternal(arg.url);
		} catch (error) {
			throw new AppError('MAINOPENEXT', error);
		}
	});

	ipcMain.on('get-app-path', () => app.getAppPath());

	ipcMain.handle('app_setting', () => LocalStore.getApplicationConfig());

	ipcMain.handle('AUTH_SUCCESS', async (_, arg) => {
		let employeeId = null;
		try {
			const user = new User({ ...arg, ...arg.user });
			user.remoteId = arg.userId;
			user.organizationId = arg.organizationId;
			if (user.employee) {
				employeeId = user.employee.id;
				await userService.save(user.toObject());
			}
		} catch (error) {
			throw new AppError('AUTH_ERROR', error);
		}
		store.set({
			auth: { ...arg, isLogout: false }
		});

		try {
			/* validate user employee desktop setting */

			await apiService.getEmployeeSetting(employeeId);
		} catch (error) {
			store.set({
				auth: null
			})
			throw new AppError('GET_EMP_SETTING', error);
		}
		listenIO(false);
		await handleAlwaysOnWindow(true);
		await closeLoginWindow();
	});

	ipcMain.on('update_app_setting', (_, arg) => {
		log.info(`Update App Setting: ${moment().format()}`);
		LocalStore.updateApplicationSetting(arg.values);
	});

	ipcMain.on('logout_desktop', async () => {
		try {
			log.info('Logout Desktop');
			store.set({
				auth: null
			});

			await appWindow.initSettingWindow();
			appWindow.settingWindow.reload();

			await checkUserAuthentication(rootPath);
			listenIO(true);

		} catch (error) {
			log.error('Error Logout Desktop', error);
		}
	});

	ipcMain.handle('mouse_kb_tracking', (_, arg: boolean) => {
		LocalStore.updateApplicationSetting({ kbMouseTracking: arg });
		kbMouseListener(arg);
		return true;
	})

	ipcMain.handle('CHECK_MAIN_AUTH', () => {
		return getAuthConfig();
	});

	ipcMain.handle('FINAL_LOGOUT', async () => {
		await userService.remove();
		LocalStore.updateAuthSetting({ isLogout: true });
	});

	ipcMain.handle('SYNC_API_AUDIT', async (_, arg: { data: { page: number, limit: number, status: AuditStatus } }) => {
		const { data } = arg;
		const auditQueue = QueueAudit.getInstance();
		return auditQueue.list({
			page: data.page,
			limit: data.limit,
			status: data.status
		});
	});

	ipcMain.on('always_on_setting', async (_: any, arg: { isEnabled: boolean }) => {
		await handleAlwaysOnWindow(arg.isEnabled)
	});

	ipcMain.handle('timer_status', async () => {
		const authConfig = getAuthConfig();
		const pullActivities = PullActivities.getInstance();
		const pushActivities = PushActivities.getInstance();
		const online = await isOnline({ timeout: 1200 }).catch(() => false);
		if (online) {
			try {
				const timerStatus = await apiService.timerStatus({
					tenantId: authConfig.user.employee.tenantId,
					organizationId: authConfig.user.employee.organizationId
				});
				timerStatus.startedAt = new Date(pushActivities.currentSessionStartTime);
				if (pullActivities?.todayDuration) {
					timerStatus.duration = pullActivities.todayDuration;
				}
				return timerStatus;
			} catch (error) {
				console.log('error get the last timer status');
			}

		}
		return {
			running: pullActivities.running,
			duration: pullActivities.todayDuration,
			startedAt: pullActivities.startedAt
		}
	});

	ipcMain.handle('toggle_timer', async () => {
		const pullActivities = PullActivities.getInstance();
		if (pullActivities.running) {
			pullActivities.stopTracking();
		} else {
			pullActivities.startTracking();
		}
		return pullActivities.running;

	});

	ipcMain.on('restart_app', async (_: any, arg) => {
		LocalStore.updateConfigSetting(arg);
		const configs = LocalStore.getStore('configs');
		global.variableGlobal = {
			API_BASE_URL: getApiBaseUrl(configs),
			IS_INTEGRATED_DESKTOP: configs.isLocalServer
		};
		/* Killing the provider. */
		await provider.kill();
		/* Creating a database if not exit. */
		await ProviderFactory.instance.createDatabase();

		/* stop queue consumer */
		const pushActivities = PushActivities.getInstance();
		await pushActivities.stopPooling();
		/* Kill all windows */
		appWindow.alwaysOnWindow?.close?.();
		appWindow.settingWindow?.close?.();
		appWindow.closeLogWindow();
		appWindow.aboutWindow?.close?.();
		appWindow.setupWindow?.close?.();
		appWindow.splashScreenWindow?.close?.();
		appWindow.authWindow?.close?.();
		appWindow.notificationWindow?.close?.();
		app.relaunch({ args: process.argv.slice(1).concat(['--relaunch']) });
		app.exit(0);
	});

	ipcMain.handle('load_logs', () => {
		return agentLogger.loadLogs;
	});

	ipcMain.handle('capture_window_init', () => {
		appWindow.setWindowIsReady(WindowType.notification);
	});



	pluginListeners();
}
