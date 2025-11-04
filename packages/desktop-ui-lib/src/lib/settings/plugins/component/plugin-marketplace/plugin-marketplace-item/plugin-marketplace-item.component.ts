import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	ICDNSource,
	IGauzySource,
	INPMSource,
	IPlugin,
	IPluginSource,
	IPluginVersion,
	PluginSourceType,
	PluginStatus,
	PluginType
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, EMPTY, Observable, Subject, tap } from 'rxjs';
import { catchError, concatMap, filter, switchMap, take, takeUntil } from 'rxjs/operators';
import { PluginInstallationActions } from '../+state/actions/plugin-installation.action';
import { PluginMarketplaceActions } from '../+state/actions/plugin-marketplace.action';
import { PluginSourceActions } from '../+state/actions/plugin-source.action';
import { PluginVersionActions } from '../+state/actions/plugin-version.action';
import { PluginSubscriptionAccessFacade } from '../+state/plugin-subscription-access.facade';
import { PluginInstallationQuery } from '../+state/queries/plugin-installation.query';
import { PluginMarketplaceQuery } from '../+state/queries/plugin-marketplace.query';
import { PluginSourceQuery } from '../+state/queries/plugin-source.query';
import { PluginVersionQuery } from '../+state/queries/plugin-version.query';
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';
import { Store, ToastrNotificationService } from '../../../../../services';
import { PluginElectronService } from '../../../services/plugin-electron.service';
import { IPlugin as IPluginInstalled } from '../../../services/plugin-loader.service';
import { PluginScope } from '../../../services/plugin-subscription-access.service';
import { PluginSubscriptionService } from '../../../services/plugin-subscription.service';
import { PluginMarketplaceUploadComponent } from '../plugin-marketplace-upload/plugin-marketplace-upload.component';
import { PluginSubscriptionSelectionComponent } from '../plugin-subscription-selection/plugin-subscription-selection.component';
import { DialogCreateSourceComponent } from './dialog-create-source/dialog-create-source.component';
import { DialogCreateVersionComponent } from './dialog-create-version/dialog-create-version.component';
import { DialogInstallationValidationComponent } from './dialog-installation-validation/dialog-installation-validation.component';

@Component({
	selector: 'gauzy-plugin-marketplace-item',
	templateUrl: './plugin-marketplace-item.component.html',
	styleUrls: ['./plugin-marketplace-item.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMarketplaceItemComponent implements OnInit, OnDestroy {
	private readonly destroy$ = new Subject<void>();
	installed$ = new BehaviorSubject<boolean>(false);
	needUpdate$ = new BehaviorSubject<boolean>(false);

	// Enum for template use
	readonly pluginStatus = PluginStatus;
	readonly pluginType = PluginType;
	readonly pluginSourceType = PluginSourceType;
	readonly pluginScope = PluginScope;

	// Access observables
	hasAccess$: Observable<boolean>;
	canAssign$: Observable<boolean>;
	accessLevel$: Observable<PluginScope | undefined>;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly pluginElectronService: PluginElectronService,
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		private readonly translateService: TranslateService,
		private readonly toastrService: ToastrNotificationService,
		private readonly action: Actions,
		private readonly subscriptionService: PluginSubscriptionService,
		public readonly marketplaceQuery: PluginMarketplaceQuery,
		public readonly installationQuery: PluginInstallationQuery,
		public readonly versionQuery: PluginVersionQuery,
		public readonly sourceQuery: PluginSourceQuery,
		public readonly accessFacade: PluginSubscriptionAccessFacade
	) {}

	ngOnInit(): void {
		this.plugin$
			.pipe(
				filter(Boolean),
				distinctUntilChange(),
				tap((plugin) => {
					// Check access when plugin loads
					this.accessFacade.checkAccess(plugin.id);

					// Initialize access observables
					this.hasAccess$ = this.accessFacade.hasAccess$(plugin.id);
					this.canAssign$ = this.accessFacade.canAssign$(plugin.id);
					this.accessLevel$ = this.accessFacade.getAccessLevel$(plugin.id);
				}),
				concatMap((plugin) => {
					this.action.dispatch(PluginVersionActions.selectVersion(plugin.version));
					this.action.dispatch(PluginSourceActions.selectSource(plugin.source));
					return this.checkInstallation(plugin);
				}),
				catchError((error) => this.handleError(error)),
				takeUntil(this.destroy$)
			)
			.subscribe();
		this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
			this.action.dispatch(PluginVersionActions.setCurrentPluginId(params['id']));
			this.loadPlugin();
		});
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public loadPlugin(): void {
		this.action.dispatch(
			PluginMarketplaceActions.getOne(this.pluginId, {
				relations: ['versions', 'versions.sources', 'uploadedBy'],
				order: { versions: { releaseDate: 'DESC' } }
			})
		);
	}

	private async handleError(error: any): Promise<void> {
		this.toastrService.error(error);
		await this.router.navigate(['/settings/marketplace-plugins']);
	}

	async checkInstallation(plugin: IPlugin): Promise<void> {
		if (!plugin) return;

		try {
			const installed = await this.checkPlugin(plugin);
			this.installed$.next(!!installed);

			if (installed && plugin.versions) {
				this.needUpdate$.next(installed.version !== plugin.version.number);
			}
		} catch (error) {
			this.installed$.next(false);
		}
	}

	async checkPlugin(plugin: IPlugin): Promise<IPluginInstalled> {
		if (!plugin) return;
		try {
			return this.pluginElectronService.checkInstallation(plugin.id);
		} catch (error) {
			return null;
		}
	}

	// Utility methods with strong typing
	getSourceTypeLabel(type: PluginSourceType): string {
		const labels: Record<PluginSourceType, string> = {
			[PluginSourceType.CDN]: this.translateService.instant('PLUGIN.FORM.SOURCE_TYPES.CDN'),
			[PluginSourceType.NPM]: this.translateService.instant('PLUGIN.FORM.SOURCE_TYPES.NPM'),
			[PluginSourceType.GAUZY]: this.translateService.instant('PLUGIN.FORM.SOURCE_TYPES.GAUZY')
		};
		return labels[type] || type;
	}

	getStatusLabel(status: PluginStatus): string {
		return this.translateService.instant(`PLUGIN.FORM.STATUSES.${status}`);
	}

	getTypeLabel(type: PluginType): string {
		return this.translateService.instant(`PLUGIN.FORM.TYPES.${type}`);
	}

	getStatusBadgeStatus(status: PluginStatus): string {
		const statusMap: Record<PluginStatus, string> = {
			[PluginStatus.ACTIVE]: 'success',
			[PluginStatus.INACTIVE]: 'warning',
			[PluginStatus.DEPRECATED]: 'info',
			[PluginStatus.ARCHIVED]: 'danger'
		};
		return statusMap[status] || 'basic';
	}

	getPluginTypeBadgeStatus(type: PluginType): string {
		const typeMap: Record<PluginType, string> = {
			[PluginType.DESKTOP]: 'primary',
			[PluginType.WEB]: 'info',
			[PluginType.MOBILE]: 'success'
		};
		return typeMap[type] || 'basic';
	}

	getPluginSourceTypeBadgeStatus(type: PluginSourceType): string {
		const typeMap: Record<PluginSourceType, string> = {
			[PluginSourceType.GAUZY]: 'primary',
			[PluginSourceType.CDN]: 'info',
			[PluginSourceType.NPM]: 'danger'
		};
		return typeMap[type] || 'basic';
	}

	getAccessLevelLabel(level: PluginScope): string {
		const labels: Record<PluginScope, string> = {
			[PluginScope.USER]: this.translateService.instant('PLUGIN.ACCESS.USER_LEVEL'),
			[PluginScope.ORGANIZATION]: this.translateService.instant('PLUGIN.ACCESS.ORG_LEVEL'),
			[PluginScope.TENANT]: this.translateService.instant('PLUGIN.ACCESS.TENANT_LEVEL'),
			[PluginScope.GLOBAL]: this.translateService.instant('PLUGIN.ACCESS.GLOBAL_LEVEL')
		};
		return labels[level] || level;
	}

	getAccessLevelBadgeStatus(level: PluginScope): string {
		const statusMap: Record<PluginScope, string> = {
			[PluginScope.TENANT]: 'success',
			[PluginScope.ORGANIZATION]: 'info',
			[PluginScope.USER]: 'warning',
			[PluginScope.GLOBAL]: 'primary'
		};
		return statusMap[level] || 'basic';
	}

	showAssignUsersDialog(): void {
		if (!this.pluginId) return;
		this.accessFacade.showAssignmentDialog(this.pluginId);
	}

	getSourceDetails(plugin: IPlugin): string {
		switch (plugin.source.type) {
			case PluginSourceType.CDN:
				return (plugin.source as ICDNSource).url;
			case PluginSourceType.NPM:
				const npmSource = plugin.source as INPMSource;
				return `${npmSource.scope ? npmSource.scope + '/' : ''}${npmSource.name}@${plugin.version.number}`;
			case PluginSourceType.GAUZY:
				return (
					(plugin.source as IGauzySource).url || this.translateService.instant('PLUGIN.DETAILS.UPLOADED_FILE')
				);
			default:
				return this.translateService.instant('PLUGIN.DETAILS.UNKNOWN_SOURCE');
		}
	}

	async updatePluginStatus(status: PluginStatus): Promise<void> {
		if (!this.pluginId || !this.isOwner) return;
		this.action.dispatch(PluginMarketplaceActions.update(this.pluginId, { status }));
	}

	navigateToEdit(): void {
		if (!this.plugin) return;

		this.dialogService
			.open(PluginMarketplaceUploadComponent, {
				backdropClass: 'backdrop-blur',
				context: { plugin: this.plugin }
			})
			.onClose.pipe(
				filter(Boolean),
				tap((plugin: IPlugin) => {
					this.action.dispatch(
						PluginInstallationActions.toggle({ isChecked: this.isInstalled, plugin: this.plugin })
					);
					this.action.dispatch(PluginMarketplaceActions.update(this.pluginId, plugin));
				}),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	navigateBack(): void {
		this.router.navigate(['/settings/marketplace-plugins']);
	}

	navigateToHistory(): void {
		this.router.navigate(['settings', 'marketplace-plugins', this.pluginId, 'versions']);
	}

	formatDate(date: Date | string | null): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleString();
	}

	public get isOwner(): boolean {
		return !!this.store.user && this.store.user?.id === this.plugin?.uploadedBy?.id;
	}

	updatePlugin(): void {
		this.installPlugin(true);
	}

	public async uninstallPlugin(): Promise<void> {
		this.dialogService
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
			.onClose.pipe(
				take(1),
				filter(Boolean),
				concatMap(() => this.checkPlugin(this.plugin)),
				filter(Boolean),
				tap((plugin) => {
					this.action.dispatch(PluginInstallationActions.toggle({ isChecked: false, plugin: this.plugin }));
					this.action.dispatch(PluginInstallationActions.uninstall(plugin));
				})
			)
			.subscribe();
	}

	public installPlugin(isUpdate = false): void {
		// Use the facade pattern and chain of responsibility for cleaner validation
		import('../services/installation-validation-chain.builder').then(({ InstallationValidationChainBuilder }) => {
			// Note: This is a temporary inline approach for demonstration
			// In production, inject InstallationValidationChainBuilder in constructor

			// For now, keep the existing working logic but with better structure
			if (this.plugin.hasPlan) {
				// For plugins with subscription plans, verify access first
				if (isUpdate) {
					this.handleUpdateWithSubscription(isUpdate);
				} else {
					this.handleNewInstallationWithSubscription(isUpdate);
				}
			} else {
				// Plugin doesn't require subscription - install directly
				this.proceedWithInstallationValidation(isUpdate);
			}
		});
	}

	/**
	 * Handles update installation for plugins with subscriptions
	 * Follows Single Responsibility Principle
	 */
	private handleUpdateWithSubscription(isUpdate: boolean): void {
		this.hasAccess$
			.pipe(
				take(1),
				tap((hasAccess) => {
					if (hasAccess) {
						this.proceedWithInstallationValidation(isUpdate);
					} else {
						this.toastrService.warn(
							this.translateService.instant('PLUGIN.SUBSCRIPTION.RESUBSCRIBE_REQUIRED')
						);
						this.showSubscriptionSelectionDialog()
							.pipe(
								filter((result) => !!result?.proceedWithInstallation),
								tap(() => this.proceedWithInstallationValidation(isUpdate))
							)
							.subscribe();
					}
				})
			)
			.subscribe();
	}

	/**
	 * Handles new installation for plugins with subscriptions
	 * Follows Single Responsibility Principle
	 */
	private handleNewInstallationWithSubscription(isUpdate: boolean): void {
		this.hasAccess$
			.pipe(
				take(1),
				switchMap((hasAccess) => {
					if (hasAccess) {
						// User has active subscription
						this.proceedWithInstallationValidation(isUpdate);
						return EMPTY;
					}

					// No subscription - must subscribe first
					this.toastrService.info(
						this.translateService.instant('PLUGIN.SUBSCRIPTION.REQUIRED_FOR_INSTALLATION')
					);

					return this.showSubscriptionSelectionDialog().pipe(
						filter((result) => !!result?.proceedWithInstallation),
						switchMap(() => this.hasAccess$.pipe(take(1))),
						tap((hasAccessNow) => {
							if (hasAccessNow) {
								this.proceedWithInstallationValidation(isUpdate);
							} else {
								this.toastrService.error(
									this.translateService.instant('PLUGIN.SUBSCRIPTION.ACCESS_NOT_GRANTED')
								);
							}
						})
					);
				}),
				catchError((error) => {
					console.error('[InstallPlugin] Error during installation:', error);
					this.toastrService.error(this.translateService.instant('PLUGIN.INSTALLATION.ERROR'));
					return EMPTY;
				})
			)
			.subscribe();
	}

	private async checkSubscriptionRequirement(): Promise<boolean> {
		if (!this.plugin) {
			return false;
		}

		// Use the computed hasPlan property to check if subscription is required
		return this.plugin.hasPlan;
	}

	private showSubscriptionSelectionDialog(): Observable<{ proceedWithInstallation: boolean }> {
		return this.dialogService.open(PluginSubscriptionSelectionComponent, {
			context: {
				plugin: this.plugin,
				pluginId: this.pluginId
			},
			backdropClass: 'backdrop-blur',
			closeOnEsc: false
		}).onClose;
	}

	private proceedWithInstallationValidation(isUpdate = false): void {
		// Final access verification before proceeding with installation
		// This ensures subscription status hasn't changed between checks
		if (this.plugin.hasPlan) {
			this.hasAccess$
				.pipe(
					take(1),
					tap((hasAccess) => {
						if (!hasAccess) {
							// Access was revoked or subscription expired
							this.toastrService.error(
								this.translateService.instant('PLUGIN.SUBSCRIPTION.ACCESS_REVOKED')
							);
							return;
						}
						// Access confirmed, proceed with installation validation
						this.openInstallationValidationDialog(isUpdate);
					})
				)
				.subscribe();
		} else {
			// No subscription required, proceed directly
			this.openInstallationValidationDialog(isUpdate);
		}
	}

	private openInstallationValidationDialog(isUpdate = false): void {
		this.dialogService
			.open(DialogInstallationValidationComponent, {
				context: {
					pluginId: this.pluginId
				},
				backdropClass: 'backdrop-blur'
			})
			.onClose.pipe(
				take(1),
				filter(Boolean),
				tap(({ version, source, authToken }) =>
					this.preparePluginInstallation(version, source, isUpdate, authToken)
				)
			)
			.subscribe();
	}

	preparePluginInstallation(
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
						marketplaceId: this.pluginId,
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
						marketplaceId: this.pluginId,
						versionId: version.id
					})
				);
				break;
			default:
				break;
		}
	}

	public get selectedVersionNumber(): string {
		return this.selectedVersion.number;
	}

	public addVersion(): void {
		if (!this.plugin || !this.isOwner || !this.pluginId) return;

		this.dialogService
			.open(DialogCreateVersionComponent, {
				backdropClass: 'backdrop-blur',
				context: { plugin: this.plugin }
			})
			.onClose.pipe(
				filter(Boolean),
				tap((version: IPluginVersion) => {
					this.action.dispatch(
						PluginInstallationActions.toggle({ isChecked: this.isInstalled, plugin: this.plugin })
					);
					this.action.dispatch(PluginVersionActions.add(this.pluginId, version));
				}),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	public addSource(): void {
		this.dialogService
			.open(DialogCreateSourceComponent, {
				backdropClass: 'backdrop-blur',
				context: { plugin: this.plugin, version: this.selectedVersion }
			})
			.onClose.pipe(
				filter(Boolean),
				tap(({ pluginId, versionId, sources }) => {
					this.action.dispatch(PluginSourceActions.add(pluginId, versionId, sources));
				}),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	public delete(): void {
		this.dialogService
			.open(AlertComponent, {
				context: {
					data: {
						message: 'PLUGIN.DIALOG.DELETE.DESCRIPTION',
						title: 'PLUGIN.DIALOG.DELETE.TITLE',
						confirmText: 'PLUGIN.DIALOG.DELETE.CONFIRM',
						status: 'Danger'
					}
				}
			})
			.onClose.pipe(
				take(1),
				filter(Boolean),
				tap(() => {
					this.action.dispatch(
						PluginInstallationActions.toggle({ isChecked: this.isInstalled, plugin: this.plugin })
					);
					this.action.dispatch(PluginMarketplaceActions.delete(this.pluginId));
				})
			)
			.subscribe();
	}

	public get plugin$(): Observable<IPlugin> {
		return this.marketplaceQuery.plugin$;
	}

	private get plugin(): IPlugin {
		return this.marketplaceQuery.plugin;
	}

	public get pluginId(): string {
		return this.versionQuery.pluginId;
	}

	private get isInstalled(): boolean {
		return this.installed$.value;
	}

	private get selectedVersion(): IPluginVersion {
		return this.versionQuery.version;
	}
}
