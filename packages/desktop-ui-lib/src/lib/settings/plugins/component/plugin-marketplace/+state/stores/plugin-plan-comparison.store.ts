import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { PlanActionType } from '../../plugin-subscription-plan-selection/services/plan-comparison.service';

export interface IPluginPlanComparisonState {
  planComparison: {
    currentPlanId: string | null;
    selectedPlanId: string | null;
    actionType: PlanActionType | null;
    isValidAction: boolean;
    requiresPayment: boolean;
    prorationAmount?: number;
  };
  confirmationStep: 'selection' | 'confirmation' | 'payment' | 'processing' | 'completed' | null;
}

export function createInitialPlanComparisonState(): IPluginPlanComparisonState {
  return {
    planComparison: {
      currentPlanId: null,
      selectedPlanId: null,
      actionType: null,
      isValidAction: false,
      requiresPayment: false
    },
    confirmationStep: null
  };
}

@StoreConfig({ name: '_plugin_plan_comparison' })
@Injectable({ providedIn: 'root' })
export class PluginPlanComparisonStore extends Store<IPluginPlanComparisonState> {
  constructor() {
    super(createInitialPlanComparisonState());
  }

  public updatePlanComparison(comparison: Partial<IPluginPlanComparisonState['planComparison']>): void {
    this.update((state) => ({ planComparison: { ...state.planComparison, ...comparison } }));
  }

  public resetPlanComparison(): void {
    this.update({ planComparison: { currentPlanId: null, selectedPlanId: null, actionType: null, isValidAction: false, requiresPayment: false } });
  }

  public setConfirmationStep(step: IPluginPlanComparisonState['confirmationStep']): void {
    this.update({ confirmationStep: step });
  }

  public reset(): void {
    this.update(createInitialPlanComparisonState());
  }
}
