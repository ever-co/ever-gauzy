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
	UserService
} from '@gauzy/desktop-lib';
import { getApiBaseUrl, delaySync } from '../util';
import { startServer } from './app';
import AppWindow from '../window-manager';
import moment from 'moment';

const userService = new UserService();

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

async function closeLoginWindow() {
	const appWindow = AppWindow.getInstance('');
	await delaySync(2000); // delay 2s before destroy login window
	appWindow.authWindow.browserWindow.destroy();
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
		try {
			const user = new User({ ...arg, ...arg.user });
			user.remoteId = arg.userId;
			user.organizationId = arg.organizationId;
			if (user.employee) {
				await userService.save(user.toObject());
			}
		} catch (error) {
			console.log('Error on save user', error);
		}
		store.set({
			auth: { ...arg, isLogout: false }
		});
		await closeLoginWindow();
	});

	ipcMain.on('update_app_setting', (event, arg) => {
		log.info(`Update App Setting: ${moment().format()}`);
		LocalStore.updateApplicationSetting(arg.values);
	});
}
