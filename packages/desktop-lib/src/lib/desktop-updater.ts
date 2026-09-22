import { BrowserWindow, app, ipcMain } from 'electron';
import { autoUpdater, UpdateInfo, UpdateDownloadedEvent } from 'electron-updater';
import { LOCAL_SERVER_UPDATE_CONFIG } from './config';
import { AutomaticUpdate, UpdateContext } from './contexts';
import {
	DialogConfirmInstallDownload,
	DialogConfirmUpgradeDownload,
	DialogLocalUpdate,
	GithubCdn
} from './decorators';
import { DesktopDialog } from './desktop-dialog';
import { LocalStore } from './desktop-store';
import { IDesktopGithubUpdate } from './interfaces';
import IUpdaterConfig from './interfaces/i-updater-config';
import { CdnUpdate, LocalUpdate } from './strategies';
import { TranslateService } from './translation';
import { DesktopLocalUpdateServer } from './update-server/desktop-local-update-server';

export class DesktopUpdater {
	private _updateContext: UpdateContext;
	private _updateServer: DesktopLocalUpdateServer;
	private _strategy: IDesktopGithubUpdate;
	private _settingWindow: BrowserWindow;
	private _gauzyWindow: BrowserWindow;
	private _config: IUpdaterConfig;
	private _automaticUpdate: AutomaticUpdate;

	constructor(config: IUpdaterConfig) {
		this._updateContext = new UpdateContext();
		this._updateServer = new DesktopLocalUpdateServer();
		this._strategy = new GithubCdn(new CdnUpdate(config));
		// The DigitalOcean Spaces CDN update feed (ever.sfo3.cdn.digitaloceanspaces.com) was
		// decommissioned; GitHub Releases is the only live feed. Default the active strategy to
		// GitHub so no install is stranded on the dead CDN — including apps that never call
		// checkUpdate() explicitly (e.g. agent) and rely solely on the automatic update loop.
		this._updateContext.strategy = this._strategy;
		this._automaticUpdate = new AutomaticUpdate(this._updateContext, this.settingWindow);
		this._config = config;
		this._mainProcess();
		this._updaterProcess();
		// GithubCdn resolves its feed URL asynchronously in initialize(); start the automatic
		// update loop only after that completes so the first check targets a valid feed.
		void this._startAutomaticUpdate();
	}

	private async _startAutomaticUpdate(): Promise<void> {
		try {
			await this._strategy.initialize();
		} catch (error) {
			console.log('Error initializing default update strategy:', error);
		}
		this._automaticUpdate.start();
	}

	private _mainProcess(): void {
		ipcMain.on('update_locally', async () => {
			const localUpdate = new LocalUpdate();
			const dialog = new DialogLocalUpdate(
				new DesktopDialog(
					process.env.DESCRIPTION,
					TranslateService.instant('TIMER_TRACKER.DIALOG.SELECT_UPDATE_FILES'),
					this._settingWindow
				)
			);
			const openedDialogResult = dialog.open();
			const files = openedDialogResult ? openedDialogResult[0] : null;
			if (files) {
				console.log('Files directory', files);
				this._updateServer.fileUri(files);
				this._updateServer.restart();
				localUpdate.url = 'http://localhost:' + LOCAL_SERVER_UPDATE_CONFIG.PORT + '/download';
			} else {
				localUpdate.url = null;
			}
			console.log('Url update', localUpdate.url);
			console.log('Server started', this._updateServer.running);
			this._updateContext.strategy = localUpdate;
			this._settingWindow?.webContents?.send?.('setting_page_ipc', {
				type: 'update_files_directory',
				data: {
					uri: files
				}
			});
			try {
				await this._updateContext.checkUpdate();
			} catch (e) {
				this._settingWindow?.webContents?.send?.('setting_page_ipc', {
					type: 'error_update',
					data: e
				});
				console.log('Error on checking update:', e);
			}
		});

		ipcMain.on('change_update_strategy', async (event, args) => {
			if (args.github || args.digitalOcean) {
				// The DigitalOcean Spaces CDN feed is dead; route the (deprecated) digitalOcean
				// option to the live GitHub feed as well so the toggle can never select it.
				await this._strategy.initialize();
				this._updateContext.strategy = this._strategy;
			}
			if (!args.local) {
				try {
					await this._updateContext.checkUpdate();
				} catch (e) {
					this._settingWindow?.webContents?.send?.('setting_page_ipc', {
						type: 'error_update',
						data: e
					});
					console.log('Error on checking update:', e);
				}
			}
		});

		ipcMain.on('check_for_update', async () => {
			try {
				await this._updateContext.checkUpdate();
			} catch (e) {
				this._settingWindow?.webContents?.send?.('setting_page_ipc', {
					type: 'error_update',
					data: e
				});
				console.log('Error on checking update:', e);
			}
		});

		ipcMain.on('download_update', () => {
			this._updateContext.update();
		});

		ipcMain.on('automatic_update_setting', (event, args) => {
			const { isEnabled, automaticUpdateDelay } = args;
			isEnabled ? (this._automaticUpdate.delay = automaticUpdateDelay) : this._automaticUpdate.stop();
		});
	}

	private _updaterProcess(): void {
		autoUpdater.once('update-available', async (info: UpdateInfo) => {
			const setting = LocalStore.getStore('appSetting');
			if (setting && !setting.automaticUpdate) return;
			const dialog = new DialogConfirmUpgradeDownload(
				new DesktopDialog(
					process.env.DESCRIPTION,
					TranslateService.instant('TIMER_TRACKER.DIALOG.UPDATE_READY'),
					this._gauzyWindow
				)
			);
			dialog.options = {
				...dialog.options,
				detail: TranslateService.instant('TIMER_TRACKER.DIALOG.NEW_VERSION_AVAILABLE', {
					next: info.version,
					current: app.getVersion()
				})
			};
			const button = await dialog.show();
			if (button?.response === 0) {
				this._updateContext.update();
			}
		});

		autoUpdater.on('update-downloaded', async (event: UpdateDownloadedEvent) => {
			const setting = LocalStore.getStore('appSetting');
			this._settingWindow?.webContents?.send?.('setting_page_ipc', {
				type: 'update_downloaded'
			});
			if (setting && !setting.automaticUpdate) return;
			const dialog = new DialogConfirmInstallDownload(
				new DesktopDialog(
					process.env.DESCRIPTION,
					TranslateService.instant('TIMER_TRACKER.DIALOG.READY_INSTALL'),
					this._gauzyWindow
				)
			);
			dialog.options.detail = TranslateService.instant('TIMER_TRACKER.DIALOG.HAS_BEEN_DOWNLOADED', {
				version: event.version
			});
			const button = await dialog.show();
			if (button?.response === 0) {
				this._settingWindow?.webContents?.send?.('setting_page_ipc', {
					type: '_logout_quit_install_'
				});
			}
			this._updateServer.stop();
		});

		autoUpdater.on('update-available', (info: UpdateInfo) => {
			this._settingWindow?.webContents?.send?.('setting_page_ipc', {
				type: 'update_available'
			});
			this._updateContext.notify(info);
		});

		autoUpdater.requestHeaders = {
			'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
		};

		autoUpdater.on('update-not-available', () => {
			this._settingWindow?.webContents?.send?.('setting_page_ipc', {
				type: 'update_not_available'
			});
			this._updateServer.stop();
		});

		autoUpdater.on('download-progress', (event) => {
			console.log('update log', event);
			if (this._settingWindow) {
				this._settingWindow?.webContents?.send?.('setting_page_ipc', {
					type: 'download_on_progress',
					data: event
				});
			}
		});

		autoUpdater.on('error', (e) => {
			this._settingWindow?.webContents?.send?.('setting_page_ipc', {
				type: 'error_update',
				data: e
			});
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

	public async checkUpdate(): Promise<void> {
		const settings: any = LocalStore.getStore('appSetting');

		if (settings && settings.cdnUpdater) {
			// GitHub Releases is the only live feed. A persisted `digitalOcean: true` (the old
			// shipped default) would otherwise pin the install to the dead DigitalOcean Spaces
			// CDN, so resolve both options to GitHub.
			if (settings.cdnUpdater.github || settings.cdnUpdater.digitalOcean) {
				await this._strategy.initialize();
				this._updateContext.strategy = this._strategy;
			}
		}

		setTimeout(async () => {
			try {
				await this._updateContext.checkUpdate();
			} catch (e) {
				this._settingWindow?.webContents?.send?.('setting_page_ipc', {
					type: 'error_update',
					data: e
				});
				console.log('Error on checking update:', e);
			}
		}, 5000);
	}

	public cancel() {
		this._updateContext.cancel();
	}
}
