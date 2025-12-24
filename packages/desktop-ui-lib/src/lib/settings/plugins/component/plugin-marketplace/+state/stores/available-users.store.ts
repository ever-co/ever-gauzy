import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { IUser } from '@gauzy/contracts';

/**
 * Available Users State Interface
 * Follows Single Responsibility Principle - manages only available users state
 */
export interface AvailableUsersState {
	users: IUser[];
	loading: boolean;
	loadingMore: boolean;
	error: string | null;
	searchTerm: string;
	selectedUserIds: string[];
	// Pagination metadata using standard TypeORM naming
	pagination: {
		skip: number; // Offset (how many to skip)
		take: number; // Limit (how many to take)
		total: number;
		hasMore: boolean;
	};
	// Organization context
	organizationId: string | null;
	tenantId: string | null;
}

/**
 * Factory function to create initial state
 * Follows Factory Pattern for object creation
 */
function createInitialState(): AvailableUsersState {
	return {
		users: [],
		loading: false,
		loadingMore: false,
		error: null,
		searchTerm: '',
		selectedUserIds: [],
		pagination: {
			skip: 0,
			take: 20,
			total: 0,
			hasMore: false
		},
		organizationId: null,
		tenantId: null
	};
}

/**
 * Available Users Store
 *
 * Responsibilities (Single Responsibility Principle):
 * - Manage available users state
 * - Handle pagination state
 * - Track loading states
 * - Maintain search and selection state
 *
 * Design Patterns:
 * - Store Pattern: Centralized state management
 * - Factory Pattern: State initialization
 * - Immutable State: All updates create new state
 */
@Injectable({ providedIn: 'root' })
@StoreConfig({ name: '_available_users' })
export class AvailableUsersStore extends Store<AvailableUsersState> {
	constructor() {
		super(createInitialState());
	}

	// ============================================================================
	// LOADING STATE MANAGEMENT
	// ============================================================================

	/**
	 * Set loading state for initial load
	 * @param loading - Loading state
	 */
	setLoading(loading: boolean): void {
		this.update({ loading });
	}

	/**
	 * Set loading state for loading more (infinite scroll)
	 * @param loadingMore - Loading more state
	 */
	setLoadingMore(loadingMore: boolean): void {
		this.update({ loadingMore });
	}

	/**
	 * Set error message
	 * @param error - Error message or null to clear
	 */
	override setError<T>(error: T): void {
		this.update({ error: error as string | null });
	}

	// ============================================================================
	// USER DATA MANAGEMENT
	// ============================================================================

	/**
	 * Set users (replace existing)
	 * @param users - Array of users
	 * @param total - Total count of users
	 */
	setUsers(users: IUser[], total?: number): void {
		const currentState = this.getValue();
		this.update({
			users,
			error: null,
			pagination: {
				...currentState.pagination,
				total: total !== undefined ? total : users.length,
				hasMore: total !== undefined ? users.length < total : false
			}
		});
	}

	/**
	 * Append users for infinite scroll
	 * Prevents duplicates using Set
	 * @param newUsers - New users to append
	 * @param total - Total count of users
	 */
	appendUsers(newUsers: IUser[], total: number): void {
		const currentState = this.getValue();
		const existingUsers = currentState.users;

		// Use Map for O(1) lookup to prevent duplicates
		const userMap = new Map<string, IUser>();
		existingUsers.forEach((user) => userMap.set(user.id, user));
		newUsers.forEach((user) => userMap.set(user.id, user));

		const mergedUsers = Array.from(userMap.values());

		this.update({
			users: mergedUsers,
			error: null,
			pagination: {
				...currentState.pagination,
				total,
				hasMore: mergedUsers.length < total
			}
		});
	}

	/**
	 * Clear all users
	 */
	clearUsers(): void {
		this.update({
			users: [],
			pagination: {
				skip: 0,
				take: 20,
				total: 0,
				hasMore: false
			}
		});
	}

	// ============================================================================
	// SEARCH AND FILTER MANAGEMENT
	// ============================================================================

	/**
	 * Set search term
	 * @param searchTerm - Search term
	 */
	setSearchTerm(searchTerm: string): void {
		this.update({ searchTerm });
	}

	/**
	 * Clear search term
	 */
	clearSearchTerm(): void {
		this.update({ searchTerm: '' });
	}

	// ============================================================================
	// SELECTION MANAGEMENT
	// ============================================================================

	/**
	 * Set selected user IDs
	 * @param userIds - Array of user IDs
	 */
	setSelectedUserIds(userIds: string[]): void {
		this.update({ selectedUserIds: userIds });
	}

	/**
	 * Add user to selection
	 * @param userId - User ID to add
	 */
	addSelectedUser(userId: string): void {
		const currentState = this.getValue();
		const selectedUserIds = [...currentState.selectedUserIds];

		if (!selectedUserIds.includes(userId)) {
			selectedUserIds.push(userId);
			this.update({ selectedUserIds });
		}
	}

	/**
	 * Remove user from selection
	 * @param userId - User ID to remove
	 */
	removeSelectedUser(userId: string): void {
		const currentState = this.getValue();
		const selectedUserIds = currentState.selectedUserIds.filter((id) => id !== userId);
		this.update({ selectedUserIds });
	}

	/**
	 * Clear all selections
	 */
	clearSelection(): void {
		this.update({ selectedUserIds: [] });
	}

	// ============================================================================
	// PAGINATION MANAGEMENT
	// ============================================================================

	/**
	 * Set skip value
	 * @param skip - Number of records to skip
	 */
	setSkip(skip: number): void {
		const currentState = this.getValue();
		this.update({
			pagination: {
				...currentState.pagination,
				skip
			}
		});
	}

	/**
	 * Set take value
	 * @param take - Number of records to take
	 */
	setTake(take: number): void {
		const currentState = this.getValue();
		this.update({
			pagination: {
				...currentState.pagination,
				take,
				skip: 0 // Reset to beginning when take size changes
			}
		});
	}

	/**
	 * Increment skip for loading next page
	 */
	incrementSkip(): void {
		const currentState = this.getValue();
		this.update({
			pagination: {
				...currentState.pagination,
				skip: currentState.pagination.skip + currentState.pagination.take
			}
		});
	}

	/**
	 * Reset pagination to initial state
	 */
	resetPagination(): void {
		const currentState = this.getValue();
		this.update({
			pagination: {
				...currentState.pagination,
				skip: 0,
				total: 0,
				hasMore: false
			}
		});
	}

	// ============================================================================
	// CONTEXT MANAGEMENT
	// ============================================================================

	/**
	 * Set organization context
	 * @param organizationId - Organization ID
	 * @param tenantId - Tenant ID
	 */
	setOrganizationContext(organizationId: string, tenantId: string): void {
		this.update({ organizationId, tenantId });
	}

	/**
	 * Clear organization context
	 */
	clearOrganizationContext(): void {
		this.update({ organizationId: null, tenantId: null });
	}

	// ============================================================================
	// RESET
	// ============================================================================

	/**
	 * Reset store to initial state
	 */
	reset(): void {
		this.update(createInitialState());
	}
}
