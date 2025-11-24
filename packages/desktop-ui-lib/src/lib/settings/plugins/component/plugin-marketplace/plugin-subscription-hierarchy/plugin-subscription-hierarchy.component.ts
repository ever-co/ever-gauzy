import { Component, Input, OnInit } from '@angular/core';
import { PluginScope } from '@gauzy/contracts';
import { IPluginSubscription, PluginSubscriptionStatus } from '../../../services/plugin-subscription.service';
import { SubscriptionStatusService } from '../shared';

interface SubscriptionNode {
	subscription: IPluginSubscription;
	level: number;
	isExpanded: boolean;
	hasChildren: boolean;
}

@Component({
	selector: 'gauzy-plugin-subscription-hierarchy',
	templateUrl: './plugin-subscription-hierarchy.component.html',
	styleUrls: ['./plugin-subscription-hierarchy.component.scss'],
	standalone: false
})
export class PluginSubscriptionHierarchyComponent implements OnInit {
	@Input() subscriptions: IPluginSubscription[] = [];
	@Input() showActions = true;

	nodes: SubscriptionNode[] = [];

	readonly pluginScope = PluginScope;
	readonly subscriptionStatus = PluginSubscriptionStatus;

	constructor(public readonly statusService: SubscriptionStatusService) {}

	ngOnInit(): void {
		if (this.subscriptions && this.subscriptions.length > 0) {
			this.buildHierarchy();
		}
	}

	private buildHierarchy(): void {
		// For now, just display subscriptions as a flat list
		// In the future, when parent-child relationships are available,
		// we can build a proper tree structure
		this.nodes = this.subscriptions.map((subscription) => ({
			subscription,
			level: 0,
			isExpanded: true,
			hasChildren: false
		}));
	}

	// Status badge logic moved to SubscriptionStatusService

	getUserId(subscription: IPluginSubscription): string {
		return subscription.userId || 'N/A';
	}

	formatDate(date: Date | string | undefined): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleDateString();
	}

	formatAmount(subscription: IPluginSubscription): string {
		return `${subscription.currency} ${subscription.amount.toFixed(2)}`;
	}
}
