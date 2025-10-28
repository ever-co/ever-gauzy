import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { IPluginSubscription, IPluginSubscriptionPlan } from '../../../../services/plugin-subscription.service';

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
		analytics: null,
		showSubscriptionDialog: false,
		selectedPluginId: null
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
		this.update({ subscriptions });
	}

	public addSubscription(subscription: IPluginSubscription): void {
		this.update((state) => ({
			subscriptions: [subscription, ...state.subscriptions]
		}));
	}

	public updateSubscription(id: string, subscription: Partial<IPluginSubscription>): void {
		this.update((state) => ({
			subscriptions: state.subscriptions.map((s) => (s.id === id ? { ...s, ...subscription } : s))
		}));
	}

	public removeSubscription(id: string): void {
		this.update((state) => ({
			subscriptions: state.subscriptions.filter((s) => s.id !== id)
		}));
	}

	public selectSubscription(subscription: IPluginSubscription | null): void {
		this.update({ selectedSubscription: subscription });
	}

	// Plan management
	public setPlans(plans: IPluginSubscriptionPlan[]): void {
		this.update({ plans });
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

	// Analytics
	public setAnalytics(analytics: IPluginSubscriptionState['analytics']): void {
		this.update({ analytics });
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
		this.update(createInitialSubscriptionState());
	}

	public resetError(): void {
		this.update({ error: null });
	}
}
