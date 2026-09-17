import { CurrencyCode, DecimalString, IBasePerTenantAndOrganizationEntityModel, ID } from '@gauzy/contracts';

/**
 * Subscriptions: a plan, the agreement it produces, the lines each cycle bills and the record of
 * every cycle that was billed.
 *
 * The domain answers one question — "sell the same thing again, on a schedule" — and it answers it
 * by delegating everything it does not own. A cycle does not take money: it hands a set of recurring
 * lines to the order capability, which prices, taxes, reserves and charges them exactly as it
 * charges any other order. This package owns the calendar, the amount, the attempt history and the
 * lifecycle, and nothing else.
 */

/*
|--------------------------------------------------------------------------
| Enums
|--------------------------------------------------------------------------
*/

/**
 * How often a plan bills.
 *
 * `billingInterval` multiplies the period, so `MONTHLY` × 3 and `QUARTERLY` describe the same
 * cadence and the first is simply the more explicit way of writing it.
 */
export enum SubscriptionBillingPeriod {
	/** Bill every day, or every `billingInterval` days. */
	DAILY = 'DAILY',
	/** Bill every week, or every `billingInterval` weeks. */
	WEEKLY = 'WEEKLY',
	/** Bill every month, or every `billingInterval` months. */
	MONTHLY = 'MONTHLY',
	/** Bill every three months, or every `billingInterval` quarters. */
	QUARTERLY = 'QUARTERLY',
	/** Bill every year, or every `billingInterval` years. */
	YEARLY = 'YEARLY'
}

/**
 * Where a subscription stands.
 *
 * `PENDING`, `ACTIVE`, `PAUSED` and `FAILED` are live states that the billing run distinguishes
 * between; `CANCELED` and `EXPIRED` are terminal, and they are separate because one of them was a
 * decision and the other a consequence.
 */
export enum SubscriptionStatus {
	/** Created; the first cycle has not been billed yet or the subscription is inside its trial. */
	PENDING = 'PENDING',
	/** Billing. `nextBillingAt` is set and the due scan picks it up. */
	ACTIVE = 'ACTIVE',
	/** Suspended until `pausedUntil`; the billing scan skips it and the period is not consumed. */
	PAUSED = 'PAUSED',
	/** Cancelled by the customer or an operator. Terminal; the history is retained. */
	CANCELED = 'CANCELED',
	/** The plan's cycle ceiling was reached. Terminal, and nobody decided to stop. */
	EXPIRED = 'EXPIRED',
	/** A cycle's payment failed and the retry policy is exhausted. Billed again only on an operator's word. */
	FAILED = 'FAILED'
}

/**
 * Where one billing cycle stands.
 *
 * `WAIVED` is deliberately distinct from `PAID`: a goodwill period and a paid period both produce no
 * money, and reporting that treats them alike overstates revenue.
 */
export enum SubscriptionBillingStatus {
	/** The cycle is due or in progress; no order yet. */
	PENDING = 'PENDING',
	/** The cycle produced an order. */
	INVOICED = 'INVOICED',
	/** The cycle's payment settled. */
	PAID = 'PAID',
	/** The cycle's payment failed and is either retrying or exhausted. */
	FAILED = 'FAILED',
	/** The cycle was refunded after it was paid. */
	REFUNDED = 'REFUNDED',
	/** The cycle was deliberately not charged. */
	WAIVED = 'WAIVED'
}

/** Which side of the recurring order a proration produced. */
export enum SubscriptionProrationKind {
	/** Money the tenant owes for the remainder of the period. */
	CHARGE = 'CHARGE',
	/** Unused value of the period that is credited against the next one. */
	CREDIT = 'CREDIT'
}

/*
|--------------------------------------------------------------------------
| Cross-domain ports
|--------------------------------------------------------------------------
*/

/**
 * The catalogue as this domain sees it.
 *
 * A plan names a product or a variant, and the catalogue is what says whether that variant may be
 * sold on a recurring basis. Reading it here rather than caching a copy is what keeps a
 * subscription from being created against a variant the catalogue has since withdrawn.
 */
export interface ISubscriptionCatalogPort {
	/**
	 * @param variantId The variant the plan delivers.
	 * @returns True when the variant is marked as sellable on a recurring basis.
	 */
	isVariantSubscribable(variantId: ID): Promise<boolean>;

	/**
	 * @param productId A product a plan is attached to.
	 * @returns The variant a product-level plan bills, or null when the product has none.
	 */
	defaultVariantOf(productId: ID): Promise<ID | null>;
}

/** One request for the recurring unit price of a variant. */
export interface IRecurringPriceRequest {
	/** Variant being priced. */
	readonly variantId: ID;
	/** Customer the price is resolved for, when a customer-specific price list exists. */
	readonly customerId?: ID;
	/** Currency the price must be expressed in. */
	readonly currency: CurrencyCode;
	/** How much the previous period billed, so a caller can see whether the resolved price moved. */
	readonly previousAmount?: DecimalString;
}

/** What the pricing capability answers with. */
export interface IRecurringPriceResult {
	/** Unit price for one period, exact. */
	readonly unitPrice: DecimalString;
	/** Currency of the price. */
	readonly currency: CurrencyCode;
	/** Price list the price came from, when one matched. */
	readonly priceListId?: ID;
}

/**
 * Pricing as this domain sees it.
 *
 * The recurring unit price is resolved through the ordinary price pipeline, so a customer price
 * list, a contact-group price list and a channel override all apply to a renewal exactly as they
 * apply to a first purchase. This domain never reads a price column of another table.
 */
export interface ISubscriptionPricingPort {
	/**
	 * @param request What to price, for whom and in which currency.
	 * @returns The resolved recurring unit price.
	 */
	resolveRecurringPrice(request: IRecurringPriceRequest): Promise<IRecurringPriceResult>;
}

/** One recurring line, as the order capability receives it. */
export interface ISubscriptionOrderLine {
	/** Variant the cycle delivers. */
	readonly variantId: ID;
	/** How many of it. */
	readonly quantity: DecimalString;
	/** Recurring unit price, snapshotted on the subscription item. */
	readonly unitPrice: DecimalString;
}

/** One request to raise the order a billing cycle represents. */
export interface ISubscriptionOrderRequest {
	/** Subscription the cycle belongs to. */
	readonly subscriptionId: ID;
	/** Billing row the order settles. */
	readonly billingId: ID;
	/** Customer the order is placed for. */
	readonly customerId: ID;
	/** Order that started the subscription, when there was one. */
	readonly originOrderId?: ID;
	/** Currency of every amount in the request. */
	readonly currency: CurrencyCode;
	/** Period the cycle covers. */
	readonly periodStart: Date;
	readonly periodEnd: Date;
	/** Whether this is the first cycle or a renewal. */
	readonly firstCycle: boolean;
	/** The recurring lines. */
	readonly lines: ISubscriptionOrderLine[];
	/** Recurring amount after the plan discount, exact. */
	readonly amount: DecimalString;
	/** One-off setup fee charged with this cycle, when it is the first paid one. */
	readonly setupFee?: DecimalString;
	/** Exact amount of the plan discount granted on this cycle, when one was. */
	readonly discountAmount?: DecimalString;
	/**
	 * Deferred credit from an earlier proration, when one is owed. Negative, and applied to the
	 * amount before payment is attempted.
	 */
	readonly creditAmount?: DecimalString;
	/** Account at the provider the renewal is charged against, when one is remembered. */
	readonly paymentAccountHolderId?: ID;
	/** Instrument the renewal is charged against, when one is remembered. */
	readonly paymentMethodTokenId?: ID;
	/**
	 * Stable key the order capability applies its own retry safety under, derived from the
	 * subscription and the period start so a second attempt at one cycle can never place a second
	 * order.
	 */
	readonly idempotencyKey: string;
	/** Free-text note carried onto the order. */
	readonly note?: string;
}

/** One request to charge the difference a mid-cycle plan or quantity change produced. */
export interface ISubscriptionProrationOrderRequest {
	/** Subscription the change was made on. */
	readonly subscriptionId: ID;
	/** Customer the proration is charged to. */
	readonly customerId: ID;
	/** Currency of the amount. */
	readonly currency: CurrencyCode;
	/** What is owed for the remainder of the current period, positive and exact. */
	readonly amount: DecimalString;
	/** What the change was, in the caller's words. */
	readonly description: string;
	/** Account at the provider the proration is charged against, when one is remembered. */
	readonly paymentAccountHolderId?: ID;
	/** Instrument the proration is charged against, when one is remembered. */
	readonly paymentMethodTokenId?: ID;
	/** Stable key, so a retried change cannot be charged twice. */
	readonly idempotencyKey: string;
}

/** What the order capability answers with once the cycle's order exists. */
export interface ISubscriptionOrderResult {
	/** The order the cycle produced. */
	readonly orderId: ID;
	/** Grand total of that order, exact. */
	readonly grandTotal?: DecimalString;
	/** Currency of the total. */
	readonly currency?: CurrencyCode;
	/** True when the order's payment settled within the same call. */
	readonly paid: boolean;
	/** When the payment settled, when it did. */
	readonly paidAt?: Date;
	/** Why the charge failed, when it did. */
	readonly failureReason?: string;
}

/**
 * The order path as this domain sees it.
 *
 * A renewal is an ordinary order: it is priced, taxed, reserved, approved and charged by the same
 * path a first purchase takes. This domain states the lines and the payer and receives the order
 * back; it writes no order row, no payment row and no stock row of its own. The port is optional,
 * and a cycle with no order capability registered fails loudly rather than marking itself paid.
 */
export interface ISubscriptionOrderGatewayPort {
	/**
	 * @param request The cycle's lines, amount and payer.
	 * @returns The order the cycle produced and whether it settled.
	 */
	raiseSubscriptionOrder(request: ISubscriptionOrderRequest): Promise<ISubscriptionOrderResult>;

	/**
	 * Charges the difference a mid-cycle change produced.
	 *
	 * A proration is an order like any other: it is priced, taxed and charged by the ordinary path,
	 * which is why this domain states the amount and receives an order back rather than writing a
	 * payment of its own.
	 *
	 * @param request What is owed and who pays it.
	 * @returns The order the proration produced and whether it settled.
	 */
	raiseProrationOrder(request: ISubscriptionProrationOrderRequest): Promise<ISubscriptionOrderResult>;
}

/** One request for the instrument a renewal may charge. */
export interface IChargeableInstrumentRequest {
	/** Account at the provider the subscription remembered, when one is remembered. */
	readonly accountHolderId?: ID;
	/** Instrument the subscription remembered, when one is remembered. */
	readonly paymentMethodTokenId?: ID;
	/** Currency the charge is in. */
	readonly currency: CurrencyCode;
}

/**
 * What the payment capability answers with about the remembered payer.
 *
 * The answer carries identifiers and a verdict, never a credential: a token value is not part of
 * this contract and never crosses it.
 */
export interface IChargeableInstrumentResult {
	/** Account the charge will be made against, when one is known. */
	readonly accountHolderId?: ID;
	/** Instrument the charge will be made against, when one is known. */
	readonly paymentMethodTokenId?: ID;
	/** Whether the instrument may be charged, and if not, the platform code that says why. */
	readonly chargeable: boolean;
	/** Platform code explaining a refusal, for example a restricted account or a revoked instrument. */
	readonly reasonCode?: string;
	/** Free-text explanation kept beside the refusal. */
	readonly reason?: string;
}

/**
 * The stored instruments as this domain sees them.
 *
 * A renewal happens with nobody present, so it charges a payer the customer authorised earlier. The
 * payment capability owns which instruments exist, which are chargeable and which mandate backs a
 * direct debit; this domain only asks its question and records the answer on the attempt.
 */
export interface ISubscriptionInstrumentPort {
	/**
	 * @param request Which payer, and in which currency.
	 * @returns Whether the remembered payer may be charged, and which instrument resolves.
	 */
	resolveChargeableInstrument(request: IChargeableInstrumentRequest): Promise<IChargeableInstrumentResult>;
}

/*
|--------------------------------------------------------------------------
| Injection tokens
|--------------------------------------------------------------------------
*/

/**
 * Token the catalogue is injected under.
 *
 * Optional on purpose: a tenant that sells plans attached to nothing — a pure service entitlement —
 * can run the whole lifecycle with no catalogue registered, while a tenant that sells a variant gets
 * the catalogue's verdict before a subscription is created.
 */
export const SUBSCRIPTION_CATALOG = Symbol('SUBSCRIPTION_CATALOG');

/** Token the recurring price is resolved through. */
export const SUBSCRIPTION_PRICING = Symbol('SUBSCRIPTION_PRICING');

/** Token the ordinary order path is reached through. */
export const SUBSCRIPTION_ORDER_GATEWAY = Symbol('SUBSCRIPTION_ORDER_GATEWAY');

/** Token the stored payer is resolved through. */
export const SUBSCRIPTION_INSTRUMENTS = Symbol('SUBSCRIPTION_INSTRUMENTS');

/*
|--------------------------------------------------------------------------
| Contracts
|--------------------------------------------------------------------------
*/

/** What can be subscribed to, and on what terms. */
export interface ISubscriptionPlan extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	code: string;
	description?: string;
	productId?: ID;
	variantId?: ID;
	billingPeriod: SubscriptionBillingPeriod;
	billingInterval: number;
	maxBillingCycles?: number;
	trialDays?: number;
	setupFee?: DecimalString;
	discountPercentage?: DecimalString;
	currency: CurrencyCode;
	isActive?: boolean;
	metadata?: Record<string, unknown>;
}

/** One running agreement with a customer. */
export interface ISubscription extends IBasePerTenantAndOrganizationEntityModel {
	planId: ID;
	customerId: ID;
	originOrderId?: ID;
	paymentAccountHolderId?: ID;
	paymentMethodTokenId?: ID;
	status: SubscriptionStatus;
	quantity: DecimalString;
	currentPeriodStart?: Date;
	currentPeriodEnd?: Date;
	nextBillingAt?: Date;
	billingCycleCount: number;
	pausedUntil?: Date;
	canceledAt?: Date;
	cancelReason?: string;
	currency: CurrencyCode;
	metadata?: Record<string, unknown>;
	items?: ISubscriptionItem[];
	billings?: ISubscriptionBilling[];
}

/** One recurring line of a subscription. */
export interface ISubscriptionItem extends IBasePerTenantAndOrganizationEntityModel {
	subscriptionId: ID;
	variantId: ID;
	quantity: DecimalString;
	unitPrice: DecimalString;
	position: number;
	metadata?: Record<string, unknown>;
}

/** One billing cycle's attempt and result. */
export interface ISubscriptionBilling extends IBasePerTenantAndOrganizationEntityModel {
	subscriptionId: ID;
	orderId?: ID;
	periodStart: Date;
	periodEnd: Date;
	amount: DecimalString;
	currency: CurrencyCode;
	status: SubscriptionBillingStatus;
	dueAt?: Date;
	paidAt?: Date;
	attemptCount: number;
	lastError?: string;
	nextRetryAt?: Date;
	metadata?: Record<string, unknown>;
}

/*
|--------------------------------------------------------------------------
| Service inputs
|--------------------------------------------------------------------------
*/

/** One recurring line as a caller supplies it. */
export interface ISubscriptionItemInput {
	variantId: ID;
	quantity?: DecimalString | number;
	unitPrice?: DecimalString | number;
	position?: number;
	metadata?: Record<string, unknown>;
}

/** A request to put a customer on a plan. */
export interface ICreateSubscriptionInput {
	planId: ID;
	customerId: ID;
	originOrderId?: ID;
	quantity?: DecimalString | number;
	currency?: CurrencyCode;
	items?: ISubscriptionItemInput[];
	paymentAccountHolderId?: ID;
	paymentMethodTokenId?: ID;
	/** When true the subscription bills its first period immediately instead of waiting to be activated. */
	activate?: boolean;
	/** Skips the first paid period and leaves the subscription inside its trial. */
	startTrial?: boolean;
	/** Overrides the plan's discount for this subscription only, as a fraction. */
	discountPercentage?: DecimalString | number;
	metadata?: Record<string, unknown>;
}

/** A request to move a subscription to another plan. */
export interface IChangeSubscriptionPlanInput {
	planId: ID;
	quantity?: DecimalString | number;
	/** `IMMEDIATE` settles the difference now; `NEXT_PERIOD` applies the new price from the next cycle. */
	effective?: 'IMMEDIATE' | 'NEXT_PERIOD';
	note?: string;
}

/** What a plan change decided. */
export interface ISubscriptionPlanChangeOutcome {
	subscription: ISubscription;
	/** What the old plan's unused time was worth. */
	credit: DecimalString;
	/** What the new plan costs for the same remaining time. */
	charge: DecimalString;
	/** `charge - credit`. Positive is owed by the customer. */
	net: DecimalString;
	/** Whether money moved now, was deferred to the next cycle, or was waived. */
	settlement: 'CHARGED' | 'DEFERRED' | 'WAIVED' | 'SCHEDULED';
	/** The currency every amount above is expressed in. */
	currency: CurrencyCode;
}

/** What one billing cycle did. */
export interface ISubscriptionBillingOutcome {
	subscriptionId: ID;
	billingId?: ID;
	status: SubscriptionBillingStatus;
	/** True when the cycle was already billed and nothing was charged a second time. */
	replayed: boolean;
	orderId?: ID;
	amount?: DecimalString;
	currency?: CurrencyCode;
	periodStart?: Date;
	periodEnd?: Date;
	/** Next instant a retry is due, when the cycle failed. */
	nextRetryAt?: Date;
	/** Platform code explaining a failure. */
	errorCode?: string;
	message?: string;
}

/** What one pass of the billing run did. */
export interface ISubscriptionBillingRunOutcome {
	/** How many subscriptions the pass examined. */
	examined: number;
	/** How many cycles were billed and settled. */
	billed: number;
	/** How many cycles failed and entered dunning. */
	failed: number;
	/** How many subscriptions were skipped because another pass held their period. */
	skipped: number;
	/** Per-subscription results, in the order they were processed. */
	results: ISubscriptionBillingOutcome[];
}
