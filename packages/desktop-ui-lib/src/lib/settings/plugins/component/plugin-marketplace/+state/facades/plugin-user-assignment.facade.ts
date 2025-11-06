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
	 * @param pluginId - Plugin identifier
	 * @param includeInactive - Whether to include inactive assignments
	 */
	loadAssignmentsForPlugin(pluginId: ID, includeInactive = false): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.loadAssignments({
				pluginId,
				installationId: '', // Empty to load all installations
				includeInactive
			})
		);
	}

	/**
	 * Load assignments for specific installation
	 * @param pluginId - Plugin identifier
	 * @param installationId - Installation identifier
	 * @param includeInactive - Whether to include inactive assignments
	 */
	loadAssignmentsForInstallation(pluginId: ID, installationId: ID, includeInactive = false): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.loadAssignments({
				pluginId,
				installationId,
				includeInactive
			})
		);
	}

	/**
	 * Load more assignments (for infinite scroll)
	 * @param pluginId - Plugin identifier
	 * @param installationId - Installation identifier
	 * @param includeInactive - Whether to include inactive assignments
	 */
	loadMoreAssignments(pluginId: ID, installationId: ID, includeInactive = false): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.loadMoreAssignments({
				pluginId,
				installationId,
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
	 * @param installationId - Installation identifier (kept for backward compatibility, not used)
	 * @param userId - User identifier
	 */
	unassignUser(pluginId: ID, installationId: ID, userId: ID): void {
		// Note: installationId parameter is kept for backward compatibility but not used in subscription-based approach
		this.actions.dispatch(
			PluginUserAssignmentActions.unassignUser({
				pluginId,
				userId
			})
		);
	}

	/**
	 * Bulk assign users to multiple installations
	 * @param pluginInstallationIds - Array of installation identifiers
	 * @param userIds - Array of user identifiers
	 * @param reason - Optional reason for assignment
	 */
	bulkAssignUsers(pluginInstallationIds: string[], userIds: string[], reason?: string): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.bulkAssignUsers({
				pluginInstallationIds,
				userIds,
				reason
			})
		);
	}

	/**
	 * Get user assignment details
	 * @param pluginId - Plugin identifier
	 * @param installationId - Installation identifier
	 * @param userId - User identifier
	 */
	getUserAssignmentDetails(pluginId: ID, installationId: ID, userId: ID): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.getUserAssignmentDetails({
				pluginId,
				installationId,
				userId
			})
		);
	}

	/**
	 * Check if user has access to plugin
	 * Uses subscription-based access check
	 * @param pluginId - Plugin identifier
	 * @param installationId - Installation identifier (kept for backward compatibility, not used)
	 * @param userId - User identifier
	 */
	checkUserAccess(pluginId: ID, installationId: ID, userId: ID): void {
		// Note: installationId parameter is kept for backward compatibility but not used in subscription-based approach
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
	 * Get assignments for specific installation
	 * @param installationId - Installation identifier
	 */
	getAssignmentsForInstallation$(installationId: string): Observable<PluginUserAssignment[]> {
		return this.query.getAssignmentsForInstallation(installationId);
	}

	/**
	 * Get assignments for specific user
	 * @param userId - User identifier
	 */
	getAssignmentsForUser$(userId: string): Observable<PluginUserAssignment[]> {
		return this.query.getAssignmentsForUser(userId);
	}

	/**
	 * Check if user has assignment for installation
	 * @param userId - User identifier
	 * @param installationId - Installation identifier
	 */
	hasUserAssignment$(userId: string, installationId: string): Observable<boolean> {
		return this.query.hasUserAssignment(userId, installationId);
	}

	/**
	 * Get assignment count for installation
	 * @param installationId - Installation identifier
	 */
	getAssignmentCount$(installationId: string): Observable<number> {
		return this.query.getAssignmentCount(installationId);
	}

	/**
	 * Get assigned users for installation
	 * @param installationId - Installation identifier
	 */
	getAssignedUsers$(installationId: string): Observable<any[]> {
		return this.query.getAssignedUsers(installationId);
	}

	// ============================================================================
	// STATE MANAGEMENT
	// ============================================================================

	/**
	 * Select a plugin and installation for context
	 * @param pluginId - Plugin identifier
	 * @param installationId - Installation identifier
	 */
	selectContext(pluginId: string, installationId: string): void {
		this.store.selectPlugin(pluginId, installationId);
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
	 * @param assignment - Plugin user assignment
	 */
	getAssignmentDate(assignment: PluginUserAssignment): Date {
		return new Date(assignment.assignedAt);
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
}
