import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
	IPluginSubscription,
	IPluginSubscriptionPlan,
	PluginSubscriptionStatus
} from '../../../../services/plugin-subscription.service';
import { IPluginSubscriptionState, PluginSubscriptionStore } from '../stores/plugin-subscription.store';

@Injectable({ providedIn: 'root' })
export class PluginSubscriptionQuery extends Query<IPluginSubscriptionState> {
	// Basic selectors
	public readonly subscriptions$: Observable<IPluginSubscription[]> = this.select((state) => state.subscriptions);
	public readonly selectedSubscription$: Observable<IPluginSubscription | null> = this.select(
		(state) => state.selectedSubscription
	);
	public readonly plans$: Observable<IPluginSubscriptionPlan[]> = this.select((state) => state.plans);
	public readonly selectedPlan$: Observable<IPluginSubscriptionPlan | null> = this.select(
		(state) => state.selectedPlan
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
	public readonly showSubscriptionDialog$: Observable<boolean> = this.select((state) => state.showSubscriptionDialog);
	public readonly selectedPluginId$: Observable<string | null> = this.select((state) => state.selectedPluginId);

	// Computed selectors
	public readonly activeSubscriptions$: Observable<IPluginSubscription[]> = this.subscriptions$.pipe(
		map((subscriptions) => {
			const subscriptionsArray = Array.isArray(subscriptions) ? subscriptions : [];
			return subscriptionsArray.filter(
				(s) => s.status === PluginSubscriptionStatus.ACTIVE || s.status === PluginSubscriptionStatus.TRIAL
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

	// Free vs paid plans
	public readonly freePlans$: Observable<IPluginSubscriptionPlan[]> = this.plans$.pipe(
		map((plans) => {
			const plansArray = Array.isArray(plans) ? plans : [];
			return plansArray.filter((p) => p.price === 0);
		})
	);

	public readonly paidPlans$: Observable<IPluginSubscriptionPlan[]> = this.plans$.pipe(
		map((plans) => {
			const plansArray = Array.isArray(plans) ? plans : [];
			return plansArray.filter((p) => p.price > 0);
		})
	);

	// Featured/recommended plans
	public readonly featuredPlans$: Observable<IPluginSubscriptionPlan[]> = this.plans$.pipe(
		map((plans) => {
			const plansArray = Array.isArray(plans) ? plans : [];
			return plansArray.filter((p) => p.isPopular || p.isRecommended);
		})
	);

	// Combined loading state
	public readonly isLoading$: Observable<boolean> = this.select(
		(state) => state.loading || state.creating || state.updating || state.deleting
	);

	constructor(readonly pluginSubscriptionStore: PluginSubscriptionStore) {
		super(pluginSubscriptionStore);
	}

	// Getters for current values
	public get subscriptions(): IPluginSubscription[] {
		const value = this.getValue().subscriptions;
		return Array.isArray(value) ? value : [];
	}

	public get selectedSubscription(): IPluginSubscription | null {
		return this.getValue().selectedSubscription;
	}

	public get plans(): IPluginSubscriptionPlan[] {
		const value = this.getValue().plans;
		return Array.isArray(value) ? value : [];
	}

	public get selectedPlan(): IPluginSubscriptionPlan | null {
		return this.getValue().selectedPlan;
	}

	public get loading(): boolean {
		return this.getValue().loading;
	}

	public get error(): string | null {
		return this.getValue().error;
	}

	public get showSubscriptionDialog(): boolean {
		return this.getValue().showSubscriptionDialog;
	}

	public get selectedPluginId(): string | null {
		return this.getValue().selectedPluginId;
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
		return this.activeSubscriptions$.pipe(
			map((subscriptions) => {
				const subscriptionsArray = Array.isArray(subscriptions) ? subscriptions : [];
				return subscriptionsArray.find((s) => s.pluginId === pluginId) || null;
			})
		);
	}

	public hasActiveSubscriptionForPlugin(pluginId: string): Observable<boolean> {
		return this.getActiveSubscriptionForPlugin(pluginId).pipe(map((subscription) => !!subscription));
	}

	public getPlanById(planId: string): Observable<IPluginSubscriptionPlan | null> {
		return this.plans$.pipe(
			map((plans) => {
				const plansArray = Array.isArray(plans) ? plans : [];
				return plansArray.find((p) => p.id === planId) || null;
			})
		);
	}

	public getPlansForPlugin(pluginId: string): Observable<IPluginSubscriptionPlan[]> {
		return this.plans$.pipe(
			map((plans) => {
				const plansArray = Array.isArray(plans) ? plans : [];
				return plansArray.filter((p) => p.pluginId === pluginId);
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
					active: subscriptionsArray.filter((s) => s.status === PluginSubscriptionStatus.ACTIVE).length,
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
