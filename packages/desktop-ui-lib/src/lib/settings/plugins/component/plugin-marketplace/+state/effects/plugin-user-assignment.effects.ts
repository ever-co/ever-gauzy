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
	 * Handles loading allowed users from plugin tenant
	 */
	loadAssignments$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.loadAssignments),
				tap(() => this.store.setLoading(true)),
				switchMap(({ pluginId, take, skip, append }) => {
					const currentSkip = skip !== undefined ? skip : this.store.getValue().pagination.skip;
					const currentTake = take !== undefined ? take : this.store.getValue().pagination.take;

					// First get the plugin tenant, then load users from it
					return this.pluginUserAssignmentService.getPluginTenantByPluginId(pluginId).pipe(
						switchMap((pluginTenant) =>
							this.pluginUserAssignmentService
								.getPluginTenantUsers(pluginTenant.id, 'allowed', currentTake, currentSkip)
								.pipe(
									map((response) =>
										PluginUserAssignmentActions.loadAssignmentsSuccess({
											assignments: response.items.map((item) => ({
												id: item.id,
												userId: item.id,
												pluginSubscriptionId: '',
												assignedAt: item.assignedAt,
												assignedBy: '',
												isActive: item.accessType === 'allowed',
												reason: '',
												user: {
													id: item.id,
													firstName: item.firstName,
													lastName: item.lastName,
													email: item.email,
													imageUrl: item.imageUrl
												}
											})),
											total: response.total,
											append: append || false
										})
									)
								)
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
				switchMap(({ pluginId }) => {
					const { skip, take } = this.store.getValue().pagination;

					// First get the plugin tenant, then load more users from it
					return this.pluginUserAssignmentService.getPluginTenantByPluginId(pluginId).pipe(
						switchMap((pluginTenant) =>
							this.pluginUserAssignmentService
								.getPluginTenantUsers(pluginTenant.id, 'allowed', take, skip)
								.pipe(
									map((response) =>
										PluginUserAssignmentActions.loadMoreAssignmentsSuccess({
											assignments: response.items.map((item) => ({
												id: item.id,
												userId: item.id,
												pluginSubscriptionId: '',
												assignedAt: item.assignedAt,
												assignedBy: '',
												isActive: item.accessType === 'allowed',
												reason: '',
												user: {
													id: item.id,
													firstName: item.firstName,
													lastName: item.lastName,
													email: item.email,
													imageUrl: item.imageUrl
												}
											})),
											total: response.total
										})
									)
								)
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
	 * Uses plugin tenant-based access control for user assignment
	 * First gets/creates plugin tenant, then adds users to allowed list
	 */
	assignUsers$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.assignUsers),
				tap(() => this.store.setLoading(true)),
				switchMap(({ pluginId, userIds, reason }) =>
					// First, get or create the plugin tenant
					this.pluginUserAssignmentService.getPluginTenantByPluginId(pluginId).pipe(
						switchMap((pluginTenant) =>
							// Then allow the users to the plugin tenant
							this.pluginUserAssignmentService
								.allowUsersToPluginTenant(pluginTenant.id, userIds, reason)
								.pipe(
									map((response) => {
										// Show success notification
										this.toastrService.success(
											this.translateService.instant(
												'PLUGIN.USER_MANAGEMENT.SUCCESS.USERS_ASSIGNED',
												{
													count: response.affectedUserIds?.length || userIds.length
												}
											)
										);

										// Reload plugin tenant users to reflect changes
										return PluginUserAssignmentActions.loadPluginTenantUsers({
											pluginTenantId: pluginTenant.id,
											type: 'allowed'
										});
									}),
									catchError((error) => {
										const errorMessage = this.translateService.instant(
											'PLUGIN.USER_MANAGEMENT.ERRORS.ASSIGN_FAILED',
											{ message: error.error?.message || error.message || 'Unknown error' }
										);
										this.toastrService.error(errorMessage);
										return of(
											PluginUserAssignmentActions.assignUsersFailure({ error: errorMessage })
										);
									})
								)
						),
						catchError((error) => {
							const errorMessage = this.translateService.instant(
								'PLUGIN.USER_MANAGEMENT.ERRORS.ASSIGN_FAILED',
								{ message: error.error?.message || error.message || 'Failed to get plugin tenant' }
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
	 * Uses plugin tenant-based removal from allowed users list
	 */
	unassignUser$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.unassignUser),
				tap(() => this.store.setLoading(true)),
				switchMap(({ pluginId, userId }) =>
					// First, get the plugin tenant
					this.pluginUserAssignmentService.getPluginTenantByPluginId(pluginId).pipe(
						switchMap((pluginTenant) =>
							// Then remove the user from allowed list
							this.pluginUserAssignmentService
								.removeAllowedUsersFromPluginTenant(
									pluginTenant.id,
									[userId],
									'User unassigned by administrator'
								)
								.pipe(
									map((response) => {
										// Show success notification
										this.toastrService.success(
											this.translateService.instant(
												'PLUGIN.USER_MANAGEMENT.SUCCESS.USER_UNASSIGNED'
											)
										);

										// Reload plugin tenant users to reflect changes
										return PluginUserAssignmentActions.loadPluginTenantUsers({
											pluginTenantId: pluginTenant.id,
											type: 'allowed'
										});
									}),
									catchError((error) => {
										const errorMessage = this.translateService.instant(
											'PLUGIN.USER_MANAGEMENT.ERRORS.UNASSIGN_FAILED',
											{ message: error.error?.message || error.message || 'Unknown error' }
										);
										this.toastrService.error(errorMessage);
										return of(
											PluginUserAssignmentActions.unassignUserFailure({ error: errorMessage })
										);
									})
								)
						),
						catchError((error) => {
							const errorMessage = this.translateService.instant(
								'PLUGIN.USER_MANAGEMENT.ERRORS.UNASSIGN_FAILED',
								{ message: error.error?.message || error.message || 'Failed to get plugin tenant' }
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

	// ============================================================================
	// PLUGIN TENANT USER MANAGEMENT EFFECTS
	// ============================================================================

	/**
	 * Load allowed users for a plugin effect
	 * Resolves plugin tenant ID first, then loads allowed users
	 * This is the main entry point for components that only know the plugin ID
	 */
	loadAllowedUsersForPlugin$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.loadAllowedUsersForPlugin),
				tap(() => this.store.setLoading(true)),
				switchMap(({ pluginId, take, skip, searchTerm }) => {
					// First get the plugin tenant ID
					return this.pluginUserAssignmentService.getPluginTenantByPluginId(pluginId).pipe(
						switchMap((pluginTenant) =>
							// Then load the users from that plugin tenant
							this.pluginUserAssignmentService
								.getPluginTenantUsers(pluginTenant.id, 'allowed', take, skip, searchTerm)
								.pipe(
									map((response) =>
										PluginUserAssignmentActions.loadAllowedUsersForPluginSuccess({
											items: response.items.map((item) => ({
												id: item.id,
												userId: item.id,
												pluginSubscriptionId: '',
												assignedAt: item.assignedAt,
												assignedBy: '',
												isActive: item.accessType === 'allowed',
												reason: '',
												user: {
													id: item.id,
													firstName: item.firstName,
													lastName: item.lastName,
													email: item.email,
													imageUrl: item.imageUrl
												}
											})),
											total: response.total,
											pluginTenantId: pluginTenant.id
										})
									)
								)
						),
						catchError((error) => {
							const errorMessage =
								error.error?.message || error.message || 'Failed to load allowed users';
							return of(
								PluginUserAssignmentActions.loadAllowedUsersForPluginFailure({ error: errorMessage })
							);
						}),
						finalize(() => this.store.setLoading(false))
					);
				})
			);
		},
		{ dispatch: true }
	);

	/**
	 * Handle load allowed users for plugin success
	 * Updates the store with the assignments and stores the plugin tenant ID
	 */
	handleLoadAllowedUsersForPluginSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.loadAllowedUsersForPluginSuccess),
				tap(({ items, total, pluginTenantId }) => {
					this.store.setAssignments(items, total);
					// Store the plugin tenant ID for future operations
					this.store.setCurrentPluginTenantId(pluginTenantId);
				})
			);
		},
		{ dispatch: false }
	);

	/**
	 * Load plugin tenant users effect
	 * Handles loading allowed/denied users for a plugin tenant
	 */
	loadPluginTenantUsers$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.loadPluginTenantUsers),
				tap(() => this.store.setLoading(true)),
				switchMap(({ pluginTenantId, take, skip, searchTerm }) =>
					this.pluginUserAssignmentService
						.getPluginTenantUsers(pluginTenantId, 'allowed', take, skip, searchTerm)
						.pipe(
							map((response) =>
								PluginUserAssignmentActions.loadPluginTenantUsersSuccess({
									items: response.items.map((item) => ({
										id: item.id,
										userId: item.id,
										pluginSubscriptionId: '',
										assignedAt: item.assignedAt,
										assignedBy: '',
										isActive: item.accessType === 'allowed',
										reason: '',
										user: {
											id: item.id,
											firstName: item.firstName,
											lastName: item.lastName,
											email: item.email,
											imageUrl: item.imageUrl
										}
									})),
									total: response.total
								})
							),
							catchError((error) => {
								const errorMessage =
									error.error?.message || error.message || 'Failed to load plugin tenant users';
								return of(
									PluginUserAssignmentActions.loadPluginTenantUsersFailure({ error: errorMessage })
								);
							}),
							finalize(() => this.store.setLoading(false))
						)
				)
			);
		},
		{ dispatch: true }
	);

	/**
	 * Handle load plugin tenant users success
	 */
	handleLoadPluginTenantUsersSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.loadPluginTenantUsersSuccess),
				tap(({ items, total }) => {
					this.store.setAssignments(items, total);
				})
			);
		},
		{ dispatch: false }
	);

	/**
	 * Allow users to plugin tenant effect
	 */
	allowUsersToPluginTenant$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.allowUsersToPluginTenant),
				tap(() => this.store.setLoading(true)),
				switchMap(({ pluginTenantId, userIds, reason }) =>
					this.pluginUserAssignmentService.allowUsersToPluginTenant(pluginTenantId, userIds, reason).pipe(
						map((response) =>
							PluginUserAssignmentActions.allowUsersToPluginTenantSuccess({
								message: response.message,
								affectedUserIds: response.affectedUserIds
							})
						),
						catchError((error) => {
							const errorMessage = error.error?.message || error.message || 'Failed to allow users';
							return of(
								PluginUserAssignmentActions.allowUsersToPluginTenantFailure({ error: errorMessage })
							);
						}),
						finalize(() => this.store.setLoading(false))
					)
				)
			);
		},
		{ dispatch: true }
	);

	/**
	 * Deny users from plugin tenant effect
	 */
	denyUsersFromPluginTenant$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.denyUsersFromPluginTenant),
				tap(() => this.store.setLoading(true)),
				switchMap(({ pluginTenantId, userIds, reason }) =>
					this.pluginUserAssignmentService.denyUsersFromPluginTenant(pluginTenantId, userIds, reason).pipe(
						map((response) =>
							PluginUserAssignmentActions.denyUsersFromPluginTenantSuccess({
								message: response.message,
								affectedUserIds: response.affectedUserIds
							})
						),
						catchError((error) => {
							const errorMessage = error.error?.message || error.message || 'Failed to deny users';
							return of(
								PluginUserAssignmentActions.denyUsersFromPluginTenantFailure({ error: errorMessage })
							);
						}),
						finalize(() => this.store.setLoading(false))
					)
				)
			);
		},
		{ dispatch: true }
	);

	/**
	 * Remove allowed users from plugin tenant effect
	 */
	removeAllowedUsersFromPluginTenant$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.removeAllowedUsersFromPluginTenant),
				tap(() => this.store.setLoading(true)),
				switchMap(({ pluginTenantId, userIds, reason }) =>
					this.pluginUserAssignmentService
						.removeAllowedUsersFromPluginTenant(pluginTenantId, userIds, reason)
						.pipe(
							map((response) =>
								PluginUserAssignmentActions.removeAllowedUsersFromPluginTenantSuccess({
									message: response.message,
									affectedUserIds: response.affectedUserIds
								})
							),
							catchError((error) => {
								const errorMessage =
									error.error?.message || error.message || 'Failed to remove allowed users';
								return of(
									PluginUserAssignmentActions.removeAllowedUsersFromPluginTenantFailure({
										error: errorMessage
									})
								);
							}),
							finalize(() => this.store.setLoading(false))
						)
				)
			);
		},
		{ dispatch: true }
	);

	/**
	 * Remove denied users from plugin tenant effect
	 */
	removeDeniedUsersFromPluginTenant$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginUserAssignmentActions.removeDeniedUsersFromPluginTenant),
				tap(() => this.store.setLoading(true)),
				switchMap(({ pluginTenantId, userIds, reason }) =>
					this.pluginUserAssignmentService
						.removeDeniedUsersFromPluginTenant(pluginTenantId, userIds, reason)
						.pipe(
							map((response) =>
								PluginUserAssignmentActions.removeDeniedUsersFromPluginTenantSuccess({
									message: response.message,
									affectedUserIds: response.affectedUserIds
								})
							),
							catchError((error) => {
								const errorMessage =
									error.error?.message || error.message || 'Failed to remove denied users';
								return of(
									PluginUserAssignmentActions.removeDeniedUsersFromPluginTenantFailure({
										error: errorMessage
									})
								);
							}),
							finalize(() => this.store.setLoading(false))
						)
				)
			);
		},
		{ dispatch: true }
	);

	/**
	 * Show plugin tenant user management success notifications
	 */
	showPluginTenantUserSuccessNotifications$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(
					PluginUserAssignmentActions.allowUsersToPluginTenantSuccess,
					PluginUserAssignmentActions.denyUsersFromPluginTenantSuccess,
					PluginUserAssignmentActions.removeAllowedUsersFromPluginTenantSuccess,
					PluginUserAssignmentActions.removeDeniedUsersFromPluginTenantSuccess
				),
				tap((action) => {
					const message = (action as any).message || 'Operation completed successfully';
					this.toastrService.success(message);
				})
			);
		},
		{ dispatch: false }
	);

	/**
	 * Show plugin tenant user management error notifications
	 */
	showPluginTenantUserErrorNotifications$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(
					PluginUserAssignmentActions.loadPluginTenantUsersFailure,
					PluginUserAssignmentActions.allowUsersToPluginTenantFailure,
					PluginUserAssignmentActions.denyUsersFromPluginTenantFailure,
					PluginUserAssignmentActions.removeAllowedUsersFromPluginTenantFailure,
					PluginUserAssignmentActions.removeDeniedUsersFromPluginTenantFailure
				),
				tap(({ error }) => {
					this.store.setErrorMessage(error);
					this.toastrService.error(error);
					console.error('Plugin tenant user management operation failed:', error);
				})
			);
		},
		{ dispatch: false }
	);
}
