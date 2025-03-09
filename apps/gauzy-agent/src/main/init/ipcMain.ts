import {
	ipcMain,
	nativeTheme,
	shell
} from 'electron';
import * as remoteMain from '@electron/remote/main';
import { logger as log, store } from '@gauzy/desktop-core';
import {
	LocalStore,
	TranslateService,
	AppError
} from '@gauzy/desktop-lib';
import { getApiBaseUrl } from '../util';
import { startServer } from './app';

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
		const configs = LocalStore.getStore('configs');
		try {
			const baseUrl = getApiBaseUrl(configs);

			global.variableGlobal = {
				API_BASE_URL: baseUrl,
				IS_INTEGRATED_DESKTOP: arg.isLocalServer
			};

			return await startServer(arg);
		} catch (error) {
			log.error(error);
			return null;
		}
	});

	ipcMain.handle('getGlobalVariable', () => {
		const configs = LocalStore.getStore('configs');
		return {
			API_BASE_URL: getApiBaseUrl(configs),
			IS_INTEGRATED_DESKTOP: false
		};
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
}
