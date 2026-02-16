import { ITrayIconConfig, TrayIconImpl } from './tray';
import {
	ConfigStoreAdapter,
	TranslationServiceAdapter,
	UserRepositoryAdapter,
	WindowServiceAdapter
} from './tray/adapters/adapters';

export class TrayIconFactory {
	static create(config: any, windowPath: any, iconPath: string): TrayIconImpl {
		const trayConfig: ITrayIconConfig = {
			iconPath,
			windowPath,
			config
		};

		const dependencies = {
			userRepository: new UserRepositoryAdapter(),
			windowService: new WindowServiceAdapter(),
			configStore: new ConfigStoreAdapter(),
			translationService: new TranslationServiceAdapter()
		};

		const trayIcon = new TrayIconImpl(trayConfig, dependencies);

		trayIcon.initialize();

		return trayIcon;
	}
}
