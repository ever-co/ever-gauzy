import { Injectable } from '@angular/core';
import { IPluginSubscription, PluginSubscriptionStatus } from '../../../../services/plugin-subscription.service';

/**
 * Service for subscription status icon and badge mapping
 * Following Single Responsibility Principle
 */
@Injectable({
	providedIn: 'root'
})
export class SubscriptionStatusService {
	/**
	 * Get icon for subscription status
	 */
	getStatusIcon(status: string): string {
		const iconMap: Record<string, string> = {
			active: 'checkmark-circle-outline',
			trial: 'clock-outline',
			expired: 'alert-triangle-outline',
			cancelled: 'close-circle-outline',
			suspended: 'pause-circle-outline',
			pending: 'hourglass-outline',
			past_due: 'alert-circle-outline'
		};

		return iconMap[status?.toLowerCase()] || 'info-outline';
	}

	/**
	 * Get badge status for Nebular theme
	 */
	getBadgeStatus(status: PluginSubscriptionStatus): string {
		const statusMap: Partial<Record<PluginSubscriptionStatus, string>> = {
			[PluginSubscriptionStatus.ACTIVE]: 'success',
			[PluginSubscriptionStatus.PENDING]: 'warning',
			[PluginSubscriptionStatus.CANCELLED]: 'danger',
			[PluginSubscriptionStatus.EXPIRED]: 'basic',
			[PluginSubscriptionStatus.TRIAL]: 'info',
			[PluginSubscriptionStatus.SUSPENDED]: 'danger',
			[PluginSubscriptionStatus.PAST_DUE]: 'warning'
		};

		return statusMap[status] || 'basic';
	}

	/**
	 * Check if subscription is active
	 */
	isActive(subscription: IPluginSubscription): boolean {
		return subscription.status === PluginSubscriptionStatus.ACTIVE;
	}

	/**
	 * Check if subscription is in trial
	 */
	isTrial(subscription: IPluginSubscription): boolean {
		return subscription.status === PluginSubscriptionStatus.TRIAL;
	}

	/**
	 * Check if subscription is expiring soon
	 */
	isExpiringSoon(subscription: IPluginSubscription): boolean {
		if (!subscription.endDate && !subscription.trialEndDate) return false;

		const daysRemaining = this.getDaysRemaining(subscription);
		return daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0;
	}

	/**
	 * Check if subscription requires action
	 */
	requiresAction(subscription: IPluginSubscription): boolean {
		return (
			subscription.status === PluginSubscriptionStatus.PAST_DUE ||
			subscription.status === PluginSubscriptionStatus.SUSPENDED ||
			this.isExpiringSoon(subscription)
		);
	}

	/**
	 * Get status display text
	 */
	getStatusDisplayText(status: PluginSubscriptionStatus): string {
		const displayMap: Record<PluginSubscriptionStatus, string> = {
			[PluginSubscriptionStatus.ACTIVE]: 'Active',
			[PluginSubscriptionStatus.TRIAL]: 'Trial',
			[PluginSubscriptionStatus.PENDING]: 'Pending',
			[PluginSubscriptionStatus.CANCELLED]: 'Cancelled',
			[PluginSubscriptionStatus.EXPIRED]: 'Expired',
			[PluginSubscriptionStatus.SUSPENDED]: 'Suspended',
			[PluginSubscriptionStatus.PAST_DUE]: 'Past Due'
		};

		return displayMap[status] || 'Unknown';
	}

	/**
	 * Calculate days remaining in subscription
	 */
	getDaysRemaining(subscription: IPluginSubscription): number | null {
		const endDate = subscription.endDate || subscription.trialEndDate;
		if (!endDate) return null;

		const end = new Date(endDate);
		const now = new Date();
		const diffTime = end.getTime() - now.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		return Math.max(0, diffDays);
	}
}
