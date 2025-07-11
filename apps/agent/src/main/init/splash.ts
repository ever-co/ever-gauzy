import { systemPreferences } from 'electron';
import AppWindow from "../window-manager";
import * as path from 'node:path';
import { delaySync } from '../util';
import { AppError } from '@gauzy/desktop-lib';
const appRootPath: string = path.join(__dirname, '../..');

async function checkAndGetPermissionAccess() {
	if (process.platform === 'darwin') {
		const isAccessibilityGrant = systemPreferences.isTrustedAccessibilityClient(true);
		const isRecordAccess = systemPreferences.getMediaAccessStatus('screen');

		if (!isAccessibilityGrant || !isRecordAccess) {
			await delaySync(5000);
		}
	}
}

export async function handleSplashScreen() {
	try {
		const appWindow = AppWindow.getInstance(appRootPath);
		await appWindow.initSplashScreenWindow();
		await appWindow.splashScreenWindow.loadURL();
		appWindow.splashScreenWindow.show();
		await checkAndGetPermissionAccess();
		await delaySync(2000);
	} catch (error) {
		console.log('error splashScreenWindow', error);
		throw new AppError('INIT_APP_SPLASH', error);
	}
}
