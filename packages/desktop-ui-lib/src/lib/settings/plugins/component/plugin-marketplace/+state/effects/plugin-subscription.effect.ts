import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { EMPTY, catchError, concatMap, exhaustMap, filter, finalize, map, switchMap, take, tap } from 'rxjs';

import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { ToastrNotificationService } from '../../../../../../services';
import { PluginSubscriptionService, PluginSubscriptionStatus } from '../../../../services/plugin-subscription.service';
import { PluginSubscriptionManagerComponent } from '../../plugin-subscription-manager/plugin-subscription-manager.component';
import { PluginSubscriptionActions } from '../actions/plugin-subscription.action';
import { PluginSubscriptionStore } from '../stores/plugin-subscription.store';

@Injectable({ providedIn: 'root' })
export class PluginSubscriptionEffects {
	constructor(
		private readonly actions$: Actions,
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginSubscriptionStore: PluginSubscriptionStore,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService
	) {}

	// Load subscriptions for a plugin
	loadPluginSubscriptions$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.loadPluginSubscriptions),
			tap(() => this.pluginSubscriptionStore.setLoading(true)),
			switchMap(({ pluginId }) =>
				this.pluginSubscriptionService.getPluginSubscriptions(pluginId).pipe(
					map((subscriptions) => {
						this.pluginSubscriptionStore.setSubscriptions(subscriptions);
						this.pluginSubscriptionStore.selectSubscription(subscriptions[0]);
						// Also set the current subscription for this specific plugin
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
					}),
					finalize(() => this.pluginSubscriptionStore.setLoading(false)),
					catchError((error) => {
						this.pluginSubscriptionStore.setErrorMessage(error.message || 'Failed to load subscriptions');
						this.toastrService.error(error.message || 'Failed to load subscriptions');
						return EMPTY;
					})
				)
			)
		)
	);

	// Load subscription plans for a plugin

	// Create subscription
	createSubscription$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.createSubscription),
			tap(() => {
				this.pluginSubscriptionStore.setCreating(true);
				this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.CREATING'));
			}),
			switchMap(({ subscriptionData }) =>
				this.pluginSubscriptionService.createSubscription(subscriptionData).pipe(
					tap((subscription) => {
						this.pluginSubscriptionStore.addSubscription(subscription);
						this.pluginSubscriptionStore.selectSubscription(subscription);
						this.pluginSubscriptionStore.setShowSubscriptionDialog(false);
						this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.CREATED'));
					}),
					finalize(() => this.pluginSubscriptionStore.setCreating(false)),
					catchError((error) => {
						this.pluginSubscriptionStore.setErrorMessage(error.message || 'Failed to create subscription');
						this.toastrService.error(error.message || 'Failed to create subscription');
						return EMPTY;
					})
				)
			)
		)
	);

	// Update subscription
	updateSubscription$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.updateSubscription),
			tap(() => this.pluginSubscriptionStore.setUpdating(true)),
			switchMap(({ pluginId, subscriptionId, updates }) =>
				this.pluginSubscriptionService.updateSubscription(pluginId, subscriptionId, updates).pipe(
					tap((subscription) => {
						this.pluginSubscriptionStore.updateSubscription(subscriptionId, subscription);
						this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.UPDATED'));
					}),
					finalize(() => this.pluginSubscriptionStore.setUpdating(false)),
					catchError((error) => {
						this.pluginSubscriptionStore.setErrorMessage(error.message || 'Failed to update subscription');
						this.toastrService.error(error.message || 'Failed to update subscription');
						return EMPTY;
					})
				)
			)
		)
	);

	// Cancel subscription
	cancelSubscription$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.cancelSubscription),
			tap(() => this.pluginSubscriptionStore.setUpdating(true)),
			switchMap(({ pluginId, subscriptionId }) =>
				this.pluginSubscriptionService.cancelSubscription(pluginId, subscriptionId).pipe(
					tap((subscription) => {
						this.pluginSubscriptionStore.updateSubscription(subscriptionId, subscription);
						this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.CANCELLED'));
					}),
					finalize(() => this.pluginSubscriptionStore.setUpdating(false)),
					catchError((error) => {
						this.pluginSubscriptionStore.setErrorMessage(error.message || 'Failed to cancel subscription');
						this.toastrService.error(error.message || 'Failed to cancel subscription');
						return EMPTY;
					})
				)
			)
		)
	);

	// Upgrade subscription
	upgradeSubscription$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.upgradeSubscription),
			tap(() => {
				this.pluginSubscriptionStore.setUpdating(true);
				this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.UPGRADING'));
			}),
			switchMap(({ pluginId, subscriptionId, newPlanId }) =>
				this.pluginSubscriptionService.upgradeSubscription(pluginId, subscriptionId, newPlanId).pipe(
					tap((subscription) => {
						this.pluginSubscriptionStore.updateSubscription(subscriptionId, subscription);
						this.pluginSubscriptionStore.selectSubscription(subscription);
						this.pluginSubscriptionStore.setShowSubscriptionDialog(false);
						this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.UPGRADED'));
					}),
					finalize(() => this.pluginSubscriptionStore.setUpdating(false)),
					catchError((error) => {
						this.pluginSubscriptionStore.setErrorMessage(error.message || 'Failed to upgrade subscription');
						this.toastrService.error(error.message || 'Failed to upgrade subscription');
						return EMPTY;
					})
				)
			)
		)
	);

	// Downgrade subscription
	downgradeSubscription$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.downgradeSubscription),
			tap(() => {
				this.pluginSubscriptionStore.setUpdating(true);
				this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.DOWNGRADING'));
			}),
			switchMap(({ pluginId, subscriptionId, newPlanId }) =>
				this.pluginSubscriptionService.downgradeSubscription(pluginId, subscriptionId, newPlanId).pipe(
					tap((subscription) => {
						this.pluginSubscriptionStore.updateSubscription(subscriptionId, subscription);
						this.pluginSubscriptionStore.selectSubscription(subscription);
						this.pluginSubscriptionStore.setShowSubscriptionDialog(false);
						this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.DOWNGRADED'));
					}),
					finalize(() => this.pluginSubscriptionStore.setUpdating(false)),
					catchError((error) => {
						this.pluginSubscriptionStore.setErrorMessage(
							error.message || 'Failed to downgrade subscription'
						);
						this.toastrService.error(error.message || 'Failed to downgrade subscription');
						return EMPTY;
					})
				)
			)
		)
	);

	// Load subscription analytics
	loadSubscriptionAnalytics$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.loadSubscriptionAnalytics),
			tap(() => this.pluginSubscriptionStore.setLoading(true)),
			switchMap(() =>
				this.pluginSubscriptionService.getSubscriptionAnalytics().pipe(
					tap((analytics) => {
						this.pluginSubscriptionStore.setAnalytics(analytics);
					}),
					finalize(() => this.pluginSubscriptionStore.setLoading(false)),
					catchError((error) => {
						this.pluginSubscriptionStore.setErrorMessage(error.message || 'Failed to load analytics');
						this.toastrService.error(error.message || 'Failed to load analytics');
						return EMPTY;
					})
				)
			)
		)
	);

	openSubscriptionDialog$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.openSubscriptionManagement),
			tap(() => this.pluginSubscriptionStore.setLoading(true)),
			concatMap(({ plugin }) =>
				this.pluginSubscriptionService.getCurrentSubscription(plugin.id).pipe(
					tap((subscription) => {
						this.pluginSubscriptionStore.setCurrentPluginSubscription(plugin.id, subscription);
						this.pluginSubscriptionStore.selectSubscription(subscription);
						this.pluginSubscriptionStore.setLoading(false);
					}),
					exhaustMap((currentSubscription) =>
						this.dialogService
							.open(PluginSubscriptionManagerComponent, { context: { plugin, currentSubscription } })
							.onClose.pipe(take(1), filter(Boolean))
					)
				)
			)
		)
	);

	// UI Actions
	selectSubscription$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.selectSubscription),
			tap(({ subscription }) => {
				this.pluginSubscriptionStore.selectSubscription(subscription);
			})
		)
	);

	resetError$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.resetError),
			tap(() => {
				this.pluginSubscriptionStore.resetError();
			})
		)
	);

	resetState$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.resetState),
			tap(() => {
				this.pluginSubscriptionStore.reset();
			})
		)
	);
}
