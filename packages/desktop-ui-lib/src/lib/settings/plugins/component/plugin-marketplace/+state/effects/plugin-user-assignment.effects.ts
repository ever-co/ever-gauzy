import { Injectable } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { catchError, exhaustMap, finalize, map, of, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../../../services/toastr-notification.service';
import { PluginUserAssignmentService } from '../../../../services/plugin-user-assignment.service';
import { PluginUserManagementComponent } from '../../plugin-user-management/plugin-user-management.component';
import { PluginUserAssignmentActions } from '../actions/plugin-user-assignment.actions';
import { PluginUserAssignmentStore } from '../stores/plugin-user-assignment.store';

/**
 * Plugin User Assignment Effects
 *
 * Handles side effects for user assignment operations following Akita patterns
 *
 * Responsibilities:
 * - Coordinate service calls with state updates
 * - Manage loading states through store
 * - Handle errors and success notifications
 * - Transform service responses to actions
 *
 * Best Practices Applied:
 * - Proper loading state management (set loading before, clear after)
 * - Error handling with user-friendly messages
 * - Success notifications for user feedback
 * - Finalize operator for cleanup
 * - Immutable state updates
 */
@Injectable({ providedIn: 'root' })
export class PluginUserAssignmentEffects {
	constructor(
		private readonly actions$: Actions,
		private readonly pluginUserAssignmentService: PluginUserAssignmentService,
		private readonly store: PluginUserAssignmentStore,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService
	) {}

	/**
	 * Load assignments effect with pagination support
	 * Handles loading user assignments for a plugin or specific installation
	 */
	loadAssignments$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.loadAssignments),
				tap(() => this.store.setLoading(true)),
				switchMap(({ pluginId, includeInactive, take, skip, append }) => {
					const currentSkip = skip !== undefined ? skip : this.store.getValue().pagination.skip;
					const currentTake = take !== undefined ? take : this.store.getValue().pagination.take;

					// Use the main endpoint GET /plugins/:pluginId/users
					return this.pluginUserAssignmentService
						.getPluginUserAssignments(pluginId, includeInactive, currentTake, currentSkip)
						.pipe(
							map((response) =>
								PluginUserAssignmentActions.loadAssignmentsSuccess({
									assignments: response.items,
									total: response.total,
									append: append || false
								})
							),
							catchError((error) => {
								const errorMessage = this.translateService.instant(
									'PLUGIN.USER_MANAGEMENT.ERRORS.LOAD_FAILED',
									{ message: error.message || 'Unknown error' }
								);
								return of(PluginUserAssignmentActions.loadAssignmentsFailure({ error: errorMessage }));
							}),
							finalize(() => this.store.setLoading(false))
						);
				})
			);
		},
		{ dispatch: true }
	);

	/**
	 * Load more assignments effect for infinite scroll
	 * Handles loading next page of user assignments
	 */
	loadMoreAssignments$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.loadMoreAssignments),
				tap(() => {
					this.store.setLoadingMore(true);
					this.store.incrementSkip();
				}),
				switchMap(({ pluginId, includeInactive }) => {
					const { skip, take } = this.store.getValue().pagination;

					// Use the main endpoint GET /plugins/:pluginId/users
					return this.pluginUserAssignmentService.loadNextPage(pluginId, take, skip, includeInactive).pipe(
						map((response) =>
							PluginUserAssignmentActions.loadMoreAssignmentsSuccess({
								assignments: response.items,
								total: response.total
							})
						),
						catchError((error) => {
							const errorMessage = this.translateService.instant(
								'PLUGIN.USER_MANAGEMENT.ERRORS.LOAD_MORE_FAILED',
								{ message: error.message || 'Unknown error' }
							);
							return of(PluginUserAssignmentActions.loadMoreAssignmentsFailure({ error: errorMessage }));
						}),
						finalize(() => this.store.setLoadingMore(false))
					);
				})
			);
		},
		{ dispatch: true }
	);

	/**
	 * Assign users effect
	 * Uses subscription-based access control for user assignment
	 * Creates child USER-scoped subscriptions for the assigned users
	 */
	assignUsers$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.assignUsers),
				tap(() => this.store.setLoading(true)),
				switchMap(({ pluginId, userIds, reason }) =>
					this.pluginUserAssignmentService.assignUsers(pluginId, userIds, reason).pipe(
						map((response) => {
							// Show success notification
							this.toastrService.success(
								this.translateService.instant('PLUGIN.USER_MANAGEMENT.SUCCESS.USERS_ASSIGNED', {
									count: response.assignedUsers
								})
							);

							// Reload assignments to reflect changes
							return PluginUserAssignmentActions.loadAssignments({
								pluginId,
								includeInactive: false,
								take: this.store.getValue().pagination.take,
								skip: 0
							});
						}),
						catchError((error) => {
							const errorMessage = this.translateService.instant(
								'PLUGIN.USER_MANAGEMENT.ERRORS.ASSIGN_FAILED',
								{ message: error.error?.message || error.message || 'Unknown error' }
							);
							this.toastrService.error(errorMessage);
							return of(PluginUserAssignmentActions.assignUsersFailure({ error: errorMessage }));
						}),
						finalize(() => this.store.setLoading(false))
					)
				)
			);
		},
		{ dispatch: true }
	);

	/**
	 * Unassign user effect
	 * Uses subscription-based revocation to remove user access
	 * Cancels the child USER-scoped subscription
	 */
	unassignUser$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.unassignUser),
				tap(() => this.store.setLoading(true)),
				switchMap(({ pluginId, userId }) =>
					this.pluginUserAssignmentService
						.revokeUsers(pluginId, [userId], 'User unassigned by administrator')
						.pipe(
							map((response) => {
								// Show success notification
								this.toastrService.success(
									this.translateService.instant('PLUGIN.USER_MANAGEMENT.SUCCESS.USER_UNASSIGNED')
								);

								// Reload assignments to reflect changes
								return PluginUserAssignmentActions.loadAssignments({
									pluginId,
									includeInactive: false,
									take: this.store.getValue().pagination.take,
									skip: 0
								});
							}),
							catchError((error) => {
								const errorMessage = this.translateService.instant(
									'PLUGIN.USER_MANAGEMENT.ERRORS.UNASSIGN_FAILED',
									{ message: error.error?.message || error.message || 'Unknown error' }
								);
								this.toastrService.error(errorMessage);
								return of(PluginUserAssignmentActions.unassignUserFailure({ error: errorMessage }));
							}),
							finalize(() => this.store.setLoading(false))
						)
				)
			);
		},
		{ dispatch: true }
	);

	bulkAssignUsers$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.bulkAssignUsers),
				switchMap(({ pluginSubscriptionIds, userIds, reason }) =>
					this.pluginUserAssignmentService.createBatch({ pluginSubscriptionIds, userIds, reason }).pipe(
						map((assignments) => PluginUserAssignmentActions.bulkAssignUsersSuccess({ assignments })),
						catchError((error) =>
							of(
								PluginUserAssignmentActions.bulkAssignUsersFailure({
									error: error.message || 'Unknown error'
								})
							)
						)
					)
				)
			);
		},
		{ dispatch: true }
	);

	getUserAssignmentDetails$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.getUserAssignmentDetails),
				switchMap(({ pluginId, userId }) =>
					this.pluginUserAssignmentService.getUserAssignmentDetails(pluginId, userId).pipe(
						map(({ hasAccess, assignment }) =>
							PluginUserAssignmentActions.getUserAssignmentDetailsSuccess({ hasAccess, assignment })
						),
						catchError((error) =>
							of(
								PluginUserAssignmentActions.getUserAssignmentDetailsFailure({
									error: error.message || 'Unknown error'
								})
							)
						)
					)
				)
			);
		},
		{ dispatch: true }
	);

	/**
	 * Check user access effect
	 * Uses subscription-based access check
	 */
	checkUserAccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.checkUserAccess),
				switchMap(({ pluginId, userId }) =>
					this.pluginUserAssignmentService.checkUserAccess(pluginId, userId).pipe(
						map((response) =>
							PluginUserAssignmentActions.checkUserAccessSuccess({ hasAccess: response.hasAccess })
						),
						catchError((error) =>
							of(
								PluginUserAssignmentActions.checkUserAccessFailure({
									error: error.error?.message || error.message || 'Unknown error'
								})
							)
						)
					)
				)
			);
		},
		{ dispatch: true }
	);

	// ============================================================================
	// SUCCESS & ERROR HANDLING
	// ============================================================================

	/**
	 * Handle successful load
	 * Updates store with loaded assignments
	 */
	handleLoadSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.loadAssignmentsSuccess),
				tap(({ assignments, total, append }) => {
					console.log('Load assignments success:', assignments);
					if (append) {
						this.store.appendAssignments(assignments, total);
					} else {
						this.store.setAssignments(assignments, total);
					}
				})
			);
		},
		{ dispatch: false }
	);

	/**
	 * Handle successful load more
	 * Appends new assignments to existing list
	 */
	handleLoadMoreSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.loadMoreAssignmentsSuccess),
				tap(({ assignments, total }) => {
					this.store.appendAssignments(assignments, total);
				})
			);
		},
		{ dispatch: false }
	);

	/**
	 * Show success notifications
	 * Displays user-friendly success messages
	 */
	showSuccessNotifications$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(
					PluginUserAssignmentActions.assignUsersSuccess,
					PluginUserAssignmentActions.unassignUserSuccess,
					PluginUserAssignmentActions.bulkAssignUsersSuccess
				),
				tap((action) => {
					let message: string;

					if (action.type === PluginUserAssignmentActions.assignUsersSuccess.type) {
						const count = (action as any).assignments?.length || 0;
						message = this.translateService.instant('PLUGIN.USER_MANAGEMENT.SUCCESS.USERS_ASSIGNED', {
							count
						});
					} else if (action.type === PluginUserAssignmentActions.unassignUserSuccess.type) {
						message = this.translateService.instant('PLUGIN.USER_MANAGEMENT.SUCCESS.USER_UNASSIGNED');
					} else {
						const count = (action as any).assignments?.length || 0;
						message = this.translateService.instant('PLUGIN.USER_MANAGEMENT.SUCCESS.BULK_ASSIGNED', {
							count
						});
					}

					this.toastrService.success(message);
				})
			);
		},
		{ dispatch: false }
	);

	/**
	 * Show error notifications
	 * Displays user-friendly error messages and updates store
	 */
	showErrorNotifications$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(
					PluginUserAssignmentActions.loadAssignmentsFailure,
					PluginUserAssignmentActions.loadMoreAssignmentsFailure,
					PluginUserAssignmentActions.assignUsersFailure,
					PluginUserAssignmentActions.unassignUserFailure,
					PluginUserAssignmentActions.bulkAssignUsersFailure,
					PluginUserAssignmentActions.getUserAssignmentDetailsFailure,
					PluginUserAssignmentActions.checkUserAccessFailure
				),
				tap((action) => {
					const error = (action as any).error;
					this.store.setErrorMessage(error);
					this.toastrService.error(error);
					console.error('Plugin user assignment operation failed:', error);
				})
			);
		},
		{ dispatch: false }
	);

	openUserManagementDialog$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.manageUsers),
				exhaustMap(
					({ plugin }) =>
						// Open the dialog using NbDialogService
						this.dialogService.open(PluginUserManagementComponent, {
							context: {
								plugin
							}
						}).onClose
				)
			);
		},
		{ dispatch: false }
	);
}
