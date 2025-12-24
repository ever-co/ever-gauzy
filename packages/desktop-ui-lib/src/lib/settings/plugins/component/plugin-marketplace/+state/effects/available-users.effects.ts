import { Injectable } from '@angular/core';
import { IUserOrganization } from '@gauzy/contracts';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { catchError, finalize, from, map, of, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../../../services/toastr-notification.service';
import { UserOrganizationService } from '../../../../../../time-tracker/organization-selector/user-organization.service';
import { AvailableUsersActions } from '../actions/available-users.actions';
import { AvailableUsersStore } from '../stores/available-users.store';

/**
 * Available Users Effects
 *
 * Responsibilities (Single Responsibility Principle):
 * - Handle side effects for available users operations
 * - Coordinate service calls with store updates
 * - Manage loading states
 * - Handle errors and notifications
 *
 * Design Patterns:
 * - Effect Pattern: Separate side effects from state
 * - Observer Pattern: React to actions
 * - Strategy Pattern: Different strategies for load vs load more
 *
 * Best Practices:
 * - Proper loading state management
 * - Error handling with user-friendly messages
 * - Finalize operator for cleanup
 * - Immutable state updates via store
 */
@Injectable({ providedIn: 'root' })
export class AvailableUsersEffects {
	constructor(
		private readonly actions$: Actions,
		private readonly store: AvailableUsersStore,
		private readonly userOrganizationService: UserOrganizationService,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService
	) {}

	// ============================================================================
	// LOAD USERS EFFECT
	// ============================================================================

	/**
	 * Load users effect
	 * Handles initial loading of users with pagination
	 */
	loadUsers$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(AvailableUsersActions.loadUsers),
				tap(({ skip, take }) => {
					this.store.setLoading(true);
					// Update pagination if provided
					if (skip !== undefined) {
						this.store.setSkip(skip);
					}
					if (take !== undefined) {
						this.store.setTake(take);
					}
				}),
				switchMap(({ organizationId, tenantId, skip, take }) => {
					const currentState = this.store.getValue();
					const currentSkip = skip !== undefined ? skip : currentState.pagination.skip;
					const currentTake = take !== undefined ? take : currentState.pagination.take;

					// Fetch user organizations
					return from(
						this.userOrganizationService.getAll(['user', 'user.role'], { organizationId, tenantId }, false)
					).pipe(
						map((response) => {
							// Extract users from user organizations
							const allUsers = response.items
								.filter((userOrg: IUserOrganization) => userOrg.isActive && userOrg.user)
								.map((userOrg: IUserOrganization) => userOrg.user);

							// Apply pagination using currentSkip/currentTake
							const paginatedUsers = allUsers.slice(currentSkip, currentSkip + currentTake);

							return AvailableUsersActions.loadUsersSuccess({
								users: paginatedUsers,
								total: response.total
							});
						}),
						catchError((error) => {
							const errorMessage = this.translateService.instant(
								'PLUGIN.USER_MANAGEMENT.ERRORS.LOAD_USERS_FAILED',
								{ message: error.message || 'Unknown error' }
							);
							console.error('[AvailableUsersEffects] Load users failed:', error);
							return of(AvailableUsersActions.loadUsersFailure({ error: errorMessage }));
						}),
						finalize(() => this.store.setLoading(false))
					);
				})
			);
		},
		{ dispatch: true }
	);

	// ============================================================================
	// LOAD MORE USERS EFFECT (Infinite Scroll)
	// ============================================================================

	/**
	 * Load more users effect
	 * Handles loading next page of users for infinite scroll
	 */
	loadMoreUsers$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(AvailableUsersActions.loadMoreUsers),
				tap(() => {
					this.store.setLoadingMore(true);
					this.store.incrementSkip();
				}),
				switchMap(({ organizationId, tenantId }) => {
					const { skip, take } = this.store.getValue().pagination;

					// Fetch user organizations
					return from(
						this.userOrganizationService.getAll(['user', 'user.role'], { organizationId, tenantId }, false)
					).pipe(
						map((response) => {
							// Extract users from user organizations
							const allUsers = response.items
								.filter((userOrg: IUserOrganization) => userOrg.isActive && userOrg.user)
								.map((userOrg: IUserOrganization) => userOrg.user);

							// Apply pagination for next page
							const paginatedUsers = allUsers.slice(skip, skip + take);
							const total = allUsers.length;

							console.log(
								'[AvailableUsersEffects] Loaded more users:',
								paginatedUsers.length,
								'Skip:',
								skip,
								'Total:',
								total
							);

							return AvailableUsersActions.loadMoreUsersSuccess({
								users: paginatedUsers,
								total
							});
						}),
						catchError((error) => {
							const errorMessage = this.translateService.instant(
								'PLUGIN.USER_MANAGEMENT.ERRORS.LOAD_MORE_USERS_FAILED',
								{ message: error.message || 'Unknown error' }
							);
							console.error('[AvailableUsersEffects] Load more users failed:', error);
							return of(AvailableUsersActions.loadMoreUsersFailure({ error: errorMessage }));
						}),
						finalize(() => this.store.setLoadingMore(false))
					);
				})
			);
		},
		{ dispatch: true }
	);

	// ============================================================================
	// SUCCESS HANDLERS
	// ============================================================================

	/**
	 * Handle load users success
	 * Updates store with loaded users
	 */
	handleLoadUsersSuccess$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(AvailableUsersActions.loadUsersSuccess),
			tap(({ users, total }) => {
				this.store.setUsers(users, total);
				console.log('[AvailableUsersEffects] Users set in store:', users.length, 'Total:', total);
			})
		);
	});

	/**
	 * Handle load more users success
	 * Appends users to existing list
	 */
	handleLoadMoreUsersSuccess$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(AvailableUsersActions.loadMoreUsersSuccess),
			tap(({ users, total }) => {
				this.store.appendUsers(users, total);
				console.log('[AvailableUsersEffects] Users appended to store:', users.length, 'Total:', total);
			})
		);
	});

	// ============================================================================
	// ERROR HANDLERS
	// ============================================================================

	/**
	 * Handle load users failure
	 * Shows error notification and updates store
	 */
	handleLoadUsersFailure$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(AvailableUsersActions.loadUsersFailure),
			tap(({ error }) => {
				this.store.setError(error);
				this.toastrService.error(error);
				console.error('[AvailableUsersEffects] Load users error:', error);
			})
		);
	});

	/**
	 * Handle load more users failure
	 * Shows error notification and updates store
	 */
	handleLoadMoreUsersFailure$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(AvailableUsersActions.loadMoreUsersFailure),
			tap(({ error }) => {
				this.store.setError(error);
				this.toastrService.error(error);
				console.error('[AvailableUsersEffects] Load more users error:', error);
			})
		);
	});

	// ============================================================================
	// SEARCH AND FILTER EFFECTS
	// ============================================================================

	/**
	 * Handle set search term
	 * Updates store with new search term
	 */
	handleSetSearchTerm$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(AvailableUsersActions.setSearchTerm),
			tap(({ searchTerm }) => {
				this.store.setSearchTerm(searchTerm);
			})
		);
	});

	/**
	 * Handle clear search term
	 * Clears search term from store
	 */
	handleClearSearchTerm$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(AvailableUsersActions.clearSearchTerm),
			tap(() => {
				this.store.clearSearchTerm();
			})
		);
	});

	// ============================================================================
	// SELECTION EFFECTS
	// ============================================================================

	/**
	 * Handle select user
	 * Adds user to selection
	 */
	handleSelectUser$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(AvailableUsersActions.selectUser),
			tap(({ userId }) => {
				this.store.addSelectedUser(userId);
				console.log('[AvailableUsersEffects] User selected:', userId);
			})
		);
	});

	/**
	 * Handle deselect user
	 * Removes user from selection
	 */
	handleDeselectUser$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(AvailableUsersActions.deselectUser),
				tap(({ userId }) => {
					this.store.removeSelectedUser(userId);
					console.log('[AvailableUsersEffects] User deselected:', userId);
				})
			);
		},
		{ dispatch: false }
	);

	/**
	 * Handle set selected users
	 * Sets selected users in store
	 */
	handleSetSelectedUsers$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(AvailableUsersActions.setSelectedUsers),
			tap(({ userIds }) => {
				this.store.setSelectedUserIds(userIds);
				console.log('[AvailableUsersEffects] Selected users set:', userIds.length);
			})
		);
	});

	/**
	 * Handle clear selection
	 * Clears all selected users
	 */
	handleClearSelection$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(AvailableUsersActions.clearSelection),
			tap(() => {
				this.store.clearSelection();
				console.log('[AvailableUsersEffects] Selection cleared');
			})
		);
	});

	// ============================================================================
	// CONTEXT MANAGEMENT EFFECTS
	// ============================================================================

	/**
	 * Handle set organization context
	 * Updates organization context in store
	 */
	handleSetOrganizationContext$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(AvailableUsersActions.setOrganizationContext),
			tap(({ organizationId, tenantId }) => {
				this.store.setOrganizationContext(organizationId, tenantId);
				console.log('[AvailableUsersEffects] Organization context set:', organizationId, tenantId);
			})
		);
	});

	/**
	 * Handle clear organization context
	 * Clears organization context from store
	 */
	handleClearOrganizationContext$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(AvailableUsersActions.clearOrganizationContext),
			tap(() => {
				this.store.clearOrganizationContext();
				console.log('[AvailableUsersEffects] Organization context cleared');
			})
		);
	});

	// ============================================================================
	// STATE MANAGEMENT EFFECTS
	// ============================================================================

	/**
	 * Handle clear users
	 * Clears all users from store
	 */
	handleClearUsers$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(AvailableUsersActions.clearUsers),
			tap(() => {
				this.store.clearUsers();
				console.log('[AvailableUsersEffects] Users cleared');
			})
		);
	});

	/**
	 * Handle clear error
	 * Clears error from store
	 */
	handleClearError$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(AvailableUsersActions.clearError),
			tap(() => {
				this.store.setError(null);
				console.log('[AvailableUsersEffects] Error cleared');
			})
		);
	});

	/**
	 * Handle reset
	 * Resets store to initial state
	 */
	handleReset$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(AvailableUsersActions.reset),
			tap(() => {
				this.store.reset();
				console.log('[AvailableUsersEffects] Store reset');
			})
		);
	});
}
