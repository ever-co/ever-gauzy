import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	ID,
	IPlugin,
	IPluginSubscription,
	PluginScope,
	PluginSourceType,
	PluginStatus,
	PluginType
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { NbRouteTab } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, Observable, Subject, tap } from 'rxjs';
import { catchError, filter, map, takeUntil } from 'rxjs/operators';
import { PluginSubscriptionActions, PluginSubscriptionQuery } from '../+state';
import { PluginInstallationActions } from '../+state/actions/plugin-installation.action';
import { PluginMarketplaceActions } from '../+state/actions/plugin-marketplace.action';
import { PluginSourceActions } from '../+state/actions/plugin-source.action';
import { PluginVersionActions } from '../+state/actions/plugin-version.action';
import { PluginSubscriptionAccessFacade } from '../+state/plugin-subscription-access.facade';
import { PluginInstallationQuery } from '../+state/queries/plugin-installation.query';
import { PluginMarketplaceQuery } from '../+state/queries/plugin-marketplace.query';
import { PluginSourceQuery } from '../+state/queries/plugin-source.query';
import { PluginVersionQuery } from '../+state/queries/plugin-version.query';
import { PluginQuery } from '../../+state/plugin.query';
import { Store, ToastrNotificationService } from '../../../../../services';
import { PluginMarketplaceUtilsService } from '../plugin-marketplace-utils.service';
// Installation and subscription side-effects moved to effects

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
	private readonly action = inject(Actions);

	constructor(
		private readonly store: Store,
		private readonly translateService: TranslateService,
		private readonly toastrService: ToastrNotificationService,
		public readonly marketplaceQuery: PluginMarketplaceQuery,
		public readonly installationQuery: PluginInstallationQuery,
		public readonly pluginQuery: PluginQuery,
		public readonly versionQuery: PluginVersionQuery,
		public readonly sourceQuery: PluginSourceQuery,
		public readonly subscriptionQuery: PluginSubscriptionQuery,
		public readonly accessFacade: PluginSubscriptionAccessFacade,
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
				relations: ['versions', 'versions.sources', 'uploadedBy', 'subscriptions', 'subscriptions.plan'],
				order: { versions: { releaseDate: 'DESC' } }
			})
		);
	}

	private async handleError(error: any): Promise<void> {
		this.toastrService.error(error);
		await this.router.navigate(['/settings/marketplace-plugins']);
	}

	// Delegate utility methods to PluginMarketplaceUtilsService
	public getSourceTypeLabel(type: PluginSourceType): string {
		return this.utils.getSourceTypeLabel(type);
	}

	public getStatusLabel(status: PluginStatus): string {
		return this.utils.getStatusLabel(status);
	}

	public getTypeLabel(type: PluginType): string {
		return this.utils.getTypeLabel(type);
	}

	public getStatusBadgeStatus(status: PluginStatus): string {
		return this.utils.getStatusBadgeStatus(status);
	}

	getPluginTypeBadgeStatus(type: PluginType): string {
		return this.utils.getPluginTypeBadgeStatus(type);
	}

	public getPluginSourceTypeBadgeStatus(type: PluginSourceType): string {
		return this.utils.getPluginSourceTypeBadgeStatus(type);
	}

	getAccessLevelLabel(level: PluginScope): string {
		return this.utils.getAccessLevelLabel(level);
	}

	public getAccessLevelBadgeStatus(level: PluginScope): string {
		return this.utils.getAccessLevelBadgeStatus(level);
	}

	public showAssignUsersDialog(): void {
		if (!this.pluginId) return;
		this.accessFacade.showAssignmentDialog(this.pluginId);
	}

	public getSourceDetails(plugin: IPlugin): string {
		return this.utils.getSourceDetails(plugin);
	}

	public async updatePluginStatus(status: PluginStatus): Promise<void> {
		if (!this.pluginId || !this.isOwner) return;
		this.action.dispatch(PluginMarketplaceActions.update({ ...this.plugin, status }));
	}

	public navigateToEdit(): void {
		this.action.dispatch(PluginMarketplaceActions.update(this.plugin));
	}

	public async navigateBack(): Promise<void> {
		await this.router.navigate(['settings', 'marketplace-plugins']);
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

	public formatDate(date: Date | string | null): string {
		return this.utils.formatDate(date);
	}

	public get isOwner(): boolean {
		return !!this.store.user && this.store.user?.id === this.plugin?.uploadedBy?.id;
	}

	public installUpdate(): void {
		// Trigger install update flow via actions/effects
		this.action.dispatch(PluginMarketplaceActions.installUpdate(this.plugin));
	}

	public async uninstallPlugin(): Promise<void> {
		this.action.dispatch(PluginInstallationActions.uninstall(this.pluginId));
	}

	public installPlugin(): void {
		// Trigger the install flow via actions; effects will handle dialogs/validation
		this.action.dispatch(PluginMarketplaceActions.install(this.plugin));
	}

	/**
	 * Alternative subscription management dialog (simpler UI)
	 * NOTE: Subscription management is handled via effects; components should dispatch actions.
	 */
	public manageSubscription(): void {
		// Dispatch an action or use facade to open/manage subscriptions via effects
		this.action.dispatch(PluginSubscriptionActions.openSubscriptionManagement(this.plugin, true));
	}

	/**
	 * Get current subscription
	 */
	public get currentSubscription$(): Observable<IPluginSubscription> {
		return this.accessFacade.getPluginAccess$(this.pluginId).pipe(map((access) => access?.subscription));
	}

	/**
	 * Check if plugin has subscription to show hierarchy button
	 */
	public get hasSubscription$(): Observable<boolean> {
		return this.accessFacade
			.getPluginAccess$(this.pluginId)
			.pipe(map((plugin) => plugin && plugin.hasAccess && !!plugin.subscription));
	}

	/**
	 * View subscription hierarchy (admin feature) — route through actions/effects
	 */
	public viewSubscription(): void {
		this.action.dispatch(PluginSubscriptionActions.openSubscriptionManagement(this.plugin));
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

	public get installedVersionId$(): Observable<ID> {
		return this.pluginQuery.currentPluginVersionId(this.pluginId);
	}
}
