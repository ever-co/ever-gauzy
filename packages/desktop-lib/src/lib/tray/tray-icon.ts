import { RegisteredWindow } from '@gauzy/desktop-core';
import { ipcMain, nativeImage, Tray } from 'electron';
import * as path from 'node:path';
import { TrayIPCHandler } from './handlers/tray-ipc-handler';
import { IConfigStore, ITranslationService, ITrayIconConfig, IWindowService } from './interfaces';
import { TrayMenuManager } from './managers/tray-menu-manager';
import { ILanguageObserver, LanguageChangeSubject } from './observer/language-subject';

/**
 * Main TrayIcon class implementing Observer pattern for language changes
 * DOES NOT recreate on language change - only rebuilds menu
 */
export class TrayIcon implements ILanguageObserver {
	private tray: Tray;
	private menuManager: TrayMenuManager;
	private trayIPCHandler: TrayIPCHandler;
	private languageSubject: LanguageChangeSubject;

	constructor(
		config: ITrayIconConfig,
		private dependencies: {
			windowService: IWindowService;
			configStore: IConfigStore;
			translationService: ITranslationService;
		}
	) {
		// Create tray icon
		this.tray = this.createTray(config.iconPath);

		// Create menu manager with Strategy pattern
		this.menuManager = new TrayMenuManager(
			this.tray,
			dependencies.translationService,
			dependencies.windowService,
			dependencies.configStore,
			config.windowPath
		);

		// Build initial menu
		this.menuManager.rebuildMenu();

		// Setup IPC handlers
		this.trayIPCHandler = new TrayIPCHandler(
			this.menuManager,
			dependencies.windowService,
			dependencies.configStore
		);
		this.trayIPCHandler.setupHandlers();

		// Setup language change observer
		this.languageSubject = new LanguageChangeSubject();
		this.languageSubject.attach(this);
		this.setupLanguageChangeListener();

		// Setup tray interactions
		this.setupTrayInteractions();

		// Setup icon update handler
		this.setupIconUpdateHandler();
	}

	/**
	 * Observer pattern implementation
	 * Called when language changes - rebuilds menu WITHOUT recreating tray
	 */
	onLanguageChanged(): void {
		console.log('Language changed detected, rebuilding menu...');
		this.menuManager.rebuildMenu();
	}

	/**
	 * Update auth state from external source
	 */
	onAuthStateChanged(isAuthenticated: boolean, authData?: any): void {
		this.menuManager.updateAuthState(isAuthenticated, authData);
	}

	private createTray(iconPath: string): Tray {
		const iconDir = path.dirname(iconPath);
		const normalIcon = path.join(iconDir, 'icon.png');
		const iconNativePath = nativeImage.createFromPath(normalIcon);
		iconNativePath.resize({ width: 16, height: 16 });
		return new Tray(iconNativePath);
	}

	private setupLanguageChangeListener(): void {
		this.dependencies.translationService.onLanguageChange(() => {
			this.languageSubject.notify();
		});
	}

	private setupTrayInteractions(): void {
		this.tray.on('double-click', () => {
			if (process.env.IS_DESKTOP_TIMER === 'true') {
				this.dependencies.windowService.show(RegisteredWindow.TIMER);
				const timeTrackerWindow = this.dependencies.windowService.getOne(RegisteredWindow.TIMER);
				if (timeTrackerWindow) {
					this.dependencies.windowService.webContents(timeTrackerWindow).send('auth_success_tray_init');
				}
			}
		});
	}

	private setupIconUpdateHandler(): void {
		ipcMain.on('update-tray-icon', (event, dataUrl) => {
			if (!this.tray?.isDestroyed()) {
				const image = nativeImage.createFromDataURL(dataUrl);
				const imgResize = image.resize({
					height: 18,
					width: 88,
					quality: 'best'
				});
				this.tray.setImage(imgResize);
			}
		});
	}

	destroy(): void {
		this.trayIPCHandler.removeHandlers();
		this.languageSubject.detach(this);
		ipcMain.removeAllListeners('update-tray-icon');
		this.tray.destroy();
	}
}
