import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { IUser } from '@gauzy/contracts';
import { combineLatest, map, Observable } from 'rxjs';
import { AvailableUsersState, AvailableUsersStore } from '../stores/available-users.store';

/**
 * Available Users Query
 *
 * Responsibilities (Single Responsibility Principle):
 * - Select state from store
 * - Derive computed state
 * - Provide filtered and sorted data
 *
 * Design Patterns:
 * - Query Pattern: Separate read operations from write
 * - Computed Properties: Derive state without mutation
 * - Observable Pattern: Reactive data streams
 */
@Injectable({ providedIn: 'root' })
export class AvailableUsersQuery extends Query<AvailableUsersState> {
	constructor(protected store: AvailableUsersStore) {
		super(store);
	}

	// ============================================================================
	// STATE SELECTORS - Observable streams
	// ============================================================================

	/**
	 * Select all users
	 */
	readonly users$ = this.select((state) => state.users);

	/**
	 * Select loading state
	 */
	readonly loading$ = this.select((state) => state.loading);

	/**
	 * Select loading more state
	 */
	readonly loadingMore$ = this.select((state) => state.loadingMore);

	/**
	 * Select error state
	 */
	readonly error$ = this.select((state) => state.error);

	/**
	 * Select search term
	 */
	readonly searchTerm$ = this.select((state) => state.searchTerm);

	/**
	 * Select selected user IDs
	 */
	readonly selectedUserIds$ = this.select((state) => state.selectedUserIds);

	/**
	 * Select pagination state
	 */
	readonly pagination$ = this.select((state) => state.pagination);

	/**
	 * Select organization context
	 */
	readonly organizationContext$ = this.select((state) => ({
		organizationId: state.organizationId,
		tenantId: state.tenantId
	}));

	// ============================================================================
	// PAGINATION SELECTORS
	// ============================================================================

	/**
	 * Select current skip value
	 */
	readonly currentSkip$ = this.select((state) => state.pagination.skip);

	/**
	 * Select current take value
	 */
	readonly currentTake$ = this.select((state) => state.pagination.take);

	/**
	 * Select total count
	 */
	readonly total$ = this.select((state) => state.pagination.total);

	/**
	 * Select has more flag
	 */
	readonly hasMore$ = this.select((state) => state.pagination.hasMore);

	// ============================================================================
	// COMPUTED SELECTORS - Derived state
	// ============================================================================

	/**
	 * Get selected users as objects
	 * Combines users$ and selectedUserIds$ to get full user objects
	 */
	readonly selectedUsers$: Observable<IUser[]> = combineLatest([this.users$, this.selectedUserIds$]).pipe(
		map(([users, selectedIds]) => users.filter((user) => selectedIds.includes(user.id)))
	);

	/**
	 * Get filtered users based on search term
	 * Applies search filter to users
	 */
	readonly filteredUsers$: Observable<IUser[]> = combineLatest([this.users$, this.searchTerm$]).pipe(
		map(([users, searchTerm]) => {
			if (!searchTerm.trim()) {
				return users;
			}

			const term = searchTerm.toLowerCase();
			return users.filter(
				(user) =>
					user.firstName?.toLowerCase().includes(term) ||
					user.lastName?.toLowerCase().includes(term) ||
					user.email?.toLowerCase().includes(term)
			);
		})
	);

	/**
	 * Get filtered users excluding assigned users
	 * Combines filtered users with assigned users list
	 * @param assignedUserIds - IDs of assigned users to exclude
	 */
	getAvailableUsers$(assignedUserIds$: Observable<string[]>): Observable<IUser[]> {
		return combineLatest([this.filteredUsers$, assignedUserIds$]).pipe(
			map(([filteredUsers, assignedIds]) => filteredUsers.filter((user) => !assignedIds.includes(user.id)))
		);
	}

	/**
	 * Check if there are any errors
	 */
	readonly hasError$: Observable<boolean> = this.error$.pipe(map((error) => !!error));

	/**
	 * Check if there are any users
	 */
	readonly hasUsers$: Observable<boolean> = this.users$.pipe(map((users) => users.length > 0));

	/**
	 * Get selected user count
	 */
	readonly selectedCount$: Observable<number> = this.selectedUserIds$.pipe(map((ids) => ids.length));

	/**
	 * Check if any users are selected
	 */
	readonly hasSelection$: Observable<boolean> = this.selectedUserIds$.pipe(map((ids) => ids.length > 0));

	/**
	 * Check if loading (either initial or more)
	 */
	readonly isLoading$: Observable<boolean> = combineLatest([this.loading$, this.loadingMore$]).pipe(
		map(([loading, loadingMore]) => loading || loadingMore)
	);

	// ============================================================================
	// SYNCHRONOUS GETTERS - For imperative access
	// ============================================================================

	/**
	 * Get current users synchronously
	 */
	get users(): IUser[] {
		return this.getValue().users;
	}

	/**
	 * Get loading state synchronously
	 */
	get loading(): boolean {
		return this.getValue().loading;
	}

	/**
	 * Get loading more state synchronously
	 */
	get loadingMore(): boolean {
		return this.getValue().loadingMore;
	}

	/**
	 * Get error synchronously
	 */
	get error(): string | null {
		return this.getValue().error;
	}

	/**
	 * Get search term synchronously
	 */
	get searchTerm(): string {
		return this.getValue().searchTerm;
	}

	/**
	 * Get selected user IDs synchronously
	 */
	get selectedUserIds(): string[] {
		return this.getValue().selectedUserIds;
	}

	/**
	 * Get pagination synchronously
	 */
	get pagination() {
		return this.getValue().pagination;
	}

	/**
	 * Get current skip synchronously
	 */
	get currentSkip(): number {
		return this.getValue().pagination.skip;
	}

	/**
	 * Get current take synchronously
	 */
	get currentTake(): number {
		return this.getValue().pagination.take;
	}

	/**
	 * Get total synchronously
	 */
	get total(): number {
		return this.getValue().pagination.total;
	}

	/**
	 * Get has more synchronously
	 */
	get hasMore(): boolean {
		return this.getValue().pagination.hasMore;
	}

	/**
	 * Get organization context synchronously
	 */
	get organizationContext() {
		const state = this.getValue();
		return {
			organizationId: state.organizationId,
			tenantId: state.tenantId
		};
	}

	// ============================================================================
	// UTILITY METHODS
	// ============================================================================

	/**
	 * Check if a user is selected
	 * @param userId - User ID to check
	 */
	isUserSelected(userId: string): boolean {
		return this.selectedUserIds.includes(userId);
	}

	/**
	 * Check if user is selected (observable)
	 * @param userId - User ID to check
	 */
	isUserSelected$(userId: string): Observable<boolean> {
		return this.selectedUserIds$.pipe(map((ids) => ids.includes(userId)));
	}

	/**
	 * Get user by ID
	 * @param userId - User ID
	 */
	getUserById(userId: string): IUser | undefined {
		return this.users.find((user) => user.id === userId);
	}

	/**
	 * Get user by ID (observable)
	 * @param userId - User ID
	 */
	getUserById$(userId: string): Observable<IUser | undefined> {
		return this.users$.pipe(map((users) => users.find((user) => user.id === userId)));
	}
}
