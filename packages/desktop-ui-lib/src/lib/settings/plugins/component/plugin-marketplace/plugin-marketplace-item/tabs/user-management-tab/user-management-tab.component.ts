import { AsyncPipe } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { IPlugin } from '@gauzy/contracts';
import { NbAlertModule, NbBadgeModule, NbButtonModule, NbIconModule, NbSpinnerModule, NbToggleModule, NbTooltipModule } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslatePipe } from '@ngx-translate/core';
import { Angular2SmartTableModule, LocalDataSource } from 'angular2-smart-table';
import { distinctUntilChanged, filter, Observable, take, tap } from 'rxjs';
import {
	PluginUserAssignmentFacade,
	UserManagementViewModel
} from '../../../+state/facades/plugin-user-assignment.facade';
import { PluginSubscriptionAccessFacade } from '../../../+state/plugin-subscription-access.facade';
import { PluginMarketplaceQuery } from '../../../+state/queries/plugin-marketplace.query';
import { PluginUserAssignment } from '../../../+state/stores/plugin-user-assignment.store';
import { PaginationComponent } from '../../../../../../../time-tracker/pagination/pagination.component';
import { PluginAssignedUsersTableService } from '../../../plugin-user-management/services/plugin-assigned-users-table.service';

/**
 * User Management Tab Component
 *
 * Smart Component responsible for:
 * - Managing plugin user assignments
 * - Displaying assigned users
 * - Handling user assignment/unassignment operations
 *
 * Architecture:
 * - Uses OnPush change detection for optimal performance
 * - Leverages Facade pattern for business logic
 * - Implements reactive programming with RxJS
 * - Follows Single Responsibility Principle
 *
 * State Management:
 * - All state operations delegated to PluginUserAssignmentFacade
 * - Uses observables for reactive data flow
 * - No manual subscriptions (UntilDestroy handles cleanup)
 *
 * @example
 * <gauzy-plugin-user-management-tab></gauzy-plugin-user-management-tab>
 */
@UntilDestroy()
@Component({
    selector: 'gauzy-plugin-user-management-tab',
    templateUrl: './user-management-tab.component.html',
    styleUrls: ['./user-management-tab.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
		NbIconModule, NbButtonModule, NbAlertModule, NbSpinnerModule, NbBadgeModule, NbTooltipModule, NbToggleModule,
		Angular2SmartTableModule, PaginationComponent,
		AsyncPipe, TranslatePipe
	]
})
export class UserManagementTabComponent implements OnInit, AfterViewInit, OnDestroy {
	// ============================================================================
	// PUBLIC OBSERVABLES - Exposed to template
	// ============================================================================

	/**
	 * Current plugin being managed
	 */
	readonly plugin$: Observable<IPlugin | null>;

	/**
	 * Complete view model containing all UI state
	 * Combines assignments, loading, error, and computed values
	 */
	readonly viewModel$: Observable<UserManagementViewModel>;

	/**
	 * Permission check for assigning users
	 */
	canAssign$: Observable<boolean>;

	/**
	 * Active users count for stats display
	 */
	readonly activeUsersCount$: Observable<number>;

	/**
	 * Loading state
	 */
	readonly loading$: Observable<boolean>;

	/**
	 * Error state
	 */
	readonly error$: Observable<string | null>;

	/**
	 * Assigned users list
	 */
	readonly assignedUsers$: Observable<PluginUserAssignment[]>;

	// Smart table
	public readonly assignedUsersSource = new LocalDataSource([]);
	public assignedUsersSettings: any;

	// ============================================================================
	// CONSTRUCTOR & LIFECYCLE
	// ============================================================================

	constructor(
		private readonly marketplaceQuery: PluginMarketplaceQuery,
		private readonly accessFacade: PluginSubscriptionAccessFacade,
		private readonly userAssignmentFacade: PluginUserAssignmentFacade,
		private readonly assignedUsersTableService: PluginAssignedUsersTableService
	) {
		// Initialize observables
		this.plugin$ = this.marketplaceQuery.plugin$;
		this.viewModel$ = this.userAssignmentFacade.viewModel$;
		this.activeUsersCount$ = this.userAssignmentFacade.activeUsersCount$;
		this.loading$ = this.userAssignmentFacade.loading$;
		this.error$ = this.userAssignmentFacade.error$;
		this.assignedUsers$ = this.userAssignmentFacade.assignments$;
	}

	/**
	 * Component initialization
	 * Sets up reactive data streams and loads initial data
	 */
	ngOnInit(): void {
		this.buildSmartTableSettings();
		this.initializeDataStreams();
	}

	ngAfterViewInit(): void {
		this.bindSourcesToStreams();
	}

	/**
	 * Component cleanup
	 * UntilDestroy decorator handles subscription cleanup automatically
	 */
	ngOnDestroy(): void {
		// Cleanup is handled by @UntilDestroy decorator
		// Clear facade state on component destroy
		this.userAssignmentFacade.clearContext();
	}

	// ============================================================================
	// PRIVATE METHODS - Initialization
	// ============================================================================

	private buildSmartTableSettings(): void {
		this.assignedUsersSettings = this.assignedUsersTableService.buildSettings({
			onToggle: (rowData) => this.onToggleUserAccess(rowData),
			onUnassign: (assignment) => this.onUnassignUser(assignment),
			pipeUntilDestroyed: (obs) => obs.pipe(untilDestroyed(this))
		});
	}

	private bindSourcesToStreams(): void {
		this.userAssignmentFacade.assignments$
			.pipe(
				tap((assignments) => {
					this.assignedUsersSource.load(
						assignments.map((a) => this.assignedUsersTableService.mapAssignmentToRow(a))
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Initialize reactive data streams
	 * Sets up plugin monitoring and loads assignments when plugin changes
	 */
	private initializeDataStreams(): void {
		// Monitor plugin changes and load assignments
		this.plugin$
			.pipe(
				filter(Boolean),
				distinctUntilChanged((prev, curr) => prev?.id === curr?.id),
				untilDestroyed(this)
			)
			.subscribe((plugin) => {
				this.handlePluginChange(plugin);
			});
	}

	/**
	 * Handle plugin change event
	 * Loads allowed users from plugin tenant and updates permission checks
	 * @param plugin - The plugin that changed
	 */
	private handlePluginChange(plugin: IPlugin): void {
		console.log('Plugin changed in user-management-tab, loading allowed users for plugin:', plugin.id);

		// Clear previous assignments first to avoid showing stale data
		this.userAssignmentFacade.clearAssignments();

		// Load allowed users for this plugin (facade handles plugin tenant resolution internally)
		this.userAssignmentFacade.loadAllowedUsersForPlugin(plugin.id, 'allowed');

		// Update canAssign observable
		this.canAssign$ = this.accessFacade.canAssign$(plugin.id);
	}

	// ============================================================================
	// PUBLIC METHODS - User Actions
	// ============================================================================

	/**
	 * Show assignment dialog for adding users
	 * Opens modal to select and assign users to plugin
	 */
	showAssignmentDialog(): void {
		const plugin = this.marketplaceQuery.plugin;
		if (!plugin) {
			console.warn('Cannot show assignment dialog: plugin not found');
			return;
		}

		this.accessFacade.showAssignmentDialog(plugin.id);
	}

	/**
	 * Toggle user access to the plugin (enable / disable)
	 */
	onToggleUserAccess(rowData: any): void {
		const pluginTenantId = this.userAssignmentFacade.currentPluginTenantId;
		if (!pluginTenantId) return;
		if (rowData.newState) {
			this.userAssignmentFacade.enableUser(pluginTenantId, rowData.userId);
		} else {
			this.userAssignmentFacade.disableUser(pluginTenantId, rowData.userId);
		}
	}

	/**
	 * Enable access for all assigned users
	 */
	onEnableAllUsers(): void {
		const pluginTenantId = this.userAssignmentFacade.currentPluginTenantId;
		if (!pluginTenantId) return;
		this.userAssignmentFacade.assignments$
			.pipe(take(1), untilDestroyed(this))
			.subscribe((assignments) => {
				const userIds = assignments.map((a) => a.userId);
				if (userIds.length > 0) {
					this.userAssignmentFacade.enableAllUsers(pluginTenantId, userIds);
				}
			});
	}

	/**
	 * Disable access for all assigned users
	 */
	onDisableAllUsers(): void {
		const pluginTenantId = this.userAssignmentFacade.currentPluginTenantId;
		if (!pluginTenantId) return;
		this.userAssignmentFacade.assignments$
			.pipe(take(1), untilDestroyed(this))
			.subscribe((assignments) => {
				const userIds = assignments.map((a) => a.userId);
				if (userIds.length > 0) {
					this.userAssignmentFacade.disableAllUsers(pluginTenantId, userIds);
				}
			});
	}

	/**
	 * Handle user unassignment (remove from allowed users)
	 * Removes user from the plugin tenant's allowed users list
	 * @param assignment - The assignment to remove
	 */
	onUnassignUser(assignment: PluginUserAssignment): void {
		if (!assignment) {
			console.warn('Cannot unassign: assignment is null or undefined');
			return;
		}

		const pluginTenantId = this.userAssignmentFacade.currentPluginTenantId;
		if (!pluginTenantId) {
			console.warn('Cannot unassign user: plugin tenant ID not found');
			return;
		}

		console.log('Removing user:', assignment.userId, 'from allowed users list');

		// Remove from allowed users using plugin tenant
		this.userAssignmentFacade.removeAllowedUsersFromPluginTenant(
			pluginTenantId,
			[assignment.userId],
			'Removed by user'
		);
	}

	// ============================================================================
	// PUBLIC METHODS - UI Helpers (Presentation Logic)
	// ============================================================================

	/**
	 * Get display name for user from assignment (used externally)
	 */
	getUserDisplayName(assignment: PluginUserAssignment): string {
		return this.userAssignmentFacade.getUserDisplayName(assignment);
	}
}
