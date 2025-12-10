import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { IPluginSubscription } from '../../../../services/plugin-subscription.service';

export interface IPluginSubscriptionState {
	subscriptions: IPluginSubscription[];
	selectedSubscription: IPluginSubscription | null;
	loading: boolean;
	creating: boolean;
	updating: boolean;
	deleting: boolean;
	error: string | null;

	// Current subscription tracking
	currentPluginSubscriptions: Record<string, IPluginSubscription | null>;

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
	selectedPluginId: string | null;
}

export function createInitialSubscriptionState(): IPluginSubscriptionState {
	return {
		subscriptions: [],
		selectedSubscription: null,
		loading: false,
		creating: false,
		updating: false,
		deleting: false,
		error: null,
		currentPluginSubscriptions: {},
		analytics: null,
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

	// (Plan responsibilities moved to PluginPlanStore)

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

	// Reset methods
	public reset(): void {
		this.update({ subscriptions: [] });
	}

	public resetError(): void {
		this.update({ error: null });
	}

	public resetPluginState(pluginId: string): void {
		this.update((state) => {
			const { [pluginId]: removedSub, ...remainingSubs } = state.currentPluginSubscriptions;
			return {
				currentPluginSubscriptions: remainingSubs
			};
		});
	}

	public setAnalytics(analytics: any): void {
		this.update({ analytics });
	}
}
