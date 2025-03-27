import { app, BrowserWindow } from 'electron';
import {
	LocalStore,
	DialogErrorHandler,
	DesktopDialog
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

export async function checkUserAuthentication(rootPath: string) {
	const authConfig = getAuthConfig();
	if (!authConfig?.token) {
		const appWindow = AppWindow.getInstance(rootPath);
		await appWindow.initAuthWindow();
		appWindow.authWindow.browserWindow.removeAllListeners('close');
		appWindow.authWindow.browserWindow.on('close', async (event) => {
			event.preventDefault();
			await handleCloseAuthWindow(appWindow.authWindow.browserWindow);
		})
		await appWindow.authWindow.loadURL();
		appWindow.authWindow.show();
	}
}

async function handleCloseAuthWindow(authWindow: BrowserWindow) {
	const authConfig = getAuthConfig();
	if (!authConfig?.token) {
		const DIALOG_TITLE = 'TIMER_TRACKER.DIALOG.WARNING';
		const DIALOG_MESSAGE = 'Application need to login f FWirst to use';

		const dialog = new DesktopDialog(DIALOG_TITLE, DIALOG_MESSAGE, authWindow);
		dialog.options.buttons = [
			'BUTTON.CANCEL',
			'BUTTON.EXIT'
		];
		const button = await dialog.show();
		switch (button.response) {
			case 1: // exit button
				authWindow.destroy();
				app.exit(0);
				break;
			default:
				// Do nothing when other than exit button choosed
				break;
		}
	}
}
