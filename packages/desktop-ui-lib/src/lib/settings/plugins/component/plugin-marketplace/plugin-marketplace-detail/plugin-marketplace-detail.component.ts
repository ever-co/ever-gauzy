import { ChangeDetectionStrategy, Component, inject, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IPlugin, PluginStatus, PluginSubscriptionType } from '@gauzy/contracts';
import { NbMenuItem, NbMenuService, NbBadgeModule, NbTooltipModule, NbIconModule, NbButtonModule, NbContextMenuModule, NbToggleModule } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { filter, tap } from 'rxjs';
import { PluginSettingsActions, PluginSubscriptionActions } from '../+state';
import { PluginInstallationActions } from '../+state/actions/plugin-installation.action';
import { PluginMarketplaceActions } from '../+state/actions/plugin-marketplace.action';
import { PluginToggleActions } from '../+state/actions/plugin-toggle.action';
import { PluginUserAssignmentActions } from '../+state/actions/plugin-user-assignment.actions';
import { PluginVersionActions } from '../+state/actions/plugin-version.action';
import { PluginInstallationQuery } from '../+state/queries/plugin-installation.query';
import { PluginMarketplaceQuery } from '../+state/queries/plugin-marketplace.query';
import { PluginToggleQuery } from '../+state/queries/plugin-toggle.query';
import { Store } from '../../../../../services';
import { PluginEnvironmentService } from '../../../services/plugin-environment.service';
import { PluginMarketplaceUtilsService } from '../plugin-marketplace-utils.service';
import { DesktopDirectiveModule } from '../../../../../directives/desktop-directive.module';
import { AsyncPipe, DecimalPipe, TitleCasePipe, CurrencyPipe, DatePipe } from '@angular/common';

@UntilDestroy()
@Component({
    selector: 'lib-plugin-marketplace-detail',
    templateUrl: './plugin-marketplace-detail.component.html',
    styleUrls: ['./plugin-marketplace-detail.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NbBadgeModule, NbTooltipModule, NbIconModule, DesktopDirectiveModule, NbButtonModule, NbContextMenuModule, NbToggleModule, AsyncPipe, DecimalPipe, TitleCasePipe, CurrencyPipe, DatePipe, TranslatePipe]
})
export class PluginMarketplaceDetailComponent implements OnInit {
	@Input()
	public plugin: IPlugin;

	@Input()
	public viewMode: 'grid' | 'list' = 'grid';

	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly action = inject(Actions);
	private readonly translate = inject(TranslateService);

	constructor(
		private readonly utils: PluginMarketplaceUtilsService,
		private readonly store: Store,
		private readonly menuService: NbMenuService,
		public readonly marketplaceQuery: PluginMarketplaceQuery,
		public readonly installationQuery: PluginInstallationQuery,
		public readonly toggleQuery: PluginToggleQuery,
		private readonly environmentService: PluginEnvironmentService
	) {}

	ngOnInit(): void {
		// Listen to context menu item clicks
		this.menuService
			.onItemClick()
			.pipe(
				filter(({ tag }) => tag === `plugin-more-actions-${this.plugin.id}`),
				tap(({ item }) => this.onContextMenuItemSelect(item)),
				untilDestroyed(this)
			)
			.subscribe();

		this.installationQuery
			.installed$(this.plugin.id)
			.pipe(
				tap((enabled) =>
					this.action.dispatch(PluginToggleActions.toggle({ pluginId: this.plugin.id, enabled }))
				),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public togglePlugin(checked: boolean): void {
		if (checked) {
			this.installPlugin();
		} else {
			this.uninstallPlugin();
		}
	}

	public installPlugin(): void {
		// Installation orchestration moved to effects; dispatch install intent
		this.action.dispatch(PluginMarketplaceActions.install(this.plugin));
	}

	// Installation validation and dialog orchestration moved to effects.
	public async openPlugin(): Promise<void> {
		this.action.dispatch(PluginVersionActions.selectVersion(this.plugin.version));
		await this.router.navigate([this.plugin.id], { relativeTo: this.route });
	}

	public editPlugin(): void {
		this.action.dispatch(PluginMarketplaceActions.update(this.plugin));
	}

	private uninstallPlugin(): void {
		this.action.dispatch(PluginInstallationActions.uninstall(this.plugin.id));
	}

	public get isOwner(): boolean {
		return !!this.store.user && !!this.plugin && this.store.user.id === this.plugin.uploadedById;
	}

	/**
	 * Get the color status for plugin status badge
	 */
	public getStatusColor(status: PluginStatus): string {
		return this.utils.getStatusBadgeStatus(status);
	}

	/**
	 * Get the appropriate icon for subscription type
	 */
	public getSubscriptionIcon(type: PluginSubscriptionType): string {
		return this.utils.getSubscriptionIcon(type);
	}

	/**
	 * Open plugin settings dialog
	 */
	public openSettings(): void {
		this.action.dispatch(PluginSettingsActions.openSettings({ plugin: this.plugin }));
	}

	/**
	 * Open subscription manager dialog (alternative to plan selection)
	 */
	public manageSubscription(): void {
		this.action.dispatch(PluginSubscriptionActions.openSubscriptionManagement(this.plugin, true));
	}

	/**
	 * Open subscription hierarchy view (admin feature)
	 */
	public viewSubscriptionHierarchy(): void {
		this.action.dispatch(PluginSubscriptionActions.openHierarchySubscriptions(this.plugin));
	}

	/**
	 * Open user assignment dialog
	 */
	public manageUsers(): void {
		this.action.dispatch(PluginUserAssignmentActions.manageUsers({ plugin: this.plugin }));
	}

	/**
	 * Get context menu items for more actions
	 */
	public getContextMenuItems(): NbMenuItem[] {
		// Return empty array if plugin is not available
		if (!this.plugin) {
			return [];
		}

		// Construct absolute path from activated route
		const baseRoute = this.router.createUrlTree(['./'], { relativeTo: this.route }).toString();

		// Get items
		const items: NbMenuItem[] = [
			{
				title: this.translate.instant('PLUGIN.ACTIONS.VIEW_DETAILS'),
				icon: 'eye-outline',
				link: `${baseRoute}/${this.plugin.id}`
			}
		];

		// Add plugin management options if installed
		if (this.plugin.installed && this.isOwner) {
			items.push({
				title: this.translate.instant('PLUGIN.ACTIONS.SETTINGS'),
				icon: 'settings-outline',
				data: { action: 'settings' }
			});

			// Add subscription management for plugins with plans
			if (this.plugin.hasPlan) {
				items.push({
					title: this.translate.instant('PLUGIN.ACTIONS.MANAGE_SUBSCRIPTION'),
					icon: 'credit-card-outline',
					data: { action: 'manage-subscription' }
				});
				// Only show user management for plugins with plans (subscription-based)
				items.push({
					title: this.translate.instant('PLUGIN.ACTIONS.MANAGE_USERS'),
					icon: 'people-outline',
					data: { action: 'manage-users' }
				});
			}
		}

		// Add external links
		if (this.plugin.homepage) {
			items.push({
				title: this.translate.instant('PLUGIN.ACTIONS.HOMEPAGE'),
				icon: 'external-link-outline',
				data: { action: 'homepage', url: this.plugin.homepage }
			});
		}

		if (this.plugin.repository) {
			items.push({
				title: this.translate.instant('PLUGIN.ACTIONS.REPOSITORY'),
				icon: 'github-outline',
				data: { action: 'repository', url: this.plugin.repository }
			});
		}

		// Add owner-specific actions
		if (this.isOwner) {
			items.push(
				{
					title: this.translate.instant('PLUGIN.ACTIONS.EDIT'),
					icon: 'edit-outline',
					data: { action: 'edit' }
				},
				{
					title: this.translate.instant('PLUGIN.ACTIONS.DELETE'),
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
			case 'manage-subscription':
				this.manageSubscription();
				break;
			case 'view-subscription-hierarchy':
				this.viewSubscriptionHierarchy();
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
		this.action.dispatch(PluginMarketplaceActions.delete(this.plugin.id));
	}
	/**
	 * Check if the plugin can be installed in the current environment
	 */
	public canInstallInEnvironment(): boolean {
		return this.environmentService.canInstallPlugin(this.plugin);
	}

	/**
	 * Get the environment mismatch tooltip message
	 */
	public getEnvironmentMismatchTooltip(): string {
		return this.environmentService.getEnvironmentMismatchWarning(this.plugin);
	}
}
