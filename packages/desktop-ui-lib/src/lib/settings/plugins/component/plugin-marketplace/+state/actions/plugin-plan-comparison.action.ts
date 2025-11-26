import { createAction } from '@ngneat/effects';
import { PlanActionType } from '../../plugin-subscription-plan-selection/services/plan-comparison.service';

export class PluginPlanComparisonActions {
    public static updatePlanComparison = createAction(
        '[Plugin Plan Comparison] Update Plan Comparison',
        (comparison: {
            currentPlanId?: string | null;
            selectedPlanId?: string | null;
            actionType?: PlanActionType;
            isValidAction?: boolean;
            requiresPayment?: boolean;
            prorationAmount?: number;
        }) => ({ comparison })
    );

    public static resetPlanComparison = createAction('[Plugin Plan Comparison] Reset Plan Comparison');

    public static setConfirmationStep = createAction(
        '[Plugin Plan Comparison] Set Confirmation Step',
        (step: 'selection' | 'confirmation' | 'payment' | 'processing' | 'completed' | null) => ({ step })
    );
}
