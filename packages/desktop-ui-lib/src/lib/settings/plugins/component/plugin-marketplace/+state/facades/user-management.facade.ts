import { Injectable } from '@angular/core';
import { ID, IUser } from '@gauzy/contracts';
import { Actions } from '@ngneat/effects-ng';
import { combineLatest, map, Observable } from 'rxjs';
import { AvailableUsersActions } from '../actions/available-users.actions';
import { PluginUserAssignmentActions } from '../actions/plugin-user-assignment.actions';
import { AvailableUsersQuery } from '../queries/available-users.query';
import { PluginUserAssignmentQuery } from '../queries/plugin-user-assignment.query';
import { PluginUserAssignment } from '../stores/plugin-user-assignment.store';

/**
 * View Model for User Management Dialog
 * Encapsulates all presentation state needed by the component
 */
export interface UserManagementDialogViewModel {
	// Available Users
	availableUsers: IUser[];
	filteredAvailableUsers: IUser[];
	loadingAvailableUsers: boolean;
	loadingMoreAvailableUsers: boolean;
	hasMoreAvailableUsers: boolean;
	availableUsersError: string | null;

	// Assigned Users
	assignedUsers: PluginUserAssignment[];
	loadingAssignedUsers: boolean;
	assignedUsersError: string | null;

	// Selection
	selectedUsers: IUser[];
	selectedUserIds: string[];
	hasSelection: boolean;

	// Search
	searchTerm: string;

	// Overall state
	hasErrors: boolean;
	isEmpty: boolean;
}

/**
 * User Management Facade
 *
 * Responsibilities (Single Responsibility Principle):
 * - Provide high-level API for user management operations
 * - Encapsulate complexity of multiple stores and queries
 * - Coordinate between available users and assigned users
 * - Provide computed view models for components
 *
 * Design Patterns:
 * - Facade Pattern: Simplifies complex subsystem
 * - Delegation Pattern: Delegates to specialized services
 * - Observer Pattern: Reactive data streams
 * - Strategy Pattern: Different strategies for operations
 *
 * Benefits:
 * - Single point of contact for components
 * - Loose coupling between components and state management
 * - Easy to test and mock
 * - Centralized business logic
 */
@Injectable({ providedIn: 'root' })
export class UserManagementFacade {
	constructor(
		private readonly availableUsersQuery: AvailableUsersQuery,
		private readonly assignmentQuery: PluginUserAssignmentQuery,
		private readonly actions: Actions
	) {}

	// ============================================================================
	// STATE SELECTORS - Available Users
	// ============================================================================

	/**
	 * Get all available users
	 */
	get availableUsers$(): Observable<IUser[]> {
		return this.availableUsersQuery.users$;
	}

	/**
	 * Get filtered available users (excluding assigned users)
	 */
	get filteredAvailableUsers$(): Observable<IUser[]> {
		const assignedUserIds$ = this.assignmentQuery.assignments$.pipe(
			map((assignments) => assignments.map((a) => a.userId))
		);
		return this.availableUsersQuery.getAvailableUsers$(assignedUserIds$);
	}

	/**
	 * Get loading state for available users
	 */
	get loadingAvailableUsers$(): Observable<boolean> {
		return this.availableUsersQuery.loading$;
	}

	/**
	 * Get loading more state for available users
	 */
	get loadingMoreAvailableUsers$(): Observable<boolean> {
		return this.availableUsersQuery.loadingMore$;
	}

	/**
	 * Get has more flag for available users
	 */
	get hasMoreAvailableUsers$(): Observable<boolean> {
		return this.availableUsersQuery.hasMore$;
	}

	/**
	 * Get error for available users
	 */
	get availableUsersError$(): Observable<string | null> {
		return this.availableUsersQuery.error$;
	}

	// ============================================================================
	// STATE SELECTORS - Assigned Users
	// ============================================================================

	/**
	 * Get all assigned users
	 */
	get assignedUsers$(): Observable<PluginUserAssignment[]> {
		return this.assignmentQuery.assignments$;
	}

	/**
	 * Get loading state for assigned users
	 */
	get loadingAssignedUsers$(): Observable<boolean> {
		return this.assignmentQuery.loading$;
	}

	/**
	 * Get error for assigned users
	 */
	get assignedUsersError$(): Observable<string | null> {
		return this.assignmentQuery.error$;
	}

	// ============================================================================
	// STATE SELECTORS - Selection
	// ============================================================================

	/**
	 * Get selected users
	 */
	get selectedUsers$(): Observable<IUser[]> {
		return this.availableUsersQuery.selectedUsers$;
	}

	/**
	 * Get selected user IDs
	 */
	get selectedUserIds$(): Observable<string[]> {
		return this.availableUsersQuery.selectedUserIds$;
	}

	/**
	 * Check if has selection
	 */
	get hasSelection$(): Observable<boolean> {
		return this.availableUsersQuery.hasSelection$;
	}

	// ============================================================================
	// STATE SELECTORS - Search
	// ============================================================================

	/**
	 * Get search term
	 */
	get searchTerm$(): Observable<string> {
		return this.availableUsersQuery.searchTerm$;
	}

	// ============================================================================
	// COMPUTED VIEW MODEL
	// ============================================================================

	/**
	 * Get complete view model for user management dialog
	 * Combines all relevant state into single observable
	 */
	get viewModel$(): Observable<UserManagementDialogViewModel> {
		return combineLatest([
			this.availableUsers$,
			this.filteredAvailableUsers$,
			this.loadingAvailableUsers$,
			this.loadingMoreAvailableUsers$,
			this.hasMoreAvailableUsers$,
			this.availableUsersError$,
			this.assignedUsers$,
			this.loadingAssignedUsers$,
			this.assignedUsersError$,
			this.selectedUsers$,
			this.selectedUserIds$,
			this.hasSelection$,
			this.searchTerm$
		]).pipe(
			map(
				([
					availableUsers,
					filteredAvailableUsers,
					loadingAvailableUsers,
					loadingMoreAvailableUsers,
					hasMoreAvailableUsers,
					availableUsersError,
					assignedUsers,
					loadingAssignedUsers,
					assignedUsersError,
					selectedUsers,
					selectedUserIds,
					hasSelection,
					searchTerm
				]) => ({
					availableUsers,
					filteredAvailableUsers,
					loadingAvailableUsers,
					loadingMoreAvailableUsers,
					hasMoreAvailableUsers,
					availableUsersError,
					assignedUsers,
					loadingAssignedUsers,
					assignedUsersError,
					selectedUsers,
					selectedUserIds,
					hasSelection,
					searchTerm,
					hasErrors: !!(availableUsersError || assignedUsersError),
					isEmpty: filteredAvailableUsers.length === 0 && !loadingAvailableUsers
				})
			)
		);
	}

	// ============================================================================
	// BUSINESS OPERATIONS - Available Users
	// ============================================================================

	/**
	 * Load available users from organization
	 * @param organizationId - Organization ID
	 * @param tenantId - Tenant ID
	 * @param skip - Optional skip parameter
	 * @param take - Optional take parameter
	 */
	loadAvailableUsers(organizationId: ID, tenantId: ID, skip?: number, take?: number): void {
		this.actions.dispatch(
			AvailableUsersActions.loadUsers({
				organizationId,
				tenantId,
				skip,
				take
			})
		);
	}

	/**
	 * Load more available users for infinite scroll
	 * @param organizationId - Organization ID
	 * @param tenantId - Tenant ID
	 */
	loadMoreAvailableUsers(organizationId: ID, tenantId: ID): void {
		this.actions.dispatch(
			AvailableUsersActions.loadMoreUsers({
				organizationId,
				tenantId
			})
		);
	}

	// ============================================================================
	// BUSINESS OPERATIONS - Assigned Users
	// ============================================================================

	/**
	 * Load assigned users for plugin subscription
	 * @param pluginId - Plugin ID
	 * @param subscriptionId - Subscription ID (optional)
	 * @param includeInactive - Include inactive assignments
	 */
	loadAssignedUsers(pluginId: ID, subscriptionId?: ID, includeInactive = false): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.loadAssignments({
				pluginId,
				subscriptionId,
				includeInactive,
				skip: 0,
				take: 20
			})
		);
	}

	/**
	 * Assign users to plugin
	 * @param pluginId - Plugin ID
	 * @param userIds - User IDs to assign
	 * @param reason - Reason for assignment
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
	 * Unassign user from plugin
	 * @param pluginId - Plugin ID
	 * @param userId - User ID to unassign
	 */
	unassignUser(pluginId: ID, userId: ID): void {
		this.actions.dispatch(
			PluginUserAssignmentActions.unassignUser({
				pluginId,
				userId
			})
		);
	}

	// ============================================================================
	// BUSINESS OPERATIONS - Search
	// ============================================================================

	/**
	 * Set search term for filtering users
	 * @param searchTerm - Search term
	 */
	setSearchTerm(searchTerm: string): void {
		this.actions.dispatch(AvailableUsersActions.setSearchTerm({ searchTerm }));
	}

	/**
	 * Clear search term
	 */
	clearSearchTerm(): void {
		this.actions.dispatch(AvailableUsersActions.clearSearchTerm());
	}

	// ============================================================================
	// BUSINESS OPERATIONS - Selection
	// ============================================================================

	/**
	 * Select a user
	 * @param userId - User ID to select
	 */
	selectUser(userId: ID): void {
		this.actions.dispatch(AvailableUsersActions.selectUser({ userId }));
	}

	/**
	 * Deselect a user
	 * @param userId - User ID to deselect
	 */
	deselectUser(userId: ID): void {
		this.actions.dispatch(AvailableUsersActions.deselectUser({ userId }));
	}

	/**
	 * Set selected users
	 * @param userIds - User IDs to select
	 */
	setSelectedUsers(userIds: string[]): void {
		this.actions.dispatch(AvailableUsersActions.setSelectedUsers({ userIds }));
	}

	/**
	 * Clear selection
	 */
	clearSelection(): void {
		this.actions.dispatch(AvailableUsersActions.clearSelection());
	}

	// ============================================================================
	// UTILITY METHODS
	// ============================================================================

	/**
	 * Check if user is selected
	 * @param userId - User ID to check
	 */
	isUserSelected(userId: string): boolean {
		return this.availableUsersQuery.isUserSelected(userId);
	}

	/**
	 * Get user display name from assignment
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
	 * Get user avatar URL
	 * @param user - User object
	 */
	getUserAvatar(user: IUser): string {
		return user?.imageUrl || '/assets/images/avatars/default-avatar.png';
	}

	/**
	 * Get assignment date
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

	// ============================================================================
	// STATE MANAGEMENT
	// ============================================================================

	/**
	 * Set organization context for available users
	 * @param organizationId - Organization ID
	 * @param tenantId - Tenant ID
	 */
	setOrganizationContext(organizationId: ID, tenantId: ID): void {
		this.actions.dispatch(
			AvailableUsersActions.setOrganizationContext({
				organizationId,
				tenantId
			})
		);
	}

	/**
	 * Clear all state
	 */
	clearAll(): void {
		this.actions.dispatch(AvailableUsersActions.reset());
		// Assignment clear is handled separately if needed
	}

	/**
	 * Reset available users state
	 */
	resetAvailableUsers(): void {
		this.actions.dispatch(AvailableUsersActions.reset());
	}
}
