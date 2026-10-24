import { logger as log } from '@gauzy/desktop-core';
import { InstallPluginHandler, LocalStore, ProtocolRouter, setupAkitaStorageHandler } from '@gauzy/desktop-lib';
import { installNavigationGuard, installProviderSignIn } from '@gauzy/desktop-window';
import { app, ipcMain } from 'electron';
import * as path from 'path';
import { environment } from './environments/environment';
import { InitApplication } from './main/init';
import { getApiBaseUrl } from './main/util';
import AppWindow from './main/window-manager';
Object.assign(process.env, environment);

const sqlite3filename = `${process.env.GAUZY_USER_PATH}/gauzy.sqlite3`;
log.info(`Sqlite DB path: ${sqlite3filename}`);

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

// A window with Node or a preload follows no link out of its own pages (a task description's link loaded the
// linked page with Node); the configured API stays reachable, where the social sign-in links start.
installNavigationGuard({ trustedUrls: () => [getApiBaseUrl(LocalStore.getStore('configs') || {})] });

// The social sign-in: the provider's pages open in a popup, and the sign-in window is told how the sign-in ended
// (a token, or the workspace picker's one-time code when the address has several workspaces)
installProviderSignIn({ signInWindow: () => AppWindow.getInstance(__dirname).authWindow?.browserWindow });

ipcMain.handle('get-app-path', () => app.getAppPath());
