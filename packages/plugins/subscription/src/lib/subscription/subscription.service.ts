import { BadRequestException, Injectable, Inject, NotFoundException, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DeepPartial } from 'typeorm';
import {
	AdjustmentOwnerType,
	AdjustmentType,
	CurrencyCode,
	DecimalString,
	ID,
	IdempotencyOutcome
} from '@gauzy/contracts';
import {
	AdjustmentService,
	EventOutboxService,
	IVersionExpectation,
	IdempotencyService,
	Money,
	RequestContext,
	TenantAwareCrudService,
	commitVersionedUpdate
} from '@gauzy/core';
import {
	IChangeSubscriptionPlanInput,
	ICreateSubscriptionInput,
	ISubscriptionInstrumentPort,
	ISubscriptionItemInput,
	ISubscriptionOrderGatewayPort,
	ISubscriptionPlanChangeOutcome,
	ISubscriptionBillingOutcome,
	ISubscriptionBillingRunOutcome,
	SUBSCRIPTION_INSTRUMENTS,
	SUBSCRIPTION_ORDER_GATEWAY,
	SubscriptionBillingStatus,
	SubscriptionStatus
} from '../subscription.types';
import {
	DEFAULT_MINIMUM_PRORATION_CHARGE,
	ISubscriptionCadence,
	ISubscriptionPeriod,
	addDays,
	applyRecurringDiscount,
	isDunningExhausted,
	nextRetryAt,
	normalizeDecimal,
	periodFrom,
	prorate,
	recurringAmount
} from '../subscription.cycle';
import { SubscriptionPlan } from '../subscription-plan/subscription-plan.entity';
import { SubscriptionPlanService } from '../subscription-plan/subscription-plan.service';
import { currentScope } from '../subscription.scope';
import { SubscriptionItem } from '../subscription-item/subscription-item.entity';
import { SubscriptionItemService } from '../subscription-item/subscription-item.service';
import { SubscriptionBilling } from '../subscription-billing/subscription-billing.entity';
import { SubscriptionBillingService } from '../subscription-billing/subscription-billing.service';
import { Subscription } from './subscription.entity';
import { MikroOrmSubscriptionRepository } from './repository/mikro-orm-subscription.repository';
import { TypeOrmSubscriptionRepository } from './repository/type-orm-subscription.repository';

/**
 * The version a write that no caller conditioned on is predicated on.
 *
 * A write that arrives from a route is predicated on what its caller accepted in `If-Match`. A write
 * that arrives from anywhere else — a scheduled billing pass, another service, a replayed event — has
 * no caller to condition it, so it is predicated on the version the row holds when the statement runs.
 * Either way the check and the increment are one statement rather than two.
 */
const ANY_VERSION: IVersionExpectation = { wildcard: true, versions: [] };

/**
 * The version each write of one request is predicated on, handed out one write at a time.
 *
 * The caller's version is spent by the first write the request makes, because that write is the one
 * the caller's precondition was about. Every write after it belongs to the request's own follow-up —
 * the cycle row's metadata, the calendar it advances — and is predicated on the version the row holds
 * when its statement runs; predicating a follow-up on the caller's version would report the request's
 * own increment as a race it lost.
 *
 * The reader is handed to the writes rather than to the calls that contain them, so a branch that
 * writes nothing does not spend the caller's version on behalf of the branch that does.
 *
 * @param expectation What the caller accepted, or the wildcard a caller-less write is predicated on.
 * @returns A reader that answers the caller's version once and the wildcard thereafter.
 */
function spendableExpectation(expectation: IVersionExpectation): () => IVersionExpectation {
	let pending = expectation;

	return () => {
		const current = pending;

		pending = ANY_VERSION;

		return current;
	};
}

/** The key a billing cycle's idempotency claim is scoped under. */
const BILLING_SCOPE = 'subscription.bill';

/** The key a proration charge's idempotency claim is scoped under. */
const PRORATION_SCOPE = 'subscription.proration';

/** Cycle statuses that mean the period has been settled and must never be charged again. */
const SETTLED_CYCLE_STATUSES: SubscriptionBillingStatus[] = [
	SubscriptionBillingStatus.PAID,
	SubscriptionBillingStatus.INVOICED,
	SubscriptionBillingStatus.WAIVED,
	SubscriptionBillingStatus.REFUNDED
];

/** The metadata key that records the plans whose setup fee was already charged. */
const CHARGED_SETUP_FEES = 'chargedSetupFeePlanIds';

/** The metadata key that carries a proration credit into the next cycle. */
const PENDING_CREDIT = 'pendingCredit';

/**
 * The codes that mean the instrument a subscription points at can no longer be charged.
 *
 * A revocation and an expiry are terminal states of a row, and a miss is a row that is not there at
 * all; whichever one a cycle meets, the action the platform takes is the same — the customer supplies
 * another instrument — and that action is keyed on this domain's own code. The orders specification
 * states it for exactly this case ("the instrument becomes unusable while a subscription points at
 * it": the attempt fails with `SUBSCRIPTION_PAYMENT_METHOD_MISSING`, the code that enters dunning and
 * triggers the "update your payment method" notification).
 *
 * Every other answer the capability gives names a different condition with a different next step — a
 * restricted account, an ambiguous default instrument, a currency the account does not settle in — so
 * it is reported verbatim rather than flattened into the one code, and so is a code this domain does
 * not know.
 */
const UNUSABLE_INSTRUMENT_CODES: ReadonlyArray<string> = [
	'PAYMENT_METHOD_TOKEN_REVOKED',
	'PAYMENT_METHOD_TOKEN_EXPIRED',
	'PAYMENT_METHOD_TOKEN_NOT_FOUND'
];

/**
 * The subscription lifecycle and the recurring billing run.
 *
 * Four rules make this service what it is, and each of them exists because the alternative is a
 * customer charged for something nobody decided.
 *
 * 1. **A cycle is a row before it is an attempt.** The billing row is opened in `PENDING` before any
 *    work starts, so a crash mid-cycle leaves the period owed rather than skipped.
 * 2. **A cycle is charged at most once.** The period's unique `(subscriptionId, periodStart)` key and
 *    the platform idempotency store both refuse the second attempt, and a settled cycle is replayed
 *    from its own row rather than recomputed.
 * 3. **A renewal goes through the ordinary order path.** This domain states the recurring lines and
 *    the payer and receives an order back; it writes no order, payment or stock row itself, so
 *    invoicing, tax, reservation, approval rules and the off-session charge are the platform's, not a
 *    second implementation of them.
 * 4. **A failure is a state, not an exception.** A declined charge records the attempt and the next
 *    retry instant on the cycle's own row and moves the subscription into dunning. Nothing is
 *    retried blind, and nothing that failed is ever marked paid.
 */
@Injectable()
export class SubscriptionService extends TenantAwareCrudService<Subscription> {
	constructor(
		readonly typeOrmSubscriptionRepository: TypeOrmSubscriptionRepository,
		readonly mikroOrmSubscriptionRepository: MikroOrmSubscriptionRepository,
		private readonly planService: SubscriptionPlanService,
		private readonly itemService: SubscriptionItemService,
		private readonly billingService: SubscriptionBillingService,
		private readonly idempotencyService: IdempotencyService,
		private readonly adjustmentService: AdjustmentService,
		private readonly outbox: EventOutboxService,
		@Optional()
		@Inject(SUBSCRIPTION_ORDER_GATEWAY)
		private readonly orderGateway?: ISubscriptionOrderGatewayPort,
		@Optional()
		@Inject(SUBSCRIPTION_INSTRUMENTS)
		private readonly instruments?: ISubscriptionInstrumentPort
	) {
		super(typeOrmSubscriptionRepository, mikroOrmSubscriptionRepository);
	}

	/**
	 * Writes the fields a caller changed onto a subscription, under the version that caller read.
	 *
	 * The write is predicated on the version the caller stated rather than on the one the row happens to
	 * hold, so a second editor's change to the same subscription is refused instead of applied over a
	 * value it never saw. The check and the increment are the statement's own: a stale version reaches
	 * `commitVersionedUpdate`'s affected-row count and is answered with the conflict it is, not with the
	 * "not found" a read-then-write would report for a row that exists and has merely moved on.
	 *
	 * @param id The subscription.
	 * @param changes The fields to change.
	 * @param expectation The version the caller read the subscription at.
	 * @returns The subscription as it stands after the write.
	 */
	public async applyChanges(
		id: ID,
		changes: DeepPartial<Subscription>,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<Subscription> {
		await commitVersionedUpdate<Subscription>(this, {
			id,
			expectation,
			// The version is written by the conditional update and never by the caller's payload, so a body
			// that named one cannot move the row past the version the write was predicated on.
			patch: { ...(changes as Record<string, unknown>) } as Record<string, unknown> & Partial<Subscription>
		});

		return await this.findOneDetailed(id);
	}

	/*
	|--------------------------------------------------------------------------
	| Creation
	|--------------------------------------------------------------------------
	*/

	/**
	 * Puts a customer on a plan.
	 *
	 * The whole creation — the agreement, its recurring lines, the first cycle's row and the
	 * `subscription.created` event — commits together, so a subscription can never exist without the
	 * lines it bills or the event that announces it. When the caller names the order that produced
	 * the subscription, creation is idempotent on it: a retried checkout finds the subscription it
	 * already made instead of making a second one.
	 *
	 * @param input The plan, the customer, the lines and the payer.
	 * @returns The created subscription, with its lines.
	 * @throws BadRequestException when the plan is not sellable, the lines cannot be priced, or the
	 * stated currency and the plan's disagree.
	 */
	public async createSubscription(input: ICreateSubscriptionInput): Promise<Subscription> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		if (!input?.planId) {
			throw new BadRequestException('A subscription must name the plan it is on.');
		}

		if (!input?.customerId) {
			throw new BadRequestException('A subscription must name the customer it belongs to.');
		}

		if (input.originOrderId) {
			const existing = await this.typeOrmSubscriptionRepository.findOne({
				where: { originOrderId: input.originOrderId, ...currentScope() }
			});

			if (existing) {
				return await this.findOneDetailed(existing.id);
			}
		}

		const plan = await this.planService.assertSubscribeable(input.planId);
		const cadence = this.planService.cadenceOf(plan);
		const currency = input.currency ?? plan.currency;

		if (input.currency && plan.currency && input.currency !== plan.currency) {
			throw new BadRequestException(
				`SUBSCRIPTION_CURRENCY_MISMATCH: the plan is priced in ${plan.currency} and the request states ${input.currency}.`
			);
		}

		const variantId = await this.planService.resolveVariantId(plan);
		const prepared = await this.itemService.prepareItems(input.items ?? [], currency, input.customerId, variantId);
		const now = new Date();
		const trialDays = input.startTrial ? Math.max(0, Math.trunc(Number(plan.trialDays ?? 0))) : 0;
		const period = trialDays > 0 ? { start: now, end: addDays(now, trialDays) } : periodFrom(now, cadence);
		const status = input.activate && trialDays === 0 ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PENDING;

		const metadata: Record<string, unknown> = {
			...(input.metadata ?? {}),
			...(trialDays > 0 ? { trialEndsAt: period.end.toISOString() } : {}),
			...(input.discountPercentage !== undefined ? { discountPercentage: String(input.discountPercentage) } : {})
		};

		const created = await this.typeOrmSubscriptionRepository.manager.transaction(async (manager) => {
			const subscription = await manager.save(
				Subscription,
				manager.create(Subscription, {
					planId: plan.id,
					customerId: input.customerId,
					originOrderId: input.originOrderId,
					paymentAccountHolderId: input.paymentAccountHolderId,
					paymentMethodTokenId: input.paymentMethodTokenId,
					status,
					quantity: normalizeDecimal(input.quantity, '1'),
					currentPeriodStart: period.start,
					currentPeriodEnd: period.end,
					nextBillingAt: period.end,
					billingCycleCount: 0,
					currency,
					// The row starts its optimistic lock at one, which is the value the column's own
					// `NOT NULL DEFAULT 1` gives it: stated here as well so the row carries its version
					// from the moment it exists, whichever ORM wrote it.
					version: 1,
					metadata,
					tenantId,
					organizationId
				} as Partial<Subscription>)
			);

			for (const line of prepared) {
				await manager.save(
					SubscriptionItem,
					manager.create(SubscriptionItem, {
						subscriptionId: subscription.id,
						variantId: line.variantId,
						quantity: line.quantity,
						unitPrice: line.unitPrice,
						position: line.position,
						metadata: line.metadata,
						tenantId,
						organizationId
					} as Partial<SubscriptionItem>)
				);
			}

			const gross = recurringAmount(prepared, currency);
			const { discount, net } = applyRecurringDiscount(gross, this.discountOf(plan, input.discountPercentage));
			// A trial owes nothing, so its cycle row is written waived **and for zero** (doc 11 §10.4
			// step 4: "the first billing amount is zero, the billing row is written with
			// `status = 'WAIVED'` and `amount = 0`"). What the period would have cost is kept in the
			// metadata rather than in the amount, because a waived row carrying the recurring amount is
			// indistinguishable from revenue to anything that reads the amount without reading the
			// status first.
			const amount = trialDays > 0 ? Money.zero(currency).round().toStorageString() : net.toStorageString();
			const billing = await manager.save(
				SubscriptionBilling,
				manager.create(SubscriptionBilling, {
					subscriptionId: subscription.id,
					periodStart: period.start,
					periodEnd: period.end,
					amount,
					currency,
					status: trialDays > 0 ? SubscriptionBillingStatus.WAIVED : SubscriptionBillingStatus.PENDING,
					dueAt: period.start,
					paidAt: null,
					attemptCount: 0,
					metadata: {
						gross: gross.toStorageString(),
						discount: discount.toStorageString(),
						...(trialDays > 0 ? { trial: true } : {})
					},
					tenantId,
					organizationId
				} as Partial<SubscriptionBilling>)
			);

			await this.outbox.append(manager, {
				name: 'subscription.created',
				aggregateType: 'SUBSCRIPTION',
				aggregateId: subscription.id as ID,
				data: {
					subscriptionId: subscription.id,
					planId: subscription.planId,
					customerId: subscription.customerId,
					originOrderId: subscription.originOrderId ?? null,
					status: subscription.status,
					billingId: billing.id
				},
				tenantId,
				organizationId
			});

			return subscription;
		});

		return await this.findOneDetailed(created.id);
	}

	/*
	|--------------------------------------------------------------------------
	| Lifecycle
	|--------------------------------------------------------------------------
	*/

	/**
	 * Starts billing a pending subscription.
	 *
	 * The period is computed from the instant it is activated — or from the trial's end, when the
	 * trial has not run out yet — rather than from creation, so a subscription that sat pending for a
	 * week does not inherit a week of period it was never billed for.
	 *
	 * @param id The subscription to activate.
	 * @param expectation The version the caller read the subscription at.
	 * @returns The activated subscription.
	 * @throws BadRequestException when it is not pending.
	 */
	public async activate(id: ID, expectation: IVersionExpectation = ANY_VERSION): Promise<Subscription> {
		const subscription = await this.findOneScoped(id);

		if (subscription.status === SubscriptionStatus.ACTIVE) {
			return subscription;
		}

		this.assertStatus(subscription, [SubscriptionStatus.PENDING], 'activate');

		const plan = await this.planService.findOneScoped(subscription.planId);
		const cadence = this.planService.cadenceOf(plan);
		const now = new Date();
		const trialEndsAt = this.trialEndOf(subscription);
		const start = trialEndsAt && trialEndsAt.getTime() > now.getTime() ? trialEndsAt : now;
		const period = periodFrom(start, cadence);

		await commitVersionedUpdate<Subscription>(this, {
			id,
			expectation,
			patch: {
				status: SubscriptionStatus.ACTIVE,
				currentPeriodStart: period.start,
				currentPeriodEnd: period.end,
				nextBillingAt: period.end
			}
		});

		await this.emit('subscription.activated', id, {
			subscriptionId: id,
			planId: subscription.planId,
			currentPeriodStart: period.start,
			currentPeriodEnd: period.end
		});

		return await this.findOneScoped(id);
	}

	/**
	 * Suspends billing.
	 *
	 * `pausedUntil` is the resume instant, and leaving it unset means the pause is indefinite. Either
	 * way the period is not consumed: the billing run skips a paused subscription, and resuming
	 * recomputes the next billing instant from the resume rather than back-dating it.
	 *
	 * @param id The subscription to pause.
	 * @param options Until when, and why.
	 * @param expectation The version the caller read the subscription at.
	 * @returns The paused subscription.
	 * @throws BadRequestException when it is not active.
	 */
	public async pause(
		id: ID,
		options: { until?: Date; reason?: string } = {},
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<Subscription> {
		const subscription = await this.findOneScoped(id);

		this.assertStatus(subscription, [SubscriptionStatus.ACTIVE], 'pause');

		await commitVersionedUpdate<Subscription>(this, {
			id,
			expectation,
			patch: {
				status: SubscriptionStatus.PAUSED,
				pausedUntil: options.until ?? null
			}
		});

		await this.emit('subscription.paused', id, {
			subscriptionId: id,
			pausedUntil: options.until ?? null,
			reason: options.reason ?? null,
			pausedBy: RequestContext.currentUserId()
		});

		return await this.findOneScoped(id);
	}

	/**
	 * Resumes a paused subscription.
	 *
	 * The next billing instant is the later of now and the end of the period the customer already
	 * paid for, so a pause never refunds time and never charges twice for it.
	 *
	 * @param id The subscription to resume.
	 * @param at The instant to resume at; defaults to now, and is used by the billing run when a
	 * scheduled pause ends.
	 * @param expectation The version the caller read the subscription at.
	 * @returns The resumed subscription.
	 * @throws BadRequestException when it is not paused.
	 */
	public async resume(id: ID, at?: Date, expectation: IVersionExpectation = ANY_VERSION): Promise<Subscription> {
		const subscription = await this.findOneScoped(id);

		this.assertStatus(subscription, [SubscriptionStatus.PAUSED], 'resume');

		const now = at ?? new Date();
		const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : now;
		const nextBillingAt = periodEnd.getTime() > now.getTime() ? periodEnd : now;

		await commitVersionedUpdate<Subscription>(this, {
			id,
			expectation,
			patch: {
				status: SubscriptionStatus.ACTIVE,
				pausedUntil: null,
				nextBillingAt
			}
		});

		await this.emit('subscription.resumed', id, {
			subscriptionId: id,
			resumedAt: now,
			nextBillingAt
		});

		return await this.findOneScoped(id);
	}

	/**
	 * Ends a subscription.
	 *
	 * Two cancellations, and the difference is which period the customer keeps. `immediate: false`
	 * lets the period already paid for run out and stops the next one; `immediate: true` stops
	 * billing now. Cancelling an expired or already cancelled subscription is a no-op that returns
	 * the row, because the outcome the caller wanted has already happened.
	 *
	 * @param id The subscription to cancel.
	 * @param options Why, and whether it ends now.
	 * @param expectation The version the caller read the subscription at.
	 * @returns The cancelled subscription.
	 */
	public async cancel(
		id: ID,
		options: { reason?: string; immediate?: boolean } = {},
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<Subscription> {
		const subscription = await this.findOneScoped(id);

		if ([SubscriptionStatus.CANCELED, SubscriptionStatus.EXPIRED].includes(subscription.status)) {
			return subscription;
		}

		const now = new Date();
		const deferred = !options.immediate && subscription.status === SubscriptionStatus.ACTIVE;

		await commitVersionedUpdate<Subscription>(this, {
			id,
			expectation,
			patch: {
				status: deferred ? SubscriptionStatus.ACTIVE : SubscriptionStatus.CANCELED,
				canceledAt: now,
				cancelReason: options.reason ?? subscription.cancelReason,
				nextBillingAt: deferred ? subscription.nextBillingAt : null,
				pausedUntil: deferred ? subscription.pausedUntil : null,
				metadata: {
					...(subscription.metadata ?? {}),
					...(deferred ? { cancelAtPeriodEnd: true } : {})
				}
			}
		});

		await this.emit('subscription.canceled', id, {
			subscriptionId: id,
			canceledAt: now,
			cancelReason: options.reason ?? null,
			immediate: !deferred,
			creditAmount: null
		});

		return await this.findOneScoped(id);
	}

	/**
	 * Ends a subscription because it ran out rather than because somebody stopped it.
	 *
	 * Reaching the plan's cycle ceiling is the case this exists for, which is why `EXPIRED` and
	 * `CANCELED` are separate states: one of them was a decision.
	 *
	 * @param id The subscription to expire.
	 * @param reason Why it expired.
	 * @param expectation The version the caller read the subscription at.
	 * @returns The expired subscription.
	 */
	public async expire(id: ID, reason?: string, expectation: IVersionExpectation = ANY_VERSION): Promise<Subscription> {
		const subscription = await this.findOneScoped(id);

		if (subscription.status === SubscriptionStatus.EXPIRED) {
			return subscription;
		}

		this.assertStatus(
			subscription,
			[SubscriptionStatus.PENDING, SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED, SubscriptionStatus.FAILED],
			'expire'
		);

		await commitVersionedUpdate<Subscription>(this, {
			id,
			expectation,
			patch: {
				status: SubscriptionStatus.EXPIRED,
				nextBillingAt: null,
				pausedUntil: null
			}
		});

		await this.emit('subscription.expired', id, {
			subscriptionId: id,
			expiredAt: new Date(),
			reason: reason ?? null
		});

		return await this.findOneScoped(id);
	}

	/*
	|--------------------------------------------------------------------------
	| Plan and line changes, with proration
	|--------------------------------------------------------------------------
	*/

	/**
	 * Moves a subscription to another plan, settling the remainder of the current period.
	 *
	 * The arithmetic is stated once, in the cycle module: the unused share of the period is worth what
	 * the old plan charged for it, and costs what the new plan charges for the same window. The
	 * difference settles one of four ways — charged now through the order path, deferred as a credit
	 * on the next cycle, waived because it is smaller than the cost of taking it, or scheduled to
	 * apply from the next period with no money moving at all.
	 *
	 * The period boundaries are never rewritten by a change, which is what keeps the billing calendar
	 * stable and the arithmetic reproducible from the persisted rows alone.
	 *
	 * @param id The subscription to change.
	 * @param input The plan to move to, the quantity and when the change takes effect.
	 * @param expectation The version the caller read the subscription at.
	 * @returns What the change decided and what it settled.
	 * @throws BadRequestException when the subscription is terminal, or when a charge is owed and the
	 * order capability is not registered.
	 */
	public async changePlan(
		id: ID,
		input: IChangeSubscriptionPlanInput,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<ISubscriptionPlanChangeOutcome> {
		const subscription = await this.findOneScoped(id);

		this.assertLive(subscription);

		const plan = await this.planService.assertSubscribeable(input.planId);
		const variantId = await this.planService.resolveVariantId(plan);
		const existing = await this.itemService.findForSubscription(id);
		const requested: ISubscriptionItemInput[] = variantId
			? [{ variantId, quantity: input.quantity ?? subscription.quantity }]
			: existing.map((row) => ({
					variantId: row.variantId,
					quantity: input.quantity ?? row.quantity,
					unitPrice: row.unitPrice,
					position: row.position
			  }));
		const prepared = await this.itemService.prepareItems(requested, subscription.currency, subscription.customerId);

		return await this.applyChange(
			subscription,
			{
				planId: plan.id,
				quantity: input.quantity,
				discountPercentage:
					plan.discountPercentage !== undefined && plan.discountPercentage !== null
						? String(plan.discountPercentage)
						: undefined,
				before: existing,
				after: prepared,
				effective: input.effective ?? 'IMMEDIATE',
				description: input.note ?? `Plan changed to ${plan.code}.`
			},
			expectation
		);
	}

	/**
	 * Adds a recurring line mid-cycle and settles the remainder of the period.
	 *
	 * @param id The subscription to add the line to.
	 * @param item The line as the caller stated it.
	 * @param expectation The version the caller read the subscription at.
	 * @returns What the change decided and what it settled.
	 */
	public async addItem(
		id: ID,
		item: ISubscriptionItemInput,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<ISubscriptionPlanChangeOutcome> {
		const subscription = await this.findOneScoped(id);

		this.assertLive(subscription);

		const before = await this.itemService.findForSubscription(id);
		const prepared = await this.itemService.prepareItems(
			[
				...before.map((row) => ({
					variantId: row.variantId,
					quantity: row.quantity,
					unitPrice: row.unitPrice,
					position: row.position
				})),
				item
			],
			subscription.currency,
			subscription.customerId
		);

		return await this.applyChange(
			subscription,
			{
				before,
				after: prepared,
				effective: 'IMMEDIATE',
				description: `Recurring line added for variant ${item.variantId}.`
			},
			expectation
		);
	}

	/**
	 * Changes the quantity of one recurring line mid-cycle and settles the remainder of the period.
	 *
	 * @param id The subscription whose line is changing.
	 * @param variantId The variant whose line is changing.
	 * @param quantity The new quantity, as an exact decimal.
	 * @param expectation The version the caller read the subscription at.
	 * @returns What the change decided and what it settled.
	 */
	public async changeItemQuantity(
		id: ID,
		variantId: ID,
		quantity: DecimalString | number,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<ISubscriptionPlanChangeOutcome> {
		const subscription = await this.findOneScoped(id);

		this.assertLive(subscription);

		const before = await this.itemService.findForSubscription(id);

		if (!before.some((row) => row.variantId === variantId)) {
			throw new NotFoundException(
				`SUBSCRIPTION_ITEM_NOT_FOUND: subscription ${id} has no recurring line for variant ${variantId}.`
			);
		}

		const prepared = await this.itemService.prepareItems(
			before.map((row) => ({
				variantId: row.variantId,
				quantity: row.variantId === variantId ? quantity : row.quantity,
				unitPrice: row.unitPrice,
				position: row.position
			})),
			subscription.currency,
			subscription.customerId
		);

		return await this.applyChange(
			subscription,
			{
				before,
				after: prepared,
				effective: 'IMMEDIATE',
				description: `Recurring quantity changed for variant ${variantId}.`
			},
			expectation
		);
	}

	/**
	 * Removes a recurring line mid-cycle and settles the remainder of the period.
	 *
	 * @param id The subscription whose line is being removed.
	 * @param variantId The variant whose line is being removed.
	 * @param expectation The version the caller read the subscription at.
	 * @returns What the change decided and what it settled.
	 */
	public async removeItem(
		id: ID,
		variantId: ID,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<ISubscriptionPlanChangeOutcome> {
		const subscription = await this.findOneScoped(id);

		this.assertLive(subscription);

		const before = await this.itemService.findForSubscription(id);

		if (!before.some((row) => row.variantId === variantId)) {
			throw new NotFoundException(
				`SUBSCRIPTION_ITEM_NOT_FOUND: subscription ${id} has no recurring line for variant ${variantId}.`
			);
		}

		if (before.length <= 1) {
			throw new BadRequestException(
				'SUBSCRIPTION_LAST_ITEM: a subscription must keep at least one recurring line; pause or cancel it instead of emptying it.'
			);
		}

		const prepared = await this.itemService.prepareItems(
			before
				.filter((row) => row.variantId !== variantId)
				.map((row) => ({
					variantId: row.variantId,
					quantity: row.quantity,
					unitPrice: row.unitPrice,
					position: row.position
				})),
			subscription.currency,
			subscription.customerId
		);

		return await this.applyChange(
			subscription,
			{
				before,
				after: prepared,
				effective: 'IMMEDIATE',
				description: `Recurring line removed for variant ${variantId}.`
			},
			expectation
		);
	}

	/*
	|--------------------------------------------------------------------------
	| Billing
	|--------------------------------------------------------------------------
	*/

	/**
	 * Bills one cycle for one subscription.
	 *
	 * The cycle is identified by the period it covers, which is derived from the subscription's own
	 * calendar: the next billing instant while it is billing, and the end of the last settled period
	 * when it is in dunning. Deriving it rather than accepting it is what makes a retry land on the
	 * same row as the attempt it is retrying.
	 *
	 * @param id The subscription to bill.
	 * @param options The instant to bill against, and whether an operator asked for it — a manual
	 * attempt ignores the dunning schedule, which is what makes "retry this now" possible.
	 * @param expectation The version the caller read the subscription at. The cycle spends it on the
	 * first write it makes to the subscription — a resume, a cancellation, an expiry or the cycle's own
	 * record — because the subscription's version moves with that write and the version the caller
	 * stated no longer exists afterwards.
	 * @returns What the cycle did.
	 */
	public async billCycle(
		id: ID,
		options: { asOf?: Date; manual?: boolean } = {},
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<ISubscriptionBillingOutcome> {
		const now = options.asOf ?? new Date();
		let subscription = await this.findOneScoped(id);

		// Every subscription write this cycle makes is predicated through this reader, so exactly one of
		// them — whichever runs first — carries the version the caller stated.
		const spend = spendableExpectation(expectation);

		if ([SubscriptionStatus.CANCELED, SubscriptionStatus.EXPIRED].includes(subscription.status)) {
			return this.outcome(subscription, {
				status: SubscriptionBillingStatus.PENDING,
				replayed: false,
				message: `A subscription in status "${subscription.status}" is not billed.`
			});
		}

		if (subscription.status === SubscriptionStatus.PAUSED) {
			const until = subscription.pausedUntil ? new Date(subscription.pausedUntil) : null;

			if (!until || until.getTime() > now.getTime()) {
				return this.outcome(subscription, {
					status: SubscriptionBillingStatus.PENDING,
					replayed: false,
					message: 'The subscription is paused, so the period is not consumed and nothing is billed.'
				});
			}

			await this.resume(id, now, spend());
			subscription = await this.findOneScoped(id);
		}

		if (subscription.metadata?.['cancelAtPeriodEnd'] === true) {
			const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : now;

			if (periodEnd.getTime() <= now.getTime()) {
				const canceled = await this.cancel(
					id,
					{
						reason: subscription.cancelReason ?? 'Cancelled at the end of the period.',
						immediate: true
					},
					spend()
				);

				return this.outcome(canceled, {
					status: SubscriptionBillingStatus.PENDING,
					replayed: false,
					message: 'The subscription was cancelled at the end of the period it had already paid for.'
				});
			}
		}

		const plan = await this.planService.findOneScoped(subscription.planId);
		const cadence = this.planService.cadenceOf(plan);

		if (plan.maxBillingCycles !== undefined && plan.maxBillingCycles !== null && subscription.billingCycleCount >= plan.maxBillingCycles) {
			const expired = await this.expire(id, 'MAX_BILLING_CYCLES_REACHED', spend());

			return this.outcome(expired, {
				status: SubscriptionBillingStatus.PENDING,
				replayed: false,
				message: `The plan bills at most ${plan.maxBillingCycles} cycles, which the subscription has now used.`
			});
		}

		const periodStart = new Date(subscription.nextBillingAt ?? subscription.currentPeriodEnd ?? now);
		const period = periodFrom(periodStart, cadence);
		const key = `${subscription.id}:${period.start.toISOString()}`;

		const claim = await this.idempotencyService.claim({
			scope: BILLING_SCOPE,
			key,
			requestHash: this.hash({ subscriptionId: subscription.id, periodStart: period.start.toISOString(), amount: 'period' }),
			resourceType: 'subscription_billing'
		});

		if (claim.outcome === IdempotencyOutcome.REPLAYED) {
			return {
				...(claim.response?.body as unknown as ISubscriptionBillingOutcome),
				subscriptionId: subscription.id,
				replayed: true
			};
		}

		if (claim.outcome === IdempotencyOutcome.REUSED_KEY) {
			throw new BadRequestException(
				'SUBSCRIPTION_BILL_KEY_REUSED: this cycle was already billed under a different request, so it cannot be billed again.'
			);
		}

		if (claim.outcome === IdempotencyOutcome.IN_FLIGHT) {
			return this.outcome(subscription, {
				status: SubscriptionBillingStatus.PENDING,
				replayed: false,
				periodStart: period.start,
				periodEnd: period.end,
				message: 'Another billing pass holds this period and is still working.'
			});
		}

		const outcome = await this.executeCycle(subscription, plan, period, now, options.manual === true, spend());

		if (SETTLED_CYCLE_STATUSES.includes(outcome.status)) {
			// Only a settled cycle completes its key. A failed cycle leaves the claim in progress so the
			// dunning schedule's next attempt can take it over rather than being answered with the
			// failure it is trying to recover from.
			await this.idempotencyService.complete(claim.record, {
				responseStatus: 200,
				responseBody: outcome as unknown as Record<string, unknown>,
				resourceType: 'subscription_billing',
				resourceId: outcome.billingId
			});
		}

		return outcome;
	}

	/**
	 * Runs one billing pass.
	 *
	 * The pass examines every subscription whose billing instant has passed, every paused subscription
	 * whose pause has run out, and — when an operator names one — that subscription alone. Each of
	 * them is billed through `billCycle`, so a manual run and a scheduled run are the same code with
	 * the same idempotency and the same dunning.
	 *
	 * @param options The instant to run against, how many subscriptions one pass may take, and an
	 * optional single subscription to restrict the pass to.
	 * @returns What the pass did.
	 */
	public async runBilling(
		options: { asOf?: Date; limit?: number; subscriptionId?: ID } = {}
	): Promise<ISubscriptionBillingRunOutcome> {
		const now = options.asOf ?? new Date();
		const limit = Math.max(1, Math.trunc(options.limit ?? 200));

		const due = options.subscriptionId
			? [await this.findOneScoped(options.subscriptionId)]
			: await this.findDue(now, limit);

		const results: ISubscriptionBillingOutcome[] = [];
		let billed = 0;
		let failed = 0;
		let skipped = 0;

		for (const subscription of due) {
			let outcome: ISubscriptionBillingOutcome;

			try {
				outcome = await this.billCycle(subscription.id, { asOf: now });
			} catch (error) {
				// One subscription that cannot be billed must not abandon the pass: the rest of the
				// tenants' due cycles are owed their attempt, and the failure is reported as this
				// subscription's outcome rather than as the run's.
				const refusal = error as Error;

				outcome = {
					subscriptionId: subscription.id,
					status: SubscriptionBillingStatus.FAILED,
					replayed: false,
					errorCode: /^([A-Z][A-Z0-9_]{3,}):/.exec(refusal.message)?.[1] ?? 'SUBSCRIPTION_BILL_FAILED',
					message: refusal.message
				};
			}

			results.push(outcome);

			if (outcome.replayed || !outcome.billingId) {
				skipped++;
			} else if (outcome.status === SubscriptionBillingStatus.PAID || outcome.status === SubscriptionBillingStatus.INVOICED) {
				billed++;
			} else if (outcome.status === SubscriptionBillingStatus.FAILED) {
				failed++;
			} else {
				skipped++;
			}
		}

		return { examined: due.length, billed, failed, skipped, results };
	}

	/**
	 * Reads the subscriptions a billing pass must examine.
	 *
	 * A subscription in dunning is not selected here: its retry is driven by the cycle row's own
	 * `nextRetryAt`, and the cycle is reached again through its subscription, so the subscription is
	 * selected while it is active and its billing instant has passed.
	 *
	 * @param now The instant to compare against.
	 * @param limit How many subscriptions one pass may take.
	 * @returns The subscriptions, oldest billing instant first.
	 */
	public async findDue(now: Date, limit: number = 200): Promise<Subscription[]> {
		const scope = currentScope();

		const active = await this.typeOrmSubscriptionRepository.find({
			where: { ...scope, status: SubscriptionStatus.ACTIVE },
			order: { nextBillingAt: 'ASC' },
			take: limit
		});

		const paused = await this.typeOrmSubscriptionRepository.find({
			where: { ...scope, status: SubscriptionStatus.PAUSED },
			order: { pausedUntil: 'ASC' },
			take: limit
		});

		return [...active, ...paused]
			.filter((subscription) => {
				const due = subscription.status === SubscriptionStatus.ACTIVE ? subscription.nextBillingAt : subscription.pausedUntil;

				return due ? new Date(due).getTime() <= now.getTime() : false;
			})
			.sort(
				(left, right) =>
					new Date(left.nextBillingAt ?? left.pausedUntil).getTime() -
					new Date(right.nextBillingAt ?? right.pausedUntil).getTime()
			)
			.slice(0, limit);
	}

	/*
	|--------------------------------------------------------------------------
	| Reads
	|--------------------------------------------------------------------------
	*/

	/**
	 * Reads a subscription with everything a detail view shows.
	 *
	 * @param id The subscription to read.
	 * @returns The subscription, its lines and its billing history.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findOneDetailed(id: ID): Promise<Subscription> {
		const subscription = await this.typeOrmSubscriptionRepository.findOne({
			where: {
				id,
				...currentScope()
			},
			relations: { items: true }
		});

		if (!subscription) {
			throw new NotFoundException('The subscription was not found.');
		}

		subscription.billings = await this.billingService.findForSubscription(id);

		return subscription;
	}

	/**
	 * @param id The subscription whose cycles are being read.
	 * @returns Its billing history, newest period first.
	 */
	public async findBillings(id: ID): Promise<SubscriptionBilling[]> {
		await this.findOneScoped(id);

		return await this.billingService.findForSubscription(id);
	}

	/**
	 * Reads a subscription inside the caller's tenant and organization.
	 *
	 * @param id The subscription to read.
	 * @returns The subscription.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findOneScoped(id: ID): Promise<Subscription> {
		const subscription = await this.typeOrmSubscriptionRepository.findOne({
			where: {
				id,
				...currentScope()
			}
		});

		if (!subscription) {
			throw new NotFoundException('The subscription was not found.');
		}

		return subscription;
	}

	/*
	|--------------------------------------------------------------------------
	| One cycle
	|--------------------------------------------------------------------------
	*/

	/**
	 * Does the work of one billing cycle.
	 *
	 * @param subscription The subscription being billed.
	 * @param plan The plan it is on.
	 * @param period The period the cycle covers.
	 * @param now The instant the cycle is running at.
	 * @param manual Whether an operator asked for this attempt, which ignores the dunning schedule.
	 * @param expectation The version the caller read the subscription at, spent by the first write this
	 * cycle makes to it.
	 * @returns What the cycle did.
	 */
	private async executeCycle(
		subscription: Subscription,
		plan: SubscriptionPlan,
		period: ISubscriptionPeriod,
		now: Date,
		manual: boolean,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<ISubscriptionBillingOutcome> {
		const items = await this.itemService.findForSubscription(subscription.id);

		if (!items.length) {
			throw new BadRequestException(
				'SUBSCRIPTION_ITEMS_REQUIRED: this subscription has no recurring lines, so its cycle cannot be priced.'
			);
		}

		const existing = await this.billingService.findByPeriod(subscription.id, period.start);

		if (existing && SETTLED_CYCLE_STATUSES.includes(existing.status)) {
			// The period is settled. Recomputing it would be a second answer to a question the row has
			// already answered, and acting on that answer is how a customer is charged twice.
			return {
				subscriptionId: subscription.id,
				billingId: existing.id,
				status: existing.status,
				replayed: true,
				orderId: existing.orderId,
				amount: existing.amount,
				currency: existing.currency,
				periodStart: existing.periodStart,
				periodEnd: existing.periodEnd
			};
		}

		if (existing?.nextRetryAt && !manual && new Date(existing.nextRetryAt).getTime() > now.getTime()) {
			return {
				subscriptionId: subscription.id,
				billingId: existing.id,
				status: existing.status,
				replayed: true,
				periodStart: existing.periodStart,
				periodEnd: existing.periodEnd,
				nextRetryAt: existing.nextRetryAt,
				message: 'The dunning schedule has not reached the next attempt yet.'
			};
		}

		const gross = recurringAmount(items, subscription.currency);
		const { discount, net } = applyRecurringDiscount(gross, this.discountOf(plan, this.discountOverrideOf(subscription)));

		// The subscription is written by whichever of the two writes below runs first — the metadata the
		// order path records, or the cycle's own record — so the caller's version is handed to the writes
		// rather than to the calls, and a path that writes nothing does not spend it.
		const spend = spendableExpectation(expectation);

		const billing =
			existing ??
			(await this.billingService.createPending({
				subscriptionId: subscription.id,
				periodStart: period.start,
				periodEnd: period.end,
				amount: net.toStorageString(),
				currency: subscription.currency,
				dueAt: period.start,
				metadata: { gross: gross.toStorageString(), discount: discount.toStorageString() }
			}));

		if (discount.isPositive()) {
			await this.appendDiscount(billing, subscription, discount);
		}

		const credit = await this.consumePendingCredit(subscription, billing);

		const failure = await this.raiseCycleOrder(
			subscription,
			plan,
			items,
			billing,
			period,
			net,
			credit,
			discount,
			spend
		);

		if (failure) {
			return await this.recordFailure(subscription, billing, failure, now, spend());
		}

		return await this.recordSuccess(subscription, plan, billing, period, items, spend());
	}

	/**
	 * Raises the cycle's order through the ordinary order path.
	 *
	 * @param subscription The subscription being billed.
	 * @param plan The plan it is on.
	 * @param items The recurring lines.
	 * @param billing The cycle's row.
	 * @param period The period the cycle covers.
	 * @param net The recurring amount after the plan discount.
	 * @param credit The deferred proration credit, when one is owed.
	 * @param discount The plan discount granted, when one was.
	 * @param nextExpectation The reader the two subscription writes below take their expectation from,
	 * so that whichever of them runs first carries the version the route's caller stated.
	 * @returns A platform code and message when the charge could not be made, or undefined on success.
	 */
	private async raiseCycleOrder(
		subscription: Subscription,
		plan: SubscriptionPlan,
		items: SubscriptionItem[],
		billing: SubscriptionBilling,
		period: ISubscriptionPeriod,
		net: Money,
		credit: Money | null,
		discount: Money,
		nextExpectation: () => IVersionExpectation
	): Promise<{ code: string; message: string } | undefined> {
		if (!this.orderGateway) {
			return {
				code: 'SUBSCRIPTION_ORDER_GATEWAY_UNAVAILABLE',
				message:
					'The order capability is not registered, so a cycle cannot raise the order it bills; the cycle is recorded as failed rather than marked paid.'
			};
		}

		const payer = await this.resolvePayer(subscription);

		if (payer.refusal) {
			return payer.refusal;
		}

		const setupFee = this.setupFeeFor(subscription, plan);
		// One key per attempt, not per period. The per-period key is what the cycle's idempotency claim
		// holds, and it is deliberately left open after a failure so the dunning schedule's next
		// attempt can take it over; the order path's key has to move with the attempt, or a retry
		// would be answered with the decline it is trying to recover from. Two runs of the *same*
		// attempt still collide, which is what stops one attempt charging twice.
		const attempt = (billing.attemptCount ?? 0) + 1;

		try {
			const result = await this.orderGateway.raiseSubscriptionOrder({
				subscriptionId: subscription.id,
				billingId: billing.id,
				customerId: subscription.customerId,
				originOrderId: subscription.originOrderId,
				currency: subscription.currency,
				periodStart: period.start,
				periodEnd: period.end,
				firstCycle: subscription.billingCycleCount === 0,
				lines: items.map((item) => ({
					variantId: item.variantId,
					quantity: item.quantity,
					unitPrice: item.unitPrice
				})),
				amount: net.toStorageString(),
				...(setupFee ? { setupFee } : {}),
				...(discount.isPositive() ? { discountAmount: discount.toStorageString() } : {}),
				...(credit && !credit.isZero() ? { creditAmount: credit.toStorageString() } : {}),
				paymentAccountHolderId: payer.accountHolderId,
				paymentMethodTokenId: payer.paymentMethodTokenId,
				idempotencyKey: `${subscription.id}:${period.start.toISOString()}:${attempt}`,
				note: `Subscription cycle ${period.start.toISOString()}, attempt ${attempt}`
			});

			if (!result?.orderId) {
				return {
					code: 'SUBSCRIPTION_ORDER_NOT_RAISED',
					message: 'The order capability did not return an order for this cycle.'
				};
			}

			if (result.paid) {
				await this.billingService.markPaid(billing.id, {
					paidAt: result.paidAt ?? new Date(),
					orderId: result.orderId,
					attemptCount: billing.attemptCount ?? 0
				});
			} else {
				await this.billingService.markInvoiced(billing.id, result.orderId, net.toStorageString());
			}

			if (setupFee) {
				await this.rememberSetupFee(subscription, plan, nextExpectation());
			}

			if (credit && !credit.isZero()) {
				await this.clearPendingCredit(subscription, nextExpectation());
			}

			return undefined;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);

			return {
				code: /^([A-Z][A-Z0-9_]{3,}):/.exec(message)?.[1] ?? 'SUBSCRIPTION_CHARGE_FAILED',
				message
			};
		}
	}

	/**
	 * Records a failed attempt and moves the subscription's dunning on by one step.
	 *
	 * @param subscription The subscription being billed.
	 * @param billing The cycle's row.
	 * @param failure The platform code and message the attempt produced.
	 * @param now The instant the attempt failed at.
	 * @param expectation The version the caller read the subscription at, carried by whichever of the
	 * two writes below records the attempt — only one of them ever runs.
	 * @returns What the attempt did.
	 */
	private async recordFailure(
		subscription: Subscription,
		billing: SubscriptionBilling,
		failure: { code: string; message: string },
		now: Date,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<ISubscriptionBillingOutcome> {
		const attempts = (billing.attemptCount ?? 0) + 1;
		const exhausted = isDunningExhausted(attempts);
		const retryAt = exhausted ? null : nextRetryAt(attempts, now);
		const error = `${failure.code}: ${failure.message}`;

		const failed = await this.billingService.markFailed(billing.id, {
			attemptCount: attempts,
			error,
			nextRetryAt: retryAt
		});

		if (exhausted) {
			// The retry policy is spent. The subscription keeps its history and its period, and stops
			// being billed automatically until an operator acts or the customer supplies an instrument.
			await commitVersionedUpdate<Subscription>(this, {
				id: subscription.id,
				expectation,
				patch: { status: SubscriptionStatus.FAILED, nextBillingAt: null }
			});
		} else {
			// Still active, and still owed the same period: the cycle row's own retry instant decides
			// when the next attempt happens, so the calendar does not move.
			await commitVersionedUpdate<Subscription>(this, {
				id: subscription.id,
				expectation,
				patch: {
					status: SubscriptionStatus.ACTIVE,
					nextBillingAt: billing.periodStart
				}
			});
		}

		await this.emit('subscription.payment-failed', subscription.id, {
			subscriptionId: subscription.id,
			billingId: failed.id,
			periodStart: failed.periodStart,
			amount: failed.amount,
			attempt: attempts,
			nextRetryAt: retryAt,
			reason: error
		});

		return {
			subscriptionId: subscription.id,
			billingId: failed.id,
			status: SubscriptionBillingStatus.FAILED,
			replayed: false,
			orderId: failed.orderId,
			amount: failed.amount,
			currency: failed.currency,
			periodStart: failed.periodStart,
			periodEnd: failed.periodEnd,
			nextRetryAt: retryAt ?? undefined,
			errorCode: failure.code,
			message: failure.message
		};
	}

	/**
	 * Records a settled cycle and advances the calendar.
	 *
	 * The next billing instant is computed from the period that was just billed rather than from the
	 * moment the cycle ran, so a run that is six hours late — or a dunning recovery a week late —
	 * produces the same calendar as one that was on time. Reaching the plan's ceiling on this cycle
	 * expires the subscription instead of scheduling another one.
	 *
	 * @param subscription The subscription being billed.
	 * @param plan The plan it is on.
	 * @param billing The cycle's row.
	 * @param period The period the cycle covered.
	 * @param items The recurring lines.
	 * @param expectation The version the caller read the subscription at.
	 * @returns What the cycle did.
	 */
	private async recordSuccess(
		subscription: Subscription,
		plan: SubscriptionPlan,
		billing: SubscriptionBilling,
		period: ISubscriptionPeriod,
		items: SubscriptionItem[],
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<ISubscriptionBillingOutcome> {
		const settled = await this.billingService.findOneScoped(billing.id);
		const cycleCount = (subscription.billingCycleCount ?? 0) + 1;
		const ceilingReached =
			plan.maxBillingCycles !== undefined && plan.maxBillingCycles !== null && cycleCount >= plan.maxBillingCycles;

		await commitVersionedUpdate<Subscription>(this, {
			id: subscription.id,
			expectation,
			patch: {
				status: ceilingReached ? SubscriptionStatus.EXPIRED : SubscriptionStatus.ACTIVE,
				currentPeriodStart: period.start,
				currentPeriodEnd: period.end,
				nextBillingAt: ceilingReached ? null : period.end,
				billingCycleCount: cycleCount
			}
		});

		await this.emit('subscription.renewed', subscription.id, {
			subscriptionId: subscription.id,
			billingId: settled.id,
			orderId: settled.orderId ?? null,
			periodStart: period.start,
			periodEnd: period.end,
			amount: settled.amount,
			nextBillingAt: ceilingReached ? null : period.end,
			planId: plan.id,
			lineCount: items.length
		});

		if (ceilingReached) {
			await this.emit('subscription.expired', subscription.id, {
				subscriptionId: subscription.id,
				expiredAt: new Date(),
				reason: 'MAX_BILLING_CYCLES_REACHED'
			});
		}

		return {
			subscriptionId: subscription.id,
			billingId: settled.id,
			status: settled.status,
			replayed: false,
			orderId: settled.orderId,
			amount: settled.amount,
			currency: settled.currency,
			periodStart: period.start,
			periodEnd: period.end
		};
	}

	/*
	|--------------------------------------------------------------------------
	| Proration
	|--------------------------------------------------------------------------
	*/

	/**
	 * Computes what a mid-cycle change is worth, settles it, and applies it.
	 *
	 * @param subscription The subscription being changed.
	 * @param change What is changing: the plan, the line set, or both.
	 * @param expectation The version the caller read the subscription at, carried by whichever of the
	 * two writes below the change takes — a scheduled change and an immediate one never both run.
	 * @returns What the change decided and what it settled.
	 */
	private async applyChange(
		subscription: Subscription,
		change: {
			planId?: ID;
			quantity?: DecimalString | number;
			discountPercentage?: string;
			before: SubscriptionItem[];
			after: Array<{ variantId: ID; quantity: DecimalString; unitPrice: DecimalString; position: number; metadata?: Record<string, unknown> }>;
			effective: 'IMMEDIATE' | 'NEXT_PERIOD';
			description: string;
		},
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<ISubscriptionPlanChangeOutcome> {
		const currency = subscription.currency;
		const zero = Money.zero(currency).round().toStorageString();
		const oldRecurring = recurringAmount(change.before, currency);
		const newRecurring = recurringAmount(change.after, currency);
		const metadata: Record<string, unknown> = { ...(subscription.metadata ?? {}) };

		if (change.planId) {
			// A plan change re-states the discount: the new plan's terms replace whatever the old one
			// was sold with, and a plan that grants none must not inherit the previous one's.
			if (change.discountPercentage === undefined) {
				delete metadata['discountPercentage'];
			} else {
				metadata['discountPercentage'] = change.discountPercentage;
			}
		}

		const scheduled =
			change.effective === 'NEXT_PERIOD' || !subscription.currentPeriodStart || !subscription.currentPeriodEnd;

		if (scheduled) {
			metadata['scheduledPlanChange'] = {
				...(change.planId ? { planId: change.planId } : {}),
				effectiveAt: subscription.currentPeriodEnd ?? null,
				description: change.description
			};

			await commitVersionedUpdate<Subscription>(this, {
				id: subscription.id,
				expectation,
				patch: { metadata }
			});

			return {
				subscription: await this.findOneScoped(subscription.id),
				credit: zero,
				charge: zero,
				net: zero,
				settlement: 'SCHEDULED',
				currency
			};
		}

		const period: ISubscriptionPeriod = {
			start: new Date(subscription.currentPeriodStart),
			end: new Date(subscription.currentPeriodEnd)
		};
		const { credit, charge, net } = prorate({ oldRecurring, newRecurring, period, at: new Date() });
		const minimum = Money.of(String(metadata['minimumProrationCharge'] ?? DEFAULT_MINIMUM_PRORATION_CHARGE), currency);

		let settlement: ISubscriptionPlanChangeOutcome['settlement'] = 'DEFERRED';

		if (net.isPositive() && net.greaterThan(minimum)) {
			await this.chargeProration(subscription, net, change.description);
			settlement = 'CHARGED';
		} else if (net.isPositive()) {
			// Below the cost of collecting it: charging would lose money and refunding would be theatre.
			metadata['waivedProrations'] = [
				...((metadata['waivedProrations'] as unknown[]) ?? []),
				{ amount: net.toStorageString(), currency, at: new Date().toISOString(), description: change.description }
			];
			settlement = 'WAIVED';
		} else if (net.isNegative()) {
			metadata[PENDING_CREDIT] = {
				amount: net.toStorageString(),
				currency,
				at: new Date().toISOString(),
				description: change.description
			};
			await this.appendCredit(subscription, net, change.description);
		} else {
			settlement = 'WAIVED';
		}

		await commitVersionedUpdate<Subscription>(this, {
			id: subscription.id,
			expectation,
			patch: {
				...(change.planId ? { planId: change.planId } : {}),
				...(change.quantity !== undefined ? { quantity: normalizeDecimal(change.quantity, subscription.quantity) } : {}),
				metadata
			}
		});

		if (change.planId || change.after.length !== change.before.length) {
			await this.itemService.replaceItems(
				subscription.id,
				change.after.map((line) => ({
					variantId: line.variantId,
					quantity: line.quantity,
					unitPrice: line.unitPrice,
					position: line.position,
					metadata: line.metadata
				})),
				currency,
				subscription.customerId
			);
		} else {
			for (const line of change.after) {
				const current = change.before.find((row) => row.variantId === line.variantId);

				if (current && String(current.quantity) !== String(line.quantity)) {
					await this.itemService.changeQuantity(subscription.id, line.variantId, line.quantity, currency);
				}
			}
		}

		return {
			subscription: await this.findOneScoped(subscription.id),
			credit: credit.toStorageString(),
			charge: charge.toStorageString(),
			net: net.toStorageString(),
			settlement,
			currency
		};
	}

	/**
	 * Charges the difference a change produced, through the ordinary order path.
	 *
	 * The charge is claimed under a key derived from the change itself — the subscription, the amount
	 * and the period it belongs to — rather than from the moment the request arrived, so repeating the
	 * identical change inside one period settles it once and a *different* change in the same period
	 * still settles on its own account.
	 *
	 * @param subscription The subscription that changed.
	 * @param net What is owed, positive.
	 * @param description What the change was.
	 * @throws BadRequestException when the order capability is not registered, when the remembered
	 * payer may not be charged, or when the identical change is already being settled.
	 */
	private async chargeProration(subscription: Subscription, net: Money, description: string): Promise<void> {
		if (!this.orderGateway) {
			throw new BadRequestException(
				'SUBSCRIPTION_ORDER_GATEWAY_UNAVAILABLE: the order capability is not registered, so the difference this change produced cannot be charged.'
			);
		}

		const payer = await this.resolvePayer(subscription);

		if (payer.refusal) {
			throw new BadRequestException(`${payer.refusal.code}: ${payer.refusal.message}`);
		}

		const amount = net.toStorageString();
		const periodStart = subscription.currentPeriodStart ? new Date(subscription.currentPeriodStart).toISOString() : '';
		const key = `${subscription.id}:${this.hash({ description, amount, periodStart }).slice(0, 32)}`;
		const claim = await this.idempotencyService.claim({
			scope: PRORATION_SCOPE,
			key,
			requestHash: this.hash({ subscriptionId: subscription.id, amount, periodStart })
		});

		if (claim.outcome === IdempotencyOutcome.REPLAYED) {
			// This exact change was already charged for this period. The caller gets the same answer
			// rather than a second charge, which is the whole point of settling under a derived key.
			return;
		}

		if (claim.outcome === IdempotencyOutcome.IN_FLIGHT || claim.outcome === IdempotencyOutcome.REUSED_KEY) {
			throw new BadRequestException(
				'SUBSCRIPTION_PRORATION_IN_FLIGHT: an identical change is already being settled for this period.'
			);
		}

		const result = await this.orderGateway.raiseProrationOrder({
			subscriptionId: subscription.id,
			customerId: subscription.customerId,
			currency: subscription.currency,
			amount,
			description,
			paymentAccountHolderId: payer.accountHolderId,
			paymentMethodTokenId: payer.paymentMethodTokenId,
			idempotencyKey: key
		});

		await this.idempotencyService.complete(claim.record, {
			responseStatus: 200,
			resourceType: 'order',
			resourceId: result?.orderId
		});
	}

	/**
	 * Writes a proration credit against the cycle it will reduce.
	 *
	 * A credit is an adjustment on a billing row rather than a smaller amount, so the reduction stays
	 * visible in the ledger. When the current period has no row to own it — which happens when a
	 * change lands after the period settled and before the next cycle opened — the intent is recorded
	 * on the subscription and consumed when the next cycle's row exists.
	 *
	 * @param subscription The subscription that changed.
	 * @param net The negative difference the change produced.
	 * @param description What the change was.
	 */
	private async appendCredit(subscription: Subscription, net: Money, description: string): Promise<void> {
		const owner = await this.currentPeriodBilling(subscription);

		if (!owner) {
			return;
		}

		await this.adjustmentService.append({
			ownerType: AdjustmentOwnerType.SUBSCRIPTION_BILLING,
			ownerId: owner.id,
			type: AdjustmentType.CREDIT,
			amount: net.toStorageString(),
			currency: subscription.currency,
			referenceType: 'subscription',
			referenceId: subscription.id,
			description
		});
	}

	/**
	 * Grants the plan's recurring discount on a cycle, once.
	 *
	 * The discount is an adjustment rather than a smaller `amount`, which is what keeps it auditable
	 * and what stops a later price change from rewriting what a cycle was worth. Appending it twice
	 * would double it, so an existing row of the same type on the same cycle is left alone.
	 *
	 * @param billing The cycle.
	 * @param subscription The subscription being billed.
	 * @param discount The discount granted.
	 */
	private async appendDiscount(billing: SubscriptionBilling, subscription: Subscription, discount: Money): Promise<void> {
		const existing = await this.adjustmentService.findByOwner(AdjustmentOwnerType.SUBSCRIPTION_BILLING, billing.id);

		if (existing.some((row) => row.type === AdjustmentType.PROMOTION)) {
			return;
		}

		await this.adjustmentService.append({
			ownerType: AdjustmentOwnerType.SUBSCRIPTION_BILLING,
			ownerId: billing.id,
			type: AdjustmentType.PROMOTION,
			amount: discount.negate().toStorageString(),
			currency: subscription.currency,
			referenceType: 'subscription-plan',
			referenceId: subscription.planId,
			description: 'Recurring plan discount.'
		});
	}

	/**
	 * Applies a credit an earlier change deferred, and returns it so the cycle can be reduced by it.
	 *
	 * @param subscription The subscription being billed.
	 * @param billing The cycle the credit reduces.
	 * @returns The credit, or null when none is owed.
	 */
	private async consumePendingCredit(subscription: Subscription, billing: SubscriptionBilling): Promise<Money | null> {
		const pending = subscription.metadata?.[PENDING_CREDIT] as { amount?: string; currency?: string } | undefined;

		if (!pending?.amount) {
			return null;
		}

		const credit = Money.of(pending.amount, pending.currency ?? subscription.currency).round();

		if (credit.isZero()) {
			return null;
		}

		const existing = await this.adjustmentService.findByOwner(AdjustmentOwnerType.SUBSCRIPTION_BILLING, billing.id);

		if (!existing.some((row) => row.type === AdjustmentType.CREDIT)) {
			await this.adjustmentService.append({
				ownerType: AdjustmentOwnerType.SUBSCRIPTION_BILLING,
				ownerId: billing.id,
				type: AdjustmentType.CREDIT,
				amount: credit.toStorageString(),
				currency: subscription.currency,
				referenceType: 'subscription',
				referenceId: subscription.id,
				description: 'Credit from an earlier plan change.'
			});
		}

		return credit;
	}

	/*
	|--------------------------------------------------------------------------
	| Helpers
	|--------------------------------------------------------------------------
	*/

	/**
	 * @param subscription The subscription being billed.
	 * @returns The account and instrument the charge may use, or the platform code that refuses it.
	 */
	private async resolvePayer(subscription: Subscription): Promise<{
		accountHolderId?: ID;
		paymentMethodTokenId?: ID;
		refusal?: { code: string; message: string };
	}> {
		const remembered = {
			accountHolderId: subscription.paymentAccountHolderId,
			paymentMethodTokenId: subscription.paymentMethodTokenId
		};

		// Nothing is remembered, so there is nothing for a capability to resolve and nothing to charge.
		// The cycle fails with the code the dunning path and the "update your payment method"
		// notification both point at, and this is asked **before** the capability is: a registered
		// instrument capability cannot resolve a payer the subscription never named, and the answer it
		// would give — "no such account holder" — is a refusal about a row rather than about this
		// subscription, which is not what the customer is told and not what the dunning schedule keys on.
		if (!remembered.accountHolderId && !remembered.paymentMethodTokenId) {
			return {
				...remembered,
				refusal: {
					code: 'SUBSCRIPTION_PAYMENT_METHOD_MISSING',
					message: 'No payment instrument is remembered for this subscription, so the cycle cannot be charged.'
				}
			};
		}

		// A tenant that registers no instrument capability still has the identifiers the subscription
		// carries, so the cycle is attempted with them and the provider answers for them.
		if (!this.instruments) {
			return remembered;
		}

		const resolved = await this.instruments.resolveChargeableInstrument({
			accountHolderId: remembered.accountHolderId,
			paymentMethodTokenId: remembered.paymentMethodTokenId,
			currency: subscription.currency
		});

		if (!resolved?.chargeable) {
			return {
				...remembered,
				refusal: {
					code: this.cycleCodeOf(resolved?.reasonCode),
					message: resolved?.reason ?? 'The remembered payer may not be charged.'
				}
			};
		}

		return {
			accountHolderId: resolved.accountHolderId ?? remembered.accountHolderId,
			paymentMethodTokenId: resolved.paymentMethodTokenId ?? remembered.paymentMethodTokenId
		};
	}

	/**
	 * @param reasonCode The code the stored-instrument capability refused with, when it refused.
	 * @returns The code the cycle carries: this domain's own when the instrument itself is unusable,
	 * and the capability's own for every other refusal.
	 */
	private cycleCodeOf(reasonCode?: string): string {
		return reasonCode && !UNUSABLE_INSTRUMENT_CODES.includes(reasonCode)
			? reasonCode
			: 'SUBSCRIPTION_PAYMENT_METHOD_MISSING';
	}

	/**
	 * @param subscription The subscription being billed.
	 * @param plan The plan it is on.
	 * @returns The setup fee to charge with this cycle, or undefined when it is not owed.
	 */
	private setupFeeFor(subscription: Subscription, plan: SubscriptionPlan): DecimalString | undefined {
		if (subscription.billingCycleCount > 0 || !plan.setupFee) {
			return undefined;
		}

		const charged = (subscription.metadata?.[CHARGED_SETUP_FEES] as ID[]) ?? [];

		if (charged.includes(plan.id)) {
			return undefined;
		}

		const fee = Money.of(String(plan.setupFee), subscription.currency).round();

		return fee.isPositive() ? fee.toStorageString() : undefined;
	}

	/**
	 * @param subscription The subscription whose setup fee was charged.
	 * @param plan The plan whose setup fee it was.
	 * @param expectation The version the write is predicated on.
	 */
	private async rememberSetupFee(
		subscription: Subscription,
		plan: SubscriptionPlan,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<void> {
		const charged = (subscription.metadata?.[CHARGED_SETUP_FEES] as ID[]) ?? [];

		if (charged.includes(plan.id)) {
			return;
		}

		await commitVersionedUpdate<Subscription>(this, {
			id: subscription.id,
			expectation,
			patch: {
				metadata: { ...(subscription.metadata ?? {}), [CHARGED_SETUP_FEES]: [...charged, plan.id] }
			}
		});
	}

	/**
	 * @param subscription The subscription whose deferred credit was applied.
	 * @param expectation The version the write is predicated on.
	 */
	private async clearPendingCredit(
		subscription: Subscription,
		expectation: IVersionExpectation = ANY_VERSION
	): Promise<void> {
		const metadata = { ...(subscription.metadata ?? {}) };

		delete metadata[PENDING_CREDIT];

		await commitVersionedUpdate<Subscription>(this, {
			id: subscription.id,
			expectation,
			patch: { metadata }
		});
	}

	/**
	 * @param subscription The subscription to read the current period's cycle of.
	 * @returns The cycle covering the current period, or null when it has none.
	 */
	private async currentPeriodBilling(subscription: Subscription): Promise<SubscriptionBilling | null> {
		if (!subscription.currentPeriodStart) {
			return null;
		}

		return await this.billingService.findByPeriod(subscription.id, new Date(subscription.currentPeriodStart));
	}

	/**
	 * @param subscription The subscription being billed.
	 * @returns The discount this subscription was sold with, when it is not simply the plan's.
	 */
	private discountOverrideOf(subscription: Subscription): string | undefined {
		const override = subscription.metadata?.['discountPercentage'];

		return override === undefined || override === null ? undefined : String(override);
	}

	/**
	 * @param subscription The subscription being billed.
	 * @param plan The plan it is on.
	 * @param override A discount the caller stated for this subscription alone.
	 * @returns The discount fraction to apply.
	 */
	private discountOf(plan: SubscriptionPlan, override?: string | number): string | undefined {
		if (override !== undefined && override !== null && String(override) !== '') {
			return String(override);
		}

		return plan.discountPercentage !== undefined && plan.discountPercentage !== null
			? String(plan.discountPercentage)
			: undefined;
	}

	/**
	 * @param subscription The subscription being read.
	 * @returns The end of its trial, when it is inside one.
	 */
	private trialEndOf(subscription: Subscription): Date | null {
		const trialEndsAt = subscription.metadata?.['trialEndsAt'];

		return typeof trialEndsAt === 'string' ? new Date(trialEndsAt) : null;
	}

	/**
	 * @param subscription The subscription a read-only outcome is reported for.
	 * @param outcome What the cycle decided.
	 * @returns The outcome, carrying the subscription's identity and currency.
	 */
	private outcome(
		subscription: Subscription,
		outcome: Partial<ISubscriptionBillingOutcome> & Pick<ISubscriptionBillingOutcome, 'status' | 'replayed'>
	): ISubscriptionBillingOutcome {
		return { subscriptionId: subscription.id, currency: subscription.currency, ...outcome };
	}

	/**
	 * Writes one `subscription.*` event to the platform outbox.
	 *
	 * The event is the hand-over: the entitlement context, the notification triggers and any webhook
	 * subscriber learn about the change from it, so this domain never has to know who consumes it.
	 *
	 * @param name The event name.
	 * @param subscriptionId The aggregate the event is about.
	 * @param data The projection a consumer receives.
	 */
	private async emit(name: string, subscriptionId: ID, data: Record<string, unknown>): Promise<void> {
		await this.outbox.append(this.typeOrmSubscriptionRepository.manager, {
			name,
			aggregateType: 'SUBSCRIPTION',
			aggregateId: subscriptionId,
			data,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as any);
	}

	/**
	 * @param subscription The subscription a transition is attempted on.
	 * @throws BadRequestException when it is cancelled or expired.
	 */
	private assertLive(subscription: Subscription): void {
		if ([SubscriptionStatus.CANCELED, SubscriptionStatus.EXPIRED].includes(subscription.status)) {
			throw new BadRequestException(
				`A subscription in status "${subscription.status}" cannot be changed; reactivate it as a new subscription instead.`
			);
		}
	}

	/**
	 * @param subscription The subscription a transition is attempted on.
	 * @param allowed The statuses it may be attempted from.
	 * @param action The action being attempted, named in the error.
	 * @throws BadRequestException when the subscription is not in one of the allowed statuses.
	 */
	private assertStatus(subscription: Subscription, allowed: SubscriptionStatus[], action: string): void {
		if (!allowed.includes(subscription.status)) {
			throw new BadRequestException(
				`A subscription in status "${subscription.status}" cannot ${action}; expected ${allowed.join(' or ')}.`
			);
		}
	}

	/**
	 * @param value What to hash.
	 * @returns The SHA-256 of its canonical JSON form, which is what an idempotency key carries.
	 */
	private hash(value: Record<string, unknown>): string {
		return createHash('sha256').update(JSON.stringify(value)).digest('hex');
	}
}
