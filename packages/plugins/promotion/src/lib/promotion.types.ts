import { DecimalString, IBasePerTenantAndOrganizationEntityModel, ID, IPagination } from '@gauzy/contracts';

/**
 * The promotion domain's value sets and in-memory shapes.
 *
 * The enumerations live beside the tables they describe rather than in the shared contract package,
 * because a promotion is a concept only this domain has: a cart, an order or a return reads a
 * promotion through the numbers it produced (an `adjustment` row), never through these types. What
 * crosses a domain boundary — money, currency, the rule engine, the adjustment ledger — is already
 * declared by the kernel.
 */

/**
 * Lifecycle of a campaign.
 */
export enum CampaignStatus {
	/** Being prepared; its promotions are not candidates. */
	DRAFT = 'DRAFT',
	/** Running; its promotions are candidates inside its window. */
	ACTIVE = 'ACTIVE',
	/** Deliberately stopped. */
	INACTIVE = 'INACTIVE'
}

/**
 * What a campaign budget counts.
 */
export enum CampaignBudgetType {
	/** A money ceiling across the campaign. */
	SPEND = 'SPEND',
	/** A redemption count. */
	USAGE = 'USAGE',
	/** A money ceiling per value of the budget's attribute. */
	SPEND_BY_ATTRIBUTE = 'SPEND_BY_ATTRIBUTE',
	/** A redemption count per value of the budget's attribute. */
	USAGE_BY_ATTRIBUTE = 'USAGE_BY_ATTRIBUTE'
}

/**
 * Lifecycle of a promotion.
 */
export enum PromotionStatus {
	DRAFT = 'DRAFT',
	ACTIVE = 'ACTIVE',
	INACTIVE = 'INACTIVE',
	/** Set by the expiry sweep once the window has closed. */
	EXPIRED = 'EXPIRED'
}

/**
 * The shape of an offer, which decides the action types that are legal for it.
 */
export enum PromotionType {
	/** A plain discount: fixed, percentage or tiered percentage. */
	STANDARD = 'STANDARD',
	/** Buy some, get some: needs a buy-scope rule and a buy quantity. */
	BUY_GET = 'BUY_GET',
	/** Shipping is discounted to zero. */
	FREE_SHIPPING = 'FREE_SHIPPING',
	/** A set of items is discounted down to a bundle price. */
	BUNDLE = 'BUNDLE',
	/** Target items are given away. */
	FREE_ITEM = 'FREE_ITEM'
}

/**
 * What a promotion action does.
 */
export enum PromotionActionType {
	/** Subtract a fixed amount. */
	FIXED = 'FIXED',
	/** Subtract a fraction of the discountable amount. */
	PERCENTAGE = 'PERCENTAGE',
	/** Discount shipping to zero. */
	FREE_SHIPPING = 'FREE_SHIPPING',
	/** Add the target units as free lines. */
	FREE_ITEM = 'FREE_ITEM',
	/** Discount a target set down to a bundle price. */
	BUNDLE_PRICE = 'BUNDLE_PRICE',
	/** A percentage selected by a threshold. */
	TIERED_PERCENTAGE = 'TIERED_PERCENTAGE'
}

/**
 * What an action's benefit lands on.
 */
export enum PromotionActionTargetType {
	ORDER = 'ORDER',
	ITEMS = 'ITEMS',
	SHIPPING = 'SHIPPING'
}

/**
 * How an action's benefit is spread over its targets.
 */
export enum PromotionActionAllocation {
	/** Spread once over the whole targeted set, by largest remainder. */
	ACROSS = 'ACROSS',
	/** Once per discounted unit, so a partial return can reverse a whole number of units. */
	EACH = 'EACH',
	/** Once, on a single selected unit or on the set as a whole. */
	ONCE = 'ONCE'
}

/**
 * Lifecycle of one application of a promotion.
 */
export enum PromotionUsageStatus {
	/** Held while the cart is being checked out. */
	RESERVED = 'RESERVED',
	/** The order was placed; the discount stands. */
	REGISTERED = 'REGISTERED',
	/** Cancelled, expired or returned under the reversibility policy. */
	REVERTED = 'REVERTED'
}

/**
 * Lifecycle of a stored-value instrument.
 */
export enum GiftCardStatus {
	ACTIVE = 'ACTIVE',
	/** The balance reached zero. */
	REDEEMED = 'REDEEMED',
	/** The expiry instant passed. */
	EXPIRED = 'EXPIRED',
	/** Withdrawn by an operator; the ledger is kept. */
	CANCELED = 'CANCELED'
}

/**
 * What a gift-card ledger row records.
 */
export enum GiftCardTransactionType {
	/** The card was created and credited with its face value. */
	ISSUE = 'ISSUE',
	/** The balance was spent; the amount is negative. */
	REDEEM = 'REDEEM',
	/** Value was returned to the card. */
	REFUND = 'REFUND',
	/** A manual correction, in either direction. */
	ADJUST = 'ADJUST',
	/** A forfeited balance at expiry. */
	EXPIRE = 'EXPIRE'
}

/**
 * Why a promotion was excluded or only partly applied. Every exclusion is reported, because a
 * promotion that silently does nothing is the defect an operator cannot diagnose.
 */
export enum PromotionNotice {
	PROMOTION_INACTIVE = 'PROMOTION_INACTIVE',
	PROMOTION_EXPIRED = 'PROMOTION_EXPIRED',
	CAMPAIGN_WINDOW_CLOSED = 'CAMPAIGN_WINDOW_CLOSED',
	RULES_NOT_MATCHED = 'RULES_NOT_MATCHED',
	SELLER_SCOPE_MISMATCH = 'SELLER_SCOPE_MISMATCH',
	CURRENCY_MISMATCH = 'CURRENCY_MISMATCH',
	USAGE_LIMIT_EXCEEDED = 'USAGE_LIMIT_EXCEEDED',
	PER_CUSTOMER_LIMIT_EXCEEDED = 'PER_CUSTOMER_LIMIT_EXCEEDED',
	COUPON_INACTIVE = 'COUPON_INACTIVE',
	COUPON_EXPIRED = 'COUPON_EXPIRED',
	COUPON_LIMIT_EXCEEDED = 'COUPON_LIMIT_EXCEEDED',
	COUPON_CUSTOMER_LIMIT_EXCEEDED = 'COUPON_CUSTOMER_LIMIT_EXCEEDED',
	BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
	PARTIALLY_APPLIED_BUDGET = 'PARTIALLY_APPLIED_BUDGET',
	STACKING_CONFLICT = 'STACKING_CONFLICT',
	NO_TARGETS = 'NO_TARGETS',
	NO_DISCOUNTABLE_AMOUNT = 'NO_DISCOUNTABLE_AMOUNT',
	PROMOTION_CAPPED = 'PROMOTION_CAPPED',
	PROMOTION_CANDIDATE_LIMIT = 'PROMOTION_CANDIDATE_LIMIT'
}

/**
 * What happens to a promotion's usage when a return is received.
 */
export enum RevertOnReturnPolicy {
	/** The customer kept the benefit; usage stands. */
	NEVER = 'NEVER',
	/** The whole discount goes back to the budget. */
	ALWAYS = 'ALWAYS',
	/** The returned share of the discount goes back. */
	PROPORTIONAL = 'PROPORTIONAL'
}

/**
 * One notice produced by an evaluation.
 */
export interface IPromotionNotice {
	readonly promotionId: ID;
	readonly code: string;
	readonly notice: PromotionNotice;
	readonly message: string;
	readonly details?: Record<string, unknown>;
}

/**
 * One promotion that was applied, with the amount it gave away.
 */
export interface IPromotionApplication {
	readonly promotionId: ID;
	readonly couponId?: ID;
	readonly code?: string;
	readonly isAutomatic: boolean;
	readonly amount: DecimalString;
	readonly currency: string;
}

/**
 * The outcome of an evaluation. It is deterministic: the same inputs always produce the same
 * adjustments, which is what makes the golden fixtures meaningful.
 */
export interface IPromotionEvaluationResult {
	readonly applications: IPromotionApplication[];
	readonly notices: IPromotionNotice[];
	readonly discountTotal: DecimalString;
	readonly currency: string;
}

/**
 * A campaign: a window and a budget, nothing more. It holds no rules of its own.
 */
export interface ICampaign extends IBasePerTenantAndOrganizationEntityModel {
	identifier: string;
	name: string;
	description?: string;
	status: CampaignStatus;
	startsAt?: Date;
	endsAt?: Date;
	metadata?: Record<string, unknown>;
	budget?: ICampaignBudget;
	promotions?: IPromotion[];
}

/**
 * The ceiling of one campaign, in money or in redemptions.
 */
export interface ICampaignBudget extends IBasePerTenantAndOrganizationEntityModel {
	campaignId: ID;
	type: CampaignBudgetType;
	limit: DecimalString;
	used: DecimalString;
	attribute?: string;
	currency?: string;
	campaign?: ICampaign;
	usages?: ICampaignBudgetUsage[];
}

/**
 * Consumption of a budget for one value of its attribute.
 */
export interface ICampaignBudgetUsage extends IBasePerTenantAndOrganizationEntityModel {
	budgetId: ID;
	attributeValue: string;
	used: DecimalString;
	budget?: ICampaignBudget;
}

/**
 * A promotion. Its conditions are `rule` rows with owner type `PROMOTION`; its effect is the action
 * set; the money it moves is recorded in the core adjustment ledger.
 */
export interface IPromotion extends IBasePerTenantAndOrganizationEntityModel {
	code?: string;
	title: string;
	description?: string;
	type: PromotionType;
	status: PromotionStatus;
	isAutomatic: boolean;
	isCombinable: boolean;
	stackingGroup?: string;
	priority: number;
	campaignId?: ID;
	channelId?: ID;
	currency?: string;
	customerGroupId?: ID;
	startsAt?: Date;
	endsAt?: Date;
	usageLimit?: number;
	usageCount: number;
	perCustomerUsageLimit?: number;
	budgetAmount?: DecimalString;
	budgetSpent: DecimalString;
	isTaxInclusive: boolean;
	metadata?: Record<string, unknown>;
	campaign?: ICampaign;
	actions?: IPromotionAction[];
	coupons?: ICoupon[];
	usages?: IPromotionUsage[];
}

/**
 * What a promotion does when it matches.
 */
export interface IPromotionAction extends IBasePerTenantAndOrganizationEntityModel {
	promotionId: ID;
	type: PromotionActionType;
	targetType: PromotionActionTargetType;
	allocation: PromotionActionAllocation;
	value: DecimalString;
	currency?: string;
	maxQuantity?: DecimalString;
	applyToQuantity?: DecimalString;
	buyRulesMinQuantity?: DecimalString;
	isTaxInclusive: boolean;
	position: number;
	metadata?: Record<string, unknown>;
	promotion?: IPromotion;
}

/**
 * A redeemable code belonging to a promotion.
 */
export interface ICoupon extends IBasePerTenantAndOrganizationEntityModel {
	code: string;
	promotionId?: ID;
	batchId?: string;
	usageLimit?: number;
	usageCount: number;
	perCustomerLimit?: number;
	startsAt?: Date;
	endsAt?: Date;
	metadata?: Record<string, unknown>;
	promotion?: IPromotion;
	usages?: IPromotionUsage[];
}

/**
 * One application of a promotion: the row the limits and the budget are checked against.
 */
export interface IPromotionUsage extends IBasePerTenantAndOrganizationEntityModel {
	promotionId: ID;
	couponId?: ID;
	orderId?: ID;
	cartId?: ID;
	customerId?: ID;
	code?: string;
	amount: DecimalString;
	currency: string;
	usedAt: Date;
	status: PromotionUsageStatus;
	promotion?: IPromotion;
	coupon?: ICoupon;
}

/**
 * A stored-value instrument. `balance` is a materialised cache of the ledger, never the authority.
 */
export interface IGiftCard extends IBasePerTenantAndOrganizationEntityModel {
	code: string;
	initialAmount: DecimalString;
	balance: DecimalString;
	currency: string;
	status: GiftCardStatus;
	customerId?: ID;
	orderId?: ID;
	expiresAt?: Date;
	pin?: string;
	metadata?: Record<string, unknown>;
	transactions?: IGiftCardTransaction[];
}

/**
 * One movement on a gift card. Append-only.
 */
export interface IGiftCardTransaction extends IBasePerTenantAndOrganizationEntityModel {
	giftCardId: ID;
	orderId?: ID;
	amount: DecimalString;
	balanceAfter: DecimalString;
	type: GiftCardTransactionType;
	note?: string;
	occurredAt: Date;
	giftCard?: IGiftCard;
}

/**
 * Paginated campaigns.
 */
export type ICampaignPagination = IPagination<ICampaign>;

/**
 * Paginated promotions.
 */
export type IPromotionPagination = IPagination<IPromotion>;

/**
 * Paginated coupons.
 */
export type ICouponPagination = IPagination<ICoupon>;

/**
 * Paginated gift cards.
 */
export type IGiftCardPagination = IPagination<IGiftCard>;

/**
 * The code format a batch of coupons is generated in.
 */
export interface ICouponCodeFormat {
	/** Regular expression every generated code matches. */
	readonly pattern?: string;
	/** Alphabet the significant characters are drawn from. */
	readonly alphabet?: string;
	/** Number of significant characters. */
	readonly significantLength?: number;
	/** Characters per group. */
	readonly groupSize?: number;
	/** Separator between groups. */
	readonly separator?: string;
	/** Optional fixed prefix. */
	readonly prefix?: string | null;
	/** Optional fixed suffix. */
	readonly suffix?: string | null;
}

/**
 * The outcome of a coupon batch request.
 */
export interface ICouponBatchResult {
	readonly batchId: string;
	readonly requested: number;
	readonly created: number;
	readonly failed: number;
}
