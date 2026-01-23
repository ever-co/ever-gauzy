import { inject, Injectable, NgZone, OnDestroy } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChanged, filter, forkJoin, from, map, Subject, take, takeUntil, tap } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import { Store } from '../../../services';
import { PendingInstallationActions } from '../component/+state/pending-installation.action';
import { PendingInstallationQuery } from '../component/+state/pending-installation.query';
import { IPendingPluginInstallation, PendingInstallationStore } from '../component/+state/pending-installation.store';
import { PendingInstallationDialogComponent } from '../component/pending-installation-dialog/pending-installation-dialog.component';
import { PluginElectronService } from './plugin-electron.service';
import { UserSubscribedPluginsService } from './user-subscribed-plugins.service';

/**
 * Configuration for plugin startup check behavior
 */
export interface IPluginStartupCheckConfig {
	/** Whether to auto-install plugins without showing dialog */
	forceInstall: boolean;
	/** Whether the startup check is enabled */
	enabled: boolean;
	/** Delay in milliseconds before showing dialog (to allow app to stabilize) */
	dialogDelay: number;
}

/**
 * Default configuration for plugin startup check
 */
const DEFAULT_CONFIG: IPluginStartupCheckConfig = {
	forceInstall: false,
	enabled: true,
	dialogDelay: 1500
};

/**
 * Service for managing plugin availability checks at desktop app startup.
 *
 * This service handles:
 * - Checking for available plugins for the employee/organization/tenant on startup
 * - Showing popup notification for available plugin installations
 * - Supporting "force install" mode that bypasses the popup
 *
 * The service listens to authentication success events and triggers the plugin check
 * automatically when a user logs in on the desktop app.
 *
 * @example
 * ```typescript
 * // Initialize the service in your app component or module
 * export class AppComponent implements OnInit {
 *   private pluginStartupCheckService = inject(PluginStartupCheckService);
 *
 *   ngOnInit(): void {
 *     this.pluginStartupCheckService.initialize();
 *   }
 * }
 * ```
 */
@UntilDestroy({ checkProperties: true })
@Injectable({ providedIn: 'root' })
export class PluginStartupCheckService implements OnDestroy {
	private readonly store = inject(PendingInstallationStore);
	private readonly query = inject(PendingInstallationQuery);
	private readonly userSubscribedPluginsService = inject(UserSubscribedPluginsService);
	private readonly pluginElectronService = inject(PluginElectronService);
	private readonly electronService = inject(ElectronService);
	private readonly dialogService = inject(NbDialogService);
	private readonly actions = inject(Actions, { optional: true });
	private readonly appStore = inject(Store);
	private readonly ngZone = inject(NgZone);

	/** Configuration for startup check behavior */
	private config: IPluginStartupCheckConfig = { ...DEFAULT_CONFIG };

	/** Flag to track if service has been initialized */
	private isInitialized = false;

	/** Flag to prevent concurrent checks */
	private isChecking = false;

	/** Subject to manage IPC listener cleanup */
	private readonly destroy$ = new Subject<void>();

	/**
	 * Initialize the startup check service.
	 * Should be called once when the application starts.
	 *
	 * @param config Optional configuration overrides
	 */
	public initialize(config?: Partial<IPluginStartupCheckConfig>): void {
		if (this.isInitialized) {
			console.warn('[PluginStartupCheckService] Service already initialized');
			return;
		}

		// Skip if not running in desktop environment
		if (!this.pluginElectronService.isDesktop) {
			console.log('[PluginStartupCheckService] Not in desktop environment, skipping initialization');
			return;
		}

		// Merge configuration
		if (config) {
			this.config = { ...this.config, ...config };
		}

		if (!this.config.enabled) {
			console.log('[PluginStartupCheckService] Startup check is disabled');
			return;
		}

		this.setupAuthenticationListener();
		this.isInitialized = true;
		console.log('[PluginStartupCheckService] Initialized');
	}

	/**
	 * Update the service configuration
	 *
	 * @param config Configuration options to update
	 */
	public updateConfig(config: Partial<IPluginStartupCheckConfig>): void {
		this.config = { ...this.config, ...config };
		console.log('[PluginStartupCheckService] Configuration updated:', this.config);
	}

	/**
	 * Get the current configuration
	 */
	public getConfig(): IPluginStartupCheckConfig {
		return { ...this.config };
	}

	/**
	 * Enable or disable force install mode
	 *
	 * @param enabled Whether to enable force install
	 */
	public setForceInstall(enabled: boolean): void {
		this.config.forceInstall = enabled;
		console.log('[PluginStartupCheckService] Force install mode:', enabled);
	}

	/**
	 * Manually trigger a startup check.
	 * Useful for re-checking after configuration changes or manual trigger.
	 */
	public triggerCheck(): void {
		if (this.isChecking) {
			console.warn('[PluginStartupCheckService] Check already in progress');
			return;
		}

		// Only check if user is authenticated
		if (!this.appStore.userId || !this.appStore.token) {
			console.warn('[PluginStartupCheckService] User not authenticated, skipping check');
			return;
		}

		this.performStartupCheck();
	}

	/**
	 * Set up listener for authentication success events.
	 * This listens to IPC events from the Electron main process.
	 */
	private setupAuthenticationListener(): void {
		if (!this.electronService.isElectron && !this.electronService.isContextBridge) {
			return;
		}

		// Listen for successful authentication
		this.electronService.ipcRenderer.on('auth_success', (_event, _arg) => {
			this.ngZone.run(() => {
				console.log('[PluginStartupCheckService] Auth success detected, scheduling plugin check');
				// Add delay to allow app to stabilize after login
				setTimeout(() => {
					this.performStartupCheck();
				}, this.config.dialogDelay);
			});
		});

		// Also listen for tray initialization which happens after auth
		this.electronService.ipcRenderer.on('auth_success_tray_init', (_event, _arg) => {
			this.ngZone.run(() => {
				// Only trigger if not already checked
				if (!this.query.checked && !this.isChecking) {
					console.log('[PluginStartupCheckService] Tray init detected, scheduling plugin check');
					setTimeout(() => {
						this.performStartupCheck();
					}, this.config.dialogDelay);
				}
			});
		});

		// Observe authentication state changes as a fallback
		this.observeAuthenticationState();
	}

	/**
	 * Observe authentication state changes from the store.
	 * This serves as a fallback if IPC events are missed.
	 */
	private observeAuthenticationState(): void {
		// Watch for user authentication changes
		this.appStore.user$
			?.pipe(
				distinctUntilChanged((prev, curr) => prev?.id === curr?.id),
				filter((user) => !!user?.id && !!user?.employee?.id),
				tap((user) => {
					console.log('[PluginStartupCheckService] User authenticated:', user.id);
				}),
				// Only trigger if not already checked
				filter(() => !this.query.checked && !this.isChecking),
				takeUntil(this.destroy$)
			)
			.subscribe(() => {
				setTimeout(() => {
					this.performStartupCheck();
				}, this.config.dialogDelay);
			});
	}

	/**
	 * Perform the actual startup check for pending plugin installations.
	 */
	private performStartupCheck(): void {
		if (this.isChecking) {
			return;
		}

		// Skip if already checked
		if (this.query.checked) {
			console.log('[PluginStartupCheckService] Already checked, skipping');
			// If we have pending plugins and dialog is not open, show it
			if (this.query.hasPendingPlugins && !this.query.dialogOpen && !this.config.forceInstall) {
				this.showDialog();
			}
			return;
		}

		this.isChecking = true;
		this.store.update({ loading: true, error: null });

		console.log('[PluginStartupCheckService] Checking for pending plugin installations...');

		forkJoin({
			subscribedPlugins: this.userSubscribedPluginsService.getSubscribedPlugins(),
			installedPlugins: from(this.pluginElectronService.plugins)
		})
			.pipe(
				map(({ subscribedPlugins, installedPlugins }) => {
					// Get IDs of locally installed plugins
					const installedPluginIds = new Set(installedPlugins.map((p) => p.marketplaceId).filter(Boolean));

					// Filter to find subscribed plugins that are NOT installed locally
					const pendingPlugins: IPendingPluginInstallation[] = subscribedPlugins
						.filter((sub) => sub.plugin && !installedPluginIds.has(sub.plugin.id))
						.map((sub) => ({
							plugin: sub.plugin,
							subscriptionId: sub.subscriptionId,
							installed: true,
							isInstalling: false,
							error: null,
							// Pass through auto-install and mandatory flags from subscription
							canAutoInstall: sub.canAutoInstall,
							isMandatory: sub.isMandatory
						}));

					return pendingPlugins;
				}),
				tap((pendingPlugins) => {
					this.store.setPendingPlugins(pendingPlugins);
					this.store.update({ loading: false });
					this.isChecking = false;

					if (pendingPlugins.length > 0) {
						console.log(
							`[PluginStartupCheckService] Found ${pendingPlugins.length} pending plugin(s) to install`
						);
						this.handlePendingPlugins(pendingPlugins);
					} else {
						console.log('[PluginStartupCheckService] No pending plugins found');
					}
				}),
				take(1),
				untilDestroyed(this)
			)
			.subscribe({
				error: (error) => {
					const errorMessage =
						error?.error?.message || error?.message || 'Failed to check pending installations';
					this.store.update({ error: errorMessage, loading: false, checked: true });
					this.isChecking = false;
					console.error('[PluginStartupCheckService] Error checking pending installations:', error);
				}
			});
	}

	/**
	 * Handle pending plugins based on configuration.
	 *
	 * @param pendingPlugins List of pending plugins
	 */
	private handlePendingPlugins(pendingPlugins: IPendingPluginInstallation[]): void {
		// Separate plugins by their auto-install capability
		const autoInstallablePlugins = pendingPlugins.filter((p) => p.canAutoInstall === true);
		const manualPlugins = pendingPlugins.filter((p) => p.canAutoInstall !== true);

		console.log(
			`[PluginStartupCheckService] ${autoInstallablePlugins.length} auto-installable, ` +
				`${manualPlugins.length} require manual action`
		);

		if (this.config.forceInstall) {
			// Force install mode: install ALL plugins without dialog
			this.autoInstallPlugins(pendingPlugins);
		} else if (autoInstallablePlugins.length > 0) {
			// Auto-install eligible plugins silently
			this.autoInstallPlugins(autoInstallablePlugins);

			// If there are remaining plugins that need manual action, show dialog
			if (manualPlugins.length > 0) {
				this.showDialog();
			}
		} else if (manualPlugins.length > 0) {
			// No auto-installable plugins, show dialog for user to choose
			this.showDialog();
		}
	}

	/**
	 * Auto-install pending plugins without user interaction.
	 * This is used when force install mode is enabled or for auto-installable plugins.
	 *
	 * @param pluginsToInstall List of plugins to install
	 */
	private autoInstallPlugins(pluginsToInstall: IPendingPluginInstallation[]): void {
		if (pluginsToInstall.length === 0) {
			console.log('[PluginStartupCheckService] No plugins to auto-install');
			return;
		}

		console.log(`[PluginStartupCheckService] Auto-installing ${pluginsToInstall.length} plugin(s)...`);

		// Install each plugin
		pluginsToInstall.forEach((pending) => {
			if (pending.plugin.version?.id && this.actions) {
				this.actions.dispatch(
					PendingInstallationActions.installPlugin(pending.plugin.id, pending.plugin.version.id)
				);
			}
		});
	}

	/**
	 * Show the pending installation dialog.
	 */
	private showDialog(): void {
		if (this.query.dialogOpen) {
			return;
		}

		this.store.openDialog();

		if (this.actions) {
			this.actions.dispatch(PendingInstallationActions.openDialog());
		}

		this.ngZone.run(() => {
			this.dialogService.open(PendingInstallationDialogComponent, {
				closeOnBackdropClick: false,
				closeOnEsc: true,
				hasBackdrop: true,
				context: {}
			});
		});
	}

	/**
	 * Reset the service state.
	 * Useful for logout scenarios or re-initialization.
	 */
	public reset(): void {
		this.store.resetState();
		this.isChecking = false;
		console.log('[PluginStartupCheckService] State reset');
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}
}
