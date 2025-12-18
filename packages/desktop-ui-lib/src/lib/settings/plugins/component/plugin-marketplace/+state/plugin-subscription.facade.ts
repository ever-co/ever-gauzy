import { Injectable } from '@angular/core';
import { Actions } from '@ngneat/effects-ng';
import { Observable } from 'rxjs';

import {
	IPluginSubscription,
	IPluginSubscriptionCreateInput,
	IPluginSubscriptionPlan,
	IPluginSubscriptionUpdateInput,
	PluginSubscriptionType
} from '@gauzy/contracts';
import { PlanActionType } from '../plugin-subscription-plan-selection/services/plan-comparison.service';
import { PluginPlanComparisonActions } from './actions/plugin-plan-comparison.action';
import { PluginPlanActions } from './actions/plugin-plan.action';
import { PluginSubscriptionActions } from './actions/plugin-subscription.action';
import { PluginPlanComparisonQuery } from './queries/plugin-plan-comparison.query';
import { PluginPlanQuery } from './queries/plugin-plan.query';
import { PluginSubscriptionQuery } from './queries/plugin-subscription.query';

/**
 * Facade service for plugin subscription state management
 * Provides a simplified API for components to interact with subscription state
 */
@Injectable({ providedIn: 'root' })
export class PluginSubscriptionFacade {
	// Observables for components
	public readonly subscriptions$ = this.query.subscriptions$;
	public readonly selectedSubscription$ = this.query.selectedSubscription$;
	public readonly loading$ = this.query.loading$;
	public readonly creating$ = this.query.creating$;
	public readonly updating$ = this.query.updating$;
	public readonly deleting$ = this.query.deleting$;
	public readonly error$ = this.query.error$;
	public readonly selectedPluginId$ = this.query.selectedPluginId$;
	public readonly confirmationStep$ = this.query.confirmationStep$;

	// Plan observables (from PluginPlanQuery)
	public readonly plans$ = this.planQuery.plans$;
	public readonly selectedPlan$ = this.planQuery.selectedPlan$;
	public readonly freePlans$ = this.planQuery.freePlans$;
	public readonly paidPlans$ = this.planQuery.paidPlans$;
	public readonly featuredPlans$ = this.planQuery.featuredPlans$;
	public readonly currentPluginPlans$ = this.planQuery.currentPluginPlans$;

	// Plan comparison observables (from PluginPlanComparisonQuery)
	public readonly planComparison$ = this.planComparisonQuery.planComparison$;
	public readonly currentPlanId$ = this.planComparisonQuery.currentPlanId$;
	public readonly selectedPlanId$ = this.planComparisonQuery.selectedPlanId$;
	public readonly actionType$ = this.planComparisonQuery.actionType$;
	public readonly isValidAction$ = this.planComparisonQuery.isValidAction$;
	public readonly requiresPayment$ = this.planComparisonQuery.requiresPayment$;
	public readonly prorationAmount$ = this.planComparisonQuery.prorationAmount$;

	// Current plugin subscription state
	public readonly currentPluginSubscriptions$ = this.query.currentPluginSubscriptions$;

	// Computed observables
	public readonly activeSubscriptions$ = this.query.activeSubscriptions$;
	public readonly expiredSubscriptions$ = this.query.expiredSubscriptions$;
	public readonly trialSubscriptions$ = this.query.trialSubscriptions$;

	constructor(
		private readonly query: PluginSubscriptionQuery,
		private readonly actions$: Actions,
		private readonly planQuery: PluginPlanQuery,
		private readonly planComparisonQuery: PluginPlanComparisonQuery
	) {}

	// Subscription Management
	public loadPluginSubscriptions(pluginId: string): void {
		this.actions$.dispatch(PluginSubscriptionActions.loadPluginSubscriptions(pluginId));
	}

	public loadPluginPlans(pluginId: string): void {
		this.actions$.dispatch(PluginPlanActions.loadPluginPlans(pluginId));
	}

	public createSubscription(pluginId: string, subscriptionData: IPluginSubscriptionCreateInput): void {
		this.actions$.dispatch(PluginSubscriptionActions.createSubscription(pluginId, subscriptionData));
	}

	public updateSubscription(pluginId: string, subscriptionId: string, updates: IPluginSubscriptionUpdateInput): void {
		this.actions$.dispatch(PluginSubscriptionActions.updateSubscription(pluginId, subscriptionId, updates));
	}

	public cancelSubscription(pluginId: string, subscriptionId: string): void {
		this.actions$.dispatch(PluginSubscriptionActions.cancelSubscription(pluginId, subscriptionId));
	}

	public loadSubscriptionAnalytics(pluginId: string): void {
		this.actions$.dispatch(PluginSubscriptionActions.loadSubscriptionAnalytics(pluginId));
	}

	// UI State Management
	public selectSubscription(subscription: IPluginSubscription | null): void {
		this.actions$.dispatch(PluginSubscriptionActions.selectSubscription(subscription));
	}

	public selectPlan(plan: IPluginSubscriptionPlan | null): void {
		this.actions$.dispatch(PluginPlanActions.selectPlan(plan));
	}

	public openPlanCreator(pluginId: string): void {
		this.actions$.dispatch(PluginPlanActions.openPlanCreator(pluginId));
	}

	public resetError(): void {
		this.actions$.dispatch(PluginSubscriptionActions.resetError());
	}

	public resetState(): void {
		this.actions$.dispatch(PluginSubscriptionActions.resetState());
	}

	// Query Methods
	public getSubscriptionsByPluginId(pluginId: string): Observable<IPluginSubscription[]> {
		return this.query.getSubscriptionsByPluginId(pluginId);
	}

	public getActiveSubscriptionForPlugin(pluginId: string): Observable<IPluginSubscription | null> {
		return this.query.getActiveSubscriptionForPlugin(pluginId);
	}

	public hasActiveSubscriptionForPlugin(pluginId: string): Observable<boolean> {
		return this.query.hasActiveSubscriptionForPlugin(pluginId);
	}

	public getPlanById(planId: string): Observable<IPluginSubscriptionPlan | null> {
		return this.planQuery.getPlanById(planId);
	}

	public getPlansForPlugin(pluginId: string): Observable<IPluginSubscriptionPlan[]> {
		return this.planQuery.getPlansForPlugin(pluginId);
	}

	public getSubscriptionMetrics(): Observable<{
		total: number;
		active: number;
		trial: number;
		expired: number;
		cancelled: number;
		suspended: number;
		pastDue: number;
	}> {
		return this.query.getSubscriptionMetrics();
	}

	// Getters for current values (synchronous access)
	public get currentSubscriptions(): IPluginSubscription[] {
		return this.query.subscriptions;
	}

	public get currentSelectedSubscription(): IPluginSubscription | null {
		return this.query.selectedSubscription;
	}

	public get currentPlans(): IPluginSubscriptionPlan[] {
		return this.planQuery.plans;
	}

	public get currentSelectedPlan(): IPluginSubscriptionPlan | null {
		return this.planQuery.selectedPlan;
	}

	public get currentLoading(): boolean {
		return this.query.loading;
	}

	public get currentError(): string | null {
		return this.query.error;
	}

	public get currentSelectedPluginId(): string | null {
		return this.query.selectedPluginId;
	}

	// Plan Management Methods
	public createPlan(planData: Omit<IPluginSubscriptionPlan, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>): void {
		this.actions$.dispatch(PluginPlanActions.createPlan(planData));
	}

	public updatePlan(planId: string, updates: Partial<IPluginSubscriptionPlan>): void {
		this.actions$.dispatch(PluginPlanActions.updatePlan(planId, updates));
	}

	public deletePlan(planId: string): void {
		this.actions$.dispatch(PluginPlanActions.deletePlan(planId));
	}

	public bulkCreatePlans(plansData: Array<Partial<IPluginSubscriptionPlan>>): void {
		this.actions$.dispatch(PluginPlanActions.bulkCreatePlans(plansData));
	}

	// Enhanced subscription flow management
	public getCurrentPluginSubscription(pluginId: string): Observable<IPluginSubscription | null> {
		return this.query.getCurrentPluginSubscription(pluginId);
	}

	public getCurrentPluginPlans(pluginId: string): Observable<IPluginSubscriptionPlan[]> {
		return this.planQuery.getCurrentPluginPlans(pluginId);
	}

	public getPlanComparisonForPlugin(pluginId: string): Observable<{
		currentPlan: IPluginSubscriptionPlan | null;
		selectedPlan: IPluginSubscriptionPlan | null;
		actionType: PlanActionType;
		isValidAction: boolean;
		requiresPayment: boolean;
		prorationAmount?: number;
	}> {
		return this.planComparisonQuery.getPlanComparisonForPlugin(pluginId);
	}

	public getPluginSubscriptionStatus(pluginId: string): Observable<{
		hasSubscription: boolean;
		isActive: boolean;
		isTrial: boolean;
		isExpired: boolean;
		currentPlanType: PluginSubscriptionType | null;
		daysRemaining?: number;
	}> {
		return this.query.getPluginSubscriptionStatus(pluginId);
	}

	public canUpgradeFromPlan(fromPlanId: string, toPlanId: string): Observable<boolean> {
		return this.query.canUpgradeFromPlan(fromPlanId, toPlanId);
	}

	public canDowngradeFromPlan(fromPlanId: string, toPlanId: string): Observable<boolean> {
		return this.query.canDowngradeFromPlan(fromPlanId, toPlanId);
	}

	// Plan comparison actions
	public updatePlanComparison(
		currentPlanId: string | null,
		selectedPlanId: string | null,
		actionType: PlanActionType,
		isValidAction: boolean,
		requiresPayment: boolean,
		prorationAmount?: number
	): void {
		this.actions$.dispatch(
			PluginPlanComparisonActions.updatePlanComparison({
				currentPlanId,
				selectedPlanId,
				actionType,
				isValidAction,
				requiresPayment,
				prorationAmount
			})
		);
	}

	public resetPlanComparison(): void {
		this.actions$.dispatch(PluginPlanComparisonActions.resetPlanComparison());
	}

	public setConfirmationStep(
		step: 'selection' | 'confirmation' | 'payment' | 'processing' | 'completed' | null
	): void {
		this.actions$.dispatch(PluginPlanComparisonActions.setConfirmationStep(step));
	}

	// Enhanced subscription actions
	public upgradeSubscription(pluginId: string, subscriptionId: string, newPlanId: string): void {
		this.actions$.dispatch(PluginSubscriptionActions.upgradeSubscription(pluginId, subscriptionId, newPlanId));
	}

	public downgradeSubscription(pluginId: string, subscriptionId: string, newPlanId: string): void {
		this.actions$.dispatch(PluginSubscriptionActions.downgradeSubscription(pluginId, subscriptionId, newPlanId));
	}
}
