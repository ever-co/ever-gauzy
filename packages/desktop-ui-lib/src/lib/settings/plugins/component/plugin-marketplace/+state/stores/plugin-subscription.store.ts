import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { IPluginSubscription, IPluginSubscriptionPlan } from '../../../../services/plugin-subscription.service';
import { PlanActionType } from '../../plugin-subscription-plan-selection/services/plan-comparison.service';

export interface IPluginSubscriptionState {
	subscriptions: IPluginSubscription[];
	selectedSubscription: IPluginSubscription | null;
	plans: IPluginSubscriptionPlan[];
	selectedPlan: IPluginSubscriptionPlan | null;
	loading: boolean;
	creating: boolean;
	updating: boolean;
	deleting: boolean;
	error: string | null;

	// Current subscription tracking
	currentPluginSubscriptions: Record<string, IPluginSubscription | null>;
	currentPluginPlans: Record<string, IPluginSubscriptionPlan[]>;

	// Plan comparison state
	planComparison: {
		currentPlanId: string | null;
		selectedPlanId: string | null;
		actionType: PlanActionType;
		isValidAction: boolean;
		requiresPayment: boolean;
		prorationAmount?: number;
	};

	// Analytics data
	analytics: {
		totalSubscriptions: number;
		activeSubscriptions: number;
		trialSubscriptions: number;
		revenue: number;
		churnRate: number;
		averageRevenuePerUser: number;
		subscriptionsByType: Record<string, number>;
		revenueByPeriod: Array<{ period: string; revenue: number }>;
	} | null;

	// UI state
	showSubscriptionDialog: boolean;
	selectedPluginId: string | null;
	confirmationStep: 'selection' | 'confirmation' | 'payment' | 'processing' | 'completed' | null;
}

export function createInitialSubscriptionState(): IPluginSubscriptionState {
	return {
		subscriptions: [],
		selectedSubscription: null,
		plans: [],
		selectedPlan: null,
		loading: false,
		creating: false,
		updating: false,
		deleting: false,
		error: null,
		currentPluginSubscriptions: {},
		currentPluginPlans: {},
		planComparison: {
			currentPlanId: null,
			selectedPlanId: null,
			actionType: null,
			isValidAction: false,
			requiresPayment: false
		},
		analytics: null,
		showSubscriptionDialog: false,
		selectedPluginId: null,
		confirmationStep: null
	};
}

@StoreConfig({ name: '_plugin_subscription' })
@Injectable({ providedIn: 'root' })
export class PluginSubscriptionStore extends Store<IPluginSubscriptionState> {
	constructor() {
		super(createInitialSubscriptionState());
	}

	// Subscription management
	public setSubscriptions(subscriptions: IPluginSubscription[]): void {
		// Defensive programming: ensure subscriptions is always an array
		const normalizedSubscriptions = Array.isArray(subscriptions) ? subscriptions : [];
		this.update({ subscriptions: normalizedSubscriptions });
	}

	public addSubscription(subscription: IPluginSubscription): void {
		this.update((state) => {
			const currentSubscriptions = Array.isArray(state.subscriptions) ? state.subscriptions : [];
			return {
				subscriptions: [subscription, ...currentSubscriptions]
			};
		});
	}

	public updateSubscription(id: string, subscription: Partial<IPluginSubscription>): void {
		this.update((state) => {
			const currentSubscriptions = Array.isArray(state.subscriptions) ? state.subscriptions : [];
			return {
				subscriptions: currentSubscriptions.map((s) => (s.id === id ? { ...s, ...subscription } : s))
			};
		});
	}

	public removeSubscription(id: string): void {
		this.update((state) => {
			const currentSubscriptions = Array.isArray(state.subscriptions) ? state.subscriptions : [];
			return {
				subscriptions: currentSubscriptions.filter((s) => s.id !== id)
			};
		});
	}

	public selectSubscription(subscription: IPluginSubscription | null): void {
		this.update({ selectedSubscription: subscription });
	}

	// Plan management
	public setPlans(plans: IPluginSubscriptionPlan[]): void {
		// Defensive programming: ensure plans is always an array
		const normalizedPlans = Array.isArray(plans) ? plans : [];
		this.update({ plans: normalizedPlans });
	}

	public addPlan(plan: IPluginSubscriptionPlan): void {
		this.update((state) => {
			const currentPlans = Array.isArray(state.plans) ? state.plans : [];
			return {
				plans: [...currentPlans, plan]
			};
		});
	}

	public updatePlan(id: string, plan: Partial<IPluginSubscriptionPlan>): void {
		this.update((state) => {
			const currentPlans = Array.isArray(state.plans) ? state.plans : [];
			return {
				plans: currentPlans.map((p) => (p.id === id ? { ...p, ...plan } : p))
			};
		});
	}

	public removePlan(id: string): void {
		this.update((state) => {
			const currentPlans = Array.isArray(state.plans) ? state.plans : [];
			return {
				plans: currentPlans.filter((p) => p.id !== id)
			};
		});
	}

	public selectPlan(plan: IPluginSubscriptionPlan | null): void {
		this.update({ selectedPlan: plan });
	}

	// Loading states
	public setLoading(loading: boolean): void {
		this.update({ loading });
	}

	public setCreating(creating: boolean): void {
		this.update({ creating });
	}

	public setUpdating(updating: boolean): void {
		this.update({ updating });
	}

	public setDeleting(deleting: boolean): void {
		this.update({ deleting });
	}

	// Error handling
	public setErrorMessage(error: string | null): void {
		this.update({ error });
	}

	// Current subscription management for specific plugins
	public setCurrentPluginSubscription(pluginId: string, subscription: IPluginSubscription | null): void {
		this.update((state) => ({
			currentPluginSubscriptions: {
				...state.currentPluginSubscriptions,
				[pluginId]: subscription
			}
		}));
	}

	public setCurrentPluginPlans(pluginId: string, plans: IPluginSubscriptionPlan[]): void {
		this.update((state) => ({
			currentPluginPlans: {
				...state.currentPluginPlans,
				[pluginId]: plans
			}
		}));
	}

	// Plan comparison management
	public updatePlanComparison(comparison: Partial<IPluginSubscriptionState['planComparison']>): void {
		this.update((state) => ({
			planComparison: {
				...state.planComparison,
				...comparison
			}
		}));
	}

	public setPlanComparison(
		currentPlanId: string | null,
		selectedPlanId: string | null,
		actionType: PlanActionType,
		isValidAction: boolean,
		requiresPayment: boolean,
		prorationAmount?: number
	): void {
		this.update({
			planComparison: {
				currentPlanId,
				selectedPlanId,
				actionType,
				isValidAction,
				requiresPayment,
				prorationAmount
			}
		});
	}

	// Subscription flow management
	public setConfirmationStep(step: IPluginSubscriptionState['confirmationStep']): void {
		this.update({ confirmationStep: step });
	}

	public resetPlanComparison(): void {
		this.update({
			planComparison: {
				currentPlanId: null,
				selectedPlanId: null,
				actionType: null,
				isValidAction: false,
				requiresPayment: false
			}
		});
	}

	// UI state
	public setShowSubscriptionDialog(show: boolean, pluginId?: string): void {
		this.update({
			showSubscriptionDialog: show,
			selectedPluginId: pluginId || null
		});
	}

	// Reset methods
	public reset(): void {
		this.update({ subscriptions: [], plans: [] });
	}

	public resetError(): void {
		this.update({ error: null });
	}

	public resetPluginState(pluginId: string): void {
		this.update((state) => {
			const { [pluginId]: removedSub, ...remainingSubs } = state.currentPluginSubscriptions;
			const { [pluginId]: removedPlans, ...remainingPlans } = state.currentPluginPlans;
			return {
				currentPluginSubscriptions: remainingSubs,
				currentPluginPlans: remainingPlans
			};
		});
	}

	public setAnalytics(analytics: any): void {
		this.update({ analytics });
	}
}
