import { nativeTheme } from 'electron';
import { IApplicationSetting, IStoreService } from '../types';
import { StoreService } from './store.service';

export class ApplicationSettingStoreService extends StoreService implements IStoreService<IApplicationSetting> {
	private readonly storeKey = 'appSetting';

	public setDefault(): void {
		if (this.find()) {
			return;
		}

		const defaultSettings: IApplicationSetting = {
			monitor: {
				captured: 'all' // ['all', 'active-only']
			},
			timer: {
				updatePeriod: 10 // [1, 5, 10]
			},
			SCREENSHOTS_ENGINE_METHOD: 'ElectronDesktopCapturer',
			screenshotNotification: true,
			simpleScreenshotNotification: false,
			mutedNotification: false,
			autoLaunch: true,
			visibleAwOption: true,
			randomScreenshotTime: false,
			visibleWakatimeOption: false,
			trackOnPcSleep: false,
			awIsConnected: true,
			preventDisplaySleep: false,
			automaticUpdate: true,
			automaticUpdateDelay: 1, // hour
			timerStarted: false,
			cdnUpdater: {
				github: false,
				digitalOcean: true
			},
			prerelease: false,
			preferredLanguage: 'en',
			zone: 'local',
			alwaysOn: true,
			enforced: false,
			theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
		};

		this.store.set(this.storeKey, defaultSettings);
	}

	public update(values: Partial<IApplicationSetting>): void {
		const current = this.find() || {};
		this.store.set(this.storeKey, { ...current, ...values });
	}

	public find(): IApplicationSetting | undefined {
		return this.store.get(this.storeKey);
	}
}
