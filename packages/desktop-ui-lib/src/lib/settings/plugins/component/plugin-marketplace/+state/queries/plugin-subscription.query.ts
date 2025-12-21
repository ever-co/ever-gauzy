import { Injectable, inject } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

import {
	IPluginSubscription,
	IPluginSubscriptionPlan,
	PluginSubscriptionStatus,
	PluginSubscriptionType
} from '../../../../services/plugin-subscription.service';
import { PlanActionType } from '../../plugin-subscription-plan-selection/services/plan-comparison.service';
import { SubscriptionPlanService } from '../../shared';
import { IPluginSubscriptionState, PluginSubscriptionStore } from '../stores/plugin-subscription.store';
import { PluginPlanComparisonQuery } from './plugin-plan-comparison.query';
import { PluginPlanQuery } from './plugin-plan.query';

@Injectable({ providedIn: 'root' })
export class PluginSubscriptionQuery extends Query<IPluginSubscriptionState> {
	//Plan service
	private readonly planService = inject(SubscriptionPlanService);
	private readonly planQuery = inject(PluginPlanQuery);
	private readonly planComparisonQuery = inject(PluginPlanComparisonQuery);
	// Basic selectors
	public readonly subscriptions$: Observable<IPluginSubscription[]> = this.select((state) => state.subscriptions);
	public readonly selectedSubscription$: Observable<IPluginSubscription | null> = this.select(
		(state) => state.selectedSubscription
	);

	// Loading states
	public readonly loading$: Observable<boolean> = this.select((state) => state.loading);
	public readonly creating$: Observable<boolean> = this.select((state) => state.creating);
	public readonly updating$: Observable<boolean> = this.select((state) => state.updating);
	public readonly deleting$: Observable<boolean> = this.select((state) => state.deleting);

	// Error handling
	public readonly error$: Observable<string | null> = this.select((state) => state.error);

	// Analytics
	public readonly analytics$: Observable<IPluginSubscriptionState['analytics']> = this.select(
		(state) => state.analytics
	);

	// UI state
	public readonly selectedPluginId$: Observable<string | null> = this.select((state) => state.selectedPluginId);

	// Current plugin subscription state
	public readonly currentPluginSubscriptions$: Observable<Record<string, IPluginSubscription | null>> = this.select(
		(state) => state.currentPluginSubscriptions
	);

	// Computed selectors
	public readonly activeSubscriptions$: Observable<IPluginSubscription[]> = this.subscriptions$.pipe(
		map((subscriptions) => {
			const subscriptionsArray = Array.isArray(subscriptions) ? subscriptions : [];
			return subscriptionsArray.filter((s) =>
				[
					PluginSubscriptionStatus.ACTIVE,
					PluginSubscriptionStatus.PENDING,
					PluginSubscriptionStatus.TRIAL
				].includes(s.status)
			);
		})
	);

	public readonly expiredSubscriptions$: Observable<IPluginSubscription[]> = this.subscriptions$.pipe(
		map((subscriptions) => {
			const subscriptionsArray = Array.isArray(subscriptions) ? subscriptions : [];
			return subscriptionsArray.filter((s) => s.status === PluginSubscriptionStatus.EXPIRED);
		})
	);

	public readonly cancelledSubscriptions$: Observable<IPluginSubscription[]> = this.subscriptions$.pipe(
		map((subscriptions) => {
			const subscriptionsArray = Array.isArray(subscriptions) ? subscriptions : [];
			return subscriptionsArray.filter((s) => s.status === PluginSubscriptionStatus.CANCELLED);
		})
	);

	public readonly trialSubscriptions$: Observable<IPluginSubscription[]> = this.subscriptions$.pipe(
		map((subscriptions) => {
			const subscriptionsArray = Array.isArray(subscriptions) ? subscriptions : [];
			return subscriptionsArray.filter((s) => s.status === PluginSubscriptionStatus.TRIAL);
		})
	);

	public readonly pastDueSubscriptions$: Observable<IPluginSubscription[]> = this.subscriptions$.pipe(
		map((subscriptions) => {
			const subscriptionsArray = Array.isArray(subscriptions) ? subscriptions : [];
			return subscriptionsArray.filter((s) => s.status === PluginSubscriptionStatus.PAST_DUE);
		})
	);

	public readonly suspendedSubscriptions$: Observable<IPluginSubscription[]> = this.subscriptions$.pipe(
		map((subscriptions) => {
			const subscriptionsArray = Array.isArray(subscriptions) ? subscriptions : [];
			return subscriptionsArray.filter((s) => s.status === PluginSubscriptionStatus.SUSPENDED);
		})
	);

	// Plan observables (delegated to PluginPlanQuery)
	public readonly plans$ = this.planQuery.plans$;
	public readonly selectedPlan$ = this.planQuery.selectedPlan$;
	public readonly freePlans$ = this.planQuery.freePlans$;
	public readonly paidPlans$ = this.planQuery.paidPlans$;
	public readonly featuredPlans$ = this.planQuery.featuredPlans$;
	public readonly currentPluginPlans$ = this.planQuery.currentPluginPlans$;

	// Plan comparison observables (delegated)
	public readonly planComparison$ = this.planComparisonQuery.planComparison$;
	public readonly confirmationStep$ = this.planComparisonQuery.confirmationStep$;

	constructor(readonly pluginSubscriptionStore: PluginSubscriptionStore) {
		super(pluginSubscriptionStore as any);
	}
	public get selectedPlan(): IPluginSubscriptionPlan | null {
		return this.planQuery.selectedPlan;
	}

	public get loading(): boolean {
		return this.getValue().loading;
	}

	public get error(): string | null {
		return this.getValue().error;
	}

	public get selectedPluginId(): string | null {
		return this.getValue().selectedPluginId;
	}

	public get planComparison(): import('../stores/plugin-plan-comparison.store').IPluginPlanComparisonState['planComparison'] {
		return this.planComparisonQuery.getValue().planComparison;
	}

	public get confirmationStep(): import('../stores/plugin-plan-comparison.store').IPluginPlanComparisonState['confirmationStep'] {
		return this.planComparisonQuery.getValue().confirmationStep;
	}

	// Utility methods
	public getSubscriptionsByPluginId(pluginId: string): Observable<IPluginSubscription[]> {
		return this.subscriptions$.pipe(
			map((subscriptions) => {
				const subscriptionsArray = Array.isArray(subscriptions) ? subscriptions : [];
				return subscriptionsArray.filter((s) => s.pluginId === pluginId);
			})
		);
	}

	public getActiveSubscriptionForPlugin(pluginId: string): Observable<IPluginSubscription | null> {
		return this.subscriptions$.pipe(
			map((subscriptions) => {
				const subscriptionsArray = Array.isArray(subscriptions) ? subscriptions : [];
				return (
					subscriptionsArray.find(
						(s) =>
							s.pluginId === pluginId &&
							[
								PluginSubscriptionStatus.ACTIVE,
								PluginSubscriptionStatus.PENDING,
								PluginSubscriptionStatus.TRIAL
							].includes(s.status)
					) || null
				);
			})
		);
	}

	public getPlanById(planId: string): Observable<IPluginSubscriptionPlan | null> {
		return this.planQuery.getPlanById(planId);
	}

	public getPlansForPlugin(pluginId: string): Observable<IPluginSubscriptionPlan[]> {
		return this.planQuery.getPlansForPlugin(pluginId);
	}

	// Enhanced utility methods for current subscription state
	public getCurrentPluginSubscription(pluginId: string): Observable<IPluginSubscription | null> {
		return this.currentPluginSubscriptions$.pipe(map((subscriptions) => subscriptions[pluginId] || null));
	}

	// Synchronous getters for convenience
	public get subscriptions(): IPluginSubscription[] {
		return this.getValue().subscriptions || [];
	}

	public get selectedSubscription(): IPluginSubscription | null {
		return this.getValue().selectedSubscription;
	}

	public hasActiveSubscriptionForPlugin(pluginId: string): Observable<boolean> {
		return this.getActiveSubscriptionForPlugin(pluginId).pipe(map((s) => !!s));
	}

	public getCurrentPluginPlans(pluginId: string): Observable<IPluginSubscriptionPlan[]> {
		return this.currentPluginPlans$.pipe(map((plans) => plans[pluginId] || []));
	}

	// Plan comparison utilities
	public getPlanComparisonForPlugin(pluginId: string): Observable<{
		currentPlan: IPluginSubscriptionPlan | null;
		selectedPlan: IPluginSubscriptionPlan | null;
		actionType: PlanActionType;
		isValidAction: boolean;
		requiresPayment: boolean;
		prorationAmount?: number;
	}> {
		return combineLatest([this.getCurrentPluginPlans(pluginId), this.planComparison$]).pipe(
			map(([plans, comparison]) => {
				const currentPlan = comparison.currentPlanId
					? plans.find((p) => p.id === comparison.currentPlanId) || null
					: null;
				const selectedPlan = comparison.selectedPlanId
					? plans.find((p) => p.id === comparison.selectedPlanId) || null
					: null;

				return {
					currentPlan,
					selectedPlan,
					actionType: comparison.actionType,
					isValidAction: comparison.isValidAction,
					requiresPayment: comparison.requiresPayment,
					prorationAmount: comparison.prorationAmount
				};
			})
		);
	}

	// Check if user can perform specific actions
	public canUpgradeFromPlan(fromPlanId: string, toPlanId: string): Observable<boolean> {
		return this.plans$.pipe(
			map((plans) => {
				const fromPlan = plans.find((p) => p.id === fromPlanId);
				const toPlan = plans.find((p) => p.id === toPlanId);
				if (!fromPlan || !toPlan) return false;
				return this.planService.canUpgrade(fromPlan, toPlan);
			})
		);
	}

	public canDowngradeFromPlan(fromPlanId: string, toPlanId: string): Observable<boolean> {
		return this.plans$.pipe(
			map((plans) => {
				const fromPlan = plans.find((p) => p.id === fromPlanId);
				const toPlan = plans.find((p) => p.id === toPlanId);
				if (!fromPlan || !toPlan) return false;
				return this.planService.canDowngrade(fromPlan, toPlan);
			})
		);
	}

	/**
	 * Determine if the plan change is an upgrade
	 * Order: FREE < TRIAL < BASIC < PREMIUM < ENTERPRISE < CUSTOM
	 */

	// Get subscription status for a specific plugin
	public getPluginSubscriptionStatus(pluginId: string): Observable<{
		hasSubscription: boolean;
		isActive: boolean;
		isTrial: boolean;
		isExpired: boolean;
		currentPlanType: PluginSubscriptionType | null;
		daysRemaining?: number;
	}> {
		return this.getCurrentPluginSubscription(pluginId).pipe(
			map((subscription) => {
				if (!subscription) {
					return {
						hasSubscription: false,
						isActive: false,
						isTrial: false,
						isExpired: false,
						currentPlanType: null
					};
				}

				const isActive = [
					PluginSubscriptionStatus.ACTIVE,
					PluginSubscriptionStatus.PENDING,
					PluginSubscriptionStatus.TRIAL
				].includes(subscription.status);
				const isTrial = subscription.status === PluginSubscriptionStatus.TRIAL;
				const isExpired = subscription.status === PluginSubscriptionStatus.EXPIRED;

				let daysRemaining: number | undefined;
				if (subscription.endDate) {
					const now = new Date();
					const endDate = new Date(subscription.endDate);
					const diffTime = endDate.getTime() - now.getTime();
					daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
				}

				return {
					hasSubscription: true,
					isActive,
					isTrial,
					isExpired,
					currentPlanType: subscription.plan?.type ?? null,
					daysRemaining
				};
			})
		);
	}

	// Subscription metrics
	public getSubscriptionMetrics(): Observable<{
		total: number;
		active: number;
		trial: number;
		expired: number;
		cancelled: number;
		suspended: number;
		pastDue: number;
	}> {
		return this.subscriptions$.pipe(
			map((subscriptions) => {
				const subscriptionsArray = Array.isArray(subscriptions) ? subscriptions : [];
				return {
					total: subscriptionsArray.length,
					active: subscriptionsArray.filter((s) =>
						[
							PluginSubscriptionStatus.ACTIVE,
							PluginSubscriptionStatus.PENDING,
							PluginSubscriptionStatus.TRIAL
						].includes(s.status)
					).length,
					trial: subscriptionsArray.filter((s) => s.status === PluginSubscriptionStatus.TRIAL).length,
					expired: subscriptionsArray.filter((s) => s.status === PluginSubscriptionStatus.EXPIRED).length,
					cancelled: subscriptionsArray.filter((s) => s.status === PluginSubscriptionStatus.CANCELLED).length,
					suspended: subscriptionsArray.filter((s) => s.status === PluginSubscriptionStatus.SUSPENDED).length,
					pastDue: subscriptionsArray.filter((s) => s.status === PluginSubscriptionStatus.PAST_DUE).length
				};
			})
		);
	}
}
