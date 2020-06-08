// Adapted from https://github.com/maximegris/angular-electron/blob/master/main.ts

import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
require('module').globalPaths.push(path.join(__dirname, 'node_modules'));
require('sqlite3');
import * as url from 'url';

// console.log(process.env)
// require(path.join(__dirname, 'api/main.js'));

let serve: boolean;
const args = process.argv.slice(1);
serve = args.some((val) => val === '--serve');

let win: BrowserWindow = null;

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

function createSetupWindow() {
	const sizes = screen.getPrimaryDisplay().workAreaSize;
	mainWindowSettings.width = 800;
	mainWindowSettings.height = 600;
	mainWindowSettings.frame = false;
	mainWindowSettings.webPreferences.nodeIntegration = true;
	win = new BrowserWindow(mainWindowSettings);
	const launchPath = url.format({
		pathname: path.join(__dirname, 'setup.html'),
		protocol: 'file:',
		slashes: true
	});

	win.loadURL(launchPath);
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
		mkdirSync(path.join(__dirname, '../data'));
	} catch (error) {}
	try {
		const configContent = `serverUrl=${value.serverUrl};isSetup=1;db=${value.db};dbHost=${value.dbHost};dbPort=${value.dbPort};dbName=${value.dbName};dbUsername=${value.dbUsername};dbPassword=${value.dbPassword};isLocalServer=${value.isLocalServer};port=${value.port}`;
		writeFileSync(
			path.join(__dirname, '../data/config.txt'),
			configContent
		);
	} catch (error) {}

	if (!value.isSetup) win.close();
	setTimeout(() => {
		createWindow();
	}, 5000);

	return true;
}

function parseConfig(txt) {
	const conf: any = {};
	txt.split(';').forEach((item) => {
		const configItem = item.split('=');
		conf[configItem[0]] =
			configItem[1] === 'undefined' || configItem[1] === 'null'
				? null
				: configItem[1];
	});
	console.log(conf);
	return conf;
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
			const getConfig = readFileSync(
				path.join(__dirname, '../data/config.txt'),
				'utf8'
			);
			const configParsed = parseConfig(getConfig);
			if (configParsed.isSetup) {
				global.variableGlobal = {
					API_BASE_URL: configParsed.serverUrl
						? configParsed.serverUrl
						: configParsed.port
						? `http://localhost:${configParsed.port}`
						: 'http://localhost:3000'
				};
				startServer(configParsed);
			}
		} catch (e) {
			createSetupWindow();
		}

		ipcMain.on('go', (event, arg) => {
			global.variableGlobal = {
				API_BASE_URL: arg.serverUrl
					? arg.serverUrl
					: arg.port
					? `http://localhost:${arg.port}`
					: 'http://localhost:3000'
			};
			startServer(arg);
		});
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
