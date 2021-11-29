import log from 'electron-log';
import { screen, BrowserWindow, ipcMain } from 'electron';
import * as remoteMain from '@electron/remote/main';
import * as url from 'url';

export function createGauzyWindow(gauzyWindow, serve, config, filePath) {
	log.info('createGauzyWindow started');

	let mainWindowSettings: Electron.BrowserWindowConstructorOptions = null;

  	mainWindowSettings = windowSetting();

  	gauzyWindow = new BrowserWindow(mainWindowSettings);
  
	remoteMain.enable(gauzyWindow.webContents);

	let launchPath;

	if (!config.gauzyWindow) {
	 	gauzyWindow.hide();
	}

	if (serve) {
		require('electron-reload')(__dirname, {
			electron: require(`${__dirname}/../../../../node_modules/electron`)
		});

		launchPath = `http://localhost:${config.GAUZY_UI_DEFAULT_PORT}`;

		gauzyWindow.loadURL(launchPath);
	} else {
		launchPath = url.format({
			pathname: filePath,
			protocol: 'file:',
			slashes: true
		});

		gauzyWindow.loadURL(launchPath);
	}

	console.log('launched electron with:', launchPath);
	// gauzyWindow.webContents.toggleDevTools();

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
			webSecurity: false,			
			contextIsolation: false
		},
		width: sizes.width,
		height: sizes.height,
		x: 0,
		y: 0,
		title: 'Gauzy Desktop',
		show: false
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

export function getApiBaseUrl(configs, envConfig) {
	if (configs.serverUrl) return configs.serverUrl;
	else {
		return configs.port
			? `http://localhost:${configs.port}`
			: `http://localhost:${envConfig.API_DEFAULT_PORT}`;
	}
}

export function gauzyPage(filePath) {
	return url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true
	});
}
