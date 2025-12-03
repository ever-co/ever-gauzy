import { Injectable } from '@angular/core';
import { ID } from '@gauzy/contracts';
import { Actions } from '@ngneat/effects-ng';
import { combineLatest, map, Observable } from 'rxjs';
import { PluginUserAssignmentActions } from '../actions/plugin-user-assignment.actions';
import { PluginUserAssignmentQuery } from '../queries/plugin-user-assignment.query';
import { PluginUserAssignment, PluginUserAssignmentStore } from '../stores/plugin-user-assignment.store';

/**
 * View Model for User Management Tab
 * Encapsulates presentation logic and derived state
 */
export interface UserManagementViewModel {
	assignments: PluginUserAssignment[];
	activeAssignmentsCount: number;
	totalAssignmentsCount: number;
	loading: boolean;
	error: string | null;
	hasError: boolean;
	hasAssignments: boolean;
	isEmpty: boolean;
}

/**
 * Facade for Plugin User Assignment Management
 * Implements Facade Pattern to provide a simplified interface to the complex subsystem
 * of stores, queries, and effects for user assignment management.
 *
 * Responsibilities:
 * - Encapsulate business logic
 * - Provide high-level API for components
 * - Manage state operations through Akita stores
 * - Coordinate between different state layers
 *
 * Benefits:
 * - Single Responsibility: Each method has one clear purpose
 * - Loose Coupling: Components don't need to know about stores/queries
 * - Testability: Easy to mock for unit tests
 * - Maintainability: Changes to state management don't affect components
 */
@Injectable({ providedIn: 'root' })
export class PluginUserAssignmentFacade {
	constructor(
		private readonly store: PluginUserAssignmentStore,
		private readonly query: PluginUserAssignmentQuery,
		private readonly actions: Actions
	) {}

	// ============================================================================
	// STATE SELECTORS
	// ============================================================================

	/**
	 * Get all user assignments as observable
	 */
	get assignments$(): Observable<PluginUserAssignment[]> {
		return this.query.assignments$;
	}

	/**
	 * Get loading state
	 */
	get loading$(): Observable<boolean> {
		return this.query.loading$;
	}

	/**
	 * Get loading more state (for infinite scroll)
	 */
	get loadingMore$(): Observable<boolean> {
		return this.query.loadingMore$;
	}

	/**
	 * Get has more data to load
	 */
	get hasMore$(): Observable<boolean> {
		return this.query.hasMore$;
	}

	/**
	 * Get pagination state
	 */
	get pagination$(): Observable<any> {
		return this.query.pagination$;
	}

	/**
	 * Get error state
	 */
	get error$(): Observable<string | null> {
		return this.query.error$;
	}

	/**
	 * Get active assignments only
	 */
	get activeAssignments$(): Observable<PluginUserAssignment[]> {
		return this.query.getActiveAssignments();
	}

	/**
	 * Get complete view model for user management
	 * Combines multiple state slices into a single view model
	 */
	get viewModel$(): Observable<UserManagementViewModel> {
		return combineLatest([this.query.assignments$, this.query.loading$, this.query.error$]).pipe(
			map(([assignments, loading, error]) => ({
				assignments,
				activeAssignmentsCount: assignments.filter((a) => a.isActive).length,
				totalAssignmentsCount: assignments.length,
				loading,
				error,
				hasError: !!error,
				hasAssignments: assignments.length > 0,
				isEmpty: assignments.length === 0 && !loading
			}))
		);
	}

	/**
	 * Get active users count as observable
	 */
	get activeUsersCount$(): Observable<number> {
		return this.query.assignments$.pipe(map((assignments) => assignments.filter((a) => a.isActive).length));
	}

	/**
	 * Check if module has any error
	 */
	get hasError$(): Observable<boolean> {
		return this.query.hasError();
	}

	/**
	 * Check if module has any assignments
	 */
	get hasAssignments$(): Observable<boolean> {
		return this.query.hasAssignments();
	}

	// ============================================================================
	// BUSINESS OPERATIONS
	// ============================================================================

	/**
	 * Load all assignments for a plugin
	 * Backend: GET /plugins/:pluginId/users
	 * @param pluginId - Plugin identifier
	 * @param includeInactive - Whether to include inactive assignments
	 */
	loadAssignmentsForPlugin(pluginId: ID, includeInactive = false): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.loadAssignments({
				pluginId,
				includeInactive
			})
		);
	}

	/**
	 * Load more assignments (for infinite scroll)
	 * Backend: GET /plugins/:pluginId/users
	 * @param pluginId - Plugin identifier
	 * @param includeInactive - Whether to include inactive assignments
	 */
	loadMoreAssignments(pluginId: ID, includeInactive = false): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.loadMoreAssignments({
				pluginId,
				includeInactive
			})
		);
	}

	/**
	 * Assign users to a plugin subscription
	 * Uses subscription-based access control (creates child USER-scoped subscriptions)
	 * @param pluginId - Plugin identifier
	 * @param userIds - Array of user identifiers
	 * @param reason - Optional reason for assignment
	 */
	assignUsers(pluginId: ID, userIds: string[], reason?: string): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.assignUsers({
				pluginId,
				userIds,
				reason
			})
		);
	}

	/**
	 * Unassign a user from plugin (revoke subscription)
	 * Uses subscription-based revocation to cancel child USER-scoped subscription
	 * @param pluginId - Plugin identifier
	 * @param userId - User identifier
	 */
	unassignUser(pluginId: ID, userId: ID): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.unassignUser({
				pluginId,
				userId
			})
		);
	}

	/**
	 * Bulk assign users to multiple subscriptions
	 * @param pluginSubscriptionIds - Array of subscription identifiers
	 * @param userIds - Array of user identifiers
	 * @param reason - Optional reason for assignment
	 */
	bulkAssignUsers(pluginSubscriptionIds: string[], userIds: string[], reason?: string): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.bulkAssignUsers({
				pluginSubscriptionIds,
				userIds,
				reason
			})
		);
	}

	/**
	 * Get user assignment details
	 * Backend: GET /users/:userId/plugins/:pluginId/access
	 * @param pluginId - Plugin identifier
	 * @param userId - User identifier
	 */
	getUserAssignmentDetails(pluginId: ID, userId: ID): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.getUserAssignmentDetails({
				pluginId,
				userId
			})
		);
	}

	/**
	 * Check if user has access to plugin
	 * Uses subscription-based access check
	 * @param pluginId - Plugin identifier
	 * @param userId - User identifier
	 */
	checkUserAccess(pluginId: ID, userId: ID): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.checkUserAccess({
				pluginId,
				userId
			})
		);
	}

	// ============================================================================
	// QUERY OPERATIONS
	// ============================================================================

	/**
	 * Get assignments for specific subscription
	 * @param subscriptionId - Subscription identifier
	 */
	getAssignmentsForSubscription$(subscriptionId: string): Observable<PluginUserAssignment[]> {
		return this.query.getAssignmentsForSubscription(subscriptionId);
	}

	/**
	 * Get assignments for specific user
	 * @param userId - User identifier
	 */
	getAssignmentsForUser$(userId: string): Observable<PluginUserAssignment[]> {
		return this.query.getAssignmentsForUser(userId);
	}

	/**
	 * Check if user has assignment for subscription
	 * @param userId - User identifier
	 * @param subscriptionId - Subscription identifier
	 */
	hasUserAssignment$(userId: string, subscriptionId: string): Observable<boolean> {
		return this.query.hasUserAssignment(userId, subscriptionId);
	}

	/**
	 * Get assignment count for subscription
	 * @param subscriptionId - Subscription identifier
	 */
	getAssignmentCount$(subscriptionId: string): Observable<number> {
		return this.query.getAssignmentCount(subscriptionId);
	}

	/**
	 * Get assigned users for subscription
	 * @param subscriptionId - Subscription identifier
	 */
	getAssignedUsers$(subscriptionId: string): Observable<any[]> {
		return this.query.getAssignedUsers(subscriptionId);
	}

	// ============================================================================
	// STATE MANAGEMENT
	// ============================================================================

	/**
	 * Select a plugin and subscription for context
	 * @param pluginId - Plugin identifier
	 * @param subscriptionId - Subscription identifier (optional)
	 */
	selectContext(pluginId: string, subscriptionId?: string): void {
		this.store.selectPlugin(pluginId, subscriptionId);
	}

	/**
	 * Clear current selection context
	 */
	clearContext(): void {
		this.store.clearSelection();
	}

	/**
	 * Clear all assignments from store
	 */
	clearAssignments(): void {
		this.store.clearAssignments();
	}

	/**
	 * Clear error state
	 */
	clearError(): void {
		this.store.clearError();
	}

	/**
	 * Reset store to initial state
	 */
	reset(): void {
		this.store.reset();
	}

	// ============================================================================
	// UTILITY METHODS
	// ============================================================================

	/**
	 * Get display name for user from assignment
	 * @param assignment - Plugin user assignment
	 */
	getUserDisplayName(assignment: PluginUserAssignment): string {
		if (assignment.user) {
			const { firstName, lastName, email } = assignment.user;
			if (firstName || lastName) {
				return `${firstName || ''} ${lastName || ''}`.trim();
			}
			return email || 'N/A';
		}
		return 'Unknown User';
	}

	/**
	 * Get avatar URL for user from assignment
	 * @param assignment - Plugin user assignment
	 */
	getUserAvatar(assignment: PluginUserAssignment): string {
		return assignment.user?.imageUrl || '/assets/images/avatars/default-avatar.png';
	}

	/**
	 * Format assignment date
	 * Returns null if assignedAt is not a valid date value
	 * @param assignment - Plugin user assignment
	 */
	getAssignmentDate(assignment: PluginUserAssignment): Date | null {
		if (!assignment?.assignedAt) {
			return null;
		}
		const date = new Date(assignment.assignedAt);
		// Check for Invalid Date
		return isNaN(date.getTime()) ? null : date;
	}

	/**
	 * Check if assignment is active
	 * @param assignment - Plugin user assignment
	 */
	isAssignmentActive(assignment: PluginUserAssignment): boolean {
		return assignment.isActive;
	}

	/**
	 * Get assignment status badge configuration
	 * @param assignment - Plugin user assignment
	 */
	getStatusBadge(assignment: PluginUserAssignment): { status: string; text: string } {
		return {
			status: assignment.isActive ? 'success' : 'warning',
			text: assignment.isActive ? 'PLUGIN.USER_MANAGEMENT.ACTIVE' : 'PLUGIN.USER_MANAGEMENT.INACTIVE'
		};
	}

	// ============================================================================
	// PLUGIN TENANT USER MANAGEMENT
	// ============================================================================

	/**
	 * Get current plugin tenant ID
	 */
	get currentPluginTenantId$(): Observable<string | null> {
		return this.query.currentPluginTenantId$;
	}

	/**
	 * Get current plugin tenant ID (synchronous)
	 */
	get currentPluginTenantId(): string | null {
		return this.query.currentPluginTenantId;
	}

	/**
	 * Load allowed users for a plugin
	 * This resolves the plugin tenant internally and loads the allowed users
	 * @param pluginId - Plugin identifier
	 * @param type - Type of users to load ('allowed', 'denied', 'all')
	 * @param take - Number of records to take
	 * @param skip - Number of records to skip
	 * @param searchTerm - Optional search term
	 */
	loadAllowedUsersForPlugin(
		pluginId: ID,
		type: 'allowed' | 'denied' | 'all' = 'allowed',
		take?: number,
		skip?: number,
		searchTerm?: string
	): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.loadAllowedUsersForPlugin({
				pluginId,
				type,
				take,
				skip,
				searchTerm
			})
		);
	}

	/**
	 * Load plugin tenant users (allowed/denied)
	 * @param pluginTenantId - Plugin tenant identifier
	 * @param type - Type of users to load ('allowed', 'denied', 'all')
	 * @param take - Number of records to take
	 * @param skip - Number of records to skip
	 * @param searchTerm - Optional search term
	 */
	loadPluginTenantUsers(
		pluginTenantId: ID,
		type: 'allowed' | 'denied' | 'all' = 'all',
		take?: number,
		skip?: number,
		searchTerm?: string
	): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.loadPluginTenantUsers({
				pluginTenantId,
				type,
				take,
				skip,
				searchTerm
			})
		);
	}

	/**
	 * Allow users access to a plugin tenant
	 * @param pluginTenantId - Plugin tenant identifier
	 * @param userIds - Array of user IDs to allow
	 * @param reason - Optional reason for the operation
	 */
	allowUsersToPluginTenant(pluginTenantId: ID, userIds: string[], reason?: string): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.allowUsersToPluginTenant({
				pluginTenantId,
				userIds,
				reason
			})
		);
	}

	/**
	 * Deny users access to a plugin tenant
	 * @param pluginTenantId - Plugin tenant identifier
	 * @param userIds - Array of user IDs to deny
	 * @param reason - Optional reason for the operation
	 */
	denyUsersFromPluginTenant(pluginTenantId: ID, userIds: string[], reason?: string): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.denyUsersFromPluginTenant({
				pluginTenantId,
				userIds,
				reason
			})
		);
	}

	/**
	 * Remove users from allowed list for a plugin tenant
	 * @param pluginTenantId - Plugin tenant identifier
	 * @param userIds - Array of user IDs to remove
	 * @param reason - Optional reason for the operation
	 */
	removeAllowedUsersFromPluginTenant(pluginTenantId: ID, userIds: string[], reason?: string): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.removeAllowedUsersFromPluginTenant({
				pluginTenantId,
				userIds,
				reason
			})
		);
	}

	/**
	 * Remove users from denied list for a plugin tenant
	 * @param pluginTenantId - Plugin tenant identifier
	 * @param userIds - Array of user IDs to remove
	 * @param reason - Optional reason for the operation
	 */
	removeDeniedUsersFromPluginTenant(pluginTenantId: ID, userIds: string[], reason?: string): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.removeDeniedUsersFromPluginTenant({
				pluginTenantId,
				userIds,
				reason
			})
		);
	}
}
