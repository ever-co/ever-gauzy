import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { catchError, concatMap, exhaustMap, finalize, map, of, switchMap, take, tap } from 'rxjs';

import { IPlugin } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { PluginActions } from '../../../+state/plugin.action';
import { ToastrNotificationService } from '../../../../../../services';
import {
	IPluginSubscription,
	PluginSubscriptionService,
	PluginSubscriptionStatus
} from '../../../../services/plugin-subscription.service';
import { PluginSubscriptionManagerComponent } from '../../plugin-subscription-manager/plugin-subscription-manager.component';
import { PluginMarketplaceActions } from '../actions/plugin-marketplace.action';
import { PluginPlanActions } from '../actions/plugin-plan.action';
import { PluginSubscriptionAccessActions } from '../actions/plugin-subscription-access.actions';
import { PluginSubscriptionActions } from '../actions/plugin-subscription.action';
import { PluginToggleActions } from '../actions/plugin-toggle.action';
import { PluginInstallationQuery } from '../queries/plugin-installation.query';
import { PluginMarketplaceStore } from '../stores/plugin-market.store';
import { PluginSubscriptionStore } from '../stores/plugin-subscription.store';

@Injectable({ providedIn: 'root' })
export class PluginSubscriptionEffects {
	constructor(
		private readonly actions$: Actions,
		private readonly pluginMarketplaceStore: PluginMarketplaceStore,
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginSubscriptionStore: PluginSubscriptionStore,
		private readonly pluginInstallationQuery: PluginInstallationQuery,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService
	) {}

	// Load subscriptions for a plugin
	loadPluginSubscriptions$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.loadPluginSubscriptions),
				tap(() => this.pluginSubscriptionStore.setLoading(true)),
				switchMap(({ pluginId }) =>
					this.pluginSubscriptionService.getPluginSubscriptions(pluginId).pipe(
						map((subscriptions) => {
							this.pluginSubscriptionStore.setSubscriptions(subscriptions);
							this.pluginSubscriptionStore.selectSubscription(subscriptions[0]);
							const currentSubscription =
								subscriptions.find(
									(s) =>
										s.pluginId === pluginId &&
										[
											PluginSubscriptionStatus.ACTIVE,
											PluginSubscriptionStatus.PENDING,
											PluginSubscriptionStatus.TRIAL
										].includes(s.status)
								) || null;
							this.pluginSubscriptionStore.setCurrentPluginSubscription(pluginId, currentSubscription);
							return PluginSubscriptionActions.loadPluginSubscriptionsSuccess(subscriptions);
						}),
						finalize(() => this.pluginSubscriptionStore.setLoading(false)),
						catchError((error) => {
							const errorMessage = error.message || 'Failed to load subscriptions';
							this.pluginSubscriptionStore.setErrorMessage(errorMessage);
							this.toastrService.error(errorMessage);
							return of(PluginSubscriptionActions.loadPluginSubscriptionsFailure(errorMessage));
						})
					)
				)
			),
		{ dispatch: true }
	);

	// Load subscription plans for a plugin

	// Create subscription
	createSubscription$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.createSubscription),
				tap(() => {
					this.pluginSubscriptionStore.setCreating(true);
					this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.CREATING'));
				}),
				switchMap(({ subscriptionData }) =>
					this.pluginSubscriptionService.createSubscription(subscriptionData).pipe(
						map((subscription) => {
							this.pluginSubscriptionStore.addSubscription(subscription);
							this.pluginSubscriptionStore.selectSubscription(subscription);
							this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.CREATED'));
							return PluginSubscriptionActions.createSubscriptionSuccess(subscription);
						}),
						finalize(() => this.pluginSubscriptionStore.setCreating(false)),
						catchError((error) => {
							const errorMessage = error.message || 'Failed to create subscription';
							this.pluginSubscriptionStore.setErrorMessage(errorMessage);
							this.toastrService.error(errorMessage);
							return of(PluginSubscriptionActions.createSubscriptionFailure(errorMessage));
						})
					)
				)
			),
		{ dispatch: true }
	);

	// Update subscription
	updateSubscription$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.updateSubscription),
				tap(() => this.pluginSubscriptionStore.setUpdating(true)),
				switchMap(({ pluginId, subscriptionId, updates }) =>
					this.pluginSubscriptionService.updateSubscription(pluginId, subscriptionId, updates).pipe(
						map((subscription) => {
							this.pluginSubscriptionStore.updateSubscription(subscriptionId, subscription);
							this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.UPDATED'));
							return PluginSubscriptionActions.updateSubscriptionSuccess(subscription);
						}),
						finalize(() => this.pluginSubscriptionStore.setUpdating(false)),
						catchError((error) => {
							const errorMessage = error.message || 'Failed to update subscription';
							this.pluginSubscriptionStore.setErrorMessage(errorMessage);
							this.toastrService.error(errorMessage);
							return of(PluginSubscriptionActions.updateSubscriptionFailure(errorMessage));
						})
					)
				)
			),
		{ dispatch: true }
	);

	// Cancel subscription
	cancelSubscription$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.cancelSubscription),
				tap(() => this.pluginSubscriptionStore.setUpdating(true)),
				concatMap(({ pluginId, subscriptionId }) =>
					this.pluginSubscriptionService.cancelSubscription(pluginId, subscriptionId).pipe(
						map((subscription) => {
							// Update subscription in the subscriptions array
							this.pluginSubscriptionStore.updateSubscription(subscriptionId, subscription);
							// Update the current plugin subscription to reflect cancelled status
							this.pluginSubscriptionStore.setCurrentPluginSubscription(pluginId, subscription);
							// Update selected subscription if it's the one being cancelled
							this.pluginSubscriptionStore.selectSubscription(subscription);
							return PluginSubscriptionActions.cancelSubscriptionSuccess(subscription);
						}),
						finalize(() => this.pluginSubscriptionStore.setUpdating(false)),
						catchError((error) => {
							const errorMessage = error.message || 'Failed to cancel subscription';
							this.pluginSubscriptionStore.setErrorMessage(errorMessage);
							this.toastrService.error(errorMessage);
							return of(PluginSubscriptionActions.cancelSubscriptionFailure(errorMessage));
						})
					)
				)
			),
		{ dispatch: true }
	);

	// Upgrade subscription
	upgradeSubscription$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.upgradeSubscription),
				tap(() => {
					this.pluginSubscriptionStore.setUpdating(true);
					this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.UPGRADING'));
				}),
				switchMap(({ pluginId, subscriptionId, newPlanId }) =>
					this.pluginSubscriptionService.upgradeSubscription(pluginId, subscriptionId, newPlanId).pipe(
						map((subscription) => {
							this.pluginSubscriptionStore.updateSubscription(subscriptionId, subscription);
							this.pluginSubscriptionStore.selectSubscription(subscription);
							this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.UPGRADED'));
							return PluginSubscriptionActions.upgradeSubscriptionSuccess(subscription);
						}),
						finalize(() => this.pluginSubscriptionStore.setUpdating(false)),
						catchError((error) => {
							const errorMessage = error.message || 'Failed to upgrade subscription';
							this.pluginSubscriptionStore.setErrorMessage(errorMessage);
							this.toastrService.error(errorMessage);
							return of(PluginSubscriptionActions.upgradeSubscriptionFailure(errorMessage));
						})
					)
				)
			),
		{ dispatch: true }
	);

	// Downgrade subscription
	downgradeSubscription$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.downgradeSubscription),
				tap(() => {
					this.pluginSubscriptionStore.setUpdating(true);
					this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.DOWNGRADING'));
				}),
				switchMap(({ pluginId, subscriptionId, newPlanId }) =>
					this.pluginSubscriptionService.downgradeSubscription(pluginId, subscriptionId, newPlanId).pipe(
						map((subscription) => {
							this.pluginSubscriptionStore.updateSubscription(subscriptionId, subscription);
							this.pluginSubscriptionStore.selectSubscription(subscription);
							this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.DOWNGRADED'));
							return PluginSubscriptionActions.downgradeSubscriptionSuccess(subscription);
						}),
						finalize(() => this.pluginSubscriptionStore.setUpdating(false)),
						catchError((error) => {
							const errorMessage = error.message || 'Failed to downgrade subscription';
							this.pluginSubscriptionStore.setErrorMessage(errorMessage);
							this.toastrService.error(errorMessage);
							return of(PluginSubscriptionActions.downgradeSubscriptionFailure(errorMessage));
						})
					)
				)
			),
		{ dispatch: true }
	);

	// Load subscription analytics
	loadSubscriptionAnalytics$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.loadSubscriptionAnalytics),
				tap(() => this.pluginSubscriptionStore.setLoading(true)),
				switchMap(() =>
					this.pluginSubscriptionService.getSubscriptionAnalytics().pipe(
						map((analytics) => {
							this.pluginSubscriptionStore.setAnalytics(analytics);
							return PluginSubscriptionActions.loadSubscriptionAnalyticsSuccess(analytics);
						}),
						finalize(() => this.pluginSubscriptionStore.setLoading(false)),
						catchError((error) => {
							const errorMessage = error.message || 'Failed to load analytics';
							this.pluginSubscriptionStore.setErrorMessage(errorMessage);
							this.toastrService.error(errorMessage);
							return of(PluginSubscriptionActions.loadSubscriptionAnalyticsFailure(errorMessage));
						})
					)
				)
			),
		{ dispatch: true }
	);

	openSubscriptionDialog$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.openSubscriptionManagement),
				tap(() => this.pluginSubscriptionStore.setLoading(true)),

				// Ensure sequential dialogs
				concatMap(({ plugin, clicked }) =>
					this.pluginSubscriptionService.getCurrentSubscription(plugin.id).pipe(
						tap((s) => this.setContext(plugin, s)),
						exhaustMap((subscription) => this.handleSubscriptionFlow(plugin, subscription, clicked)),
						catchError(() => of(PluginPlanActions.openPlanSubscriptions(plugin.id))),
						finalize(() => this.pluginSubscriptionStore.setLoading(false))
					)
				)
			),
		{ dispatch: true }
	);

	// UI Actions
	selectSubscription$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.selectSubscription),
				tap(({ subscription }) => {
					this.pluginSubscriptionStore.selectSubscription(subscription);
				})
			),
		{ dispatch: false }
	);

	resetError$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.resetError),
				tap(() => {
					this.pluginSubscriptionStore.resetError();
				})
			),
		{ dispatch: false }
	);

	resetState$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.resetState),
				tap(() => {
					this.pluginSubscriptionStore.reset();
				})
			),
		{ dispatch: false }
	);

	// Set current plugin subscription
	setCurrentPluginSubscription$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.setCurrentPluginSubscription),
				tap(({ pluginId, subscription }) => {
					this.pluginSubscriptionStore.setCurrentPluginSubscription(pluginId, subscription);
				})
			),
		{ dispatch: false }
	);

	// Open hierarchy subscriptions dialog
	openHierarchySubscriptions$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.openHierarchySubscriptions),
				tap(() => this.pluginSubscriptionStore.setLoading(true)),
				concatMap(({ plugin }) =>
					this.pluginSubscriptionService.getPluginSubscriptions(plugin.id).pipe(
						tap((subscriptions) => {
							this.pluginSubscriptionStore.setSubscriptions(subscriptions);
							this.pluginMarketplaceStore.selectPlugin(plugin);
						}),
						map((subscriptions) => PluginSubscriptionActions.loadPluginSubscriptionsSuccess(subscriptions)),
						finalize(() => this.pluginSubscriptionStore.setLoading(false)),
						catchError((error) => {
							const errorMessage = error.message || 'Failed to load hierarchy subscriptions';
							this.pluginSubscriptionStore.setErrorMessage(errorMessage);
							this.toastrService.error(errorMessage);
							return of(PluginSubscriptionActions.loadPluginSubscriptionsFailure(errorMessage));
						})
					)
				)
			),
		{ dispatch: true }
	);

	// ==================== Success/Failure Action Handlers ====================

	// Handle load subscriptions success - refresh plugin list
	loadPluginSubscriptionsSuccess$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.loadPluginSubscriptionsSuccess),
				map(() => PluginActions.refresh())
			),
		{ dispatch: true }
	);

	// Handle load subscriptions failure - reset loading state
	loadPluginSubscriptionsFailure$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.loadPluginSubscriptionsFailure),
				tap(({ error }) => {
					this.pluginSubscriptionStore.setLoading(false);
					this.pluginSubscriptionStore.setErrorMessage(error);
				})
			),
		{ dispatch: false }
	);

	// Handle create subscription success - trigger plugin installation
	createSubscriptionSuccess$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.createSubscriptionSuccess),
				switchMap(({ subscription }) => {
					// Update current plugin subscription after successful creation
					this.pluginSubscriptionStore.setCurrentPluginSubscription(subscription.pluginId, subscription);
					return of(PluginActions.refresh());
				})
			),
		{ dispatch: true }
	);

	// Handle create subscription failure
	createSubscriptionFailure$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.createSubscriptionFailure),
				tap(({ error }) => {
					this.pluginSubscriptionStore.setCreating(false);
					this.pluginSubscriptionStore.setErrorMessage(error);
				})
			),
		{ dispatch: false }
	);

	// Handle update subscription success
	updateSubscriptionSuccess$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.updateSubscriptionSuccess),
				map(() => PluginActions.refresh())
			),
		{ dispatch: true }
	);

	// Handle update subscription failure
	updateSubscriptionFailure$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.updateSubscriptionFailure),
				tap(({ error }) => {
					this.pluginSubscriptionStore.setUpdating(false);
					this.pluginSubscriptionStore.setErrorMessage(error);
				})
			),
		{ dispatch: false }
	);

	// Handle cancel subscription success - may trigger uninstall
	cancelSubscriptionSuccess$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.cancelSubscriptionSuccess),
				tap(() => this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.CANCELLED'))),
				map(() => PluginActions.refresh())
			),
		{ dispatch: true }
	);

	// Handle cancel subscription failure
	cancelSubscriptionFailure$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.cancelSubscriptionFailure),
				tap(({ error }) => {
					this.pluginSubscriptionStore.setUpdating(false);
					this.pluginSubscriptionStore.setErrorMessage(error);
				})
			),
		{ dispatch: false }
	);

	// Handle upgrade subscription success
	upgradeSubscriptionSuccess$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.upgradeSubscriptionSuccess),
				switchMap(({ subscription }) => {
					this.pluginSubscriptionStore.setCurrentPluginSubscription(subscription.pluginId, subscription);
					return of(PluginActions.refresh());
				})
			),
		{ dispatch: true }
	);

	// Handle upgrade subscription failure
	upgradeSubscriptionFailure$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.upgradeSubscriptionFailure),
				tap(({ error }) => {
					this.pluginSubscriptionStore.setUpdating(false);
					this.pluginSubscriptionStore.setErrorMessage(error);
				})
			),
		{ dispatch: false }
	);

	// Handle downgrade subscription success
	downgradeSubscriptionSuccess$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.downgradeSubscriptionSuccess),
				switchMap(({ subscription }) => {
					this.pluginSubscriptionStore.setCurrentPluginSubscription(subscription.pluginId, subscription);
					return of(PluginActions.refresh());
				})
			),
		{ dispatch: true }
	);

	// Handle downgrade subscription failure
	downgradeSubscriptionFailure$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.downgradeSubscriptionFailure),
				tap(({ error }) => {
					this.pluginSubscriptionStore.setUpdating(false);
					this.pluginSubscriptionStore.setErrorMessage(error);
				})
			),
		{ dispatch: false }
	);

	// Handle load analytics success
	loadSubscriptionAnalyticsSuccess$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.loadSubscriptionAnalyticsSuccess),
				tap(({ analytics }) => {
					this.pluginSubscriptionStore.setAnalytics(analytics);
					this.pluginSubscriptionStore.setLoading(false);
				})
			),
		{ dispatch: false }
	);

	// Handle load analytics failure
	loadSubscriptionAnalyticsFailure$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginSubscriptionActions.loadSubscriptionAnalyticsFailure),
				tap(({ error }) => {
					this.pluginSubscriptionStore.setLoading(false);
					this.pluginSubscriptionStore.setErrorMessage(error);
				})
			),
		{ dispatch: false }
	);

	subscriptionChange$ = createEffect(() =>
		this.actions$.pipe(
			ofType(
				PluginSubscriptionActions.createSubscriptionSuccess,
				PluginSubscriptionActions.updateSubscriptionSuccess,
				PluginSubscriptionActions.cancelSubscriptionSuccess,
				PluginSubscriptionActions.upgradeSubscriptionSuccess,
				PluginSubscriptionActions.downgradeSubscriptionSuccess
			),
			tap(({ subscription }) => this.pluginMarketplaceStore.setSubscription(subscription)),
			map(({ subscription }) => PluginSubscriptionAccessActions.refreshPluginAccess(subscription.pluginId))
		)
	);

	/**
	 *
	 * @param plugin
	 * @param subscription
	 * @param clicked
	 * @returns
	 */
	private handleSubscriptionFlow(plugin: IPlugin, currentSubscription: IPluginSubscription | null, clicked: boolean) {
		// No subscription → open plan selector
		if (!currentSubscription) {
			return of(PluginPlanActions.openPlanSubscriptions(plugin.id));
		}

		// Subscription present → open manager dialog
		return this.dialogService
			.open(PluginSubscriptionManagerComponent, {
				context: { plugin, currentSubscription }
			})
			.onClose.pipe(
				take(1),
				switchMap((result) => this.resolveDialogResult(result, plugin, clicked))
			);
	}

	/**
	 *
	 * @param result
	 * @param plugin
	 * @param clicked
	 * @returns
	 */
	private resolveDialogResult(
		result: { success?: boolean; action?: string } | null,
		plugin: IPlugin,
		clicked: boolean
	) {
		const { success, action } = result || {};
		const refreshOrToggle = () => of(clicked ? PluginActions.refresh() : PluginToggleActions.auto(plugin.id));

		if (!success) {
			return refreshOrToggle();
		}

		switch (action) {
			case 'subscribed':
				return of(PluginMarketplaceActions.install(plugin));
			case 'upgraded':
			case 'downgraded':
				return this.pluginInstallationQuery
					.installationId$(plugin.id)
					.pipe(
						map((installationId) =>
							installationId
								? PluginMarketplaceActions.update(plugin)
								: PluginMarketplaceActions.install(plugin)
						)
					);
			case 'cancelled':
				return this.pluginInstallationQuery
					.installationId$(plugin.id)
					.pipe(
						map((installationId) =>
							installationId
								? PluginMarketplaceActions.uninstall(plugin.id, installationId)
								: PluginActions.refresh()
						)
					);
			case 'closed':
				return refreshOrToggle();
			default:
				return of(PluginToggleActions.auto(plugin.id));
		}
	}

	/**
	 *
	 * @param plugin
	 * @param subscription
	 */
	private setContext(plugin: IPlugin, subscription: IPluginSubscription) {
		this.pluginMarketplaceStore.selectPlugin(plugin);
		this.pluginSubscriptionStore.setCurrentPluginSubscription(plugin.id, subscription);
		this.pluginSubscriptionStore.selectSubscription(subscription);
		this.pluginSubscriptionStore.setLoading(false);
	}
}
