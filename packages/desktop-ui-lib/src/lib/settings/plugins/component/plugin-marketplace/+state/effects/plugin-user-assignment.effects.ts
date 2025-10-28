import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { PluginUserAssignmentService } from '../../../../services/plugin-user-assignment.service';
import { PluginUserAssignmentActions } from '../actions/plugin-user-assignment.actions';

@Injectable({ providedIn: 'root' })
export class PluginUserAssignmentEffects {
	constructor(
		private readonly actions$: Actions,
		private readonly pluginUserAssignmentService: PluginUserAssignmentService
	) {}

	loadAssignments$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(PluginUserAssignmentActions.loadAssignments),
			switchMap(({ pluginId, installationId, includeInactive }) =>
				this.pluginUserAssignmentService
					.getPluginUserAssignments(pluginId, installationId, includeInactive)
					.pipe(
						map((assignments) => PluginUserAssignmentActions.loadAssignmentsSuccess({ assignments })),
						catchError((error) =>
							of(
								PluginUserAssignmentActions.loadAssignmentsFailure({
									error: error.message || 'Unknown error'
								})
							)
						)
					)
			)
		);
	});

	assignUsers$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(PluginUserAssignmentActions.assignUsers),
			switchMap(({ pluginId, installationId, userIds, reason }) =>
				this.pluginUserAssignmentService.assignUsers(pluginId, installationId, { userIds, reason }).pipe(
					map((assignments) => PluginUserAssignmentActions.assignUsersSuccess({ assignments })),
					catchError((error) =>
						of(PluginUserAssignmentActions.assignUsersFailure({ error: error.message || 'Unknown error' }))
					)
				)
			)
		);
	});

	unassignUser$ = createEffect(() => {
		return this.actions$.pipe(
			ofType(PluginUserAssignmentActions.unassignUser),
			switchMap(({ pluginId, installationId, userId }) =>
				this.pluginUserAssignmentService.unassignUser(pluginId, installationId, userId).pipe(
					map(() => PluginUserAssignmentActions.unassignUserSuccess({ pluginId, installationId, userId })),
					catchError((error) =>
						of(PluginUserAssignmentActions.unassignUserFailure({ error: error.message || 'Unknown error' }))
					)
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

	// Log successful operations
	logSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(
					PluginUserAssignmentActions.assignUsersSuccess,
					PluginUserAssignmentActions.unassignUserSuccess,
					PluginUserAssignmentActions.bulkAssignUsersSuccess
				),
				tap((action) => {
					console.log('Plugin user assignment operation successful:', action);
				})
			);
		},
		{ dispatch: false }
	);

	// Log errors
	logErrors$ = createEffect(
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
					console.error('Plugin user assignment operation failed:', action.error);
				})
			);
		},
		{ dispatch: false }
	);
}
