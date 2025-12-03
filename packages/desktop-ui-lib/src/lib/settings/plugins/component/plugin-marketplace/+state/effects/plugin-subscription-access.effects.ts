// Plugin Subscription Access Effects
// Handles side effects for subscription access operations

import { Injectable } from '@angular/core';
import { ToastrService } from '@gauzy/ui-core/core';
import { NbDialogService } from '@nebular/theme';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { PluginSubscriptionAccessService } from '../../../../services/plugin-subscription-access.service';
import {
	PluginUserManagementComponent,
	PluginUserManagementDialogData
} from '../../plugin-user-management/plugin-user-management.component';
import { PluginSubscriptionAccessActions } from '../actions/plugin-subscription-access.actions';
import { PluginMarketplaceQuery } from '../queries/plugin-marketplace.query';
import { PluginSubscriptionAccessStore } from '../stores/plugin-subscription-access.store';

@Injectable({
	providedIn: 'root'
})
export class PluginSubscriptionAccessEffects {
	constructor(
		private readonly actions$: Actions,
		private readonly subscriptionAccessService: PluginSubscriptionAccessService,
		private readonly subscriptionAccessStore: PluginSubscriptionAccessStore,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService,
		private readonly marketplaceQuery: PluginMarketplaceQuery
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

	checkUserAccess$ = createEffect(
		(actions$ = this.actions$) =>
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
			),
		{ dispatch: true }
	);

	// ============================================================================
	// Assign Users Effect
	// ============================================================================

	assignUsers$ = createEffect(
		(actions$ = this.actions$) =>
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
			),
		{ dispatch: true }
	);

	// ============================================================================
	// Assign Users Success Effect (Show Toast & Refresh)
	// ============================================================================

	assignUsersSuccess$ = createEffect((actions$ = this.actions$) =>
		actions$.pipe(
			ofType(PluginSubscriptionAccessActions.assignUsersSuccess),
			tap(({ message }) => {
				this.toastrService.success(message, 'Users Assigned');
				// Close dialog if open
				this.subscriptionAccessStore.setAssignmentDialog(false);
			})
		)
	);

	// ============================================================================
	// Revoke Users Effect
	// ============================================================================

	revokeUsers$ = createEffect(
		(actions$ = this.actions$) =>
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
			),
		{ dispatch: true }
	);

	// ============================================================================
	// Revoke Users Success Effect (Show Toast & Refresh)
	// ============================================================================

	revokeUsersSuccess$ = createEffect((actions$ = this.actions$) =>
		actions$.pipe(
			ofType(PluginSubscriptionAccessActions.revokeUsersSuccess),
			tap(({ message }) => {
				this.toastrService.success(message, 'Users Revoked');
				// Close dialog if open
				this.subscriptionAccessStore.setRevocationDialog(false);
			})
		)
	);

	// ============================================================================
	// Bulk Check Access Effect
	// ============================================================================

	bulkCheckAccess$ = createEffect(
		(actions$ = this.actions$) =>
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
			),
		{ dispatch: true }
	);

	// ============================================================================
	// Refresh Plugin Access Effect
	// ============================================================================

	refreshPluginAccess$ = createEffect(
		(actions$ = this.actions$) =>
			actions$.pipe(
				ofType(PluginSubscriptionAccessActions.refreshPluginAccess),
				map(({ pluginId }) => PluginSubscriptionAccessActions.checkAccess(pluginId))
			),
		{ dispatch: true }
	);

	// ============================================================================
	// Show Assignment Dialog Effect
	// ============================================================================

	/**
	 * Opens the user assignment dialog when showAssignmentDialog action is dispatched
	 * This effect handles the UI side effect of displaying the modal dialog
	 */
	showAssignmentDialog$ = createEffect((actions$ = this.actions$) =>
		actions$.pipe(
			ofType(PluginSubscriptionAccessActions.showAssignmentDialog),
			tap(({ pluginId }) => {
				// Get the current plugin from the marketplace query
				const plugin = this.marketplaceQuery.plugin;

				if (!plugin || plugin.id !== pluginId) {
					console.warn('Plugin not found or ID mismatch for assignment dialog');
					return;
				}

				// Get the subscription ID from the access store
				const pluginAccess = this.subscriptionAccessStore.getValue().entities?.[pluginId];
				const subscriptionId = pluginAccess?.subscriptionId;

				// Prepare dialog data
				const dialogData: PluginUserManagementDialogData = {
					plugin,
					subscriptionId
				};

				// Update store to reflect dialog is open (setAssignmentDialog handles selectedPluginId too)
				this.subscriptionAccessStore.setAssignmentDialog(true, pluginId);

				// Open the dialog
				const dialogRef = this.dialogService.open(PluginUserManagementComponent, {
					context: dialogData,
					closeOnBackdropClick: false,
					closeOnEsc: true,
					hasBackdrop: true
				});

				// Handle dialog close
				dialogRef.onClose
					.pipe(
						tap((result) => {
							// Update store when dialog closes
							this.subscriptionAccessStore.setAssignmentDialog(false);

							// If dialog closed with success result, potentially refresh data
							if (result === true) {
								// You can dispatch a refresh action here if needed
								console.log('Assignment dialog closed with success');
							}
						})
					)
					.subscribe();
			})
		)
	);

	// ============================================================================
	// Hide Assignment Dialog Effect
	// ============================================================================

	/**
	 * Handles hiding the assignment dialog
	 */
	hideAssignmentDialog$ = createEffect((actions$ = this.actions$) =>
		actions$.pipe(
			ofType(PluginSubscriptionAccessActions.hideAssignmentDialog),
			tap(() => {
				this.subscriptionAccessStore.setAssignmentDialog(false);
			})
		)
	);

	// ============================================================================
	// Show Revocation Dialog Effect
	// ============================================================================

	/**
	 * Opens the user revocation dialog when showRevocationDialog action is dispatched
	 */
	showRevocationDialog$ = createEffect((actions$ = this.actions$) =>
		actions$.pipe(
			ofType(PluginSubscriptionAccessActions.showRevocationDialog),
			tap(({ pluginId, userIds }) => {
				// Get the current plugin from the marketplace query
				const plugin = this.marketplaceQuery.plugin;

				if (!plugin || plugin.id !== pluginId) {
					console.warn('Plugin not found or ID mismatch for revocation dialog');
					return;
				}

				// Update store to reflect dialog is open (setRevocationDialog handles all state)
				this.subscriptionAccessStore.setRevocationDialog(true, pluginId, userIds);

				// TODO: Open revocation dialog component when ready
				// const dialogRef = this.dialogService.open(PluginUserRevocationDialogComponent, { ... });
				console.log('Revocation dialog effect triggered for users:', userIds);
			})
		)
	);

	// ============================================================================
	// Hide Revocation Dialog Effect
	// ============================================================================

	/**
	 * Handles hiding the revocation dialog
	 */
	hideRevocationDialog$ = createEffect((actions$ = this.actions$) =>
		actions$.pipe(
			ofType(PluginSubscriptionAccessActions.hideRevocationDialog),
			tap(() => {
				// Clear revocation dialog state (setRevocationDialog clears all related state)
				this.subscriptionAccessStore.setRevocationDialog(false);
			})
		)
	);

	// ============================================================================
	// Error Handling Effect (Show Toast)
	// ============================================================================

	showError$ = createEffect((actions$ = this.actions$) =>
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
		)
	);
}
