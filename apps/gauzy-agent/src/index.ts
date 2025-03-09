import { environment } from './environments/environment';
Object.assign(process.env, environment);
import { logger as log } from '@gauzy/desktop-core';
import { BrowserWindow, shell, app, ipcMain } from 'electron';
import * as path from 'path';
import { InitApplication } from './main/init';

InitApplication();
import {
	AppError,
	DesktopDialog,
	DesktopUpdater,
	DialogStopTimerExitConfirmation,
	LocalStore,
	TranslateService,
} from '@gauzy/desktop-lib';

let popupWin: BrowserWindow | null = null;

const sqlite3filename = `${process.env.GAUZY_USER_PATH}/gauzy.sqlite3`;
log.info(`Sqlite DB path: ${sqlite3filename}`);

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

const args = process.argv.slice(1);
const updater = new DesktopUpdater({
	repository: process.env.REPO_NAME,
	owner: process.env.REPO_OWNER,
	typeRelease: 'releases'
});
args.some((val) => val === '--serve');


LocalStore.setFilePath({
	iconPath: path.join(__dirname, 'assets', 'icons', 'menu', 'icon.png')
});
/* Setting the app user model id for the app. */
if (process.platform === 'win32') {
	app.setAppUserModelId(process.env.APP_ID);
}

app.on('window-all-closed', () => {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.commandLine.appendSwitch('disable-http2');

ipcMain.on('quit', quit);

app.on('before-quit', async (e) => {
	e.preventDefault();

	const appSetting = LocalStore.getStore('appSetting');

	if (appSetting && appSetting.timerStarted) {
		e.preventDefault();

		const exitConfirmationDialog = new DialogStopTimerExitConfirmation(
			new DesktopDialog(
				process.env.DESCRIPTION,
				TranslateService.instant('TIMER_TRACKER.DIALOG.EXIT'),
			)
		);

		const button = await exitConfirmationDialog.show();

		if (button.response === 0) {
		}
	} else {
		// soft download cancellation
		try {
			updater.cancel();
		} catch (e) {
			console.error('ERROR: Occurred while cancel update:' + e);
			throw new AppError('MAINUPDTABORT', e);
		}

		app.exit(0);
	}
});

// On OS X it is common for applications and their menu bar
// to stay active until the user quits explicitly with Cmd + Q
function quit() {
	if (process.platform !== 'darwin') {
		app.quit();
	}
}

app.on('web-contents-created', (_, contents) => {
	contents.on('will-redirect', async (event, url) => {
		const defaultBrowserConfig = {
			title: '',
			width: 1280,
			height: 600,
			webPreferences: {
				allowRunningInsecureContent: false,
				contextIsolation: true,
				enableRemoteModule: true,
				javascript: true,
				webSecurity: false,
				webviewTag: false,
				nodeIntegration: true
			}
		};

		const isLinkedInOAuth = url.includes('https://www.linkedin.com/oauth');
		const isGoogleOAuth = url.includes('https://accounts.google.com');
		const isSignInSuccess = url.includes('sign-in/success?jwt');
		const isAuthRegister = url.includes('/auth/register');
		const targetUrl = new URL(url);

		if (!ALLOWED_PROTOCOLS.has(targetUrl.protocol)) {
			return;
		}

		if (isLinkedInOAuth || isGoogleOAuth) {
			try {
				event.preventDefault();
				await showPopup(url, defaultBrowserConfig);
			} catch (_) {
				// Soft fail
			}
			return;
		}

		if (isSignInSuccess) {
			if (popupWin) popupWin.destroy();
		}

		if (isAuthRegister) {
			try {
				await shell.openExternal(url);
			} catch (error) {
				console.error('Error opening external URL:', error);
			}
		}
	});
});

const showPopup = async (url: string, options: Electron.BrowserWindowConstructorOptions) => {
	const { width = 1280, height = 768, ...otherOptions } = options;

	// Close existing popup window if it exists
	if (popupWin) {
		popupWin.destroy();
	}

	// Create a new BrowserWindow with specified options
	popupWin = new BrowserWindow({
		width,
		height,
		...otherOptions
	});

	// Set a custom user agent to emulate a specific browser version
	const userAgent = 'Chrome/104.0.0.0';
	await popupWin.loadURL(url, { userAgent });

	// Show the popup window
	popupWin.show();
};

app.on('browser-window-created', (_, window) => {
	require('@electron/remote/main').enable(window.webContents);
});

ipcMain.handle('get-app-path', () => app.getAppPath());
