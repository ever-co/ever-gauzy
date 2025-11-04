// Plugin Subscription Access Effects
// Handles side effects for subscription access operations

import { Injectable } from '@angular/core';
import { ToastrService } from '@gauzy/ui-core/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { PluginSubscriptionAccessService } from '../../../../services/plugin-subscription-access.service';
import { PluginSubscriptionAccessActions } from '../actions/plugin-subscription-access.actions';
import { PluginSubscriptionAccessStore } from '../stores/plugin-subscription-access.store';

@Injectable({
	providedIn: 'root'
})
export class PluginSubscriptionAccessEffects {
	constructor(
		private readonly actions$: Actions,
		private readonly subscriptionAccessService: PluginSubscriptionAccessService,
		private readonly subscriptionAccessStore: PluginSubscriptionAccessStore,
		private readonly toastrService: ToastrService
	) {}

	// ============================================================================
	// Check Access Effect
	// ============================================================================

	checkAccess$ = createEffect((actions$ = this.actions$) =>
		actions$.pipe(
			ofType(PluginSubscriptionAccessActions.checkAccess),
			tap(({ pluginId }) => {
				this.subscriptionAccessStore.setPluginAccessLoading(pluginId, true);
			}),
			switchMap(({ pluginId }) =>
				this.subscriptionAccessService.checkAccess(pluginId).pipe(
					map((response) => {
						this.subscriptionAccessStore.setPluginAccess(pluginId, response);
						return PluginSubscriptionAccessActions.checkAccessSuccess(response);
					}),
					catchError((error) => {
						this.subscriptionAccessStore.setPluginAccessError(pluginId, error.message);
						return of(
							PluginSubscriptionAccessActions.checkAccessFailure(
								error.message || 'Failed to check access'
							)
						);
					})
				)
			)
		)
	);

	// ============================================================================
	// Check User Access Effect
	// ============================================================================

	checkUserAccess$ = createEffect((actions$ = this.actions$) =>
		actions$.pipe(
			ofType(PluginSubscriptionAccessActions.checkUserAccess),
			tap(() => {
				this.subscriptionAccessStore.setLoading(true);
			}),
			switchMap(({ pluginId, userId }) =>
				this.subscriptionAccessService.checkUserAccess(pluginId, userId).pipe(
					map((response) => {
						this.subscriptionAccessStore.setUserAccessCheck(pluginId, userId, response);
						return PluginSubscriptionAccessActions.checkUserAccessSuccess(userId, response);
					}),
					catchError((error) => {
						this.subscriptionAccessStore.setAccessError(error.message);
						return of(
							PluginSubscriptionAccessActions.checkUserAccessFailure(
								error.message || 'Failed to check user access'
							)
						);
					})
				)
			)
		)
	);

	// ============================================================================
	// Assign Users Effect
	// ============================================================================

	assignUsers$ = createEffect((actions$ = this.actions$) =>
		actions$.pipe(
			ofType(PluginSubscriptionAccessActions.assignUsers),
			tap(() => {
				this.subscriptionAccessStore.setLoading(true);
			}),
			switchMap(({ pluginId, dto }) =>
				this.subscriptionAccessService.assignUsers(pluginId, dto).pipe(
					map((response) => {
						this.subscriptionAccessStore.setLoading(false);
						// Clear plugin access cache to force refresh
						this.subscriptionAccessStore.clearPluginAccessCache(pluginId);
						return PluginSubscriptionAccessActions.assignUsersSuccess(
							response.message,
							response.assignedUsers || 0
						);
					}),
					catchError((error) => {
						this.subscriptionAccessStore.setAccessError(error.message);
						return of(
							PluginSubscriptionAccessActions.assignUsersFailure(
								error.message || 'Failed to assign users'
							)
						);
					})
				)
			)
		)
	);

	// ============================================================================
	// Assign Users Success Effect (Show Toast & Refresh)
	// ============================================================================

	assignUsersSuccess$ = createEffect(
		(actions$ = this.actions$) =>
			actions$.pipe(
				ofType(PluginSubscriptionAccessActions.assignUsersSuccess),
				tap(({ message }) => {
					this.toastrService.success(message, 'Users Assigned');
					// Close dialog if open
					this.subscriptionAccessStore.setAssignmentDialog(false);
				})
			),
		{ dispatch: false }
	);

	// ============================================================================
	// Revoke Users Effect
	// ============================================================================

	revokeUsers$ = createEffect((actions$ = this.actions$) =>
		actions$.pipe(
			ofType(PluginSubscriptionAccessActions.revokeUsers),
			tap(() => {
				this.subscriptionAccessStore.setLoading(true);
			}),
			switchMap(({ pluginId, dto }) =>
				this.subscriptionAccessService.revokeUsers(pluginId, dto).pipe(
					map((response) => {
						this.subscriptionAccessStore.setLoading(false);
						// Clear plugin access cache to force refresh
						this.subscriptionAccessStore.clearPluginAccessCache(pluginId);
						return PluginSubscriptionAccessActions.revokeUsersSuccess(
							response.message,
							response.revokedUsers || 0
						);
					}),
					catchError((error) => {
						this.subscriptionAccessStore.setAccessError(error.message);
						return of(
							PluginSubscriptionAccessActions.revokeUsersFailure(
								error.message || 'Failed to revoke users'
							)
						);
					})
				)
			)
		)
	);

	// ============================================================================
	// Revoke Users Success Effect (Show Toast & Refresh)
	// ============================================================================

	revokeUsersSuccess$ = createEffect(
		(actions$ = this.actions$) =>
			actions$.pipe(
				ofType(PluginSubscriptionAccessActions.revokeUsersSuccess),
				tap(({ message }) => {
					this.toastrService.success(message, 'Users Revoked');
					// Close dialog if open
					this.subscriptionAccessStore.setRevocationDialog(false);
				})
			),
		{ dispatch: false }
	);

	// ============================================================================
	// Bulk Check Access Effect
	// ============================================================================

	bulkCheckAccess$ = createEffect((actions$ = this.actions$) =>
		actions$.pipe(
			ofType(PluginSubscriptionAccessActions.bulkCheckAccess),
			tap(() => {
				this.subscriptionAccessStore.update({ bulkCheckInProgress: true, loading: true });
			}),
			switchMap(({ pluginIds }) =>
				this.subscriptionAccessService.bulkCheckAccess(pluginIds).pipe(
					map((accessMap) => {
						this.subscriptionAccessStore.setBulkAccessResults(accessMap);
						return PluginSubscriptionAccessActions.bulkCheckAccessSuccess(accessMap);
					}),
					catchError((error) => {
						this.subscriptionAccessStore.update({
							bulkCheckInProgress: false,
							loading: false,
							error: error.message
						});
						return of(
							PluginSubscriptionAccessActions.bulkCheckAccessFailure(
								error.message || 'Failed to bulk check access'
							)
						);
					})
				)
			)
		)
	);

	// ============================================================================
	// Refresh Plugin Access Effect
	// ============================================================================

	refreshPluginAccess$ = createEffect((actions$ = this.actions$) =>
		actions$.pipe(
			ofType(PluginSubscriptionAccessActions.refreshPluginAccess),
			map(({ pluginId }) => PluginSubscriptionAccessActions.checkAccess(pluginId))
		)
	);

	// ============================================================================
	// Error Handling Effect (Show Toast)
	// ============================================================================

	showError$ = createEffect(
		(actions$ = this.actions$) =>
			actions$.pipe(
				ofType(
					PluginSubscriptionAccessActions.checkAccessFailure,
					PluginSubscriptionAccessActions.checkUserAccessFailure,
					PluginSubscriptionAccessActions.assignUsersFailure,
					PluginSubscriptionAccessActions.revokeUsersFailure,
					PluginSubscriptionAccessActions.bulkCheckAccessFailure
				),
				tap(({ error }) => {
					this.toastrService.error(error, 'Access Error');
				})
			),
		{ dispatch: false }
	);
}
