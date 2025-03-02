import { app, Tray, ipcMain, nativeTheme } from 'electron';
import TrayMenu from './main/Tray';
import * as path from 'path';
import { CONSTANT } from './constant';
import {
	TranslateLoader,
	LocalStore
} from '@gauzy/desktop-lib';
// initiation tray menu app
let tray: Tray | null = null;

// initiation app name
if (app.getName() === 'Electron') {
	app.setName('Ever Gauzy Agent');
}
TranslateLoader.load(__dirname + '/assets/i18n/');
(async() => {
	console.log('app initiation');
	LocalStore.setAllDefaultConfig();
	await app.whenReady(); // wait till app ready

	// initiation Tray menu
	const trayMenu = new TrayMenu(
		path.join(__dirname, CONSTANT.TRAY_ICON_PATH),
		true,
		{ helpSiteUrl: 'https://gauzy.co' },
	);
	tray = trayMenu.build();
})();

ipcMain.handle('PREFERRED_THEME', () => {
	const setting = LocalStore.getStore('appSetting');
	return !setting ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : setting.theme;
});

app.on('quit', (event) => {
	console.log('App quit event', event);
	app.exit(0);
})
