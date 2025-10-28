import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IPlugin, IPluginSource, IPluginVersion, PluginSourceType, PluginStatus } from '@gauzy/contracts';
import { NbDialogService, NbMenuService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, catchError, EMPTY, filter, from, map, Observable, of, switchMap, take, tap } from 'rxjs';
import { PluginInstallationActions } from '../+state/actions/plugin-installation.action';
import { PluginMarketplaceActions } from '../+state/actions/plugin-marketplace.action';
import { PluginVersionActions } from '../+state/actions/plugin-version.action';
import { PluginInstallationQuery } from '../+state/queries/plugin-installation.query';
import { PluginMarketplaceQuery } from '../+state/queries/plugin-marketplace.query';
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';
import { Store } from '../../../../../services';
import { PluginElectronService } from '../../../services/plugin-electron.service';
import { IPlugin as IPluginInstalled } from '../../../services/plugin-loader.service';
import { DialogInstallationValidationComponent } from '../plugin-marketplace-item/dialog-installation-validation/dialog-installation-validation.component';
import { PluginMarketplaceUploadComponent } from '../plugin-marketplace-upload/plugin-marketplace-upload.component';
import { PluginSettingsManagementComponent } from '../plugin-settings-management/plugin-settings-management.component';
import {
	IPluginSubscriptionSelectionResult,
	PluginSubscriptionSelectionComponent
} from '../plugin-subscription-selection/plugin-subscription-selection.component';
import { PluginUserManagementComponent } from '../plugin-user-management/plugin-user-management.component';

// Define enums locally since they might not be available in contracts
enum PluginSubscriptionType {
	FREE = 'free',
	TRIAL = 'trial',
	BASIC = 'basic',
	PREMIUM = 'premium',
	ENTERPRISE = 'enterprise'
}

@UntilDestroy()
@Component({
	selector: 'lib-plugin-marketplace-detail',
	templateUrl: './plugin-marketplace-detail.component.html',
	styleUrls: ['./plugin-marketplace-detail.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMarketplaceDetailComponent implements OnInit {
	@Input()
	public plugin: IPlugin;
	private readonly _isChecked$ = new BehaviorSubject<boolean>(false);

	constructor(
		private readonly dialog: NbDialogService,
		private readonly router: Router,
		private readonly store: Store,
		private readonly action: Actions,
		private readonly pluginService: PluginElectronService,
		private readonly menuService: NbMenuService,
		public readonly marketplaceQuery: PluginMarketplaceQuery,
		public readonly installationQuery: PluginInstallationQuery
	) {}

	ngOnInit(): void {
		// Guard against undefined plugin
		if (!this.plugin) {
			this._isChecked$.next(false);
			return;
		}

		// Set selector position
		this._isChecked$.next(this.plugin.installed);
		// Set selector on installation
		this.installationQuery.toggle$
			.pipe(
				filter(({ plugin }) => !!plugin && this.plugin.id === plugin.id),
				tap(({ isChecked }) => this._isChecked$.next(isChecked)),
				untilDestroyed(this)
			)
			.subscribe();
		// Check local installation
		this.check(this.plugin).subscribe((isChecked) => this._isChecked$.next(isChecked));
	}

	public check(plugin: IPlugin): Observable<boolean> {
		return from(this.checkInstallation(plugin)).pipe(
			map((installed) => !!installed), // Convert the result to a boolean directly
			catchError(() => of(false)), // Ensure the stream continues even on error
			untilDestroyed(this)
		);
	}

	public async checkInstallation(plugin: IPlugin): Promise<IPluginInstalled> {
		if (!plugin) return;
		try {
			return this.pluginService.checkInstallation(plugin.id);
		} catch (error) {
			return null;
		}
	}

	public togglePlugin(checked: boolean): void {
		this.action.dispatch(PluginInstallationActions.toggle({ isChecked: checked, plugin: this.plugin }));
		checked ? this.showSubscriptionDialog() : this.uninstallPlugin();
	}

	/**
	 * Show subscription selection dialog before installation
	 */
	private showSubscriptionDialog(): void {
		this.dialog
			.open(PluginSubscriptionSelectionComponent, {
				context: {
					plugin: this.plugin,
					pluginId: this.plugin.id
				},
				backdropClass: 'backdrop-blur',
				closeOnEsc: false
			})
			.onClose.pipe(
				take(1),
				tap((result: IPluginSubscriptionSelectionResult | null) => {
					if (result?.proceedWithInstallation) {
						// If subscription was created or it's a free plugin, proceed with installation
						this.installPlugin();
					} else {
						// User cancelled or there was an error, reset the toggle
						this.action.dispatch(
							PluginInstallationActions.toggle({
								isChecked: false,
								plugin: this.plugin
							})
						);
						this._isChecked$.next(false);
					}
				}),
				catchError((err) => {
					console.error('Subscription dialog error:', err);
					// Reset toggle on error
					this.action.dispatch(
						PluginInstallationActions.toggle({
							isChecked: false,
							plugin: this.plugin
						})
					);
					this._isChecked$.next(false);
					return EMPTY;
				})
			)
			.subscribe();
	}

	public installPlugin(isUpdate = false): void {
		const installation$ = this.createInstallationObservable(isUpdate);
		installation$.subscribe({
			error: (err) => this.handleInstallationError(err)
		});
	}

	private createInstallationObservable(isUpdate: boolean): Observable<void> {
		return this.dialog
			.open(DialogInstallationValidationComponent, {
				context: { pluginId: this.plugin.id },
				backdropClass: 'backdrop-blur'
			})
			.onClose.pipe(
				take(1),
				switchMap((data) => this.handleDialogResponse(data, isUpdate)),
				catchError((err) => {
					this.handleInstallationError(err);
					return EMPTY;
				})
			);
	}

	private handleDialogResponse(data: any, isUpdate: boolean): Observable<void> {
		if (!data) {
			return this.handleDialogCloseWithoutData();
		}

		return of(data).pipe(
			filter(Boolean),
			tap(({ version, source, authToken }) => {
				this.preparePluginInstallation(version, source, isUpdate, authToken);
			})
		);
	}

	private handleDialogCloseWithoutData(): Observable<never> {
		this.action.dispatch(
			PluginInstallationActions.toggle({
				isChecked: false,
				plugin: this.plugin
			})
		);
		return EMPTY;
	}

	private handleInstallationError(err: any): void {
		console.error('Plugin installation failed:', err);
	}

	public preparePluginInstallation(
		version: IPluginVersion,
		source: IPluginSource,
		isUpdate = false,
		authToken: string
	): void {
		this.action.dispatch(PluginInstallationActions.toggle({ isChecked: true, plugin: this.plugin }));
		switch (source.type) {
			case PluginSourceType.GAUZY:
			case PluginSourceType.CDN:
				this.action.dispatch(
					PluginInstallationActions.install({
						url: source.url,
						contextType: 'cdn',
						marketplaceId: this.plugin.id,
						versionId: version.id
					})
				);
				break;
			case PluginSourceType.NPM:
				this.action.dispatch(
					PluginInstallationActions.install({
						...{
							pkg: {
								name: source.name,
								version: isUpdate ? this.plugin.version.number : version.number
							},
							registry: {
								privateURL: source.registry,
								authToken
							}
						},
						contextType: 'npm',
						marketplaceId: this.plugin.id,
						versionId: version.id
					})
				);
				break;
			default:
				break;
		}
	}

	public get isChecked$(): Observable<boolean> {
		return this._isChecked$.asObservable();
	}

	public async openPlugin(): Promise<void> {
		this.action.dispatch(PluginVersionActions.selectVersion(this.plugin.version));
		await this.router.navigate([`/settings/marketplace-plugins/${this.plugin.id}`]);
	}

	public editPlugin(): void {
		this.dialog
			.open(PluginMarketplaceUploadComponent, {
				backdropClass: 'backdrop-blur',
				context: {
					plugin: this.plugin
				}
			})
			.onClose.pipe(
				take(1),
				filter(Boolean),
				tap((plugin: IPlugin) => this.action.dispatch(PluginMarketplaceActions.update(this.plugin.id, plugin)))
			)
			.subscribe();
	}

	private uninstallPlugin(): void {
		this.dialog
			.open(AlertComponent, {
				backdropClass: 'backdrop-blur',
				context: {
					data: {
						title: 'PLUGIN.DIALOG.UNINSTALL.TITLE',
						message: 'PLUGIN.DIALOG.UNINSTALL.DESCRIPTION',
						confirmText: 'PLUGIN.DIALOG.UNINSTALL.CONFIRM',
						status: 'basic'
					}
				}
			})
			.onClose.subscribe(async (isUninstall: boolean) => {
				const plugin = await this.checkInstallation(this.plugin);
				if (isUninstall && !!plugin) {
					this.action.dispatch(PluginInstallationActions.uninstall(plugin));
				} else {
					this._isChecked$.next(true);
				}
			});
	}

	public get isOwner(): boolean {
		return !!this.store.user && !!this.plugin && this.store.user.id === this.plugin.uploadedById;
	}

	/**
	 * Get the color status for plugin status badge
	 */
	public getStatusColor(status: PluginStatus): string {
		switch (status) {
			case PluginStatus.ACTIVE:
				return 'success';
			case PluginStatus.INACTIVE:
				return 'warning';
			case PluginStatus.DEPRECATED:
				return 'danger';
			case PluginStatus.ARCHIVED:
				return 'basic';
			default:
				return 'basic';
		}
	}

	/**
	 * Get the appropriate icon for subscription type
	 */
	public getSubscriptionIcon(type: PluginSubscriptionType): string {
		switch (type) {
			case PluginSubscriptionType.FREE:
				return 'gift-outline';
			case PluginSubscriptionType.TRIAL:
				return 'clock-outline';
			case PluginSubscriptionType.BASIC:
				return 'person-outline';
			case PluginSubscriptionType.PREMIUM:
				return 'star-outline';
			case PluginSubscriptionType.ENTERPRISE:
				return 'briefcase-outline';
			default:
				return 'info-outline';
		}
	}

	/**
	 * Open plugin settings dialog
	 */
	public openSettings(): void {
		this.dialog
			.open(PluginSettingsManagementComponent, {
				backdropClass: 'backdrop-blur',
				closeOnEsc: false,
				context: {
					plugin: this.plugin,
					// TODO: Get actual installation ID
					installationId: this.plugin.id, // This should be the actual installation ID
					scope: 'global', // or determine based on context
					organizationId: this.store.selectedOrganization?.id,
					tenantId: this.store.user?.tenantId
				}
			})
			.onClose.pipe(
				filter(Boolean),
				tap(() => {
					console.log('Settings updated for plugin:', this.plugin.name);
					// Could dispatch an action to refresh plugin data if needed
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Open user assignment dialog
	 */
	public manageUsers(): void {
		this.dialog
			.open(PluginUserManagementComponent, {
				backdropClass: 'backdrop-blur',
				closeOnEsc: false,
				context: {
					plugin: this.plugin,
					// TODO: Get actual installation ID
					installationId: this.plugin.id // This should be the actual installation ID
				}
			})
			.onClose.pipe(
				filter(Boolean),
				tap(() => {
					console.log('Users managed for plugin:', this.plugin.name);
					// Could dispatch an action to refresh plugin data if needed
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Get context menu items for more actions
	 */
	public getContextMenuItems() {
		// Return empty array if plugin is not available
		if (!this.plugin) {
			return [];
		}

		const items: any[] = [
			{
				title: 'View Details',
				icon: 'eye-outline',
				link: `/settings/marketplace-plugins/${this.plugin.id}`
			}
		];

		// Add plugin management options if installed
		const isChecked = this._isChecked$.value;
		if (isChecked) {
			items.push(
				{
					title: 'Settings',
					icon: 'settings-outline',
					data: { action: 'settings' }
				},
				{
					title: 'Manage Users',
					icon: 'people-outline',
					data: { action: 'manage-users' }
				}
			);
		}

		// Add external links
		if (this.plugin.homepage) {
			items.push({
				title: 'Homepage',
				icon: 'external-link-outline',
				data: { action: 'homepage', url: this.plugin.homepage }
			});
		}

		if (this.plugin.repository) {
			items.push({
				title: 'Repository',
				icon: 'github-outline',
				data: { action: 'repository', url: this.plugin.repository }
			});
		}

		// Add owner-specific actions
		if (this.isOwner) {
			items.push(
				{
					title: 'Edit Plugin',
					icon: 'edit-outline',
					data: { action: 'edit' }
				},
				{
					title: 'Delete',
					icon: 'trash-outline',
					data: { action: 'delete' }
				}
			);
		}

		return items;
	}

	/**
	 * Handle context menu item selection
	 */
	public onContextMenuItemSelect(item: any): void {
		if (!item.data?.action || !this.plugin) {
			return;
		}

		switch (item.data.action) {
			case 'settings':
				this.openSettings();
				break;
			case 'manage-users':
				this.manageUsers();
				break;
			case 'edit':
				this.editPlugin();
				break;
			case 'homepage':
			case 'repository':
				if (item.data.url) {
					window.open(item.data.url, '_blank');
				}
				break;
			case 'delete':
				this.confirmDeletePlugin();
				break;
		}
	}

	/**
	 * Confirm plugin deletion
	 */
	private confirmDeletePlugin(): void {
		this.dialog
			.open(AlertComponent, {
				backdropClass: 'backdrop-blur',
				context: {
					data: {
						title: 'PLUGIN.DIALOG.DELETE.TITLE',
						message: 'PLUGIN.DIALOG.DELETE.DESCRIPTION',
						confirmText: 'PLUGIN.DIALOG.DELETE.CONFIRM',
						status: 'danger'
					}
				}
			})
			.onClose.subscribe(async (isDelete: boolean) => {
				if (isDelete) {
					// Dispatch delete action
					this.action.dispatch(PluginMarketplaceActions.delete(this.plugin.id));
				}
			});
	}
}
