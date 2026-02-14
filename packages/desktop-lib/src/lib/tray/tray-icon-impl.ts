import { AuthenticationHandler } from './auth/authentication-handler';
import { AuthIPCHandler } from './handlers/auth-ipc-handler';
import { IConfigStore, ITranslationService, ITrayIconConfig, IUserRepository, IWindowService } from './interfaces';
import { TrayIcon } from './tray-icon';

export class TrayIconImpl {
	private authIPCHandler: AuthIPCHandler;
	private authHandler: AuthenticationHandler;
	private trayIcon: TrayIcon | null = null;

	constructor(
		private config: ITrayIconConfig,
		private dependencies: {
			userRepository: IUserRepository;
			windowService: IWindowService;
			configStore: IConfigStore;
			translationService: ITranslationService;
		}
	) {
		this.authHandler = new AuthenticationHandler(
			dependencies.userRepository,
			dependencies.configStore,
			dependencies.windowService,
			config.config
		);

		this.authIPCHandler = new AuthIPCHandler(
			dependencies.windowService,
			dependencies.configStore,
			this.authHandler
		);
	}

	initialize(): TrayIcon {
		if (this.trayIcon) {
			return this.trayIcon;
		}

		this.trayIcon = new TrayIcon(this.config, this.dependencies);

		this.authIPCHandler.onAuthChange((isAuthenticated, authData) => {
			if (this.trayIcon) {
				this.trayIcon.onAuthStateChanged(isAuthenticated, authData);
			}
		});

		this.authIPCHandler.setupHandlers();

		return this.trayIcon;
	}

	getTray(): TrayIcon | null {
		return this.trayIcon;
	}

	destroy(): void {
		if (this.trayIcon) {
			this.trayIcon.destroy();
			this.trayIcon = null;
		}
		this.authIPCHandler.removeHandlers();
	}
}
