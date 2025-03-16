import { app, BrowserWindow } from 'electron';
import {
	LocalStore,
	DialogErrorHandler
} from '@gauzy/desktop-lib';
import AppWindow from './window-manager';
function getAuthConfig() {
	const configs: {
		auth: {
			userId: string;
			employeeId: string;
			organizationId: string;
			token: string;
		}
	} = LocalStore.getStore('configs');
	return configs?.auth;
}

export  async function checkUserAuthentication(rootPath: string) {
	const authConfig = getAuthConfig();
	if (!authConfig?.token) {
		const appWindow = new AppWindow(rootPath);
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
		const dialog = new DialogErrorHandler('Please login first to use the app');
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
	}
}
