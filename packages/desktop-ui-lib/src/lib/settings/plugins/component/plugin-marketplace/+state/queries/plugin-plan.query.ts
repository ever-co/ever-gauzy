import { Injectable, inject } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IPluginSubscriptionPlan } from '../../../../services/plugin-subscription.service';
import { SubscriptionPlanService } from '../../shared';
import { IPluginPlanState, PluginPlanStore } from '../stores/plugin-plan.store';

@Injectable({ providedIn: 'root' })
export class PluginPlanQuery extends Query<IPluginPlanState> {
	private readonly planService = inject(SubscriptionPlanService);

	constructor(readonly pluginPlanStore: PluginPlanStore) {
		super(pluginPlanStore);
	}

	public readonly plans$ = this.select((s) => s.plans);
	public readonly selectedPlan$ = this.select((s) => s.selectedPlan);
	public readonly loading$ = this.select((s) => s.loading);
	public readonly creating$ = this.select((s) => s.creating);
	public readonly updating$ = this.select((s) => s.updating);
	public readonly deleting$ = this.select((s) => s.deleting);
	public readonly error$ = this.select((s) => s.error);
	public readonly currentPluginPlans$ = this.select((s) => s.currentPluginPlans);

	public readonly freePlans$ = this.plans$.pipe(map((plans) => (plans || []).filter((p) => Number(p.price) === 0)));
	public readonly paidPlans$ = this.plans$.pipe(map((plans) => (plans || []).filter((p) => Number(p.price) > 0)));
	public readonly featuredPlans$ = this.plans$.pipe(
		map((plans) => (plans || []).filter((p) => p.isPopular || p.isRecommended))
	);

	public get plans(): IPluginSubscriptionPlan[] {
		return this.getValue().plans || [];
	}

	public get selectedPlan(): IPluginSubscriptionPlan | null {
		return this.getValue().selectedPlan;
	}

	public getPlanById(planId: string): Observable<IPluginSubscriptionPlan | null> {
		return this.plans$.pipe(map((plans) => (plans || []).find((p) => p.id === planId) || null));
	}

	public getPlansForPlugin(pluginId: string): Observable<IPluginSubscriptionPlan[]> {
		return this.currentPluginPlans$.pipe(map((m) => m[pluginId] || []));
	}

	public getCurrentPluginPlans(pluginId: string): Observable<IPluginSubscriptionPlan[]> {
		return this.currentPluginPlans$.pipe(map((map) => map[pluginId] || []));
	}

	public canUpgradeFromPlan(fromId: string, toId: string): Observable<boolean> {
		return this.getPlanById(fromId).pipe(
			map((from) => {
				if (!from) return false;
				const to = this.getValue().plans.find((p) => p.id === toId);
				if (!to) return false;
				return this.planService.canUpgrade(from, to);
			})
		);
	}

	public canDowngradeFromPlan(fromId: string, toId: string): Observable<boolean> {
		return this.getPlanById(fromId).pipe(
			map((from) => {
				if (!from) return false;
				const to = this.getValue().plans.find((p) => p.id === toId);
				if (!to) return false;
				return this.planService.canDowngrade(from, to);
			})
		);
	}
}
