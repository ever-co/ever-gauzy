import { app } from 'electron';
import {
	LocalStore,
	DesktopDialog,
	TranslateService
} from '@gauzy/desktop-lib';
import AppWindow from './window-manager';
function getAuthConfig() {
	const authConfig: {
		userId: string;
		employeeId: string;
		organizationId: string;
		token: string;
	} = LocalStore.getStore('auth');
	return authConfig;
}

export async function checkUserAuthentication(rootPath: string): Promise<boolean> {
	const authConfig = getAuthConfig();
	if (!authConfig?.token) {
		const appWindow = AppWindow.getInstance(rootPath);
		await appWindow.initAuthWindow();
		appWindow.authWindow.browserWindow.removeAllListeners('close');
		appWindow.authWindow.browserWindow.on('close', async (event) => {
			event.preventDefault();
			await handleCloseAuthWindow(appWindow);
		})
		await appWindow.authWindow.loadURL();
		appWindow.authWindow.show();
		return false;
	}
	return true;
}

async function handleCloseAuthWindow(appWindow: AppWindow) {
	const authConfig = getAuthConfig();
	if (!authConfig?.token) {
		const DIALOG_TITLE = TranslateService.instant('TIMER_TRACKER.DIALOG.WARNING');
		const DIALOG_MESSAGE = TranslateService.instant('TIMER_TRACKER.DIALOG.EXIT_AGENT_CONFIRM');

		const dialog = new DesktopDialog(DIALOG_TITLE, DIALOG_MESSAGE, appWindow.authWindow.browserWindow);
		dialog.options.buttons = [
			TranslateService.instant('BUTTONS.CANCEL'),
			TranslateService.instant('BUTTONS.EXIT')
		];
		const button = await dialog.show();
		switch (button.response) {
			case 1: // exit button
				appWindow.destroyAuthWindow();
				app.exit(0);
				break;
			default:
				// Do nothing when other than exit button chosen
				break;
		}
	}
}
