import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { IPluginSubscription, PluginSubscriptionType } from '../../../../services/plugin-subscription.service';
import { IPlanViewModel, ISubscriptionPreviewViewModel } from '../models/plan-view.model';
import { IPlanComparisonResult, PlanActionType } from '../services/plan-comparison.service';

/**
 * Component for displaying subscription confirmation details
 * Shows exactly what action will be taken and any payment/proration information
 */
@Component({
	selector: 'lib-subscription-confirmation',
	templateUrl: './subscription-confirmation.component.html',
	styleUrls: ['./subscription-confirmation.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class SubscriptionConfirmationComponent implements OnInit {
	@Input() selectedPlan!: IPlanViewModel;
	@Input() currentSubscription: IPluginSubscription | null = null;
	@Input() comparisonResult!: IPlanComparisonResult;
	@Input() subscriptionPreview: ISubscriptionPreviewViewModel | null = null;

	// Expose enum to template
	public readonly PlanActionType = PlanActionType;

	ngOnInit(): void {
		console.log('SubscriptionConfirmation initialized:', {
			selectedPlan: this.selectedPlan?.name,
			actionType: this.comparisonResult?.actionType,
			requiresPayment: this.comparisonResult?.requiresPayment
		});
	}

	public getHeaderClass(): string {
		switch (this.comparisonResult.actionType) {
			case PlanActionType.UPGRADE:
				return 'upgrade-header';
			case PlanActionType.DOWNGRADE:
				return 'downgrade-header';
			case PlanActionType.NEW:
				return 'new-header';
			default:
				return 'default-header';
		}
	}

	public getActionIcon(): string {
		switch (this.comparisonResult.actionType) {
			case PlanActionType.UPGRADE:
				return 'trending-up-outline';
			case PlanActionType.DOWNGRADE:
				return 'trending-down-outline';
			case PlanActionType.NEW:
				return 'plus-circle-outline';
			default:
				return 'checkmark-circle-outline';
		}
	}

	public getActionTitle(): string {
		switch (this.comparisonResult.actionType) {
			case PlanActionType.UPGRADE:
				return `Upgrade to ${this.selectedPlan.name}`;
			case PlanActionType.DOWNGRADE:
				return `Downgrade to ${this.selectedPlan.name}`;
			case PlanActionType.NEW:
				return `Subscribe to ${this.selectedPlan.name}`;
			default:
				return `Select ${this.selectedPlan.name}`;
		}
	}

	public getActionDescription(): string {
		switch (this.comparisonResult.actionType) {
			case PlanActionType.UPGRADE:
				return 'You are upgrading your current subscription. Changes will take effect immediately.';
			case PlanActionType.DOWNGRADE:
				return 'You are downgrading your subscription. Changes will take effect at your next billing cycle.';
			case PlanActionType.NEW:
				return 'You are subscribing to a new plan. Access will begin immediately upon confirmation.';
			default:
				return 'Please review the plan details below.';
		}
	}

	public getPaymentTimingText(): string {
		if (this.selectedPlan.isFree) {
			return 'No payment required';
		}

		switch (this.comparisonResult.actionType) {
			case PlanActionType.UPGRADE:
				return 'Charged immediately (prorated amount)';
			case PlanActionType.DOWNGRADE:
				return 'No immediate charge. New rate applies next billing cycle';
			case PlanActionType.NEW:
				return this.selectedPlan.trialDays
					? `Free for ${this.selectedPlan.trialDays} days, then charged ${this.selectedPlan.formattedBillingPeriod}ly`
					: `Charged ${this.selectedPlan.formattedBillingPeriod}ly`;
			default:
				return 'Payment timing will be confirmed';
		}
	}

	public formatSubscriptionType(type: PluginSubscriptionType): string {
		const typeMap = {
			[PluginSubscriptionType.FREE]: 'Free Plan',
			[PluginSubscriptionType.TRIAL]: 'Trial Plan',
			[PluginSubscriptionType.BASIC]: 'Basic Plan',
			[PluginSubscriptionType.PREMIUM]: 'Premium Plan',
			[PluginSubscriptionType.ENTERPRISE]: 'Enterprise Plan',
			[PluginSubscriptionType.CUSTOM]: 'Custom Plan'
		};

		return typeMap[type] || type;
	}
}
