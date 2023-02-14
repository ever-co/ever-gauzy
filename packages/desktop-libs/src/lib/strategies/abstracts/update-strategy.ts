import { IDesktopUpdate } from '../../interfaces/i-desktop-update';
import { CancellationToken } from 'builder-util-runtime';
import DesktopNotification from '../../desktop-notifier';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { app } from 'electron';

export abstract class UpdateStrategy implements IDesktopUpdate {
	protected _cancellationToken: CancellationToken;
	protected _url: string;
	private _notifier: DesktopNotification;
	private _isUpdateTriggered: boolean;

	constructor() {
		this._notifier = new DesktopNotification();
		try {
			this._cancellationToken = new CancellationToken();
		} catch (error) {}
	}

	public update(): void {
		autoUpdater.autoDownload = !this._isUpdateTriggered;
		if (this.url) {
			autoUpdater.setFeedURL({
				channel: 'latest',
				provider: 'generic',
				url: this.url,
			});
			autoUpdater
				.checkForUpdatesAndNotify()
				.then((downloadPromise) => {
					if (this._cancellationToken) {
						this._cancellationToken =
							downloadPromise.cancellationToken;
					} else {
						this._isUpdateTriggered = true;
					}
				})
				.catch((e) => {
					console.log('Error occurred', e);
				});
		}
	}

	public async checkUpdate() {
		try {
			autoUpdater.autoDownload = false;
			autoUpdater.setFeedURL({
				channel: 'latest',
				provider: 'generic',
				url: this.url,
			});
			await autoUpdater.checkForUpdates();
		} catch (e) {
			console.log('Error on checking update: ', e);
		}
	}

	public notify(info: UpdateInfo): void {
		this._notifier.customNotification(
			`New update for ${this._appName} (version ${info.version}) is available`,
			this._appName
		);
	}

	public cancel(): void {
		if (this._cancellationToken) {
			this._cancellationToken.cancel();
		}
	}

	private get _appName(): string {
		return app
			.getName()
			.split('-')
			.join(' ')
			.replace(/(^\w{1})|(\s+\w{1})/g, (letter) => letter.toUpperCase());
	}

	public abstract get url(): string;
	public abstract set url(value: string);
}
