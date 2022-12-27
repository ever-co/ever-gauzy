import { BrowserWindow, app, ipcMain } from 'electron';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { LOCAL_SERVER_UPDATE_CONFIG } from './config';
import { UpdateContext } from './contexts';
import {
	DialogConfirmInstallDownload,
	DialogConfirmUpgradeDownload,
	DialogLocalUpdate,
	DigitalOceanCdn,
	GithubCdn
} from './decorators';
import { DesktopDialog } from './desktop-dialog';
import { LocalStore } from './desktop-store';
import { IDesktopCdnUpdate } from './interfaces';
import IUpdaterConfig from './interfaces/i-updater-config';
import { CdnUpdate, LocalUpdate } from './strategies';
import { DesktopLocalUpdateServer } from './update-server/desktop-local-update-server';

export class DesktopUpdater {
	private _updateContext: UpdateContext;
	private _updateServer: DesktopLocalUpdateServer;
	private _strategy: IDesktopCdnUpdate;
	private _settingWindow: BrowserWindow;
	private _gauzyWindow: BrowserWindow;
	private _config: IUpdaterConfig;

	constructor(config: IUpdaterConfig) {
		this._updateContext = new UpdateContext();
		this._updateServer = new DesktopLocalUpdateServer();
		this._strategy = new GithubCdn(new CdnUpdate(config));
		this._config = config;
		this._mainProcess();
		this._updaterProcess();
	}

	private _mainProcess(): void {
		ipcMain.on('update_locally', () => {
			const localUpdate = new LocalUpdate();
			const dialog = new DialogLocalUpdate(
				new DesktopDialog(
					'Gauzy',
					'Please select folder with update files',
					this._settingWindow
				)
			);
			const openedDialogResult = dialog.open();
			const files = openedDialogResult ? openedDialogResult[0] : null;
			if (files) {
				console.log('Files directory', files);
				this._updateServer.fileUri(files);
				this._updateServer.restart();
				localUpdate.url =
					'http://localhost:' +
					LOCAL_SERVER_UPDATE_CONFIG.PORT +
					'/download';
			} else {
				localUpdate.url = null;
			}
			console.log('Url update', localUpdate.url);
			console.log('Server started', this._updateServer.running);
			this._updateContext.strategy = localUpdate;
			this._settingWindow.webContents.send('update_files_directory', {
				uri: files
			});
			this._updateContext.checkUpdate();
		});

		ipcMain.on('change_update_strategy', async (event, args) => {
			if (args.github) {
				this._updateContext.strategy = this._strategy;
			} else if (args.digitalOcean) {
				this._updateContext.strategy = new DigitalOceanCdn(
					new CdnUpdate(this._config)
				);
			}
			if (!args.local) this._updateContext.checkUpdate();
		});

		ipcMain.on('check_for_update', () => {
			this._updateContext.checkUpdate();
		});

		ipcMain.on('download_update', () => {
			this._updateContext.update();
		});
	}

	private _updaterProcess(): void {
		autoUpdater.once('update-available', (info: UpdateInfo) => {
			const setting = LocalStore.getStore('appSetting');
			if (setting && !setting.automaticUpdate) return;
			const dialog = new DialogConfirmUpgradeDownload(
				new DesktopDialog(
					'Gauzy',
					'Update Ready to Download',
					this._gauzyWindow
				)
			);
			dialog.options = {
				...dialog.options,
				detail:
					'A new version v' +
					info.version +
					' is available. Upgrade the application by downloading the updates for v' +
					app.getVersion()
			};
			dialog.show().then(async (button) => {
				if (button.response === 0) {
					this._updateContext.update();
				}
			});
		});

		autoUpdater.on('update-downloaded', () => {
			const setting = LocalStore.getStore('appSetting');
			this._settingWindow.webContents.send('update_downloaded');
			if (setting && !setting.automaticUpdate) return;
			const dialog = new DialogConfirmInstallDownload(
				new DesktopDialog(
					'Gauzy',
					'Update Ready to Install',
					this._gauzyWindow
				)
			);
			dialog.show().then((button) => {
				if (button.response === 0) autoUpdater.quitAndInstall();
			});
			this._updateServer.stop();
		});

		autoUpdater.on('update-available', (info: UpdateInfo) => {
			this._settingWindow.webContents.send('update_available');
			this._updateContext.notify(info);
		});

		autoUpdater.requestHeaders = {
			'Cache-Control':
				'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
		};

		autoUpdater.on('update-not-available', () => {
			this._settingWindow.webContents.send('update_not_available');
			this._updateServer.stop();
		});

		autoUpdater.on('download-progress', (event) => {
			console.log('update log', event);
			if (this._settingWindow) {
				this._settingWindow.webContents.send(
					'download_on_progress',
					event
				);
			}
		});

		autoUpdater.on('error', (e) => {
			this._settingWindow.webContents.send('error_update', e);
			console.log('error');
			this._updateServer.stop();
		});
	}

	public set settingWindow(value: BrowserWindow) {
		this._settingWindow = value;
	}
	public set gauzyWindow(value: BrowserWindow) {
		this._gauzyWindow = value;
	}

	public checkUpdate(): void {
		const settings: any = LocalStore.getStore('appSetting');
		if (settings && settings.cdnUpdater) {
			if (settings.cdnUpdater.github) {
				this._updateContext.strategy = this._strategy;
			} else if (settings.cdnUpdater.digitalOcean) {
				this._updateContext.strategy = new DigitalOceanCdn(
					new CdnUpdate(this._config)
				);
			}
		}
		setTimeout(async () => {
			try {
				this._updateContext.checkUpdate();
			} catch (e) {
				console.log('Error on checking update:', e);
			}
		}, 5000);
	}

	public cancel() {
		this._updateContext.cancel();
	}
}
