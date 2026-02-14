import { Menu, MenuItemConstructorOptions, Tray } from 'electron';
import { IConfigStore, ITranslationService, IWindowService } from '../interfaces';
import { AuthenticatedState, AuthState, UnauthenticatedState } from '../states/auth-state';

export class TrayMenuManager {
	private currentMenu: MenuItemConstructorOptions[] = [];
	private authState: AuthState;

	constructor(
		private tray: Tray,
		private translationService: ITranslationService,
		private windowService: IWindowService,
		private configStore: IConfigStore,
		private windowPath: any
	) {
		this.authState = this.determineAuthState();
	}

	/**
	 * Rebuild menu based on current auth state
	 * Called when language changes or auth state changes
	 */
	rebuildMenu(): void {
		console.log('Rebuilding tray menu...');

		// Get appropriate strategy based on auth state
		const strategy = this.authState.getMenuStrategy(
			this.translationService,
			this.windowService,
			this.configStore,
			this.windowPath
		);

		// Build menu using strategy
		this.currentMenu = strategy.buildMenu();

		// Apply menu to tray
		this.applyMenu();

		console.log('Tray menu rebuilt successfully');
	}

	/**
	 * Update auth state and rebuild menu
	 */
	updateAuthState(isAuthenticated: boolean, authData?: any): void {
		if (isAuthenticated && authData?.employeeId) {
			this.authState = new AuthenticatedState(authData);
		} else {
			this.authState = new UnauthenticatedState();
		}

		this.rebuildMenu();
	}

	/**
	 * Update specific menu item (e.g., timer status)
	 */
	updateMenuItem(index: number, updates: Partial<MenuItemConstructorOptions>): void {
		if (this.currentMenu[index]) {
			this.currentMenu[index] = { ...this.currentMenu[index], ...updates };
			this.applyMenu();
		}
	}

	private applyMenu(): void {
		if (!this.tray || this.tray.isDestroyed()) {
			return;
		}
		this.tray.setContextMenu(Menu.buildFromTemplate([...this.currentMenu]));
	}

	private determineAuthState(): AuthState {
		const auth = this.configStore.get('auth');
		if (auth && auth.employeeId && !auth.isLogout) {
			return new AuthenticatedState(auth);
		}
		return new UnauthenticatedState();
	}

	getMenu(): MenuItemConstructorOptions[] {
		return this.currentMenu;
	}
}
