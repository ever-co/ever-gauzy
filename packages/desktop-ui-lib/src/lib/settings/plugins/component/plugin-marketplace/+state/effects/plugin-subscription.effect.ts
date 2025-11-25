import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { EMPTY, catchError, finalize, map, of, switchMap, tap } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';
import { ToastrNotificationService } from '../../../../../../services';
import {
	IPluginSubscriptionPlan,
	PluginSubscriptionService,
	PluginSubscriptionStatus
} from '../../../../services/plugin-subscription.service';
import { PluginSubscriptionActions } from '../actions/plugin-subscription.action';
import { PluginSubscriptionStore } from '../stores/plugin-subscription.store';

@Injectable({ providedIn: 'root' })
export class PluginSubscriptionEffects {
	constructor(
		private readonly actions$: Actions,
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginSubscriptionStore: PluginSubscriptionStore,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService
	) {}

	// Load subscriptions for a plugin
	loadPluginSubscriptions$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.loadPluginSubscriptions),
			tap(() => this.pluginSubscriptionStore.setLoading(true)),
			switchMap(({ pluginId }) =>
				this.pluginSubscriptionService.getPluginSubscriptions(pluginId).pipe(
					tap((subscriptions) => {
						this.pluginSubscriptionStore.setSubscriptions(subscriptions);
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
	loadPluginPlans$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.loadPluginPlans),
			tap(() => this.pluginSubscriptionStore.setLoading(true)),
			switchMap(({ pluginId }) =>
				this.pluginSubscriptionService.getPluginPlans(pluginId).pipe(
					tap((plans) => {
						this.pluginSubscriptionStore.setPlans(plans);
						// IMPORTANT: Also set plans for the specific plugin in currentPluginPlans
						this.pluginSubscriptionStore.setCurrentPluginPlans(pluginId, plans);
					}),
					finalize(() => this.pluginSubscriptionStore.setLoading(false)),
					catchError((error) => {
						this.pluginSubscriptionStore.setErrorMessage(error.message || 'Failed to load plans');
						this.toastrService.error(error.message || 'Failed to load plans');
						return EMPTY;
					})
				)
			)
		)
	);

	// Create subscription
	createSubscription$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.createSubscription),
			tap(() => {
				this.pluginSubscriptionStore.setCreating(true);
				this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.CREATING'));
			}),
			switchMap(({ pluginId, subscriptionData }) =>
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

	// UI Actions
	selectSubscription$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.selectSubscription),
			tap(({ subscription }) => {
				this.pluginSubscriptionStore.selectSubscription(subscription);
			})
		)
	);

	selectPlan$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.selectPlan),
			tap(({ plan }) => {
				this.pluginSubscriptionStore.selectPlan(plan);
			})
		)
	);

	showSubscriptionDialog$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.showSubscriptionDialog),
			tap(({ pluginId }) => {
				this.pluginSubscriptionStore.setShowSubscriptionDialog(true, pluginId);
			})
		)
	);

	hideSubscriptionDialog$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.hideSubscriptionDialog),
			tap(() => {
				this.pluginSubscriptionStore.setShowSubscriptionDialog(false);
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

	// Plan comparison and confirmation step effects
	updatePlanComparison$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.updatePlanComparison),
			tap(({ comparison }) => {
				this.pluginSubscriptionStore.updatePlanComparison(comparison);
			})
		)
	);

	resetPlanComparison$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.resetPlanComparison),
			tap(() => {
				this.pluginSubscriptionStore.resetPlanComparison();
			})
		)
	);

	setConfirmationStep$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.setConfirmationStep),
			tap(({ step }) => {
				this.pluginSubscriptionStore.setConfirmationStep(step);
			})
		)
	);

	// Plan CRUD Effects
	createPlan$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.createPlan),
			tap(() => {
				this.pluginSubscriptionStore.setCreating(true);
				this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.CREATING'));
			}),
			switchMap(({ planData }) =>
				this.pluginSubscriptionService.createPlan(planData as any).pipe(
					tap((plan) => {
						this.pluginSubscriptionStore.addPlan(plan);
						this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.CREATED'));
					}),
					finalize(() => this.pluginSubscriptionStore.setCreating(false)),
					catchError((error) => {
						this.pluginSubscriptionStore.setErrorMessage(error.message || 'Failed to create plan');
						this.toastrService.error(error.message || 'Failed to create plan');
						return EMPTY;
					})
				)
			)
		)
	);

	updatePlan$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.updatePlan),
			tap(() => {
				this.pluginSubscriptionStore.setUpdating(true);
				this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.UPDATING'));
			}),
			switchMap(({ planId, updates }) =>
				this.pluginSubscriptionService.updatePlan(planId, updates).pipe(
					tap((plan) => {
						this.pluginSubscriptionStore.updatePlan(planId, plan);
						this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.UPDATED'));
					}),
					finalize(() => this.pluginSubscriptionStore.setUpdating(false)),
					catchError((error) => {
						this.pluginSubscriptionStore.setErrorMessage(error.message || 'Failed to update plan');
						this.toastrService.error(error.message || 'Failed to update plan');
						return EMPTY;
					})
				)
			)
		)
	);

	deletePlan$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.deletePlan),
			tap(() => {
				this.pluginSubscriptionStore.setDeleting(true);
				this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.DELETING'));
			}),
			switchMap(({ planId }) =>
				this.pluginSubscriptionService.deletePlan(planId).pipe(
					tap(() => {
						this.pluginSubscriptionStore.removePlan(planId);
						this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.DELETED'));
					}),
					finalize(() => this.pluginSubscriptionStore.setDeleting(false)),
					catchError((error) => {
						this.pluginSubscriptionStore.setErrorMessage(error.message || 'Failed to delete plan');
						this.toastrService.error(error.message || 'Failed to delete plan');
						return EMPTY;
					})
				)
			)
		)
	);

	bulkCreatePlans$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginSubscriptionActions.bulkCreatePlans),
			tap(() => {
				this.pluginSubscriptionStore.setCreating(true);
				this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.BULK_CREATING'));
			}),
			switchMap(({ plansData }) => {
				// Create plans sequentially to maintain order and handle errors individually
				const createPlan$ = (planData: any) =>
					this.pluginSubscriptionService.createPlan(planData).pipe(
						catchError((error) => {
							this.toastrService.error(
								`Failed to create plan "${planData.name}": ${error.message || 'Unknown error'}`
							);
							return EMPTY; // Continue with other plans
						})
					);

				// Use forkJoin to create all plans in parallel, or reduce for sequential
				return plansData.reduce(
					(acc$, planData) =>
						acc$.pipe(
							switchMap((createdPlans) =>
								createPlan$(planData).pipe(
									map((newPlan) => (newPlan ? [...createdPlans, newPlan] : createdPlans))
								)
							)
						),
					of([] as IPluginSubscriptionPlan[])
				);
			}),
			tap((plans) => {
				if (plans.length > 0) {
					// Add all successfully created plans to store
					plans.forEach((plan) => this.pluginSubscriptionStore.addPlan(plan));
					this.toastrService.success(
						this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.BULK_CREATED', {
							count: plans.length
						})
					);
				}
			}),
			finalize(() => this.pluginSubscriptionStore.setCreating(false)),
			catchError((error) => {
				this.pluginSubscriptionStore.setErrorMessage(error.message || 'Failed to create plans');
				this.toastrService.error(error.message || 'Failed to create plans');
				return EMPTY;
			})
		)
	);
}
