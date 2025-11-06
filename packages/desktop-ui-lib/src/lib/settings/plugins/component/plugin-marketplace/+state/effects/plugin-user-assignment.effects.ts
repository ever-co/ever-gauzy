import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { catchError, finalize, map, of, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../../../services/toastr-notification.service';
import { PluginUserAssignmentService } from '../../../../services/plugin-user-assignment.service';
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
		private readonly translateService: TranslateService
	) {}

	/**
	 * Load assignments effect
	 * Handles loading user assignments for a plugin or specific installation
	 */
	loadAssignments$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(PluginUserAssignmentActions.loadAssignments),
			tap(() => this.store.setLoading(true)),
			switchMap(({ pluginId, installationId, includeInactive }) => {
				// Choose appropriate API based on whether installationId is provided
				const pluginUserAssignmentRequest = installationId
					? this.pluginUserAssignmentService.getPluginUserAssignments(
							pluginId,
							installationId,
							includeInactive
					  )
					: this.pluginUserAssignmentService.getAllPluginUserAssignments({
							pluginId,
							includeInactive
					  });

				return pluginUserAssignmentRequest.pipe(
					map((assignments) => PluginUserAssignmentActions.loadAssignmentsSuccess({ assignments })),
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
	});

	/**
	 * Assign users effect
	 * Handles assigning users to a plugin installation
	 */
	assignUsers$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(PluginUserAssignmentActions.assignUsers),
			tap(() => this.store.setLoading(true)),
			switchMap(({ pluginId, installationId, userIds, reason }) =>
				this.pluginUserAssignmentService.assignUsers(pluginId, installationId, { userIds, reason }).pipe(
					map((assignments) => {
						this.store.addAssignments(assignments);
						return PluginUserAssignmentActions.assignUsersSuccess({ assignments });
					}),
					catchError((error) => {
						const errorMessage = this.translateService.instant(
							'PLUGIN.USER_MANAGEMENT.ERRORS.ASSIGN_FAILED',
							{ message: error.message || 'Unknown error' }
						);
						return of(PluginUserAssignmentActions.assignUsersFailure({ error: errorMessage }));
					}),
					finalize(() => this.store.setLoading(false))
				)
			)
		);
	});

	/**
	 * Unassign user effect
	 * Handles removing user assignment from a plugin installation
	 */
	unassignUser$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(PluginUserAssignmentActions.unassignUser),
			tap(() => this.store.setLoading(true)),
			switchMap(({ pluginId, installationId, userId }) =>
				this.pluginUserAssignmentService.unassignUser(pluginId, installationId, userId).pipe(
					map(() => {
						this.store.removeAssignment(userId, installationId);
						return PluginUserAssignmentActions.unassignUserSuccess({ pluginId, installationId, userId });
					}),
					catchError((error) => {
						const errorMessage = this.translateService.instant(
							'PLUGIN.USER_MANAGEMENT.ERRORS.UNASSIGN_FAILED',
							{ message: error.message || 'Unknown error' }
						);
						return of(PluginUserAssignmentActions.unassignUserFailure({ error: errorMessage }));
					}),
					finalize(() => this.store.setLoading(false))
				)
			)
		);
	});

	bulkAssignUsers$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(PluginUserAssignmentActions.bulkAssignUsers),
			switchMap(({ pluginInstallationIds, userIds, reason }) =>
				this.pluginUserAssignmentService.createBatch({ pluginInstallationIds, userIds, reason }).pipe(
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
	});

	getUserAssignmentDetails$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(PluginUserAssignmentActions.getUserAssignmentDetails),
			switchMap(({ pluginId, installationId, userId }) =>
				this.pluginUserAssignmentService.getUserAssignmentDetails(pluginId, installationId, userId).pipe(
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
	});

	checkUserAccess$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(PluginUserAssignmentActions.checkUserAccess),
			switchMap(({ pluginId, installationId, userId }) =>
				this.pluginUserAssignmentService.checkUserAccess(pluginId, installationId, userId).pipe(
					map((hasAccess) => PluginUserAssignmentActions.checkUserAccessSuccess({ hasAccess })),
					catchError((error) =>
						of(
							PluginUserAssignmentActions.checkUserAccessFailure({
								error: error.message || 'Unknown error'
							})
						)
					)
				)
			)
		);
	});

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
				tap(({ assignments }) => {
					this.store.setAssignments(assignments);
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
}
