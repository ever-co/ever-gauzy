import { Injectable } from '@angular/core';
import { Actions } from '@ngneat/effects-ng';
import { Observable } from 'rxjs';

import {
	IPluginSubscription,
	IPluginSubscriptionCreateInput,
	IPluginSubscriptionPlan,
	IPluginSubscriptionUpdateInput
} from '../../../services/plugin-subscription.service';
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
}
