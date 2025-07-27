import { systemPreferences } from 'electron';
import AppWindow from "../window-manager";
import * as path from 'node:path';
import { delaySync, getAuthConfig } from '../util';
import { AppError } from '@gauzy/desktop-lib';
const appRootPath: string = path.join(__dirname, '../..');
import { ApiService } from '../api';

async function checkAndGetPermissionAccess() {
	if (process.platform === 'darwin') {
		const isAccessibilityGrant = systemPreferences.isTrustedAccessibilityClient(true);
		const isRecordAccess = systemPreferences.getMediaAccessStatus('screen');

		if (!isAccessibilityGrant || !isRecordAccess) {
			await delaySync(5000);
		}
	}
}

async function getEmployeeSetting() {
	try {
		const authConfig = getAuthConfig();
		if (authConfig?.token && authConfig?.user?.employee?.id) {
			const apiService = ApiService.getInstance();
			await apiService.getEmployeeSetting(authConfig.user.employee.id);
		}
	} catch (error) {
		console.error('error get latest employee setting', error);
	}
}

export async function handleSplashScreen() {
	try {
		const appWindow = AppWindow.getInstance(appRootPath);
		await appWindow.initSplashScreenWindow();
		await appWindow.splashScreenWindow.loadURL();
		appWindow.splashScreenWindow.show();
		await checkAndGetPermissionAccess();
		await getEmployeeSetting();
		await delaySync(2000);
	} catch (error) {
		console.log('error splashScreenWindow', error);
		throw new AppError('INIT_APP_SPLASH', error);
	}
}
