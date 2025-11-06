import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { IPlugin, IUser } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChanged, filter, Observable, tap } from 'rxjs';
import {
	PluginUserAssignmentFacade,
	UserManagementViewModel
} from '../../../+state/facades/plugin-user-assignment.facade';
import { PluginSubscriptionAccessFacade } from '../../../+state/plugin-subscription-access.facade';
import { PluginMarketplaceQuery } from '../../../+state/queries/plugin-marketplace.query';
import { PluginUserAssignment } from '../../../+state/stores/plugin-user-assignment.store';

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
	standalone: false,
	templateUrl: './user-management-tab.component.html',
	styleUrls: ['./user-management-tab.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserManagementTabComponent implements OnInit, OnDestroy {
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
	 * Loading more state (for infinite scroll)
	 */
	readonly loadingMore$: Observable<boolean>;

	/**
	 * Has more data to load
	 */
	readonly hasMore$: Observable<boolean>;

	/**
	 * Error state
	 */
	readonly error$: Observable<string | null>;

	/**
	 * Assigned users list
	 */
	readonly assignedUsers$: Observable<PluginUserAssignment[]>;

	// ============================================================================
	// CONSTRUCTOR & LIFECYCLE
	// ============================================================================

	constructor(
		private readonly marketplaceQuery: PluginMarketplaceQuery,
		private readonly accessFacade: PluginSubscriptionAccessFacade,
		private readonly userAssignmentFacade: PluginUserAssignmentFacade
	) {
		// Initialize observables
		this.plugin$ = this.marketplaceQuery.plugin$;
		this.viewModel$ = this.userAssignmentFacade.viewModel$;
		this.activeUsersCount$ = this.userAssignmentFacade.activeUsersCount$;
		this.loading$ = this.userAssignmentFacade.loading$;
		this.loadingMore$ = this.userAssignmentFacade.loadingMore$;
		this.hasMore$ = this.userAssignmentFacade.hasMore$;
		this.error$ = this.userAssignmentFacade.error$;
		this.assignedUsers$ = this.userAssignmentFacade.assignments$;
	}

	/**
	 * Component initialization
	 * Sets up reactive data streams and loads initial data
	 */
	ngOnInit(): void {
		this.initializeDataStreams();
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
	 * Loads assignments and updates permission checks
	 * @param plugin - The plugin that changed
	 */
	private handlePluginChange(plugin: IPlugin): void {
		console.log('Plugin changed in user-management-tab, loading assignments for plugin:', plugin.id);

		// Clear previous assignments first to avoid showing stale data
		this.userAssignmentFacade.clearAssignments();

		// Load all assignments for this plugin (not installation-specific)
		this.userAssignmentFacade.loadAssignmentsForPlugin(plugin.id, false);

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
	 * Handle user unassignment action
	 * Removes user assignment from plugin installation
	 * @param assignment - The assignment to remove
	 */
	onUnassignUser(assignment: PluginUserAssignment): void {
		if (!assignment) {
			console.warn('Cannot unassign: assignment is null or undefined');
			return;
		}

		const plugin = this.marketplaceQuery.plugin;
		if (!plugin) {
			console.warn('Cannot unassign user: plugin not found');
			return;
		}

		console.log('Unassigning user:', assignment.userId, 'from plugin:', plugin.id);

		// Delegate to facade
		this.userAssignmentFacade.unassignUser(plugin.id, assignment.pluginInstallationId, assignment.userId);

		// Wait for the unassignment operation to complete, then reload
		this.loading$
			.pipe(
				filter((loading) => !loading),
				tap(() => {
					console.log('Unassignment complete, reloading assignments for plugin:', plugin.id);
					// Reload assignments to reflect the changes
					this.userAssignmentFacade.loadAssignmentsForPlugin(plugin.id, false);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	// ============================================================================
	// PUBLIC METHODS - UI Helpers (Presentation Logic)
	// ============================================================================

	/**
	 * Get display name for user from assignment
	 * Formats user's full name or falls back to email
	 * @param assignment - Plugin user assignment
	 * @returns Formatted display name
	 */
	getUserDisplayName(assignment: PluginUserAssignment): string {
		return this.userAssignmentFacade.getUserDisplayName(assignment);
	}

	/**
	 * Get avatar URL for user
	 * Returns user's image URL or default avatar
	 * @param user - User object from assignment
	 * @returns Avatar URL
	 */
	getUserAvatar(user: IUser | PluginUserAssignment['user']): string {
		if (!user) {
			return '/assets/images/avatars/default-avatar.png';
		}
		return user.imageUrl || '/assets/images/avatars/default-avatar.png';
	}

	/**
	 * Get formatted assignment date
	 * @param assignment - Plugin user assignment
	 * @returns Date object for formatting in template
	 */
	getAssignmentDate(assignment: PluginUserAssignment): Date {
		return this.userAssignmentFacade.getAssignmentDate(assignment);
	}

	/**
	 * Track by function for ngFor optimization
	 * Helps Angular track items for efficient DOM updates
	 * @param index - Item index
	 * @param assignment - Plugin user assignment
	 * @returns Unique identifier for assignment
	 */
	trackByAssignmentId(index: number, assignment: PluginUserAssignment): string {
		return assignment?.id || `${index}`;
	}

	/**
	 * Check if assignment is active
	 * @param assignment - Plugin user assignment
	 * @returns True if assignment is active
	 */
	isActive(assignment: PluginUserAssignment): boolean {
		return this.userAssignmentFacade.isAssignmentActive(assignment);
	}

	/**
	 * Get status badge configuration
	 * @param assignment - Plugin user assignment
	 * @returns Badge status and text configuration
	 */
	getStatusBadge(assignment: PluginUserAssignment): { status: string; text: string } {
		return this.userAssignmentFacade.getStatusBadge(assignment);
	}

	/**
	 * Load more assignments for infinite scroll
	 */
	onLoadMore(): void {
		const plugin = this.marketplaceQuery.plugin;
		if (!plugin) {
			return;
		}

		this.userAssignmentFacade.loadMoreAssignments(plugin.id, '', false);
	}
}
