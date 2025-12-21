import {
	IPluginSubscriptionPlan,
	PluginBillingPeriod,
	PluginSubscriptionType
} from '../../../../services/plugin-subscription.service';
import { PlanActionType } from '../services/plan-comparison.service';

/**
 * View model for displaying subscription plans with comparison information
 * Follows SOLID principle: Single Responsibility - handles view data transformation
 */
export interface IPlanViewModel {
	id: string;
	name: string;
	description: string;
	type: PluginSubscriptionType;
	price: number;
	currency: string;
	billingPeriod: PluginBillingPeriod;
	features: string[];
	limitations?: Record<string, any>;

	// Display properties
	formattedPrice: string;
	formattedBillingPeriod: string;
	icon: string;
	colorStatus: string;

	// Badges
	isPopular: boolean;
	isRecommended: boolean;
	isFree: boolean;

	// Trial info
	trialDays?: number;
	trialText?: string;

	// Pricing details
	setupFee?: number;
	formattedSetupFee?: string;
	discountPercentage?: number;

	// Comparison state (populated when compared with current subscription)
	comparisonResult?: IPlanComparisonDisplayInfo;

	// Original plan data
	originalPlan: IPluginSubscriptionPlan;
}

/**
 * Display information for plan comparison
 */
export interface IPlanComparisonDisplayInfo {
	actionType: PlanActionType;
	actionText: string;
	buttonVariant: 'primary' | 'success' | 'warning' | 'basic';
	isDisabled: boolean;
	canProceed: boolean;
	requiresPayment: boolean;
	prorationAmount?: number;
	formattedProrationAmount?: string;
	restrictions: string[];
	benefits: string[];
	badgeText?: string;
	badgeColor?: string;
}

/**
 * View model for subscription preview
 */
export interface ISubscriptionPreviewViewModel {
	planName: string;
	baseAmount: number;
	formattedBaseAmount: string;
	setupFee: number;
	formattedSetupFee: string;
	discount: number;
	formattedDiscount: string;
	totalAmount: number;
	formattedTotalAmount: string;
	currency: string;
	billingPeriod: PluginBillingPeriod;
	formattedBillingPeriod: string;
	trialDays?: number;
	trialText?: string;
	features: string[];
	isFree: boolean;
}
