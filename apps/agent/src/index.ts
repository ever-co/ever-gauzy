import { logger as log } from '@gauzy/desktop-core';
import { InstallPluginHandler, LocalStore, ProtocolRouter, setupAkitaStorageHandler } from '@gauzy/desktop-lib';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { environment } from './environments/environment';
import { InitApplication } from './main/init';
Object.assign(process.env, environment);

let popupWin: BrowserWindow | null = null;

const sqlite3filename = `${process.env.GAUZY_USER_PATH}/gauzy.sqlite3`;
log.info(`Sqlite DB path: ${sqlite3filename}`);

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

const args = process.argv.slice(1);
args.some((val) => val === '--serve');

LocalStore.setFilePath({
	iconPath: path.join(__dirname, 'assets', 'icons', 'menu', 'icon.png')
});

// Register custom protocol for deep linking
const appProtocol = process.env.PROTOCOL || 'gauzy-agent';
if (process.defaultApp) {
	if (process.argv.length >= 2) {
		app.setAsDefaultProtocolClient(appProtocol, process.execPath, [path.resolve(process.argv[1])]);
	}
} else {
	app.setAsDefaultProtocolClient(appProtocol);
}

// Deep-link protocol router — registered with all supported action handlers.
const protocolRouter = ProtocolRouter.getInstance();

// Instance detection
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
	console.log('Another instance is already running, quitting...');
	app.quit();
} else {
	app.on('second-instance', (event, commandLine) => {
		console.log('Another instance is already running...');

		// Handle deep link from second instance
		const url = commandLine.find((arg) => arg.startsWith(`${appProtocol}://`));
		if (url) {
			console.log('Deep link received from second instance:', url);
			protocolRouter.route(url);
		}
	});

	// Handle deep links on macOS
	app.on('open-url', (event, url) => {
		event.preventDefault();
		console.log('Deep link received (macOS):', url);
		protocolRouter.route(url);
	});
}
/* Setting the app user model id for the app. */
if (process.platform === 'win32') {
	app.setAppUserModelId(process.env.APP_ID);
}

// Configure the protocol router with all supported deep-link action handlers.
protocolRouter.register(new InstallPluginHandler(path.join(__dirname, './index.html')));

// Setup storage handler for Akita state management
setupAkitaStorageHandler();
// init application
InitApplication();

app.commandLine.appendSwitch('disable-http2');

ipcMain.on('quit', quit);

// Removed: before-quit handler now managed by EventHandler.exitApp()

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

ipcMain.handle('get-app-path', () => app.getAppPath());
