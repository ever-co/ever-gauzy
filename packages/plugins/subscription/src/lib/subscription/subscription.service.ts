import { BadRequestException, ConflictException, Injectable, Inject, Logger, NotFoundException, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DeepPartial, EntityManager, LessThanOrEqual } from 'typeorm';
import {
	AdjustmentOwnerType,
	AdjustmentType,
	CurrencyCode,
	DecimalString,
	ID,
	IdempotencyOutcome,
	IdempotencyStatus
} from '@gauzy/contracts';
import {
	AdjustmentService,
	ApiErrorCode,
	ApiException,
	EventOutboxService,
	IVersionExpectation,
	IVersionedWriter,
	IdempotencyService,
	Money,
	RequestContext,
	assertPlainReferencesNotForeign,
	commitVersionedUpdate,
	matchesExpectation,
	parseEntityVersion,
	redactDatabaseError,
	toClientSafeError
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
	ISubscriptionUpcomingBilling,
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
	cycleDiscountOf,
	isDunningExhausted,
	nextCyclePeriod,
	nextRetryAt,
	normalizeDecimal,
	normalizeDiscountFraction,
	periodFrom,
	priceCycle,
	prorate,
	recurringAmount,
	resumedNextBillingAt
} from '../subscription.cycle';
import { SubscriptionPlan } from '../subscription-plan/subscription-plan.entity';
import { SubscriptionPlanService } from '../subscription-plan/subscription-plan.service';
import { lockPlanRow } from '../subscription-plan/subscription-plan.lock';
import { SUBSCRIPTION_REFERENCES } from '../subscription.references';
import { currentScope } from '../subscription.scope';
import { movedReadOnlyMembers, notWritable, writableOnly } from '../subscription.writable';
import { SubscriptionItem } from '../subscription-item/subscription-item.entity';
import { SubscriptionItemService } from '../subscription-item/subscription-item.service';
import { SubscriptionBilling } from '../subscription-billing/subscription-billing.entity';
import {
	CHARGE_CLAIM_LOST,
	ICycleBookkeeping,
	SubscriptionBillingService
} from '../subscription-billing/subscription-billing.service';
import { Subscription } from './subscription.entity';
import { MikroOrmSubscriptionRepository } from './repository/mikro-orm-subscription.repository';
import { TypeOrmSubscriptionRepository } from './repository/type-orm-subscription.repository';
import { SubscriptionCrudService } from '../subscription-crud.service';

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
 * The members of a subscription an edit may move (review R4-07): the payer, the quantity and the metadata - the
 * members the GraphQL `UpdateSubscriptionInput` admits. Everything else moves through the subscription's own actions.
 */
export const SUBSCRIPTION_WRITABLE_MEMBERS: readonly string[] = [
	'paymentAccountHolderId',
	'paymentMethodTokenId',
	'quantity',
	'metadata',
	// The concurrency and retry controls the GraphQL input carries beside the fields; they are read by the write and
	// the retry kernel, never stored as values of the subscription.
	'version',
	'idempotencyKey'
];

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

/**
 * The code the order path refuses an attempt with while another call still holds the attempt's key and is working
 * (`ISubscriptionOrderGatewayPort.raiseSubscriptionOrder`).
 *
 * That attempt is in flight elsewhere, not failed. Recorded as a failure, it would move the cycle's attempt count — and
 * with it the order key of the next attempt, which the order path no longer fences against the call still running.
 */
const ORDER_ATTEMPT_IN_FLIGHT = 'ORDER_SUBSCRIPTION_IN_FLIGHT';

/** The key a proration charge's idempotency claim is scoped under. */
const PRORATION_SCOPE = 'subscription.proration';

/**
 * The key the release of an invoiced cycle's held-back rights is claimed under (R4-05): one claim per cycle,
 * so two payments - or a payment and the billing run - racing on one cycle release its rights exactly once,
 * and a release interrupted half-way is taken over and finished by the next attempt once its lease is stale.
 */
const RIGHTS_RELEASE_SCOPE = 'subscription.rights.release';

/**
 * The subscription statuses a late payment releases no rights for (R4-05, review note from px-refunds): the
 * subscription ended — cancelled, expired, or failed out of dunning — while the invoice was open. The cycle is
 * recorded paid and the reason the rights were withheld is kept on it; nothing extends a right of a
 * subscription that is over.
 */
const RIGHTS_WITHHELD_STATUSES: SubscriptionStatus[] = [
	SubscriptionStatus.CANCELED,
	SubscriptionStatus.EXPIRED,
	SubscriptionStatus.FAILED
];

/**
 * Cycle statuses that mean the period's charge has been raised — an order is open for it, or it was paid,
 * waived or refunded — and must never be charged again.
 *
 * This is the list every "has this period been billed already?" question reads, and it is the list that used
 * to be called `SETTLED_CYCLE_STATUSES`. `INVOICED` belongs here — its order exists, and raising a second one
 * would bill the customer twice — but it does **not** belong to the settled list below (R4-05).
 */
const RAISED_CYCLE_STATUSES: SubscriptionBillingStatus[] = [
	SubscriptionBillingStatus.PAID,
	SubscriptionBillingStatus.INVOICED,
	SubscriptionBillingStatus.WAIVED,
	SubscriptionBillingStatus.REFUNDED
];

/**
 * Cycle statuses that mean the period is actually paid for (or deliberately settled without money): the only
 * cycles whose rights are put in force (R4-05, interim).
 *
 * An `INVOICED` cycle has an order and no money: counting it as settled extended the customer's rights — the
 * `subscription.renewed` that the entitlement package extends every right on, and the trial's
 * `subscription.activated` — for a period nobody had paid. Those two events now wait for the cycle's payment
 * (`payCycle`), and so does the calendar (Q7-W4): an invoiced cycle stays the subscription's open cycle — the
 * period is not counted, the trial does not convert, and no later period is invoiced — until it is paid.
 */
const SETTLED_CYCLE_STATUSES: SubscriptionBillingStatus[] = [
	SubscriptionBillingStatus.PAID,
	SubscriptionBillingStatus.WAIVED,
	SubscriptionBillingStatus.REFUNDED
];

/** The metadata key that records the plans whose setup fee was already charged. */
const CHARGED_SETUP_FEES = 'chargedSetupFeePlanIds';

/** The metadata key that carries a proration credit into the next cycle. */
const PENDING_CREDIT = 'pendingCredit';

/**
 * The description of the adjustment a cycle consumes the carried credit under (`consumePendingCredit`). A plan
 * change's own record of a credit it decided is described in the change's words (`appendCredit`), so this one tells the
 * consumption apart when a cycle recorded before `CYCLE_BOOKKEEPING` existed is finished (`owedBookkeepingOf`).
 */
const CONSUMED_CREDIT_DESCRIPTION = 'Credit from an earlier plan change.';

/** The metadata key a per-subscription discount override is stored under. */
const DISCOUNT_OVERRIDE = 'discountPercentage';

/** The metadata key the end of a trial is stored under; billing starts there. */
const TRIAL_ENDS_AT = 'trialEndsAt';

/** The metadata key a per-subscription proration threshold is stored under; a smaller difference is waived. */
const MINIMUM_PRORATION_CHARGE = 'minimumProrationCharge';

/** The metadata key a cancellation at the end of the paid period is recorded under; the billing run acts on it. */
const CANCEL_AT_PERIOD_END = 'cancelAtPeriodEnd';

/**
 * The metadata key a subscription records the cycle whose payment expired it under (Q7-W4).
 *
 * The payment of an invoiced cycle that reaches the plan's ceiling moves the calendar onto that cycle's period and
 * expires the subscription, and the cycle's id is written here in the same statement. The release of that cycle's
 * rights reads it to tell this expiry from one that ended the subscription any other way while the invoice was open —
 * a matching period cannot, because an opening invoice shares the subscription's period before it is paid — and,
 * being written with the expiry, it lets a payment interrupted before the expiry was told tell it on its retry.
 */
const EXPIRED_BY_CYCLE = 'expiredByCycle';

/**
 * The metadata key a subscription records the last cycle whose charge's bookkeeping it applied under: the setup fee the
 * order carried, and the deferred credit it consumed, subtracted from the one still carried (`finishCycle`).
 *
 * It is written in the statement that applies the bookkeeping, so a cycle's bookkeeping is applied once, whichever of
 * the run, a later pass recovering the cycle, or the payment of an invoiced cycle reaches it first. One cycle is open
 * at a time — the calendar stays on a cycle until it is finished or paid — so the last one is all it needs to name.
 */
const BOOKKEPT_CYCLE = 'bookkeptCycleId';

/**
 * The metadata keys the service writes and the billing run trusts (SEC-B-03): the discount override, the proration
 * credit carried into the next cycle, the plans whose setup fee was charged, the end of the trial, the proration
 * threshold below which a plan change's charge is waived, the cancellation at the end of the period, the cycle
 * whose payment expired the subscription, and the cycle whose bookkeeping was last applied. A caller's metadata can
 * neither set nor erase them —
 * `metadata: { discountPercentage: "1" }` billed every later cycle at 0, `{ pendingCredit: { amount: "100000" } }`
 * credited the next one, `{ minimumProrationCharge: "1000000" }` waived every upgrade's charge, and
 * `{ cancelAtPeriodEnd: true }` cancelled the subscription with no cancellation (CodeRabbit). They move through the
 * service's own actions.
 */
export const RESERVED_SUBSCRIPTION_METADATA_KEYS: readonly string[] = [
	DISCOUNT_OVERRIDE,
	PENDING_CREDIT,
	CHARGED_SETUP_FEES,
	TRIAL_ENDS_AT,
	MINIMUM_PRORATION_CHARGE,
	CANCEL_AT_PERIOD_END,
	EXPIRED_BY_CYCLE,
	BOOKKEPT_CYCLE
];

/**
 * How many times an edit that writes metadata re-reads the subscription after a billing pass moved it between the
 * read its metadata was built from and the write. A pass moves a row a handful of times at most, so this is a bound
 * on a pathological interleaving rather than a retry policy.
 */
const METADATA_EDIT_ATTEMPTS = 3;

/**
 * A caller's metadata without the reserved keys.
 *
 * @param metadata What the caller stated.
 * @returns The caller's own keys.
 */
export function callerMetadataOf(metadata: unknown): Record<string, unknown> {
	if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(metadata as Record<string, unknown>).filter(([key]) => !RESERVED_SUBSCRIPTION_METADATA_KEYS.includes(key))
	);
}

/**
 * The reserved keys a stored subscription carries.
 *
 * @param metadata The stored metadata.
 * @returns The service's own keys, as stored.
 */
function reservedMetadataOf(metadata: unknown): Record<string, unknown> {
	if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(metadata as Record<string, unknown>).filter(([key]) => RESERVED_SUBSCRIPTION_METADATA_KEYS.includes(key))
	);
}

/**
 * @param error What a versioned write raised.
 * @returns True when it is the conflict of a row that moved on, rather than any other failure.
 */
function isVersionConflict(error: unknown): boolean {
	return (error as { code?: unknown } | null)?.code === ApiErrorCode.ENTITY_VERSION_CONFLICT;
}

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
export class SubscriptionService extends SubscriptionCrudService<Subscription> {
	private readonly logger = new Logger(SubscriptionService.name);

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
	 * Refuses a subscription, or a change to one, that names a customer, order, account holder or payment method of
	 * another tenant (`subscription.references.ts`). Checked on the TypeORM manager, which reads these tables under
	 * either ORM.
	 *
	 * @param payload The subscription, or the change set, about to be written.
	 * @throws ForbiddenException when a reference names a row of another tenant.
	 */
	private async assertReferences(payload: object): Promise<void> {
		await assertPlainReferencesNotForeign(
			this.typeOrmSubscriptionRepository.manager,
			payload,
			SUBSCRIPTION_REFERENCES,
			RequestContext.currentTenantId()
		);
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
		const writesMetadata = !!changes && (changes as Record<string, unknown>)['metadata'] !== undefined;

		// A payer of another tenant is refused before anything is read (`subscription.references.ts`).
		await this.assertReferences(changes ?? {});

		for (let attempt = 1; ; attempt += 1) {
			// The edit moves the payer, the quantity and the metadata only (review R4-07): the lifecycle moves through
			// pause, resume, cancel and expire, the plan through the plan change, and the billing schedule through the
			// billing run. `PUT /subscriptions/:id {status:"ACTIVE", nextBillingAt:…}` reactivated a cancelled
			// subscription for the next run to charge; the GraphQL input never admitted those members.
			// A subscription that is not the caller's is left to the conditional write below, which answers it as before.
			const stored = await this.findOneDetailed(id).catch((error) => {
				if (error instanceof NotFoundException) return null;
				throw error;
			});
			const moved = stored
				? movedReadOnlyMembers(
						stored as unknown as Record<string, unknown>,
						(changes ?? {}) as Record<string, unknown>,
						SUBSCRIPTION_WRITABLE_MEMBERS
					)
				: [];

			if (moved.length > 0) {
				throw notWritable(
					'SUBSCRIPTION_FIELD_NOT_WRITABLE',
					`${moved.join(', ')} of subscription '${id}' ${moved.length === 1 ? 'is' : 'are'} moved by its lifecycle ` +
						`(pause, resume, cancel, expire, the plan change and the billing run), not by an edit.`,
					{ subscriptionId: id, fields: moved, writable: SUBSCRIPTION_WRITABLE_MEMBERS }
				);
			}

			let patch = changes as Record<string, unknown>;
			let predicate = expectation;

			if (writesMetadata) {
				// The metadata an edit writes is the caller's own keys plus the reserved ones as stored (SEC-B-03): the
				// edit replaces the column, so the stored credit, setup-fee record and trial end are carried over, and
				// whatever the caller stated under a reserved key is dropped.
				patch = {
					...patch,
					metadata: { ...callerMetadataOf(patch['metadata']), ...reservedMetadataOf(stored?.metadata) }
				};
				// Those reserved keys are the read's, so the write is predicated on the version the read saw. Predicated
				// on whatever version the row holds when the statement runs (`If-Match: *`, or no caller), it wrote a
				// billing pass's consumed `pendingCredit` back after the pass cleared it, and the next cycle applied the
				// credit again (Greptile, CodeRabbit).
				predicate = stored ? this.readVersionPredicate(stored, expectation) : expectation;
			}

			try {
				await commitVersionedUpdate<Subscription>(this, {
					where: currentScope(),
					id,
					expectation: predicate,
					// The version is written by the conditional update and never by the caller's payload, so a body
					// that named one cannot move the row past the version the write was predicated on.
					// Only the writable members are written: a restated lifecycle member was checked above and is not
					// echoed back over a cancellation that lands between the check and this statement.
					patch: writableOnly(patch, SUBSCRIPTION_WRITABLE_MEMBERS) as Record<string, unknown> &
						Partial<Subscription>
				});
			} catch (error) {
				// The row moved on between the read and the write. The next read rebuilds the merge from the row as it
				// now stands, and answers the conflict itself when the caller's expectation no longer accepts it.
				if (predicate !== expectation && attempt < METADATA_EDIT_ATTEMPTS && isVersionConflict(error)) {
					continue;
				}

				throw error;
			}

			return await this.findOneDetailed(id);
		}
	}

	/**
	 * The version an edit built from a read of the subscription is predicated on: the one that read saw, provided the
	 * caller accepts it.
	 *
	 * The caller's own precondition is kept: a stated version the read does not hold is refused with the conflict the
	 * write would have answered — including one ahead of the read, which a write predicated on the caller's version
	 * would otherwise land with the read's stale metadata. A wildcard, and a list naming the version the read holds,
	 * narrow to that version.
	 *
	 * @param stored The subscription as read.
	 * @param expectation What the caller accepted.
	 * @returns The expectation the write is predicated on.
	 * @throws ApiException with `ENTITY_VERSION_CONFLICT` when the caller does not accept the version read.
	 */
	private readVersionPredicate(stored: Subscription, expectation: IVersionExpectation): IVersionExpectation {
		const read = parseEntityVersion((stored as unknown as Record<string, unknown>)['version']);

		if (read === null) {
			return expectation;
		}

		if (!matchesExpectation(expectation, read)) {
			throw new ApiException(
				409,
				ApiErrorCode.ENTITY_VERSION_CONFLICT,
				'The record changed since you read it. Read it again and reapply your change.',
				{ expectedVersion: expectation.versions?.[0], actualVersion: read }
			);
		}

		return { ...expectation, wildcard: false, versions: [read] };
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

		// The customer, the order and the payer are written as given: none of another tenant.
		await this.assertReferences(input);

		if (input.originOrderId) {
			const existing = await this.typeOrmSubscriptionRepository.findOne({
				where: { originOrderId: input.originOrderId, ...currentScope() }
			});

			if (existing) {
				return await this.findOneDetailed(existing.id);
			}
		}

		const plan = await this.planService.assertSubscribable(input.planId);
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

		// A stated discount is a fraction between 0 and 1, as a plan's is (SEC-B-03): `"2"` made the net negative.
		let discountOverride: string | undefined;
		try {
			discountOverride = normalizeDiscountFraction(input.discountPercentage as DecimalString | number | undefined);
		} catch (error) {
			throw new BadRequestException((error as Error).message);
		}

		const metadata: Record<string, unknown> = {
			...callerMetadataOf(input.metadata),
			...(trialDays > 0 ? { [TRIAL_ENDS_AT]: period.end.toISOString() } : {}),
			...(discountOverride !== undefined ? { [DISCOUNT_OVERRIDE]: discountOverride } : {})
		};

		const created = await this.typeOrmSubscriptionRepository.manager.transaction(async (manager) => {
			// The plan row in share mode until this commits (`lockPlanRow`): a plan update waits for it and then counts
			// this subscription, and an update that committed first is seen here, so the subscription never starts on a
			// plan that was deactivated or re-priced in another currency after the checks above.
			await lockPlanRow(manager, plan.id, 'share');
			const current = await manager.findOne(SubscriptionPlan, { where: { id: plan.id } });
			if (!current || current.isActive === false) {
				throw new BadRequestException(
					`SUBSCRIPTION_PLAN_INACTIVE: the plan "${plan.code}" is not active, so no new subscription may be created from it.`
				);
			}
			if (current.currency && currency && current.currency !== currency) {
				throw new BadRequestException(
					`SUBSCRIPTION_CURRENCY_MISMATCH: the plan is priced in ${current.currency} and the request states ${currency}.`
				);
			}

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
					// The next period a billing run bills is the one starting at `nextBillingAt`
					// (`billCycle`). Without a trial that is the opening period itself, whose cycle row is
					// written below: it was `period.end`, so the first run billed the second period and the
					// opening cycle stayed `PENDING` for good — the first period of every subscription was
					// free, and its setup fee landed on the second. A trial is different: its own period is
					// waived, and the first paid period is the one starting when the trial ends.
					nextBillingAt: trialDays > 0 ? period.end : period.start,
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
			const { discount, net } = applyRecurringDiscount(gross, this.discountOf(plan, discountOverride));
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
	 * That period is the first one billed: `nextBillingAt` is its **start**, so the next billing run
	 * bills it (or, when it starts at a trial's end, bills it once the trial is over). It was the
	 * period's end, which made the first run bill the second period and left the first one free. The
	 * cycle row written at creation for the period the subscription would have started with moves to
	 * the activation's period, so it is the row that run settles rather than a `PENDING` cycle nothing
	 * ever bills. Activating does not charge anybody itself: billing stays with the billing run and the
	 * permission that drives it.
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

		// One transaction, the claim first. The claim is the subscription's versioned write, predicated on
		// the row still being `PENDING`: its UPDATE takes the row lock, so a second activation that read
		// `PENDING` too waits on it and, once this one commits, matches nothing and is refused — before it
		// has moved anything. The opening cycle moves inside the same transaction, so no billing run sees
		// the subscription `ACTIVE` before its cycle is on the period the activation starts (a run that
		// reached it first would open its own row for that period, and the cycle could not follow), and a
		// refused claim leaves the cycle where the winner put it.
		await this.typeOrmSubscriptionRepository.manager.transaction(async (manager) => {
			// Read before the claim, which rewrites the period the opening cycle is found by.
			const opening = await this.openingCycleOn(subscription, manager);

			await commitVersionedUpdate<Subscription>(this.transactionWriter(manager), {
				where: { ...currentScope(), status: SubscriptionStatus.PENDING },
				id,
				expectation,
				patch: {
					status: SubscriptionStatus.ACTIVE,
					currentPeriodStart: period.start,
					currentPeriodEnd: period.end,
					nextBillingAt: period.start
				}
			});

			await this.moveOpeningCycle(subscription, opening, period, manager);
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
			where: currentScope(),
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
	 * paid for, so a pause never refunds time and never charges twice for it. An opening period that
	 * was never billed was not paid for: it starts again at the resume, as an activation's does, and its
	 * cycle moves with it, so the first run bills it instead of the period after it.
	 *
	 * @param id The subscription to resume.
	 * @param at The instant to resume at; defaults to now, and is used by the billing run when a
	 * scheduled pause ends.
	 * @param expectation The version the caller read the subscription at.
	 * @returns The resumed subscription.
	 * @throws BadRequestException when it is not paused.
	 */
	public async resume(id: ID, at?: Date, expectation: IVersionExpectation = ANY_VERSION): Promise<Subscription> {
		const now = at ?? new Date();

		// The calendar a resume writes is decided from the subscription as read, so the write is predicated on the version
		// it was read at (Copilot): predicated on whatever version the row holds when its statement runs, a resume that
		// read the calendar on a cycle being charged wrote that instant back over the calendar the cycle's finish had
		// moved meanwhile, and the next pass finished the cycle a second time. On that conflict the row is read again and
		// the calendar decided again.
		for (let attempt = 1; ; attempt += 1) {
			const subscription = await this.findOneScoped(id);

			this.assertStatus(subscription, [SubscriptionStatus.PAUSED], 'resume');

			try {
				const nextBillingAt = await this.resumeAsRead(subscription, now, this.readVersionPredicate(subscription, expectation));

				await this.emit('subscription.resumed', id, { subscriptionId: id, resumedAt: now, nextBillingAt });

				return await this.findOneScoped(id);
			} catch (error) {
				if (expectation.wildcard && attempt < METADATA_EDIT_ATTEMPTS && isVersionConflict(error)) {
					continue;
				}

				throw error;
			}
		}
	}

	/**
	 * Writes the resume of a paused subscription, decided from the subscription as read.
	 *
	 * @param subscription The subscription, as read.
	 * @param now The instant it resumes at.
	 * @param expectation The version the decision was read at, which the write is predicated on.
	 * @returns The next billing instant the resume wrote.
	 */
	private async resumeAsRead(subscription: Subscription, now: Date, expectation: IVersionExpectation): Promise<Date> {
		const id = subscription.id;

		if (this.owesOpeningPeriod(subscription)) {
			const plan = await this.planService.findOneScoped(subscription.planId);
			const cadence = this.planService.cadenceOf(plan);
			let nextBillingAt = now;
			// A charge still running has not recorded its order or attempt yet, so its cycle reads untouched;
			// the billing claim it holds on the period is what shows it. Read before the transaction (whose
			// connection a second read would otherwise wait on): no pass starts on a paused subscription, so
			// a pass that holds the claim now began before the pause.
			const charging = await this.chargeInFlight(subscription);

			// One transaction, as in `activate`: no run sees the subscription `ACTIVE` before its opening
			// cycle is on the period it now starts, and a refused claim moves nothing. While it is paused no
			// run touches the cycle, so it is read first and decides what the resume writes.
			await this.typeOrmSubscriptionRepository.manager.transaction(async (manager) => {
				const opening = await this.openingCycleOn(subscription, manager);
				const resumed = this.resumedCalendar(subscription, now, cadence, opening, charging);

				nextBillingAt = resumed.nextBillingAt;

				await commitVersionedUpdate<Subscription>(this.transactionWriter(manager), {
					where: { ...currentScope(), status: SubscriptionStatus.PAUSED },
					id,
					expectation,
					patch: resumed.restart
						? {
								status: SubscriptionStatus.ACTIVE,
								pausedUntil: null,
								currentPeriodStart: resumed.restart.start,
								currentPeriodEnd: resumed.restart.end,
								nextBillingAt: resumed.restart.start
						  }
						: { status: SubscriptionStatus.ACTIVE, pausedUntil: null, nextBillingAt }
				});

				if (resumed.restart) {
					await this.moveOpeningCycle(subscription, opening, resumed.restart, manager);
				}
			});

			return nextBillingAt;
		}

		// An invoice still waiting for its payment keeps the subscription on its period (Q7-W4): resuming past it
		// would start a new period over the invoiced one, and bill the customer twice for the same time. So does a
		// charge of that period a pass has started or recorded and not finished (`calendarHeldByCycle`).
		const nextBillingAt = (await this.calendarHeldByCycle(subscription))
			? new Date(subscription.nextBillingAt as Date)
			: resumedNextBillingAt(subscription.currentPeriodEnd, now);

		await commitVersionedUpdate<Subscription>(this, {
			where: currentScope(),
			id,
			expectation,
			patch: {
				status: SubscriptionStatus.ACTIVE,
				pausedUntil: null,
				nextBillingAt
			}
		});

		return nextBillingAt;
	}

	/**
	 * Whether the subscription's current period is its opening one and nothing has billed it yet: it was
	 * never billed, and the next run bills the current period (from its start) rather than the one after it.
	 *
	 * @param subscription The subscription, as read.
	 * @returns True when the opening period is still owed.
	 */
	private owesOpeningPeriod(subscription: Subscription): boolean {
		if ((subscription.billingCycleCount ?? 0) > 0 || !subscription.nextBillingAt || !subscription.currentPeriodStart) {
			return false;
		}

		return new Date(subscription.nextBillingAt).getTime() <= new Date(subscription.currentPeriodStart).getTime();
	}

	/**
	 * The calendar a paused subscription resumes onto: the one rule `resume` writes and the upcoming-billing
	 * preview reads, so the preview cannot name a period the resume would not bill.
	 *
	 * Only a subscription that still owes its opening period is decided here; any other resumes onto
	 * `resumedNextBillingAt`. An untouched opening cycle restarts with the period. A settled one (paid, or waived) is a
	 * period already answered: like any paid period, it runs out before the next run bills. Any other was charged and
	 * awaits a retry: it keeps its period and its retry schedule — it cannot move (it records an attempt), and starting
	 * another period would leave it behind and open a new cycle that skips its retries — so resuming only lifts the
	 * pause. Moving the cycle of a running charge would let the returning charge settle a cycle on another period, so
	 * the period stays, as for a retry.
	 *
	 * @param subscription The paused subscription, as read; it owes its opening period.
	 * @param at The instant it resumes.
	 * @param cadence Its plan's period and interval.
	 * @param opening The cycle written for its current period, or null when the period has none.
	 * @param charging Whether a billing pass holds the claim on its current period.
	 * @returns The period the opening cycle restarts on (`restart`, null when it stays), and the next billing instant.
	 */
	private resumedCalendar(
		subscription: Subscription,
		at: Date,
		cadence: ISubscriptionCadence,
		opening: SubscriptionBilling | null,
		charging: boolean
	): { restart: ISubscriptionPeriod | null; nextBillingAt: Date } {
		const opened = new Date(subscription.currentPeriodStart as Date);

		if ((!opening || this.isUntouched(opening)) && !charging) {
			const period = periodFrom(at.getTime() > opened.getTime() ? at : opened, cadence);

			return { restart: period, nextBillingAt: period.start };
		}

		if (opening && (this.billingService.holdsDeferredCalendar(opening) || this.heldByCharge(opening))) {
			// Invoiced and waiting for its payment (Q7-W4): the period stays open, and its payment moves the calendar.
			// A cycle already paid whose payment was interrupted before it moved the calendar still holds it, and is
			// kept just the same: its retry is what moves the calendar. So does a charge of the opening period that is
			// under way, or recorded and not finished: the finish moves the calendar onto it (`finishCycle`).
			return { restart: null, nextBillingAt: new Date(subscription.nextBillingAt as Date) };
		}

		if (opening && RAISED_CYCLE_STATUSES.includes(opening.status)) {
			const periodEnd = new Date(subscription.currentPeriodEnd as Date);

			return { restart: null, nextBillingAt: periodEnd.getTime() > at.getTime() ? periodEnd : at };
		}

		return { restart: null, nextBillingAt: new Date(subscription.nextBillingAt as Date) };
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
			where: currentScope(),
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
					...(deferred ? { [CANCEL_AT_PERIOD_END]: true } : {})
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
	 * Withdraws a cancellation at the end of the period, so the subscription keeps billing (Q16 4).
	 *
	 * `cancel({ immediate: false })` leaves an active subscription running to the end of the period it paid for and
	 * records `cancelAtPeriodEnd`, which the billing run acts on. That key is the service's own (SEC-B-03, #10655): a
	 * caller's metadata can neither set nor erase it, so before this action a customer who changed their mind had no
	 * way back short of letting the subscription end and creating another. This clears the key and the cancellation
	 * it recorded (`canceledAt`, `cancelReason`); the period, the next billing instant and the rights stay as they
	 * were, because a deferred cancellation never moved them.
	 *
	 * A live subscription with no deferred cancellation is returned as it stands — the outcome the caller wanted has
	 * already happened. A cancellation that already took effect is not undone: the subscription is reactivated as a
	 * new one. The write is predicated on the version the read saw, so a billing run that ends the period between the
	 * read and the write is not overwritten: the action re-reads, finds the subscription cancelled and refuses.
	 *
	 * @param id The subscription.
	 * @param expectation The version the caller read the subscription at.
	 * @returns The subscription, billing on.
	 * @throws BadRequestException when the subscription is already cancelled or expired.
	 */
	public async undoCancellation(id: ID, expectation: IVersionExpectation = ANY_VERSION): Promise<Subscription> {
		for (let attempt = 1; ; attempt += 1) {
			const subscription = await this.findOneScoped(id);

			this.assertLive(subscription);

			if (subscription.metadata?.[CANCEL_AT_PERIOD_END] !== true) {
				return subscription;
			}

			const predicate = this.readVersionPredicate(subscription, expectation);
			const metadata = Object.fromEntries(
				Object.entries(subscription.metadata ?? {}).filter(([key]) => key !== CANCEL_AT_PERIOD_END)
			);

			try {
				await commitVersionedUpdate<Subscription>(this, {
					where: currentScope(),
					id,
					expectation: predicate,
					patch: {
						canceledAt: null,
						cancelReason: null,
						metadata
					}
				});
			} catch (error) {
				// The row moved on between the read and the write — a billing pass, or another edit. The next read
				// decides again from the row as it now stands.
				if (predicate !== expectation && attempt < METADATA_EDIT_ATTEMPTS && isVersionConflict(error)) {
					continue;
				}

				throw error;
			}

			await this.emit('subscription.cancellation-undone', id, {
				subscriptionId: id,
				undoneAt: new Date(),
				undoneBy: RequestContext.currentUserId(),
				currentPeriodEnd: subscription.currentPeriodEnd ?? null,
				nextBillingAt: subscription.nextBillingAt ?? null
			});

			return await this.findOneScoped(id);
		}
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
			where: currentScope(),
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

		const plan = await this.planService.assertSubscribable(input.planId);

		// A subscription is billed in its plan's currency (`POST /subscriptions` refuses another, and a plan with live
		// subscriptions may not change it): its lines, prorations and carried credits are priced in it, so it moves
		// only to a plan priced in the same one.
		if (plan.currency && plan.currency !== subscription.currency) {
			throw new BadRequestException(
				`SUBSCRIPTION_CURRENCY_MISMATCH: the plan is priced in ${plan.currency} and the subscription is billed in ${subscription.currency}.`
			);
		}

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

		for (let attempt = 1; subscription.metadata?.[CANCEL_AT_PERIOD_END] === true; attempt += 1) {
			const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : now;

			if (periodEnd.getTime() > now.getTime()) {
				break;
			}

			// The cancellation is predicated on the version that showed the marker (Greptile on #10862). Predicated on
			// whatever version the row holds when its statement runs, it landed after an `undoCancellation` that had
			// cleared the marker in between — the customer was told the cancellation was withdrawn and still lost the
			// subscription. On that conflict the row is read again and decided again: an undone cancellation is billed.
			const stated = spend();

			try {
				const canceled = await this.cancel(
					id,
					{
						reason: subscription.cancelReason ?? 'Cancelled at the end of the period.',
						immediate: true
					},
					this.readVersionPredicate(subscription, stated)
				);

				return this.outcome(canceled, {
					status: SubscriptionBillingStatus.PENDING,
					replayed: false,
					message: 'The subscription was cancelled at the end of the period it had already paid for.'
				});
			} catch (error) {
				if (stated.wildcard && attempt < METADATA_EDIT_ATTEMPTS && isVersionConflict(error)) {
					subscription = await this.findOneScoped(id);
					continue;
				}

				throw error;
			}
		}

		if ([SubscriptionStatus.CANCELED, SubscriptionStatus.EXPIRED].includes(subscription.status)) {
			// Read again above and found ended by another writer meanwhile: nothing is billed.
			return this.outcome(subscription, {
				status: SubscriptionBillingStatus.PENDING,
				replayed: false,
				message: `A subscription in status "${subscription.status}" is not billed.`
			});
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

		const period = nextCyclePeriod(subscription, cadence, now);
		const key = `${subscription.id}:${period.start.toISOString()}`;

		const claim = await this.idempotencyService.claim({
			scope: BILLING_SCOPE,
			key,
			requestHash: this.hash({ subscriptionId: subscription.id, periodStart: period.start.toISOString(), amount: 'period' }),
			resourceType: 'subscription_billing'
		});

		if (claim.outcome === IdempotencyOutcome.REPLAYED) {
			// A key completed on a cycle the run charged but never finished — a build before this one replayed such a
			// cycle as settled — leaves the subscription on that cycle's period for good, and every pass replays the key.
			// The finish is once-only on its own (`finishCycle`), so it is run here without the key, charging nothing.
			const charged = await this.billingService.findByPeriod(subscription.id, period.start);

			if (charged && this.leftUnfinished(charged)) {
				return await this.finishCycle(subscription.id, charged.id, await this.owedBookkeepingOf(charged), {
					expectation: spend(),
					replayed: true
				});
			}

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

		if (RAISED_CYCLE_STATUSES.includes(outcome.status)) {
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
	 * Previews the next billing of one subscription, writing nothing.
	 *
	 * The amount is the one `billCycle` would bill, because it is computed by the same function —
	 * `priceCycle`, over the same recurring lines, currency and discount rule — and the period is the
	 * same one, because it is derived by the same functions from the calendar the cycle would see:
	 * `nextCyclePeriod`, and for a paused subscription the rule `resume` writes (`resumedNextBillingAt`,
	 * or `resumedCalendar` while its opening period is owed). Nothing is claimed, created, appended or
	 * emitted: no idempotency key, no billing row, no adjustment, no order and no event, so asking costs
	 * nothing and changes nothing.
	 *
	 * Only what a billing run bills has an upcoming billing: the run takes an active subscription when its
	 * billing instant comes, a paused one when its pause runs out, and a pending one inside its trial when
	 * the trial ends (`findDue`). A cancelled, expired or failed subscription, a pending one nobody has
	 * activated, and an indefinite pause answer null. The cycle's own gates are then read at the instant
	 * the run would bill it rather than acted on: one whose plan's cycle ceiling is reached, one cancelled
	 * at the end of a period that has ended by then, and one whose period is already settled bill nothing,
	 * and the answer is null. A period whose charge failed is billed when the dunning schedule's next
	 * attempt comes, not before (`executeCycle` waits for the cycle row's `nextRetryAt`), so that attempt is
	 * the instant the gates are read at and the billing instant answered; once the schedule is spent the
	 * subscription is `FAILED`, no run takes it, and the answer is null. A subscription with no recurring
	 * lines is refused exactly as `billCycle` refuses it.
	 *
	 * @param id The subscription.
	 * @param now The instant the question is asked.
	 * @returns The next billing, or null when the subscription will not bill again as it stands.
	 * @throws NotFoundException when the subscription is not the caller's.
	 * @throws BadRequestException when it has no recurring lines to price.
	 */
	public async previewNextBilling(id: ID, now: Date = new Date()): Promise<ISubscriptionUpcomingBilling | null> {
		const subscription = await this.findOneScoped(id);
		const paused = subscription.status === SubscriptionStatus.PAUSED;
		const billable =
			subscription.status === SubscriptionStatus.ACTIVE ||
			(paused && !!subscription.pausedUntil) ||
			(subscription.status === SubscriptionStatus.PENDING && !!this.trialEndOf(subscription));

		if (!billable || (!paused && !subscription.nextBillingAt)) {
			return null;
		}

		const plan = await this.planService.findOneScoped(subscription.planId);
		const cadence = this.planService.cadenceOf(plan);
		// The run bills it when its billing instant (or the end of its pause) comes, or at once when that has passed.
		const due = new Date((paused ? subscription.pausedUntil : subscription.nextBillingAt) as Date);
		let runsAt = due.getTime() > now.getTime() ? due : now;
		let calendar: { nextBillingAt?: Date | null; currentPeriodEnd?: Date | null } = subscription;

		if (paused) {
			// The cycle resumes it first, and bills the calendar the resume writes.
			if (this.owesOpeningPeriod(subscription)) {
				const charging = await this.chargeInFlight(subscription);
				const opening = await this.billingService.findByPeriod(
					subscription.id,
					new Date(subscription.currentPeriodStart)
				);
				const resumed = this.resumedCalendar(subscription, runsAt, cadence, opening, charging);

				calendar = {
					nextBillingAt: resumed.nextBillingAt,
					currentPeriodEnd: resumed.restart?.end ?? subscription.currentPeriodEnd
				};
			} else {
				calendar = {
					nextBillingAt: (await this.calendarHeldByCycle(subscription))
						? new Date(subscription.nextBillingAt as Date)
						: resumedNextBillingAt(subscription.currentPeriodEnd, runsAt),
					currentPeriodEnd: subscription.currentPeriodEnd
				};
			}
		}

		const period = nextCyclePeriod(calendar, cadence, runsAt);
		const existing = await this.billingService.findByPeriod(subscription.id, period.start);
		const settled = !!existing && RAISED_CYCLE_STATUSES.includes(existing.status);
		// A charge of this period that failed and awaits the dunning schedule's next attempt: no run charges the
		// period before that attempt (`executeCycle`), so it is billed at the retry, and every gate below is read
		// there. A spent schedule never reaches this: the last failure moved the subscription to `FAILED`.
		const retryAt = !settled && existing?.nextRetryAt ? new Date(existing.nextRetryAt) : null;

		if (retryAt && retryAt.getTime() > runsAt.getTime()) {
			runsAt = retryAt;
		}

		if (subscription.metadata?.[CANCEL_AT_PERIOD_END] === true) {
			// `billCycle` cancels instead of billing when the period it was cancelled at has ended by the time it runs.
			const periodEnd = calendar.currentPeriodEnd ? new Date(calendar.currentPeriodEnd) : runsAt;

			if (periodEnd.getTime() <= runsAt.getTime()) {
				return null;
			}
		}

		if (
			plan.maxBillingCycles !== undefined &&
			plan.maxBillingCycles !== null &&
			subscription.billingCycleCount >= plan.maxBillingCycles
		) {
			return null;
		}

		const items = await this.itemService.findForSubscription(subscription.id);

		if (!items.length) {
			throw new BadRequestException(
				'SUBSCRIPTION_ITEMS_REQUIRED: this subscription has no recurring lines, so its cycle cannot be priced.'
			);
		}

		if (settled) {
			// The cycle answers a settled period with the row it already has, and bills nothing.
			return null;
		}

		// A retry prices the lines as they stand when it runs, exactly as a first attempt does, rather than
		// charging what the failed attempt recorded — so the preview prices them now, with the same function.
		const { net } = priceCycle({ items, currency: subscription.currency, plan, metadata: subscription.metadata });

		return {
			subscriptionId: subscription.id,
			amount: net.toStorageString(),
			currency: subscription.currency,
			periodStart: period.start,
			periodEnd: period.end,
			nextBillingAt: retryAt ?? period.start
		};
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
	 * **A subscription inside its trial is `PENDING`, and it is selected here.** It was not, and the
	 * consequence was that no trial ever converted: `createSubscription` puts a trialing subscription
	 * into `PENDING` — the status's own comment says that is what it covers — with `nextBillingAt` set
	 * to the trial's end. The pass scanned `ACTIVE` and `PAUSED` only, so the instant the trial ran out
	 * passed unnoticed, the trial ran on indefinitely and nothing was ever charged, in every tenant,
	 * until a human called the activate endpoint for each one. `billCycle` needs no special case for
	 * it: the period it bills starts at `nextBillingAt`, which is exactly the trial's end, and
	 * `finishCycle` is what moves the row to `ACTIVE` — so the trial's last instant and the first paid
	 * period's first instant are the same instant, with no free interval between them.
	 *
	 * A `PENDING` subscription that is **not** in a trial is one nobody has activated yet, and it stays
	 * where it is: `nextBillingAt` on such a row is a period boundary that was never bought, and billing
	 * it would charge a customer who never started. The trial end recorded at creation is what tells the
	 * two apart.
	 *
	 * **A subscription whose calendar waits on an open invoice is not selected (Q7-W4).** It stays on the invoiced
	 * period, so its billing instant stays in the past until the payment moves it, and every pass would only replay
	 * that invoice for it (`dueOf`).
	 *
	 * @param now The instant to compare against.
	 * @param limit How many subscriptions one pass may take.
	 * @returns The subscriptions, oldest billing instant first.
	 */
	public async findDue(now: Date, limit: number = 200): Promise<Subscription[]> {
		const scope = currentScope();

		const active = await this.dueOf(SubscriptionStatus.ACTIVE, now, limit);

		const paused = await this.typeOrmSubscriptionRepository.find({
			where: { ...scope, status: SubscriptionStatus.PAUSED },
			order: { pausedUntil: 'ASC' },
			take: limit
		});

		// The trial's end is carried in `metadata`, which is a JSON column no dialect narrows the same
		// way, so the status is narrowed in SQL and the trial is recognised in memory. A tenant holds
		// tens of pending rows per page, not thousands.
		const pending = await this.dueOf(
			SubscriptionStatus.PENDING,
			now,
			limit,
			(subscription) => !!this.trialEndOf(subscription)
		);

		return [...active, ...paused, ...pending]
			.filter((subscription) => {
				const due =
					subscription.status === SubscriptionStatus.PAUSED
						? subscription.pausedUntil
						: subscription.nextBillingAt;

				return due ? new Date(due).getTime() <= now.getTime() : false;
			})
			.sort(
				(left, right) =>
					new Date(left.nextBillingAt ?? left.pausedUntil).getTime() -
					new Date(right.nextBillingAt ?? right.pausedUntil).getTime()
			)
			.slice(0, limit);
	}

	/**
	 * Reads the subscriptions of one status whose billing instant has passed, oldest first, page by page until a
	 * pass's worth is found.
	 *
	 * Q7-W4: a subscription whose calendar waits on an invoice nobody has paid keeps that invoice's period, so its
	 * billing instant stays in the past until the payment moves it. Read oldest first and cut at the pass's limit,
	 * those subscriptions took every slot — each of them only replays its open invoice — and a subscription due on
	 * time behind them was never billed (CodeRabbit). They are left out here, before the limit is applied; the
	 * payment is what bills them on (`payCycle`). One that still has something for the pass to do — a cancellation at
	 * the end of its period — is kept.
	 *
	 * @param status The status to read.
	 * @param now The instant to compare against.
	 * @param limit How many subscriptions one pass may take, which is also the size of each page read.
	 * @param accept Which of the rows read the pass bills at all (a pending subscription only inside its trial).
	 * @returns Up to `limit` subscriptions.
	 */
	private async dueOf(
		status: SubscriptionStatus,
		now: Date,
		limit: number,
		accept: (subscription: Subscription) => boolean = () => true
	): Promise<Subscription[]> {
		const due: Subscription[] = [];

		for (let skip = 0; due.length < limit; skip += limit) {
			const page = await this.typeOrmSubscriptionRepository.find({
				where: { ...currentScope(), status, nextBillingAt: LessThanOrEqual(now) },
				order: { nextBillingAt: 'ASC', id: 'ASC' },
				skip,
				take: limit
			});
			const accepted = page.filter(accept);
			const held = await this.heldByOpenInvoice(accepted);

			due.push(...accepted.filter((subscription) => !held.has(String(subscription.id))));

			if (page.length < limit) {
				break;
			}
		}

		return due.slice(0, limit);
	}

	/**
	 * The subscriptions, of those given, that a billing pass would only replay an open invoice for (Q7-W4): the cycle
	 * at the subscription's billing instant is invoiced and holds the calendar, and no cancellation at the end of the
	 * period is waiting to be carried out.
	 *
	 * @param subscriptions The subscriptions, as read.
	 * @returns Their ids.
	 */
	private async heldByOpenInvoice(subscriptions: Subscription[]): Promise<Set<string>> {
		const candidates = subscriptions.filter(
			(subscription) => !!subscription.nextBillingAt && subscription.metadata?.[CANCEL_AT_PERIOD_END] !== true
		);
		const held = new Set<string>();

		if (!candidates.length) {
			return held;
		}

		const invoiced = await this.billingService.findInvoicedFor(candidates.map((subscription) => subscription.id));

		for (const subscription of candidates) {
			const open = invoiced.find(
				(cycle) =>
					String(cycle.subscriptionId) === String(subscription.id) &&
					new Date(cycle.periodStart).getTime() === new Date(subscription.nextBillingAt as Date).getTime()
			);

			if (open && this.billingService.holdsDeferredCalendar(open)) {
				held.add(String(subscription.id));
			}
		}

		return held;
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

		if (existing && RAISED_CYCLE_STATUSES.includes(existing.status)) {
			// The period is settled. Recomputing it would be a second answer to a question the row has
			// already answered, and acting on that answer is how a customer is charged twice.
			if (this.leftUnfinished(existing)) {
				// The run charged it and the pass that did was cut off before the cycle was finished: what is left is
				// done from the row, charging nothing.
				return await this.finishCycle(subscription.id, existing.id, await this.owedBookkeepingOf(existing), {
					expectation,
					replayed: true
				});
			}

			return this.raisedCycleOutcome(subscription, existing);
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

		// The one computation of a cycle's amount, which the upcoming-billing preview calls as well.
		const { gross, discount, net } = priceCycle({
			items,
			currency: subscription.currency,
			plan,
			metadata: subscription.metadata
		});

		// The subscription is written by whichever of the two writes below runs first — the failure the dunning schedule
		// records, or the finish of a charged cycle — so the caller's version is handed to the writes rather than to the
		// calls, and a path that writes nothing does not spend it.
		const spend = spendableExpectation(expectation);

		const opened =
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

		// The charge is claimed on the cycle before anything is charged, and while the order path is called the claim is
		// what an operator's `pay` or `waive` meets (`SubscriptionBillingService.claimCharge`). One conditional statement
		// takes it, so no row lock is held across the external call.
		const claim = await this.billingService.claimCharge(opened.id);

		if (!claim.token) {
			return this.unclaimedCycleOutcome(subscription, claim.billing);
		}

		// The claimed row is the one charged: a pass that recovered a stale claim reads the attempt count the earlier
		// call left, so it calls the order path under that call's attempt key and the order path's own idempotency says
		// what the call did.
		const billing = claim.billing;
		let stillFenced = false;
		// A takeover of an attempt whose outcome was never recorded resends that attempt's frozen request
		// (`raiseCycleOrder`), whose adjustments the attempt wrote before it froze it: none is written from the
		// subscription as it now stands, or the cycle would record a discount or a credit its order never granted.
		const replaying = !!this.billingService.frozenAttemptOf(billing, (billing.attemptCount ?? 0) + 1);

		try {
			if (discount.isPositive() && !replaying) {
				await this.appendDiscount(billing, subscription, discount);
			}

			const credit = replaying ? null : await this.consumePendingCredit(subscription, billing);
			const bookkeeping = this.cycleBookkeepingFor(subscription, plan, credit);

			const raised = await this.raiseCycleOrder(
				subscription,
				plan,
				items,
				billing,
				period,
				net,
				credit,
				discount,
				bookkeeping,
				claim.token
			);
			const failure = raised.failure;

			if (failure?.code === ORDER_ATTEMPT_IN_FLIGHT) {
				// An earlier call is still charging this attempt, and the order path still fences it. This pass records
				// nothing and keeps its claim, so the cycle stays fenced against an operator for as long as the order path
				// fences the call; that call's outcome ends the claim, or the claim goes stale and the next pass recovers it.
				stillFenced = true;

				return this.unclaimedCycleOutcome(subscription, billing);
			}

			if (failure?.code === CHARGE_CLAIM_LOST) {
				// The charge outlived its claim and another pass holds the cycle; that pass records it.
				return this.unclaimedCycleOutcome(subscription, await this.billingService.findOneScoped(billing.id));
			}

			if (failure) {
				return await this.recordFailure(subscription, billing, failure, now, spend(), claim.token);
			}

			// The bookkeeping the order was raised with is handed over as well as recorded on the row: a cycle an operator
			// settled while the charge was in flight kept the operator's record, without it.
			return await this.finishCycle(subscription.id, billing.id, raised.bookkeeping, {
				expectation: spend(),
				replayed: false
			});
		} finally {
			if (!stillFenced) {
				await this.endChargeClaim(billing, claim.token);
			}
		}
	}

	/**
	 * Ends a cycle's charge claim once the attempt that took it is over.
	 *
	 * The write that recorded the attempt's outcome has ended it already, and the token keeps a claim another pass
	 * recovered in place. A release that fails leaves the claim to go stale, which fences the cycle a little longer
	 * and is answered by the next pass, so it does not replace the cycle's own answer.
	 *
	 * @param billing The cycle.
	 * @param token The claim's token.
	 */
	private async endChargeClaim(billing: SubscriptionBilling, token: string): Promise<void> {
		try {
			await this.billingService.releaseChargeClaim(billing.id, token);
		} catch (error) {
			// The driver's message without the statement's bound values, as the platform's database-error filter logs it.
			const redacted = redactDatabaseError(error);

			this.logger.warn(
				`Subscription ${billing.subscriptionId}: the charge claim on cycle ${billing.id} was not released ` +
					`(${redacted instanceof Error ? redacted.message : 'a database error'}); it goes stale and the next ` +
					`pass recovers it.`
			);
		}
	}

	/**
	 * What a pass answers for a period whose cycle is already raised: the row's own record of it.
	 *
	 * @param subscription The subscription being billed.
	 * @param billing The raised cycle.
	 * @returns The replayed outcome.
	 */
	private raisedCycleOutcome(subscription: Subscription, billing: SubscriptionBilling): ISubscriptionBillingOutcome {
		return {
			subscriptionId: subscription.id,
			billingId: billing.id,
			status: billing.status,
			replayed: true,
			orderId: billing.orderId,
			amount: billing.amount,
			currency: billing.currency,
			periodStart: billing.periodStart,
			periodEnd: billing.periodEnd
		};
	}

	/**
	 * What a pass answers for a cycle it could not charge: one settled since it was read, or one another pass is
	 * charging. Nothing is charged, written or told, so nothing is spent either.
	 *
	 * @param subscription The subscription being billed.
	 * @param billing The cycle as it now stands.
	 * @returns The replayed outcome.
	 */
	private unclaimedCycleOutcome(subscription: Subscription, billing: SubscriptionBilling): ISubscriptionBillingOutcome {
		if (RAISED_CYCLE_STATUSES.includes(billing.status)) {
			return this.raisedCycleOutcome(subscription, billing);
		}

		return {
			subscriptionId: subscription.id,
			billingId: billing.id,
			status: billing.status,
			replayed: true,
			periodStart: billing.periodStart,
			periodEnd: billing.periodEnd,
			message: 'Another billing pass is charging this cycle, so this pass leaves it to that one.'
		};
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
	 * @param bookkeeping What the order leaves the subscription to record, written on the cycle with the charge's outcome.
	 * @param chargeClaim The token of the charge claim this pass holds on the cycle, which its payment ends.
	 * @returns A platform code and message when the charge could not be made (none once its outcome is recorded), and the
	 * bookkeeping of the request the order path was called with: a takeover of an attempt resends that attempt's.
	 * @throws Whatever recording the outcome of an order the order path raised throws, other than the refusals handled
	 * below: that is not a failed charge, since the money may have been taken.
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
		bookkeeping: ICycleBookkeeping,
		chargeClaim: string
	): Promise<{ failure?: { code: string; message: string }; bookkeeping: ICycleBookkeeping }> {
		if (!this.orderGateway) {
			return {
				failure: {
					code: 'SUBSCRIPTION_ORDER_GATEWAY_UNAVAILABLE',
					message:
						'The order capability is not registered, so a cycle cannot raise the order it bills; the cycle is recorded as failed rather than marked paid.'
				},
				bookkeeping
			};
		}

		// One key per attempt, not per period. The per-period key is what the cycle's idempotency claim
		// holds, and it is deliberately left open after a failure so the dunning schedule's next
		// attempt can take it over; the order path's key has to move with the attempt, or a retry
		// would be answered with the decline it is trying to recover from. Two runs of the *same*
		// attempt still collide, which is what stops one attempt charging twice.
		const attempt = (billing.attemptCount ?? 0) + 1;
		// A pass that takes over an attempt whose outcome was never recorded — its pass died, or the write recording it
		// failed — resends the request that attempt made (`ATTEMPT_REQUEST`). The order path replays an attempt only for
		// the same request: one rebuilt from lines changed since was refused, recorded as a failed charge and charged again
		// under the next attempt's key, and a credit deferred since was recorded as consumed by an order that never carried it.
		let frozen = this.billingService.frozenAttemptOf(billing, attempt);

		if (frozen) {
			this.logger.warn(
				`Subscription ${subscription.id}: attempt ${attempt} at cycle ${billing.id} was made before and its outcome ` +
					`never recorded; resending its request so the order path answers with what it did.`
			);
		} else {
			const payer = await this.resolvePayer(subscription);

			if (payer.refusal) {
				return { failure: payer.refusal, bookkeeping };
			}

			const setupFee = this.setupFeeFor(subscription, plan);

			frozen = {
				attempt,
				request: {
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
				},
				bookkeeping
			};

			if (!(await this.billingService.freezeAttempt(billing.id, chargeClaim, frozen))) {
				// The claim went stale before the call and another pass holds the cycle; that pass charges it.
				return {
					failure: {
						code: CHARGE_CLAIM_LOST,
						message: `${CHARGE_CLAIM_LOST}: the charge claim on billing cycle '${billing.id}' went stale before its order was raised.`
					},
					bookkeeping
				};
			}
		}

		let result: Awaited<ReturnType<ISubscriptionOrderGatewayPort['raiseSubscriptionOrder']>>;

		try {
			result = await this.orderGateway.raiseSubscriptionOrder(frozen.request);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);

			return {
				failure: { code: /^([A-Z][A-Z0-9_]{3,}):/.exec(message)?.[1] ?? 'SUBSCRIPTION_CHARGE_FAILED', message },
				bookkeeping: frozen.bookkeeping
			};
		}

		if (!result?.orderId) {
			return {
				failure: {
					code: 'SUBSCRIPTION_ORDER_NOT_RAISED',
					message: 'The order capability did not return an order for this cycle.'
				},
				bookkeeping: frozen.bookkeeping
			};
		}

		// The order is raised, so the money may have been taken. An error recording its outcome is therefore not a failed
		// charge: recorded as one, it marked a cycle whose money was taken as failed and the dunning retry charged it
		// again, and a payment that committed but whose read-back threw was replayed as settled while the calendar never
		// moved, completing the period's key on it. It propagates instead, so nothing charges the cycle again and the key
		// stays open: a cycle still unpaid is charged by the next pass under this attempt's key, which the order path
		// answers with this order, and a paid one is finished by it (`finishCycle`).
		try {
			if (result.paid) {
				await this.billingService.markPaid(billing.id, {
					paidAt: result.paidAt ?? new Date(),
					orderId: result.orderId,
					attemptCount: billing.attemptCount ?? 0,
					chargeClaim,
					bookkeeping: frozen.bookkeeping
				});
			} else {
				// R4-05: nothing was paid, so the rights of the period wait for the payment. The flags are written
				// with the status, so no payment can see the cycle invoiced without them.
				// Q7-W4: the calendar waits for the payment too, so the flag that says so is written with the status.
				await this.billingService.markInvoiced(
					billing.id,
					result.orderId,
					frozen.request.amount,
					{ activation: this.convertsTrial(subscription, plan), calendar: true },
					chargeClaim,
					frozen.bookkeeping
				);
			}
		} catch (error) {
			const code = (error as { response?: { code?: string } })?.response?.code;

			if (code === CHARGE_CLAIM_LOST) {
				// This charge outlived its claim, and another pass recovered the cycle. That pass charges under the same
				// attempt key, so the order path hands it this charge's order to record; recording it here as well
				// would clear that pass's fence while it is still working.
				this.logger.warn(
					`Subscription ${subscription.id}: the charge of cycle ${billing.id} (order ${result.orderId}) ` +
						`outlived its claim; the pass that now holds the cycle records it.`
				);

				return { failure: { code: CHARGE_CLAIM_LOST, message: (error as Error).message }, bookkeeping: frozen.bookkeeping };
			}

			// The order was raised, and an operator settled the cycle another way (paid, waived or refunded it) once
			// this charge's claim had gone stale - the claim refuses that while it is live. That is not a failed
			// charge, and reporting it as one would schedule a retry - a second charge. The cycle keeps the
			// operator's decision and the conflict is logged for follow-up.
			if (code !== 'SUBSCRIPTION_BILLING_TRANSITION_INVALID') {
				throw error;
			}

			this.logger.warn(
				`Subscription ${subscription.id}: cycle ${billing.id} was settled by an operator while its charge ` +
					`(order ${result.orderId}, ${result.paid ? 'paid' : 'unpaid'}) was in flight; the cycle keeps ` +
					`the operator's status.`
			);
		}

		return { bookkeeping: frozen.bookkeeping };
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
	 * @param chargeClaim The token of the charge claim this pass holds on the cycle. The attempt is recorded only while
	 * the claim is still the pass's (`SubscriptionBillingService.markFailed`).
	 * @returns What the attempt did.
	 */
	private async recordFailure(
		subscription: Subscription,
		billing: SubscriptionBilling,
		failure: { code: string; message: string },
		now: Date,
		expectation: IVersionExpectation = ANY_VERSION,
		chargeClaim?: string
	): Promise<ISubscriptionBillingOutcome> {
		const attempts = (billing.attemptCount ?? 0) + 1;
		const exhausted = isDunningExhausted(attempts);
		const retryAt = exhausted ? null : nextRetryAt(attempts, now);
		const error = `${failure.code}: ${failure.message}`;

		const failed = await this.billingService.markFailed(billing.id, {
			attemptCount: attempts,
			error,
			nextRetryAt: retryAt,
			chargeClaim
		});

		if (!failed) {
			// This attempt outlived its claim and another pass recovered the cycle: that pass records the attempt it made
			// under the same order key. Nothing is recorded here — no dunning step, no `subscription.payment-failed`.
			return this.unclaimedCycleOutcome(subscription, await this.billingService.findOneScoped(billing.id));
		}

		if (exhausted) {
			// The retry policy is spent. The subscription keeps its history and its period, and stops
			// being billed automatically until an operator acts or the customer supplies an instrument.
			await commitVersionedUpdate<Subscription>(this, {
				where: currentScope(),
				id: subscription.id,
				expectation,
				patch: { status: SubscriptionStatus.FAILED, nextBillingAt: null }
			});
		} else {
			// Still active, and still owed the same period: the cycle row's own retry instant decides
			// when the next attempt happens, so the calendar does not move.
			await commitVersionedUpdate<Subscription>(this, {
				where: currentScope(),
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
	 * Finishes a cycle whose charge's outcome is recorded: applies the bookkeeping its order left on the subscription and,
	 * for a cycle the run settled, moves the calendar onto its period and tells the renewal — once, whichever pass gets
	 * there first.
	 *
	 * The billing run calls it right after recording the outcome, and a pass that meets a cycle the run charged but never
	 * finished calls it in place of a replay (`leftUnfinished`), charging nothing. The bookkeeping and the calendar used to
	 * be separate writes after the outcome, so a pass cut off between them — a crash, a failed write, a payment whose
	 * read-back threw — left the cycle paid and the subscription on its period: every later pass replayed the cycle and
	 * completed the period's key on it, and the subscription was never billed again nor its renewal told.
	 *
	 * - **One statement.** The bookkeeping (`bookkeptMetadata`: the setup fee remembered, the consumed credit subtracted
	 *   from the one still carried) and the calendar are one write of the subscription, so neither lands without the other.
	 * - **Once.** The decision is read from a subscription whose calendar still points at the cycle (`isFinishable`), and
	 *   the write is predicated on the version it was read at. Of two passes finishing one cycle — the run, and a pass that
	 *   took the period's key over once its lease ran out — the second meets the first's write, reads again, finds the
	 *   calendar past the cycle and the bookkeeping applied, and writes and tells nothing.
	 * - **Told with the write.** `subscription.activated`, `subscription.renewed` and `subscription.expired` are appended to
	 *   the outbox in the write's transaction, so they are told exactly when the calendar moves.
	 * - **The row's own period.** The calendar moves onto the period the cycle records, not one recomputed from the plan's
	 *   cadence: a customer who moved to a yearly plan before a monthly cycle was finished is billed again a month on.
	 * - **An invoiced cycle keeps the calendar for its payment** (Q7-W4), and so does a paid one that held it: only the
	 *   bookkeeping is applied here, and the payment moves the calendar and releases the rights (`payCycle`).
	 *
	 * A paused subscription stays paused, and one that ended while the cycle was charged is left as it ended.
	 *
	 * @param subscriptionId The subscription.
	 * @param billingId The cycle, its outcome recorded.
	 * @param owed What the cycle's order left the subscription to record: the run's own, or the row's (`CYCLE_BOOKKEEPING`).
	 * @param options The version the caller read the subscription at, which this write spends, and whether the pass is
	 * replaying a cycle charged before rather than finishing its own charge.
	 * @returns What the cycle did.
	 */
	private async finishCycle(
		subscriptionId: ID,
		billingId: ID,
		owed: ICycleBookkeeping,
		options: { expectation: IVersionExpectation; replayed: boolean }
	): Promise<ISubscriptionBillingOutcome> {
		for (let attempt = 1; ; attempt += 1) {
			const subscription = await this.findOneScoped(subscriptionId);
			const billing = await this.billingService.findOneScoped(billingId);

			if (!this.isFinishable(subscription, billing)) {
				if ([SubscriptionStatus.CANCELED, SubscriptionStatus.EXPIRED].includes(subscription.status) && !options.replayed) {
					this.logger.warn(
						`Subscription ${subscription.id}: cycle ${billing.id} (${billing.status}) was charged while the ` +
							`subscription became ${subscription.status}; its calendar is left as it ended.`
					);
				}

				return this.finishedCycleOutcome(subscription, billing, options.replayed);
			}

			const paidFor = SETTLED_CYCLE_STATUSES.includes(billing.status);
			const movesCalendar = paidFor && !this.billingService.heldCalendar(billing);
			const bookkept = this.bookkeptMetadata(subscription, billing, owed);

			if (!movesCalendar && !bookkept) {
				return this.finishedCycleOutcome(subscription, billing, options.replayed);
			}

			// The version the decision was read at, taken now: the write must not land on a row another pass moved since.
			const predicate = this.readVersionPredicate(subscription, options.expectation);
			const plan = movesCalendar ? await this.planService.findOneScoped(subscription.planId) : null;
			const cycleCount = (subscription.billingCycleCount ?? 0) + 1;
			const ceilingReached =
				!!plan &&
				plan.maxBillingCycles !== undefined &&
				plan.maxBillingCycles !== null &&
				cycleCount >= plan.maxBillingCycles;
			const periodStart = new Date(billing.periodStart);
			const periodEnd = new Date(billing.periodEnd);
			const nextBillingAt = ceilingReached ? null : periodEnd;
			const status = ceilingReached
				? SubscriptionStatus.EXPIRED
				: subscription.status === SubscriptionStatus.PAUSED
				? SubscriptionStatus.PAUSED
				: SubscriptionStatus.ACTIVE;
			// R4-05 (interim): a cycle that held its rights back for a payment releases them through the same once-only
			// claim the payment does; one paid on the spot tells them here.
			const held = this.billingService.heldRights(billing);
			const converts = subscription.status === SubscriptionStatus.PENDING && !ceilingReached;
			const items = movesCalendar && !held ? await this.itemService.findForSubscription(subscription.id) : [];

			try {
				await this.typeOrmSubscriptionRepository.manager.transaction(async (manager) => {
					await commitVersionedUpdate<Subscription>(this.transactionWriter(manager), {
						where: currentScope(),
						id: subscription.id,
						expectation: predicate,
						patch: {
							...(bookkept ? { metadata: bookkept } : {}),
							...(movesCalendar
								? {
										status,
										currentPeriodStart: periodStart,
										currentPeriodEnd: periodEnd,
										nextBillingAt,
										billingCycleCount: cycleCount
								  }
								: {})
						}
					});

					if (!movesCalendar) {
						return;
					}

					if (converts && !held) {
						// The trial converted. The write above is the transition, and this is what says so: a
						// subscription that leaves `PENDING` because its first paid cycle settled has become active
						// just as surely as one an operator activated by hand, and a consumer that only listens for
						// `subscription.renewed` would never learn that the trial ended.
						await this.emit(
							'subscription.activated',
							subscription.id,
							{
								subscriptionId: subscription.id,
								planId: plan.id,
								currentPeriodStart: periodStart,
								currentPeriodEnd: periodEnd
							},
							manager
						);
					}

					if (!held) {
						await this.emit(
							'subscription.renewed',
							subscription.id,
							{
								subscriptionId: subscription.id,
								billingId: billing.id,
								orderId: billing.orderId ?? null,
								periodStart,
								periodEnd,
								amount: billing.amount,
								nextBillingAt,
								planId: plan.id,
								lineCount: items.length
							},
							manager
						);
					}

					if (ceilingReached) {
						await this.emit(
							'subscription.expired',
							subscription.id,
							{
								subscriptionId: subscription.id,
								expiredAt: new Date(),
								reason: 'MAX_BILLING_CYCLES_REACHED'
							},
							manager
						);
					}
				});
			} catch (error) {
				if (options.expectation.wildcard && attempt < METADATA_EDIT_ATTEMPTS && isVersionConflict(error)) {
					// Another writer moved the subscription since it was read — perhaps another pass finishing this cycle.
					// The decision is taken again on the row as it now stands.
					continue;
				}

				throw error;
			}

			if (movesCalendar && held) {
				await this.releaseHeldRights(billing.id);
			}

			if (options.replayed) {
				this.logger.warn(
					`Subscription ${subscription.id}: finished cycle ${billing.id} (${billing.status}, order ` +
						`${billing.orderId}), which the pass that charged it had left unfinished; nothing was charged.`
				);
			}

			return this.finishedCycleOutcome(subscription, billing, options.replayed);
		}
	}

	/**
	 * Whether a raised cycle is one the billing run charged whose finish may not have run (`finishCycle`).
	 *
	 * The run writes `orderId` and nothing else does, so an order names a cycle the run charged. Met at the period the
	 * calendar points at, it was charged by a pass cut off before the cycle was finished. A paid cycle that never held the
	 * calendar for its payment is finished whole — refunded since, too: its period was billed and counted, and left
	 * unfinished the subscription would stay on it — and an invoiced one that holds it has its bookkeeping left (Q7-W4).
	 * A paid cycle that held the calendar is its payment's to finish (`payCycle`), and one settled without an order is
	 * the operator's.
	 *
	 * @param billing The raised cycle.
	 * @returns True when a pass finishes it.
	 */
	private leftUnfinished(billing: SubscriptionBilling): boolean {
		if (!billing?.orderId) {
			return false;
		}

		if ([SubscriptionBillingStatus.PAID, SubscriptionBillingStatus.REFUNDED].includes(billing.status)) {
			return !this.billingService.heldCalendar(billing);
		}

		return billing.status === SubscriptionBillingStatus.INVOICED && this.billingService.holdsDeferredCalendar(billing);
	}

	/**
	 * Whether a cycle is still the one its subscription's calendar points at, so its finish is still owed: the
	 * subscription has not ended, and its next billing instant is the cycle's start — or, once the dunning schedule ran
	 * out and cleared that instant, the end of its current period is, which is where a manual attempt bills from
	 * (`nextCyclePeriod`). A finished cycle moved the calendar past itself.
	 *
	 * @param subscription The subscription, as read.
	 * @param billing The cycle.
	 * @returns True when the cycle is the subscription's open one.
	 */
	private isFinishable(subscription: Subscription, billing: SubscriptionBilling): boolean {
		if ([SubscriptionStatus.CANCELED, SubscriptionStatus.EXPIRED].includes(subscription.status)) {
			return false;
		}

		const at = subscription.nextBillingAt ?? subscription.currentPeriodEnd;

		return !!at && !!billing.periodStart && new Date(at).getTime() === new Date(billing.periodStart).getTime();
	}

	/**
	 * What a cycle's order leaves the subscription to record (`CYCLE_BOOKKEEPING`), decided as the order's own amounts are.
	 *
	 * @param subscription The subscription being billed.
	 * @param plan The plan it is on.
	 * @param credit The deferred credit the order carries, when it carries one.
	 * @returns The credit and the plan whose setup fee the order carries.
	 */
	private cycleBookkeepingFor(subscription: Subscription, plan: SubscriptionPlan, credit: Money | null): ICycleBookkeeping {
		return {
			...(credit && !credit.isZero() ? { credit: credit.toStorageString() } : {}),
			...(this.setupFeeFor(subscription, plan) ? { setupFeePlanId: plan.id } : {})
		};
	}

	/**
	 * What a charged cycle left the subscription to record, read from the cycle (`CYCLE_BOOKKEEPING`).
	 *
	 * A cycle whose outcome a build before this one recorded carries no such record, and that build may or may not have
	 * cleared the deferred credit before it was cut off. The credit the cycle consumed is then read back from the
	 * adjustment it was consumed under (`consumePendingCredit`), marked as inferred with the instant it was consumed: it
	 * is subtracted only from a carried credit no change has written since (`bookkeptMetadata`). One written since may be
	 * a new credit after that build cleared the consumed one, or the consumed one with more added, and nothing on the row
	 * tells the two apart, so it is left for reconciliation. The setup fee needs no such reading: one is charged only on a
	 * subscription's first cycle (`setupFeeFor`), which the finish counts.
	 *
	 * @param billing The cycle.
	 * @returns What is owed, and whether (and when) it was inferred.
	 */
	private async owedBookkeepingOf(
		billing: SubscriptionBilling
	): Promise<ICycleBookkeeping & { inferred?: boolean; consumedAt?: Date | null }> {
		const recorded = this.billingService.bookkeepingOf(billing);

		if (recorded) {
			return recorded;
		}

		const consumed = (await this.adjustmentService.findByOwner(AdjustmentOwnerType.SUBSCRIPTION_BILLING, billing.id)).filter(
			(row) => row.type === AdjustmentType.CREDIT && row.description === CONSUMED_CREDIT_DESCRIPTION
		);

		if (!consumed.length) {
			return {};
		}

		const credit = Money.sum(
			consumed.map((row) => Money.of(String(row.amount), billing.currency)),
			billing.currency
		).round();
		const instants = consumed.map((row) => (row.createdAt ? new Date(row.createdAt).getTime() : NaN));
		const consumedAt = instants.every((instant) => Number.isFinite(instant)) ? new Date(Math.max(...instants)) : null;

		return credit.isNegative() ? { credit: credit.toStorageString(), inferred: true, consumedAt } : {};
	}

	/**
	 * The subscription's metadata with a cycle's bookkeeping applied, or null when none is left to apply.
	 *
	 * The setup fee the order carried is remembered against its plan, and the deferred credit the order consumed is
	 * subtracted from the credit the subscription still carries — not cleared: a plan change that deferred another credit
	 * after the cycle consumed this one added it to the same total (`applyChange`), and that part is owed to the next
	 * cycle. A remainder that is not a credit is not carried. A consumption inferred for a cycle an older build recorded
	 * (`owedBookkeepingOf`) is subtracted only from a carried credit no change has written since the cycle consumed it;
	 * one written since is kept as it is and logged for reconciliation, since the row cannot say whether that build
	 * cleared the consumed credit first. The cycle is recorded as applied in the same metadata (`BOOKKEPT_CYCLE`), so a
	 * cycle already applied answers null.
	 *
	 * @param subscription The subscription, as read.
	 * @param billing The cycle.
	 * @param owed What the cycle's order left to record.
	 * @returns The metadata to write, or null.
	 */
	private bookkeptMetadata(
		subscription: Subscription,
		billing: SubscriptionBilling,
		owed: ICycleBookkeeping & { inferred?: boolean; consumedAt?: Date | null }
	): Record<string, unknown> | null {
		const stored: Record<string, unknown> = subscription.metadata ?? {};

		if (String(stored[BOOKKEPT_CYCLE] ?? '') === String(billing.id)) {
			return null;
		}

		const consumed = owed.credit ? Money.of(owed.credit, subscription.currency).round() : null;
		const credits = !!consumed && consumed.isNegative();

		if (!credits && !owed.setupFeePlanId) {
			return null;
		}

		const metadata: Record<string, unknown> = { ...stored, [BOOKKEPT_CYCLE]: billing.id };

		if (owed.setupFeePlanId) {
			const charged = (stored[CHARGED_SETUP_FEES] as ID[]) ?? [];

			if (!charged.includes(owed.setupFeePlanId)) {
				metadata[CHARGED_SETUP_FEES] = [...charged, owed.setupFeePlanId];
			}
		}

		// Read as `consumePendingCredit` read it when the cycle consumed it.
		const pending = stored[PENDING_CREDIT] as { amount?: string; at?: string } | undefined;

		if (credits && pending?.amount) {
			const left = Money.of(pending.amount, subscription.currency).round().subtract(consumed).round();
			const unchangedSinceConsumed =
				!!pending.at &&
				!!owed.consumedAt &&
				new Date(pending.at).getTime() <= new Date(owed.consumedAt).getTime();

			if (owed.inferred && !unchangedSinceConsumed) {
				this.logger.error(
					`Subscription ${subscription.id}: cycle ${billing.id} was recorded by an earlier build and consumed a ` +
						`credit of ${consumed.toStorageString()}, and the credit carried now (${pending.amount}) was written ` +
						`after it; whether that build cleared the consumed credit is unknown, so the carried credit is kept ` +
						`for reconciliation.`
				);
			} else if (left.isNegative()) {
				metadata[PENDING_CREDIT] = { ...pending, amount: left.toStorageString() };
			} else {
				delete metadata[PENDING_CREDIT];
			}
		}

		return metadata;
	}

	/**
	 * What a pass answers for a cycle it finished, or found finished.
	 *
	 * @param subscription The subscription being billed.
	 * @param billing The cycle.
	 * @param replayed Whether the pass charged nothing.
	 * @returns The outcome.
	 */
	private finishedCycleOutcome(
		subscription: Subscription,
		billing: SubscriptionBilling,
		replayed: boolean
	): ISubscriptionBillingOutcome {
		const paidFor = SETTLED_CYCLE_STATUSES.includes(billing.status);

		return {
			subscriptionId: subscription.id,
			billingId: billing.id,
			status: billing.status,
			replayed,
			orderId: billing.orderId,
			amount: billing.amount,
			currency: billing.currency,
			periodStart: billing.periodStart,
			periodEnd: billing.periodEnd,
			...(paidFor
				? {}
				: {
						message: this.billingService.holdsDeferredCalendar(billing)
							? 'The cycle is invoiced; the rights of its period are put in force when its payment is recorded, and the calendar moves on with that payment.'
							: 'The cycle is invoiced; the rights of its period are put in force when its payment is recorded.'
				  })
		};
	}

	/**
	 * Records the payment of a billing cycle, and puts in force the rights an invoiced cycle held back (R4-05).
	 *
	 * The two payment routes — `POST /subscription-billings/:id/pay` and `paySubscriptionBilling` — come here
	 * rather than to the ledger's `markPaid` alone: a cycle that was `INVOICED` when the billing run raised it
	 * extended no right, because nothing had been paid, and the payment is the moment it does. The events are
	 * the ones the run would have emitted for a cycle paid on the spot — `subscription.activated` for the
	 * trial it converted, then `subscription.renewed` for its period — built from the cycle's own row.
	 *
	 * Only a cycle the run marked as holding rights back releases them, so paying a cycle invoiced before this
	 * existed (whose rights were already extended) emits nothing twice. The release is claimed once per cycle
	 * (`releaseHeldRights`), so a second payment, or a payment racing the billing run, releases nothing again;
	 * paying an already paid cycle whose release was interrupted finishes it.
	 *
	 * @param billingId The cycle.
	 * @param options When the payment settled.
	 * @returns The paid cycle.
	 */
	public async payCycle(billingId: ID, options: { paidAt?: Date } = {}): Promise<SubscriptionBilling> {
		let paid = await this.billingService.markPaid(billingId, { paidAt: options.paidAt });

		if (paid.status !== SubscriptionBillingStatus.PAID) {
			return paid;
		}

		// Q7-W4: the calendar first, so the `subscription.renewed` the release emits names the next billing
		// instant the payment produced. Each step reads its own flag from the paid row, so a payment retried after
		// either one was interrupted finishes it, and neither runs twice.
		if (this.billingService.holdsDeferredCalendar(paid)) {
			await this.settleDeferredCalendar(paid);
			paid = await this.billingService.findOneScoped(paid.id);
		}

		// Read from the paid row, not from the status it had before: a payment retried after a release that was
		// interrupted finds the cycle already paid and its rights still held, and finishes the release.
		if (!this.billingService.holdsDeferredRights(paid)) {
			return paid;
		}

		await this.releaseHeldRights(paid.id);

		return await this.billingService.findOneScoped(paid.id);
	}

	/**
	 * Moves the subscription onto the period of the invoiced cycle that was just paid (Q7-W4).
	 *
	 * This is the calendar half of `finishCycle`, run when the money arrives rather than when the order was
	 * raised: the period is counted, a trial converts to `ACTIVE`, and the next billing instant is the period's
	 * end — or the subscription expires, when this cycle reaches the plan's ceiling. The bookkeeping the cycle's order
	 * left is applied in the same statement when the pass that invoiced the cycle was cut off before applying it
	 * (`bookkeptMetadata`, once: an applied cycle is recorded on the subscription).
	 *
	 * Only the subscription's open cycle moves it: one whose period starts at the subscription's next billing
	 * instant, on a subscription that is still billed (`ACTIVE`, a trial still `PENDING`, or `PAUSED` — which keeps
	 * its pause). A subscription that ended while the invoice was open keeps the calendar it ended on. The write is
	 * predicated on the version the decision was read at; of two payments racing, the second meets the first's
	 * write, reads again, finds the calendar already past the cycle, and moves nothing. The cycle's flag is cleared
	 * last, so a payment interrupted between the two writes is finished by its retry.
	 *
	 * An expiry is written here with the cycle that caused it (`expiredByCycle`, in the same statement) and is told
	 * by the release of the cycle's rights, after the renewal of the period it paid for (`releaseHeldRights`) — the
	 * order a cycle paid on the spot writes them in (`finishCycle`). Told here, before the renewal, the entitlement
	 * package expired the rights (closing their activations and withdrawing their keys) and the renewal then put them
	 * back in force without either (Greptile); and an expiry whose event was lost after this write was never told,
	 * because the retry finds the subscription expired and moves nothing.
	 *
	 * @param billing The paid cycle.
	 */
	private async settleDeferredCalendar(billing: SubscriptionBilling): Promise<void> {
		const owed = await this.owedBookkeepingOf(billing);

		for (let attempt = 1; ; attempt += 1) {
			const subscription = await this.findOneScoped(billing.subscriptionId);

			if (!this.isOpenCycleOf(subscription, billing)) {
				break;
			}

			const plan = await this.planService.findOneScoped(subscription.planId);
			const cycleCount = (subscription.billingCycleCount ?? 0) + 1;
			const ceilingReached =
				plan.maxBillingCycles !== undefined &&
				plan.maxBillingCycles !== null &&
				cycleCount >= plan.maxBillingCycles;
			const status = ceilingReached
				? SubscriptionStatus.EXPIRED
				: subscription.status === SubscriptionStatus.PENDING
					? SubscriptionStatus.ACTIVE
					: subscription.status;
			// The bookkeeping the cycle's order left, when the pass that invoiced it was cut off before applying it.
			const bookkept = this.bookkeptMetadata(subscription, billing, owed);

			try {
				await commitVersionedUpdate<Subscription>(this, {
					where: currentScope(),
					id: subscription.id,
					expectation: this.readVersionPredicate(subscription, ANY_VERSION),
					patch: {
						status,
						currentPeriodStart: billing.periodStart,
						currentPeriodEnd: billing.periodEnd,
						nextBillingAt: ceilingReached ? null : billing.periodEnd,
						billingCycleCount: cycleCount,
						...(ceilingReached
							? { metadata: { ...(bookkept ?? subscription.metadata ?? {}), [EXPIRED_BY_CYCLE]: billing.id } }
							: bookkept
							? { metadata: bookkept }
							: {})
					}
				});
			} catch (error) {
				if (attempt < METADATA_EDIT_ATTEMPTS && isVersionConflict(error)) {
					continue;
				}

				throw error;
			}

			break;
		}

		await this.billingService.releaseDeferredCalendar(billing.id);
	}

	/**
	 * Whether a cycle is the one a subscription's calendar waits on: its period starts at the subscription's next
	 * billing instant, and the subscription is still billed.
	 *
	 * @param subscription The subscription, as read.
	 * @param billing The cycle.
	 * @returns True when paying the cycle moves the calendar.
	 */
	private isOpenCycleOf(subscription: Subscription, billing: SubscriptionBilling): boolean {
		const billed = [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING, SubscriptionStatus.PAUSED].includes(
			subscription.status
		);

		return (
			billed &&
			!!subscription.nextBillingAt &&
			!!billing.periodStart &&
			new Date(subscription.nextBillingAt).getTime() === new Date(billing.periodStart).getTime()
		);
	}

	/**
	 * Whether the subscription's next billing instant is held by the cycle at it, so a resume keeps it there: an invoice
	 * still waiting for its payment (Q7-W4), or a charge — one a pass has started (it holds or held the cycle's charge
	 * claim), or one recorded whose cycle is not finished yet (`leftUnfinished`).
	 *
	 * The cycle's flag decides for an invoice, not its status: a payment interrupted after the cycle was recorded `PAID`
	 * and before it moved the calendar leaves the flag on, and the period must stay where the retry of that payment finds
	 * it — moved past it, the retry would find the cycle no longer open and the paid period would never be counted
	 * (Greptile). A charge holds it for the same reason: resumed past the cycle a pass is charging, the finish would find
	 * the calendar elsewhere and leave the paid period uncounted, and the next pass would bill a period over it (Copilot).
	 *
	 * @param subscription The subscription, as read.
	 * @returns True when its calendar waits on that cycle.
	 */
	private async calendarHeldByCycle(subscription: Subscription): Promise<boolean> {
		if (!subscription.nextBillingAt) {
			return false;
		}

		const open = await this.billingService.findByPeriod(subscription.id, new Date(subscription.nextBillingAt));

		return !!open && (this.billingService.holdsDeferredCalendar(open) || this.heldByCharge(open));
	}

	/**
	 * Whether a charge holds a cycle's period: a pass holds or held its charge claim, an attempt was frozen for the order
	 * path and its outcome never recorded (its order may exist, and the next pass recovers it under the same key), or it
	 * was charged and not finished yet (`leftUnfinished`).
	 *
	 * @param cycle The cycle.
	 * @returns True when moving the calendar past it would bill a period over a charge.
	 */
	private heldByCharge(cycle: SubscriptionBilling): boolean {
		return (
			!!cycle.chargeClaimToken ||
			!!this.billingService.frozenAttemptOf(cycle, (cycle.attemptCount ?? 0) + 1) ||
			this.leftUnfinished(cycle)
		);
	}

	/**
	 * Releases the rights a paid cycle held back, exactly once (R4-05).
	 *
	 * The release is claimed under `RIGHTS_RELEASE_SCOPE` and the cycle's id before anything is emitted, so of
	 * two callers racing on one cycle only one emits; the other is told the release is in flight or done. The
	 * cycle is read again under the claim, and only a paid cycle that still holds its rights releases them. A
	 * release that fails half-way leaves its claim in progress: the next payment of the cycle takes it over once
	 * the lease is stale and finishes it, because the flags are cleared only after both events were written.
	 *
	 * @param billingId The cycle.
	 */
	private async releaseHeldRights(billingId: ID): Promise<void> {
		const claim = await this.idempotencyService.claim({
			scope: RIGHTS_RELEASE_SCOPE,
			key: String(billingId),
			requestHash: this.hash({ billingId }),
			resourceType: 'subscription_billing'
		});

		if (claim.outcome !== IdempotencyOutcome.CLAIMED) {
			return;
		}

		const billing = await this.billingService.findOneScoped(billingId);

		if (billing.status === SubscriptionBillingStatus.PAID && this.billingService.holdsDeferredRights(billing)) {
			const subscription = await this.findOneScoped(billing.subscriptionId);

			// A subscription that expired because this very cycle's payment reached its plan's ceiling ended with the
			// period it paid for (Q7-W4: the payment moved the calendar onto it first), so that period's rights are
			// released. The subscription records the cycle that expired it in the same statement as the expiry
			// (`expiredByCycle`); a matching period is not proof, because an opening invoice shares the subscription's
			// period before it is paid, and a subscription expired any other way while it was open keeps its rights
			// withheld (Greptile).
			const endedWithThisCycle =
				subscription.status === SubscriptionStatus.EXPIRED &&
				String(subscription.metadata?.[EXPIRED_BY_CYCLE] ?? '') === String(billing.id);

			if (RIGHTS_WITHHELD_STATUSES.includes(subscription.status) && !endedWithThisCycle) {
				await this.billingService.releaseDeferredRights(billing.id, { withheldFor: subscription.status });
				await this.idempotencyService.complete(claim.record, {
					responseStatus: 200,
					responseBody: { billingId, withheldFor: subscription.status },
					resourceType: 'subscription_billing',
					resourceId: billingId
				});

				return;
			}

			const items = await this.itemService.findForSubscription(subscription.id);

			if (this.billingService.holdsDeferredActivation(billing)) {
				await this.emit('subscription.activated', subscription.id, {
					subscriptionId: subscription.id,
					planId: subscription.planId,
					currentPeriodStart: billing.periodStart,
					currentPeriodEnd: billing.periodEnd
				});
			}

			await this.emit('subscription.renewed', subscription.id, {
				subscriptionId: subscription.id,
				billingId: billing.id,
				orderId: billing.orderId ?? null,
				periodStart: billing.periodStart,
				periodEnd: billing.periodEnd,
				amount: billing.amount,
				nextBillingAt: subscription.nextBillingAt ?? null,
				planId: subscription.planId,
				lineCount: items.length
			});

			if (endedWithThisCycle) {
				// Q7-W4: the expiry this cycle's payment wrote is told after the renewal of the period it paid for, the
				// order a cycle paid on the spot writes them in. It is told under this release's claim and before the
				// flags are cleared, so a payment interrupted after the expiry was written tells it on its retry, once.
				await this.emit('subscription.expired', subscription.id, {
					subscriptionId: subscription.id,
					expiredAt: new Date(),
					reason: 'MAX_BILLING_CYCLES_REACHED'
				});
			}

			await this.billingService.releaseDeferredRights(billing.id);
		}

		await this.idempotencyService.complete(claim.record, {
			responseStatus: 200,
			responseBody: { billingId },
			resourceType: 'subscription_billing',
			resourceId: billingId
		});
	}

	/**
	 * Whether a cycle billed now converts the subscription's trial: it is still `PENDING` and the cycle does not
	 * reach the plan's ceiling (a cycle that does expires the subscription instead).
	 *
	 * @param subscription The subscription being billed.
	 * @param plan The plan it is on.
	 * @returns True when the cycle's settlement is what activates the subscription.
	 */
	private convertsTrial(subscription: Subscription, plan: SubscriptionPlan): boolean {
		const cycleCount = (subscription.billingCycleCount ?? 0) + 1;
		const ceilingReached =
			plan.maxBillingCycles !== undefined && plan.maxBillingCycles !== null && cycleCount >= plan.maxBillingCycles;

		return subscription.status === SubscriptionStatus.PENDING && !ceilingReached;
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
				where: currentScope(),
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
		const minimum = Money.of(
			String(metadata[MINIMUM_PRORATION_CHARGE] ?? DEFAULT_MINIMUM_PRORATION_CHARGE),
			currency
		);

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
			// **The carried credit accumulates; it does not replace.** Assigning the new amount outright
			// meant that two downgrades inside one period left only the second one's credit on the row and
			// the first one simply stopped existing — the customer was owed 30.97 and 12.00 and was given
			// 12.00. The money itself moves when the next cycle consumes what is carried here, which is
			// what doc 11 §10.8 states: "no money moves now; a `CREDIT` adjustment is attached to the
			// **next** billing order".
			const carried = this.pendingCreditOf(metadata, currency);
			const total = carried ? carried.add(net).round() : net;

			metadata[PENDING_CREDIT] = {
				amount: total.toStorageString(),
				currency,
				at: new Date().toISOString(),
				description: change.description
			};
			// And the adjustment written against the period the change happened in is the audit record of
			// the decision rather than the money: that period's row has already settled, so nothing is
			// collected or refunded by it. The pair is deliberate — one row says when the credit was
			// decided, the next cycle's says when it was given.
			await this.appendCredit(subscription, net, change.description);
		} else {
			settlement = 'WAIVED';
		}

		await commitVersionedUpdate<Subscription>(this, {
			where: currentScope(),
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
	 * A credit is an adjustment on a billing row rather than a smaller amount, so the decision stays
	 * visible in the ledger at the moment it was taken. The period this attaches to has already settled,
	 * so this row moves no money: the money moves when the next cycle consumes the amount the change
	 * carried on the subscription (`consumePendingCredit`). When the current period has no row at all —
	 * which happens when a change lands after the period settled and before the next cycle opened —
	 * there is nothing to attach the record to and the carried amount is the whole of it.
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
	 * @param metadata The subscription's metadata, as the change is building it.
	 * @param currency The subscription's currency.
	 * @returns The credit an earlier change already deferred, or null when none is carried. A deferred
	 * credit stated in another currency is not carried forward: converting it would need an exchange
	 * rate this service does not own, and adding it as if the currencies matched would be wrong by
	 * whatever the rate is.
	 */
	private pendingCreditOf(metadata: Record<string, unknown>, currency: CurrencyCode): Money | null {
		const pending = metadata?.[PENDING_CREDIT] as { amount?: string; currency?: string } | undefined;

		if (!pending?.amount || (pending.currency && pending.currency !== currency)) {
			return null;
		}

		return Money.of(pending.amount, currency).round();
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
				description: CONSUMED_CREDIT_DESCRIPTION
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
	 * @param plan The plan it is on.
	 * @param override A discount the caller stated for this subscription alone.
	 * @returns The discount fraction to apply.
	 */
	private discountOf(plan: SubscriptionPlan, override?: string | number): string | undefined {
		return cycleDiscountOf(plan, override);
	}

	/**
	 * @param subscription The subscription being read.
	 * @returns The end of its trial, when it is inside one.
	 */
	private trialEndOf(subscription: Subscription): Date | null {
		const trialEndsAt = subscription.metadata?.[TRIAL_ENDS_AT];

		return typeof trialEndsAt === 'string' ? new Date(trialEndsAt) : null;
	}

	/**
	 * Moves the cycle written at creation onto the period an activation starts.
	 *
	 * Only a subscription that was never billed has one, and only a cycle that records no money billed
	 * moves (`SubscriptionBillingService.reschedulePending`): a trial's waived cycle stays where it is,
	 * as the record of the trial.
	 *
	 * @param subscription The subscription, as read before it is activated (or resumed).
	 * @param opening Its opening cycle, as read on the transaction before the claim (`openingCycleOn`).
	 * @param period The period the activation starts.
	 * @param manager The activation's transaction.
	 */
	private async moveOpeningCycle(
		subscription: Subscription,
		opening: SubscriptionBilling | null,
		period: ISubscriptionPeriod,
		manager: EntityManager
	): Promise<void> {
		if ((subscription.billingCycleCount ?? 0) > 0) {
			return;
		}

		if (
			opening &&
			(!!this.billingService.frozenAttemptOf(opening, (opening.attemptCount ?? 0) + 1) || this.leftUnfinished(opening)) &&
			new Date(opening.periodStart).getTime() !== period.start.getTime()
		) {
			// The opening cycle was sent to the order path and its outcome never recorded, or it was charged and not
			// finished (a manual bill of a pending subscription, say): it cannot move, and committing the subscription onto
			// another period would leave the charge's finish with a calendar that no longer points at it — the paid period
			// uncounted and a later one billed over it (Copilot). The whole write is refused, as for a cycle charged since
			// it was read. A charge still before the order path holds a live claim, which `reschedulePending` refuses.
			throw new ConflictException(
				'SUBSCRIPTION_OPENING_CYCLE_CHANGED: the opening billing cycle is being charged. Read the subscription again once its charge is recorded and retry.'
			);
		}

		if (!opening || !this.isUntouched(opening) || new Date(opening.periodStart).getTime() === period.start.getTime()) {
			return;
		}

		const moved = await this.billingService.reschedulePending(opening.id, period, manager);

		// The move is predicated on the cycle still billing nothing. A cycle another writer charged after it
		// was read stays where it is, and committing the subscription onto a period its cycle is not on
		// would strand that charge: the whole write is refused (the caller's transaction rolls back).
		if (new Date(moved.periodStart).getTime() !== period.start.getTime()) {
			throw new ConflictException(
				'SUBSCRIPTION_OPENING_CYCLE_CHANGED: the opening billing cycle was charged while this change was being made. Read the subscription again and retry.'
			);
		}
	}

	/**
	 * The cycle written for the subscription's current period — at creation, the opening one — read on the
	 * caller's transaction (a second connection may be one the transaction is holding). It is found by its
	 * period, not as "the newest pending cycle": a later cycle written through the billing-cycle route is
	 * not the opening one.
	 *
	 * @param subscription The subscription, as read before the write.
	 * @param manager The caller's transaction.
	 * @returns The cycle, or null when the period has none.
	 */
	private async openingCycleOn(subscription: Subscription, manager: EntityManager): Promise<SubscriptionBilling | null> {
		return subscription.currentPeriodStart
			? await this.billingService.findByPeriod(subscription.id, new Date(subscription.currentPeriodStart), manager)
			: null;
	}

	/**
	 * Whether a billing pass holds the claim on the subscription's current period and has not completed it — a charge
	 * of that period may be running. A claim past the stale-lock window counts too: a pass does not refresh its claim
	 * or stop when the window passes, so its age cannot show that the pass stopped, and a slow charge that returns
	 * after the cycle moved would settle it on another period. Keeping the period costs at most the paused days of an
	 * opening period; moving it under a running charge would put the order, the cycle and the subscription on
	 * different dates.
	 *
	 * @param subscription The subscription, as read.
	 * @returns True when the period's billing claim is in progress.
	 */
	private async chargeInFlight(subscription: Subscription): Promise<boolean> {
		if (!subscription.currentPeriodStart) {
			return false;
		}

		const claim = await this.idempotencyService.findByKey(
			BILLING_SCOPE,
			`${subscription.id}:${new Date(subscription.currentPeriodStart).toISOString()}`
		);

		return claim?.status === IdempotencyStatus.IN_PROGRESS;
	}

	/**
	 * @param cycle A cycle.
	 * @returns Whether it records no money billed and no attempt: `PENDING`, with no order and no attempt.
	 */
	private isUntouched(cycle: SubscriptionBilling): boolean {
		return (
			cycle.status === SubscriptionBillingStatus.PENDING &&
			!cycle.orderId &&
			!cycle.attemptCount &&
			// An attempt frozen for the order path, whose outcome was never recorded, may have an order.
			!this.billingService.frozenAttemptOf(cycle, 1)
		);
	}

	/**
	 * The subscription's versioned writer inside a caller's TypeORM transaction.
	 *
	 * The two members `commitVersionedUpdate` uses, run on the transaction's manager: an update by the
	 * criteria the kernel builds, and a read by id inside the caller's scope that answers
	 * `NotFoundException` for a subscription that is not there.
	 *
	 * @param manager The transaction.
	 * @returns The writer.
	 */
	private transactionWriter(manager: EntityManager): IVersionedWriter<Subscription> {
		const subscriptions = manager.getRepository(Subscription);

		return {
			update: async (criteria, partial) => {
				try {
					return await subscriptions.update(criteria as never, partial as never);
				} catch (error) {
					// Logged as the platform's database-error filter logs one (the driver's code, its masked message and
					// the statement, without the bound values), because the answer below no longer carries any of it.
					const redacted = redactDatabaseError(error);
					let detail: string;
					try {
						detail = redacted instanceof Error ? redacted.message : JSON.stringify(redacted);
					} catch {
						detail = 'the error could not be converted to JSON';
					}
					this.logger.error(
						`The database refused a write of subscription ${String((criteria as { id?: unknown })?.id ?? '')}: ${detail}`
					);

					// Answered as `CrudService.update` answers a failed write: a 400 that carries none of the database's
					// internals (the statement, its parameters, the driver's detail). A version conflict is not an error
					// of this statement — `commitVersionedUpdate` raises it from the affected-row count — so it is unchanged.
					throw new BadRequestException(toClientSafeError(error));
				}
			},
			findOneByIdString: async (id) => {
				const subscription = await subscriptions.findOne({ where: { id, ...currentScope() } } as never);

				if (!subscription) {
					throw new NotFoundException('The subscription was not found.');
				}

				return subscription;
			}
		} as IVersionedWriter<Subscription>;
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
	 * @param manager The transaction the event is told in, when it is told with a write.
	 */
	private async emit(
		name: string,
		subscriptionId: ID,
		data: Record<string, unknown>,
		manager: EntityManager = this.typeOrmSubscriptionRepository.manager
	): Promise<void> {
		await this.outbox.append(manager, {
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
