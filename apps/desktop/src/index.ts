// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
require('module').globalPaths.push(path.join(__dirname, 'node_modules'));
require('sqlite3');
import * as url from 'url';
const Store = require('electron-store');
import { ipcMainHandler } from './libs/ipc';
import TrayIcon from './libs/tray-icon';
import DataModel from './local-data/local-table';
const knex = require('knex')({
	client: 'sqlite3',
	connection: {
		filename: `${app.getPath('userData')}/metrix.sqlite`
	}
});
const dataModel = new DataModel();
dataModel.createNewTable(knex);

console.log('path', app.getPath('userData'));
const store = new Store();

let serve: boolean;
const args = process.argv.slice(1);
serve = args.some((val) => val === '--serve');

let win: BrowserWindow = null;
let win2: BrowserWindow = null;
let tray = null;

const getFromEnv = parseInt(process.env.ELECTRON_IS_DEV, 10) === 1;

const isEnvSet = 'ELECTRON_IS_DEV' in process.env;

const debugMode = isEnvSet
	? getFromEnv
	: process.defaultApp ||
	  /node_modules[\\/]electron[\\/]/.test(process.execPath);

/**
 * Electron window settings
 */
const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
	frame: true,
	resizable: true,
	focusable: true,
	fullscreenable: true,
	// kiosk: true,
	// to hide title bar, uncomment:
	// titleBarStyle: 'hidden',
	webPreferences: {
		devTools: true,
		nodeIntegration: debugMode,
		webSecurity: false
	}
};

/**
 * Hooks for electron main process
 */
function initMainListener() {
	ipcMain.on('ELECTRON_BRIDGE_HOST', (event, msg) => {
		console.log('msg received', msg);
		if (msg === 'ping') {
			event.sender.send('ELECTRON_BRIDGE_CLIENT', 'pong');
		}
	});
}

/**
 * Create main window presentation
 */
function createWindow() {
	const sizes = screen.getPrimaryDisplay().workAreaSize;
	mainWindowSettings.frame = true;
	mainWindowSettings.webPreferences.nodeIntegration = true;
	if (debugMode) {
		process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

		mainWindowSettings.width = 800;
		mainWindowSettings.height = 600;
	} else {
		mainWindowSettings.width = sizes.width;
		mainWindowSettings.height = sizes.height;
		mainWindowSettings.x = 0;
		mainWindowSettings.y = 0;
	}

	win = new BrowserWindow(mainWindowSettings);

	let launchPath;

	if (serve) {
		require('electron-reload')(__dirname, {
			electron: require(`${__dirname}/../../../node_modules/electron`)
		});

		launchPath = 'http://localhost:4200';

		win.loadURL(launchPath);
	} else {
		launchPath = url.format({
			pathname: path.join(__dirname, 'index.html'),
			protocol: 'file:',
			slashes: true
		});

		win.loadURL(launchPath);
	}

	console.log('launched electron with:', launchPath);

	win.on('closed', () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		win = null;
	});

	initMainListener();

	if (debugMode) {
		// Open the DevTools.
		win.webContents.openDevTools();
		// client.create(applicationRef);
	}
}

/* create second window */
function createSetupWindow(value) {
	mainWindowSettings.width = 800;
	mainWindowSettings.height = 600;
	mainWindowSettings.frame = false;
	mainWindowSettings.webPreferences.nodeIntegration = true;
	win2 = new BrowserWindow(mainWindowSettings);
	const launchPath = url.format({
		pathname: path.join(__dirname, 'ui/index.html'),
		protocol: 'file:',
		slashes: true
	});
	win2.loadURL(launchPath);
	if (value) {
		win2.hide();
	}
}

function startServer(value) {
	if (value.db === 'sqlite') {
		process.env.DB_TYPE = 'sqlite';
	} else {
		process.env.DB_TYPE = 'postgres';
		process.env.DB_HOST = value.dbHost;
		process.env.DB_PORT = value.dbPort;
		process.env.DB_NAME = value.dbName;
		process.env.DB_USER = value.dbUsername;
		process.env.DB_PASS = value.dbPassword;
	}
	if (value.isLocalServer) {
		process.env.port = value.port;
		require(path.join(__dirname, 'api/main.js'));
	}

	try {
		const config: any = {
			...value,
			isSetup: true
		};
		store.set({
			configs: config
		});
	} catch (error) {}

	setTimeout(() => {
		if (!value.isSetup) {
			win2.hide();
		}
		createWindow();
		tray = new TrayIcon(win2, knex);
	}, 5000);

	return true;
}

try {
	// app.allowRendererProcessReuse = true;

	// This method will be called when Electron has finished
	// initialization and is ready to create browser windows.
	// Some APIs can only be used after this event occurs.
	// Added 5000 ms to fix the black background issue while using transparent window.
	// More details at https://github.com/electron/electron/issues/15947
	app.on('ready', () => {
		try {
			const configs: any = store.get('configs');
			if (configs.isSetup) {
				global.variableGlobal = {
					API_BASE_URL: configs.serverUrl
						? configs.serverUrl
						: configs.port
						? `http://localhost:${configs.port}`
						: 'http://localhost:3000'
				};
				createSetupWindow(true);
				startServer(configs);
			}
		} catch (e) {
			createSetupWindow(false);
		}

		ipcMainHandler(store, startServer, knex);
	});

	app.on('window-all-closed', quit);

	ipcMain.on('quit', quit);

	ipcMain.on('minimize', () => {
		win.minimize();
	});

	ipcMain.on('maximize', () => {
		win.maximize();
	});

	ipcMain.on('restore', () => {
		win.restore();
	});

	app.on('activate', () => {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (win === null) {
			createWindow();
		}
	});
} catch (err) {}

// On OS X it is common for applications and their menu bar
// to stay active until the user quits explicitly with Cmd + Q
function quit() {
	if (process.platform !== 'darwin') {
		app.quit();
	}
}
