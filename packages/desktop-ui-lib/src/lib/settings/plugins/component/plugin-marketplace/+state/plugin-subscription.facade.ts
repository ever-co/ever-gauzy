import { Injectable } from '@angular/core';
import { Actions } from '@ngneat/effects-ng';
import { Observable } from 'rxjs';

import {
	IPluginSubscription,
	IPluginSubscriptionCreateInput,
	IPluginSubscriptionPlan,
	IPluginSubscriptionUpdateInput,
	PluginSubscriptionType
} from '../../../services/plugin-subscription.service';
import { PlanActionType } from '../plugin-subscription-selection/services/plan-comparison.service';
import { PluginSubscriptionActions } from './actions/plugin-subscription.action';
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
	public readonly plans$ = this.query.plans$;
	public readonly selectedPlan$ = this.query.selectedPlan$;
	public readonly loading$ = this.query.loading$;
	public readonly creating$ = this.query.creating$;
	public readonly updating$ = this.query.updating$;
	public readonly deleting$ = this.query.deleting$;
	public readonly error$ = this.query.error$;
	public readonly isLoading$ = this.query.isLoading$;
	public readonly showSubscriptionDialog$ = this.query.showSubscriptionDialog$;
	public readonly selectedPluginId$ = this.query.selectedPluginId$;
	public readonly confirmationStep$ = this.query.confirmationStep$;

	// Current plugin subscription state
	public readonly currentPluginSubscriptions$ = this.query.currentPluginSubscriptions$;
	public readonly currentPluginPlans$ = this.query.currentPluginPlans$;

	// Plan comparison observables
	public readonly planComparison$ = this.query.planComparison$;
	public readonly currentPlanId$ = this.query.currentPlanId$;
	public readonly selectedPlanId$ = this.query.selectedPlanId$;
	public readonly actionType$ = this.query.actionType$;
	public readonly isValidAction$ = this.query.isValidAction$;
	public readonly requiresPayment$ = this.query.requiresPayment$;
	public readonly prorationAmount$ = this.query.prorationAmount$;

	// Computed observables
	public readonly activeSubscriptions$ = this.query.activeSubscriptions$;
	public readonly expiredSubscriptions$ = this.query.expiredSubscriptions$;
	public readonly trialSubscriptions$ = this.query.trialSubscriptions$;
	public readonly freePlans$ = this.query.freePlans$;
	public readonly paidPlans$ = this.query.paidPlans$;
	public readonly featuredPlans$ = this.query.featuredPlans$;

	constructor(private readonly query: PluginSubscriptionQuery, private readonly actions$: Actions) {}

	// Subscription Management
	public loadPluginSubscriptions(pluginId: string): void {
		this.actions$.dispatch(PluginSubscriptionActions.loadPluginSubscriptions(pluginId));
	}

	public loadPluginPlans(pluginId: string): void {
		this.actions$.dispatch(PluginSubscriptionActions.loadPluginPlans(pluginId));
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
		this.actions$.dispatch(PluginSubscriptionActions.selectPlan(plan));
	}

	public showSubscriptionDialog(pluginId: string): void {
		this.actions$.dispatch(PluginSubscriptionActions.showSubscriptionDialog(pluginId));
	}

	public hideSubscriptionDialog(): void {
		this.actions$.dispatch(PluginSubscriptionActions.hideSubscriptionDialog());
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
		return this.query.getPlanById(planId);
	}

	public getPlansForPlugin(pluginId: string): Observable<IPluginSubscriptionPlan[]> {
		return this.query.getPlansForPlugin(pluginId);
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
		return this.query.plans;
	}

	public get currentSelectedPlan(): IPluginSubscriptionPlan | null {
		return this.query.selectedPlan;
	}

	public get currentLoading(): boolean {
		return this.query.loading;
	}

	public get currentError(): string | null {
		return this.query.error;
	}

	public get currentShowDialog(): boolean {
		return this.query.showSubscriptionDialog;
	}

	public get currentSelectedPluginId(): string | null {
		return this.query.selectedPluginId;
	}

	// Plan Management Methods
	public createPlan(planData: Omit<IPluginSubscriptionPlan, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>): void {
		this.actions$.dispatch(PluginSubscriptionActions.createPlan(planData));
	}

	public updatePlan(planId: string, updates: Partial<IPluginSubscriptionPlan>): void {
		this.actions$.dispatch(PluginSubscriptionActions.updatePlan(planId, updates));
	}

	public deletePlan(planId: string): void {
		this.actions$.dispatch(PluginSubscriptionActions.deletePlan(planId));
	}

	public bulkCreatePlans(
		plansData: Array<Omit<IPluginSubscriptionPlan, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>>
	): void {
		this.actions$.dispatch(PluginSubscriptionActions.bulkCreatePlans(plansData));
	}

	// Enhanced subscription flow management
	public getCurrentPluginSubscription(pluginId: string): Observable<IPluginSubscription | null> {
		return this.query.getCurrentPluginSubscription(pluginId);
	}

	public getCurrentPluginPlans(pluginId: string): Observable<IPluginSubscriptionPlan[]> {
		return this.query.getCurrentPluginPlans(pluginId);
	}

	public getPlanComparisonForPlugin(pluginId: string): Observable<{
		currentPlan: IPluginSubscriptionPlan | null;
		selectedPlan: IPluginSubscriptionPlan | null;
		actionType: PlanActionType;
		isValidAction: boolean;
		requiresPayment: boolean;
		prorationAmount?: number;
	}> {
		return this.query.getPlanComparisonForPlugin(pluginId);
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
			PluginSubscriptionActions.updatePlanComparison({
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
		this.actions$.dispatch(PluginSubscriptionActions.resetPlanComparison());
	}

	public setConfirmationStep(
		step: 'selection' | 'confirmation' | 'payment' | 'processing' | 'completed' | null
	): void {
		this.actions$.dispatch(PluginSubscriptionActions.setConfirmationStep(step));
	}

	// Enhanced subscription actions
	public upgradeSubscription(pluginId: string, subscriptionId: string, newPlanId: string): void {
		this.actions$.dispatch(PluginSubscriptionActions.upgradeSubscription(pluginId, subscriptionId, newPlanId));
	}

	public downgradeSubscription(pluginId: string, subscriptionId: string, newPlanId: string): void {
		this.actions$.dispatch(PluginSubscriptionActions.downgradeSubscription(pluginId, subscriptionId, newPlanId));
	}
}
