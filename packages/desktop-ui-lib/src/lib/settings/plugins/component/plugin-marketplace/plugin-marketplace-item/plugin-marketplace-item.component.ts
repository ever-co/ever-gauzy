import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	IPlugin,
	IPluginSource,
	IPluginVersion,
	PluginScope,
	PluginSourceType,
	PluginStatus,
	PluginType
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { NbDialogService, NbRouteTab } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, EMPTY, Observable, Subject, tap } from 'rxjs';
import { catchError, filter, map, switchMap, take, takeUntil } from 'rxjs/operators';
import { PluginSubscriptionQuery } from '../+state';
import { PluginInstallationActions } from '../+state/actions/plugin-installation.action';
import { PluginMarketplaceActions } from '../+state/actions/plugin-marketplace.action';
import { PluginSourceActions } from '../+state/actions/plugin-source.action';
import { PluginVersionActions } from '../+state/actions/plugin-version.action';
import { PluginSubscriptionAccessFacade } from '../+state/plugin-subscription-access.facade';
import { PluginInstallationQuery } from '../+state/queries/plugin-installation.query';
import { PluginMarketplaceQuery } from '../+state/queries/plugin-marketplace.query';
import { PluginSourceQuery } from '../+state/queries/plugin-source.query';
import { PluginVersionQuery } from '../+state/queries/plugin-version.query';
import { Store, ToastrNotificationService } from '../../../../../services';
import { PluginMarketplaceUtilsService } from '../plugin-marketplace-utils.service';
import { PluginSubscriptionHierarchyComponent } from '../plugin-subscription-hierarchy/plugin-subscription-hierarchy.component';
import { PluginSubscriptionManagerComponent } from '../plugin-subscription-manager/plugin-subscription-manager.component';
import { InstallationValidationChainBuilder } from '../services';
import { SubscriptionDialogRouterService } from '../services/subscription-dialog-router.service';
import { SubscriptionStatusService } from '../shared';
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

	// Enum for template use
	readonly pluginStatus = PluginStatus;
	readonly pluginType = PluginType;
	readonly pluginSourceType = PluginSourceType;
	readonly pluginScope = PluginScope;

	// Access observables
	hasAccess$: Observable<boolean>;
	canAssign$: Observable<boolean>;
	canConfigure$: Observable<boolean>;
	accessLevel$: Observable<PluginScope | undefined>;

	// Tabs configuration
	tabs$: Observable<NbRouteTab[]>;

	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);

	constructor(
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		private readonly translateService: TranslateService,
		private readonly toastrService: ToastrNotificationService,
		private readonly action: Actions,
		private readonly installationValidationChainBuilder: InstallationValidationChainBuilder,
		private readonly subscriptionQuery: PluginSubscriptionQuery,
		private readonly subscriptionDialogRouter: SubscriptionDialogRouterService,
		public readonly marketplaceQuery: PluginMarketplaceQuery,
		public readonly installationQuery: PluginInstallationQuery,
		public readonly versionQuery: PluginVersionQuery,
		public readonly sourceQuery: PluginSourceQuery,
		public readonly accessFacade: PluginSubscriptionAccessFacade,
		public readonly statusService: SubscriptionStatusService,
		private readonly utils: PluginMarketplaceUtilsService
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
					this.canConfigure$ = this.accessFacade.hasAccess$(plugin.id); // Using hasAccess for now
					this.accessLevel$ = this.accessFacade.getAccessLevel$(plugin.id);

					// Build tabs based on permissions
					this.tabs$ = this.buildTabs$();
				}),
				tap((plugin) => {
					this.action.dispatch(PluginVersionActions.selectVersion(plugin.version));
					this.action.dispatch(PluginSourceActions.selectSource(plugin.source));
					this.action.dispatch(PluginInstallationActions.check(plugin.id));
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
				relations: ['versions', 'versions.sources', 'uploadedBy', 'subscriptions'],
				order: { versions: { releaseDate: 'DESC' } }
			})
		);
	}

	private async handleError(error: any): Promise<void> {
		this.toastrService.error(error);
		await this.router.navigate(['/settings/marketplace-plugins']);
	}

	// Delegate utility methods to PluginMarketplaceUtilsService
	getSourceTypeLabel(type: PluginSourceType): string {
		return this.utils.getSourceTypeLabel(type);
	}

	getStatusLabel(status: PluginStatus): string {
		return this.utils.getStatusLabel(status);
	}

	getTypeLabel(type: PluginType): string {
		return this.utils.getTypeLabel(type);
	}

	getStatusBadgeStatus(status: PluginStatus): string {
		return this.utils.getStatusBadgeStatus(status);
	}

	getPluginTypeBadgeStatus(type: PluginType): string {
		return this.utils.getPluginTypeBadgeStatus(type);
	}

	getPluginSourceTypeBadgeStatus(type: PluginSourceType): string {
		return this.utils.getPluginSourceTypeBadgeStatus(type);
	}

	getAccessLevelLabel(level: PluginScope): string {
		return this.utils.getAccessLevelLabel(level);
	}

	getAccessLevelBadgeStatus(level: PluginScope): string {
		return this.utils.getAccessLevelBadgeStatus(level);
	}

	showAssignUsersDialog(): void {
		if (!this.pluginId) return;
		// TODO: Create actions and effects for showing assignment dialog
		this.accessFacade.showAssignmentDialog(this.pluginId);
	}

	getSourceDetails(plugin: IPlugin): string {
		return this.utils.getSourceDetails(plugin);
	}

	async updatePluginStatus(status: PluginStatus): Promise<void> {
		if (!this.pluginId || !this.isOwner) return;
		this.action.dispatch(PluginMarketplaceActions.update({ ...this.plugin, status }));
	}

	navigateToEdit(): void {
		this.action.dispatch(PluginMarketplaceActions.update(this.plugin));
	}

	public async navigateBack(): Promise<void> {
		await this.router.navigate(['/settings/marketplace-plugins']);
	}

	public async navigateToHistory(): Promise<void> {
		await this.router.navigate(['settings', 'marketplace-plugins', this.pluginId, 'versions']);
	}

	/**
	 * Build tabs array dynamically based on user permissions
	 * Uses combineLatest for better performance and cleaner logic
	 */
	private buildTabs$(): Observable<NbRouteTab[]> {
		const baseTabs: NbRouteTab[] = [
			{
				title: this.translateService.instant('PLUGIN.DETAILS.OVERVIEW'),
				icon: 'info-outline',
				route: './overview',
				responsive: true
			},
			{
				title: this.translateService.instant('PLUGIN.DETAILS.SOURCE_CODE'),
				icon: 'code-outline',
				route: './source-code',
				responsive: true
			}
		];

		// Use combineLatest to efficiently combine multiple observables
		return combineLatest([this.canConfigure$, this.canAssign$]).pipe(
			map(([canConfigure, canAssign]) => {
				const tabs = [...baseTabs];

				// Add settings tab if user can configure
				if (canConfigure) {
					tabs.push({
						title: this.translateService.instant('PLUGIN.DETAILS.SETTINGS'),
						icon: 'settings-outline',
						route: './settings',
						responsive: true
					});
				}

				// Add user management tab if user can assign
				if (canAssign) {
					tabs.push({
						title: this.translateService.instant('PLUGIN.DETAILS.USER_MANAGEMENT'),
						icon: 'people-outline',
						route: './user-management',
						responsive: true
					});
				}

				return tabs;
			})
		);
	}

	formatDate(date: Date | string | null): string {
		return this.utils.formatDate(date);
	}

	public get isOwner(): boolean {
		return !!this.store.user && this.store.user?.id === this.plugin?.uploadedBy?.id;
	}

	updatePlugin(): void {
		// TODO: Create actions and effects for updating plugin
		this.installPlugin(true);
	}

	public async uninstallPlugin(): Promise<void> {
		this.action.dispatch(PluginInstallationActions.uninstall(this.pluginId));
	}

	public installPlugin(isUpdate = false): void {
		// Use the facade pattern and chain of responsibility for cleaner validation
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

	/**
	 * Show appropriate subscription dialog based on user's current subscription status.
	 * Users with active subscriptions are routed to PluginSubscriptionManager.
	 * Users without active subscriptions are routed to PluginSubscriptionPlanSelection.
	 */
	private showSubscriptionSelectionDialog(): Observable<{ proceedWithInstallation: boolean }> {
		return this.subscriptionDialogRouter.openSubscriptionDialog(this.plugin);
	}

	/**
	 * Alternative subscription management dialog (simpler UI)
	 */
	public manageSubscription(): void {
		this.dialogService
			.open(PluginSubscriptionManagerComponent, {
				backdropClass: 'backdrop-blur',
				closeOnEsc: false,
				context: {
					plugin: this.plugin,
					currentSubscription: (this.plugin?.subscription as any) || null
				}
			})
			.onClose.pipe(
				filter(Boolean),
				tap((result) => {
					console.log('Subscription updated:', result);
					this.loadPlugin();
				}),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	/**
	 * Check if plugin has subscription to show hierarchy button
	 */
	public get hasSubscription$(): Observable<boolean> {
		return this.subscriptionQuery.hasActiveSubscriptionForPlugin(this.pluginId);
	}

	/**
	 * View subscription hierarchy (admin feature)
	 */
	public viewSubscriptionHierarchy(): void {
		this.dialogService
			.open(PluginSubscriptionHierarchyComponent, {
				backdropClass: 'backdrop-blur',
				context: {
					subscriptions: this.subscriptionQuery.subscriptions || [],
					showActions: true
				}
			})
			.onClose.pipe(takeUntil(this.destroy$))
			.subscribe();
	}

	private proceedWithInstallationValidation(isUpdate = false): void {
		// Run validation chain before proceeding with installation
		this.installationValidationChainBuilder
			.validate(this.plugin, isUpdate)
			.pipe(
				take(1),
				tap((context) => {
					// Check for validation errors
					if (context.errors.length > 0) {
						// Show all errors
						context.errors.forEach((error) => {
							this.toastrService.error(this.translateService.instant(error));
						});
						// Reset installation toggle
						this.action.dispatch(
							PluginInstallationActions.toggle({ isChecked: false, pluginId: this.plugin.id })
						);
						return;
					}

					// Show warnings if any
					if (context.warnings.length > 0) {
						context.warnings.forEach((warning) => {
							this.toastrService.warn(this.translateService.instant(warning));
						});
					}

					// Validation passed, proceed with installation dialog
					this.openInstallationValidationDialog(isUpdate);
				}),
				catchError((error) => {
					console.error('[InstallationValidation] Validation chain error:', error);
					this.toastrService.error(this.translateService.instant('PLUGIN.INSTALLATION.VALIDATION_ERROR'));
					this.action.dispatch(
						PluginInstallationActions.toggle({ isChecked: false, pluginId: this.plugin.id })
					);
					return EMPTY;
				})
			)
			.subscribe();
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
		this.action.dispatch(PluginInstallationActions.toggle({ isChecked: true, pluginId: this.plugin.id }));
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
		this.action.dispatch(PluginVersionActions.add(this.plugin));
	}

	public addSource(): void {
		this.action.dispatch(PluginSourceActions.add(this.plugin));
	}

	public delete(): void {
		this.action.dispatch(PluginMarketplaceActions.delete(this.pluginId));
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

	private get selectedVersion(): IPluginVersion {
		return this.versionQuery.version;
	}
}
