import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { EMPTY, catchError, concatMap, exhaustMap, finalize, map, of, switchMap, take, tap } from 'rxjs';

import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { ToastrNotificationService } from '../../../../../../services';
import { PluginSubscriptionService } from '../../../../services/plugin-subscription.service';
import { DialogSubscriptionPlanCreatorComponent } from '../../plugin-marketplace-item/dialog-subscription-plan-creator/dialog-subscription-plan-creator.component';
import {
	IPluginSubscriptionPlanSelectionResult,
	PluginSubscriptionPlanSelectionComponent
} from '../../plugin-subscription-plan-selection';
import { PluginMarketplaceActions } from '../actions/plugin-marketplace.action';
import { PluginPlanActions } from '../actions/plugin-plan.action';
import { PluginToggleActions } from '../actions/plugin-toggle.action';
import { PluginMarketplaceQuery } from '../queries/plugin-marketplace.query';
import { PluginPlanStore } from '../stores/plugin-plan.store';

@Injectable({ providedIn: 'root' })
export class PluginPlanEffects {
	constructor(
		private readonly actions$: Actions,
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginMarketplaceQuery: PluginMarketplaceQuery,
		private readonly pluginPlanStore: PluginPlanStore,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService
	) {}

	loadPluginPlans$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginPlanActions.loadPluginPlans),
			tap(() => this.pluginPlanStore.setLoading(true)),
			switchMap(({ pluginId }) =>
				this.pluginSubscriptionService.getPluginPlans(pluginId).pipe(
					tap((plans) => {
						this.pluginPlanStore.setPlans(plans);
						this.pluginPlanStore.setCurrentPluginPlans(pluginId, plans);
					}),
					finalize(() => this.pluginPlanStore.setLoading(false)),
					catchError((error) => {
						this.pluginPlanStore.setErrorMessage(error.message || 'Failed to load plans');
						this.toastrService.error(error.message || 'Failed to load plans');
						return EMPTY;
					})
				)
			)
		)
	);

	selectPlan$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginPlanActions.selectPlan),
			tap(({ plan }) => {
				this.pluginPlanStore.selectPlan(plan);
			})
		)
	);

	createPlan$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginPlanActions.createPlan),
			tap(() => {
				this.pluginPlanStore.setCreating(true);
				this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.CREATING'));
			}),
			switchMap(({ planData }) =>
				this.pluginSubscriptionService.createPlan(planData as any).pipe(
					tap((plan) => {
						this.pluginPlanStore.addPlan(plan);
						this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.CREATED'));
					}),
					finalize(() => this.pluginPlanStore.setCreating(false)),
					catchError((error) => {
						this.pluginPlanStore.setErrorMessage(error.message || 'Failed to create plan');
						this.toastrService.error(error.message || 'Failed to create plan');
						return EMPTY;
					})
				)
			)
		)
	);

	updatePlan$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginPlanActions.updatePlan),
			tap(() => {
				this.pluginPlanStore.setUpdating(true);
				this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.UPDATING'));
			}),
			switchMap(({ planId, updates }) =>
				this.pluginSubscriptionService.updatePlan(planId, updates).pipe(
					tap((plan) => {
						this.pluginPlanStore.updatePlan(planId, plan);
						this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.UPDATED'));
					}),
					finalize(() => this.pluginPlanStore.setUpdating(false)),
					catchError((error) => {
						this.pluginPlanStore.setErrorMessage(error.message || 'Failed to update plan');
						this.toastrService.error(error.message || 'Failed to update plan');
						return EMPTY;
					})
				)
			)
		)
	);

	deletePlan$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginPlanActions.deletePlan),
			tap(() => {
				this.pluginPlanStore.setDeleting(true);
				this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.DELETING'));
			}),
			switchMap(({ planId }) =>
				this.pluginSubscriptionService.deletePlan(planId).pipe(
					tap(() => {
						this.pluginPlanStore.removePlan(planId);
						this.toastrService.success(this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.DELETED'));
					}),
					finalize(() => this.pluginPlanStore.setDeleting(false)),
					catchError((error) => {
						this.pluginPlanStore.setErrorMessage(error.message || 'Failed to delete plan');
						this.toastrService.error(error.message || 'Failed to delete plan');
						return EMPTY;
					})
				)
			)
		)
	);

	bulkCreatePlans$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginPlanActions.bulkCreatePlans),
			tap(() => {
				this.pluginPlanStore.setCreating(true);
				this.toastrService.info(this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.BULK_CREATING'));
			}),
			concatMap(({ plansData }) =>
				this.pluginSubscriptionService.bulkCreatePlans(plansData).pipe(
					tap((plans) => {
						plans.forEach((plan) => this.pluginPlanStore.addPlan(plan));
						this.toastrService.success(
							this.translateService.instant('PLUGIN.SUBSCRIPTION.PLAN.BULK_CREATED', {
								count: plans.length
							})
						);
					}),
					finalize(() => this.pluginPlanStore.setCreating(false)),
					catchError((error) => {
						this.pluginPlanStore.setErrorMessage(error.message || 'Failed to create plans');
						this.toastrService.error(error.message || 'Failed to create plans');
						return EMPTY;
					})
				)
			)
		)
	);

	openPlanSubscriptionDialog$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginPlanActions.openPlanSubscriptions),

				// Resolve plugin safely
				map(({ pluginId }) => {
					let plugin = this.pluginMarketplaceQuery.plugins.find((p) => p.id === pluginId);
					if (!plugin && this.pluginMarketplaceQuery.plugin?.id === pluginId) {
						plugin = this.pluginMarketplaceQuery.plugin;
					}
					return { pluginId, plugin };
				}),

				// Short-circuit if plugin doesn't exist
				exhaustMap(({ pluginId, plugin }) => {
					if (!plugin) {
						return of(PluginToggleActions.toggle({ pluginId, enabled: false }));
					}

					// Open selection dialog
					return this.dialogService
						.open(PluginSubscriptionPlanSelectionComponent, { context: { plugin, pluginId } })
						.onClose.pipe(
							take(1),

							// Determine next action based on user response
							map((result: IPluginSubscriptionPlanSelectionResult | null) => {
								const proceed = result?.proceedWithInstallation === true;

								if (!proceed) {
									return PluginToggleActions.toggle({ pluginId, enabled: false });
								}

								return PluginMarketplaceActions.install(plugin);
							}),

							// Recover from dialog failure
							catchError(() => of(PluginToggleActions.toggle({ pluginId, enabled: false })))
						);
				})
			),
		{
			dispatch: true
		}
	);

	openPlanCreatorDialog$ = createEffect(
		() =>
			this.actions$.pipe(
				ofType(PluginPlanActions.openPlanCreator),
				map(({ pluginId }) => {
					let plugin = this.pluginMarketplaceQuery.plugins.find((item) => item.id === pluginId);
					if (!plugin && this.pluginMarketplaceQuery.plugin?.id === pluginId) {
						plugin = this.pluginMarketplaceQuery.plugin;
					}

					return { pluginId, plugin };
				}),
				exhaustMap(({ pluginId, plugin }) => {
					if (!plugin) {
						this.toastrService.error('Unable to open subscription plans for this plugin.');
						return EMPTY;
					}

					return this.dialogService
						.open(DialogSubscriptionPlanCreatorComponent, {
							context: { plugin, pluginId },
							autoFocus: true,
							closeOnBackdropClick: false
						})
						.onClose.pipe(
							take(1),
							catchError(() => EMPTY)
						);
				})
			),
		{ dispatch: false }
	);

	// Reset errors
	resetErrors$ = createEffect(() =>
		this.actions$.pipe(
			ofType(PluginPlanActions.resetErrors),
			tap(() => {
				this.pluginPlanStore.resetError();
			})
		)
	);
}
