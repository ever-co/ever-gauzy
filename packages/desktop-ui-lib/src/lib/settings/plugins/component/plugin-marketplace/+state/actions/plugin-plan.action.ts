import { ID } from '@gauzy/contracts';
import { createAction } from '@ngneat/effects';
import { IPluginSubscriptionPlan } from '../../../../services/plugin-subscription.service';

export class PluginPlanActions {
	// Load Plugin Plans
	public static loadPluginPlans = createAction('[Plugin Plan] Load Plugin Plans', (pluginId: string) => ({
		pluginId
	}));

	public static loadPluginPlansSuccess = createAction(
		'[Plugin Plan] Load Plugin Plans Success',
		(plans: IPluginSubscriptionPlan[]) => ({ plans })
	);

	public static loadPluginPlansFailure = createAction('[Plugin Plan] Load Plugin Plans Failure', (error: string) => ({
		error
	}));

	// UI Actions
	public static selectPlan = createAction('[Plugin Plan] Select Plan', (plan: IPluginSubscriptionPlan | null) => ({
		plan
	}));

	public static openPlanSubscriptions = createAction('[Plugin Plan] Open Plan Subscriptions', (pluginId: ID) => ({
		pluginId
	}));

	public static openPlanCreator = createAction('[Plugin Plan] Open Plan Creator Dialog', (pluginId: ID) => ({
		pluginId
	}));

	// Plan CRUD Actions
	public static createPlan = createAction(
		'[Plugin Plan] Create Plan',
		(planData: Omit<IPluginSubscriptionPlan, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>) => ({ planData })
	);

	public static createPlanSuccess = createAction(
		'[Plugin Plan] Create Plan Success',
		(plan: IPluginSubscriptionPlan) => ({ plan })
	);

	public static createPlanFailure = createAction('[Plugin Plan] Create Plan Failure', (error: string) => ({ error }));

	public static updatePlan = createAction(
		'[Plugin Plan] Update Plan',
		(planId: string, updates: Partial<IPluginSubscriptionPlan>) => ({ planId, updates })
	);

	public static updatePlanSuccess = createAction(
		'[Plugin Plan] Update Plan Success',
		(plan: IPluginSubscriptionPlan) => ({ plan })
	);

	public static updatePlanFailure = createAction('[Plugin Plan] Update Plan Failure', (error: string) => ({ error }));

	public static deletePlan = createAction('[Plugin Plan] Delete Plan', (planId: string) => ({ planId }));

	public static deletePlanSuccess = createAction('[Plugin Plan] Delete Plan Success', (planId: string) => ({
		planId
	}));

	public static deletePlanFailure = createAction('[Plugin Plan] Delete Plan Failure', (error: string) => ({ error }));

	public static bulkCreatePlans = createAction(
		'[Plugin Plan] Bulk Create Plans',
		(plansData: Array<Partial<IPluginSubscriptionPlan>>) => ({
			plansData
		})
	);

	public static bulkCreatePlansSuccess = createAction(
		'[Plugin Plan] Bulk Create Plans Success',
		(plans: IPluginSubscriptionPlan[]) => ({ plans })
	);

	public static bulkCreatePlansFailure = createAction('[Plugin Plan] Bulk Create Plans Failure', (error: string) => ({
		error
	}));

	// Current plugin plans state
	public static setCurrentPluginPlans = createAction(
		'[Plugin Plan] Set Current Plugin Plans',
		(pluginId: string, plans: IPluginSubscriptionPlan[]) => ({ pluginId, plans })
	);

	// Reset errors
	public static resetErrors = createAction('[Plugin Plan] Reset Errors');
}
