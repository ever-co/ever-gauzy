import { ID, IUser } from '@gauzy/contracts';
import { createAction, props } from '@ngneat/effects';

/**
 * Available Users Actions
 *
 * Responsibilities (Single Responsibility Principle):
 * - Define all available users related actions
 * - Type-safe action creators
 * - Clear action naming convention
 *
 * Design Patterns:
 * - Command Pattern: Actions as commands
 * - Action/Event Pattern: Separate actions from state changes
 *
 * Naming Convention:
 * - [Domain] Action Type
 * - Success/Failure suffixes for async operations
 */
export const AvailableUsersActions = {
	// ============================================================================
	// LOAD USERS
	// ============================================================================

	/**
	 * Load available users from organization
	 */
	loadUsers: createAction(
		'[Available Users] Load Users',
		props<{
			organizationId: ID;
			tenantId: ID;
			skip?: number;
			take?: number;
		}>()
	),

	/**
	 * Load users success
	 */
	loadUsersSuccess: createAction(
		'[Available Users] Load Users Success',
		props<{
			users: IUser[];
			total: number;
		}>()
	),

	/**
	 * Load users failure
	 */
	loadUsersFailure: createAction('[Available Users] Load Users Failure', props<{ error: string }>()),

	// ============================================================================
	// LOAD MORE USERS (Infinite Scroll)
	// ============================================================================

	/**
	 * Load more users for infinite scroll
	 */
	loadMoreUsers: createAction(
		'[Available Users] Load More Users',
		props<{
			organizationId: ID;
			tenantId: ID;
		}>()
	),

	/**
	 * Load more users success
	 */
	loadMoreUsersSuccess: createAction(
		'[Available Users] Load More Users Success',
		props<{
			users: IUser[];
			total: number;
		}>()
	),

	/**
	 * Load more users failure
	 */
	loadMoreUsersFailure: createAction('[Available Users] Load More Users Failure', props<{ error: string }>()),

	// ============================================================================
	// SEARCH AND FILTER
	// ============================================================================

	/**
	 * Set search term
	 */
	setSearchTerm: createAction('[Available Users] Set Search Term', props<{ searchTerm: string }>()),

	/**
	 * Clear search term
	 */
	clearSearchTerm: createAction('[Available Users] Clear Search Term'),

	// ============================================================================
	// SELECTION MANAGEMENT
	// ============================================================================

	/**
	 * Select user
	 */
	selectUser: createAction('[Available Users] Select User', props<{ userId: ID }>()),

	/**
	 * Deselect user
	 */
	deselectUser: createAction('[Available Users] Deselect User', props<{ userId: ID }>()),

	/**
	 * Set selected users
	 */
	setSelectedUsers: createAction('[Available Users] Set Selected Users', props<{ userIds: string[] }>()),

	/**
	 * Clear selection
	 */
	clearSelection: createAction('[Available Users] Clear Selection'),

	// ============================================================================
	// PAGINATION
	// ============================================================================

	/**
	 * Set pagination parameters
	 */
	setPagination: createAction('[Available Users] Set Pagination', props<{ skip?: number; take?: number }>()),

	/**
	 * Reset pagination
	 */
	resetPagination: createAction('[Available Users] Reset Pagination'),

	// ============================================================================
	// CONTEXT MANAGEMENT
	// ============================================================================

	/**
	 * Set organization context
	 */
	setOrganizationContext: createAction(
		'[Available Users] Set Organization Context',
		props<{ organizationId: ID; tenantId: ID }>()
	),

	/**
	 * Clear organization context
	 */
	clearOrganizationContext: createAction('[Available Users] Clear Organization Context'),

	// ============================================================================
	// STATE MANAGEMENT
	// ============================================================================

	/**
	 * Clear all users
	 */
	clearUsers: createAction('[Available Users] Clear Users'),

	/**
	 * Clear error
	 */
	clearError: createAction('[Available Users] Clear Error'),

	/**
	 * Reset store
	 */
	reset: createAction('[Available Users] Reset')
};
