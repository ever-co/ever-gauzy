import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { combineLatest, map, Observable } from 'rxjs';
import { IPluginSubscriptionPlan } from '../../../../services/plugin-subscription.service';
import { IPluginPlanComparisonState, PluginPlanComparisonStore } from '../stores/plugin-plan-comparison.store';
import { PluginPlanQuery } from './plugin-plan.query';

@Injectable({ providedIn: 'root' })
export class PluginPlanComparisonQuery extends Query<IPluginPlanComparisonState> {
    constructor(readonly pluginPlanComparisonStore: PluginPlanComparisonStore, private readonly planQuery: PluginPlanQuery) {
        super(pluginPlanComparisonStore as any);
    }

    public readonly planComparison$ = this.select((s) => s.planComparison);
    public readonly confirmationStep$ = this.select((s) => s.confirmationStep);

    public readonly currentPlanId$ = this.planComparison$.pipe(map((c) => c.currentPlanId || null));
    public readonly selectedPlanId$ = this.planComparison$.pipe(map((c) => c.selectedPlanId || null));
    public readonly actionType$ = this.planComparison$.pipe(map((c) => c.actionType || null));
    public readonly isValidAction$ = this.planComparison$.pipe(map((c) => !!c.isValidAction));
    public readonly requiresPayment$ = this.planComparison$.pipe(map((c) => !!c.requiresPayment));
    public readonly prorationAmount$ = this.planComparison$.pipe(map((c) => c.prorationAmount));

    public getPlanComparisonForPlugin(pluginId: string): Observable<{
        currentPlan: IPluginSubscriptionPlan | null;
        selectedPlan: IPluginSubscriptionPlan | null;
        actionType: any;
        isValidAction: boolean;
        requiresPayment: boolean;
        prorationAmount?: number;
    }> {
        return combineLatest([this.planQuery.getPlansForPlugin(pluginId), this.planComparison$]).pipe(
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
                    isValidAction: !!comparison.isValidAction,
                    requiresPayment: !!comparison.requiresPayment,
                    prorationAmount: comparison.prorationAmount
                };
            })
        );
    }
}
