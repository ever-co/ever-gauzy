import log from 'electron-log';
import { screen, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as url from 'url';

export function createGauzyWindow(gauzyWindow, serve) {
	log.info('createGauzyWindow started');

	let mainWindowSettings: Electron.BrowserWindowConstructorOptions = null;
	mainWindowSettings = windowSetting();
	gauzyWindow = new BrowserWindow(mainWindowSettings);
	let launchPath;

	if (serve) {
		require('electron-reload')(__dirname, {
			electron: require(`${__dirname}/../../../../node_modules/electron`)
		});

		launchPath = 'http://localhost:4200';

		gauzyWindow.loadURL(launchPath);
	} else {
		launchPath = url.format({
			pathname: path.join(__dirname, '../index.html'),
			protocol: 'file:',
			slashes: true
		});

		gauzyWindow.loadURL(launchPath);
	}

	// console.log('launched electron with:', launchPath);

	gauzyWindow.on('close', (e) => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		e.preventDefault();
		gauzyWindow.hide(); // gauzyWindow = null;
	});

	initMainListener();

	log.info('createGauzyWindow completed');

	return gauzyWindow;
}

const windowSetting = () => {
	const sizes = screen.getPrimaryDisplay().workAreaSize;
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: true,
		focusable: true,
		fullscreenable: true,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false
		},
		width: sizes.width,
		height: sizes.height,
		x: 0,
		y: 0,
		title: 'Gauzy'
	};
	return mainWindowSettings;
};

function initMainListener() {
	ipcMain.on('ELECTRON_BRIDGE_HOST', (event, msg) => {
		console.log('msg received', msg);
		if (msg === 'ping') {
			event.sender.send('ELECTRON_BRIDGE_CLIENT', 'pong');
		}
	});
}
