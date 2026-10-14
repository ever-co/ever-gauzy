import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, In, IsNull, LessThanOrEqual } from 'typeorm';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { Money, TenantAwareCrudService, isUniqueViolation } from '@gauzy/core';
import { SubscriptionBillingStatus } from '../subscription.types';
import { currentScope } from '../subscription.scope';
import { normalizeDecimal } from '../subscription.cycle';
import { movedReadOnlyMembers, notWritable, writableOnly } from '../subscription.writable';
import { SubscriptionBilling } from './subscription-billing.entity';
import { MikroOrmSubscriptionBillingRepository } from './repository/mikro-orm-subscription-billing.repository';
import { TypeOrmSubscriptionBillingRepository } from './repository/type-orm-subscription-billing.repository';

/**
 * The members of a cycle a correction may move (review R4-08): the members the GraphQL
 * `UpdateSubscriptionBillingInput` admits.
 */
export const SUBSCRIPTION_BILLING_WRITABLE_MEMBERS: readonly string[] = ['amount', 'dueAt', 'metadata'];

/**
 * The statuses each settling action may start from (review R4-17). A payment settles a cycle that is due, invoiced or
 * retrying; a waiver forgoes one that has not been paid. Neither re-opens a cycle that was refunded, waived or paid:
 * `pay` turned a `REFUNDED` or `WAIVED` cycle back into `PAID`, and `waive` turned a `PAID` cycle into `WAIVED`,
 * erasing the revenue it recorded.
 */
const PAYABLE_FROM: readonly SubscriptionBillingStatus[] = [
	SubscriptionBillingStatus.PENDING,
	SubscriptionBillingStatus.INVOICED,
	SubscriptionBillingStatus.FAILED
];
const WAIVABLE_FROM: readonly SubscriptionBillingStatus[] = [
	SubscriptionBillingStatus.PENDING,
	SubscriptionBillingStatus.FAILED
];

/** The refusal of a settling action from a status it may not start from. */
function invalidTransition(
	billing: SubscriptionBilling,
	action: string,
	from: readonly SubscriptionBillingStatus[]
): BadRequestException {
	return new BadRequestException({
		message:
			`SUBSCRIPTION_BILLING_TRANSITION_INVALID: billing cycle '${billing.id}' is ${billing.status} and cannot be ` +
			`${action}; a cycle is ${action} only from ${from.join(', ')}.`,
		code: 'SUBSCRIPTION_BILLING_TRANSITION_INVALID',
		details: { subscriptionBillingId: billing.id, status: billing.status, allowedFrom: from }
	});
}

/**
 * Whether a cycle records money billed.
 *
 * Every status past `PENDING` does — an order was raised, a payment settled or failed, a refund or a waiver was
 * decided — and so does a `PENDING` cycle an order, a charge attempt or a payment has already touched. Only a
 * `PENDING` cycle none of those reached is a schedule entry that holds no money history.
 */
function recordsBilledMoney(billing: SubscriptionBilling): boolean {
	return (
		billing.status !== SubscriptionBillingStatus.PENDING ||
		!!billing.orderId ||
		Number(billing.attemptCount ?? 0) > 0 ||
		!!billing.paidAt
	);
}

/**
 * The billing ledger: one row per cycle, and the attempt history on it.
 *
 * The service owns the two writes that make a billing run safe to retry.
 *
 * **A period's row is created before the work starts**, so a crash between the two leaves a row that
 * says the period was owed rather than no evidence at all. `createPending` therefore treats the
 * unique `(subscriptionId, periodStart)` violation as an answer rather than as a failure: it returns
 * the row that is already there, which is exactly what a second worker racing the first needs to see.
 *
 * **Every attempt is recorded on the same row**, so a cycle's history is the row's own
 * `attemptCount`, `lastError` and `nextRetryAt`. A separate failure table would allow the two to
 * disagree about how many times a customer was charged.
 */
@Injectable()
export class SubscriptionBillingService extends TenantAwareCrudService<SubscriptionBilling> {
	constructor(
		readonly typeOrmSubscriptionBillingRepository: TypeOrmSubscriptionBillingRepository,
		readonly mikroOrmSubscriptionBillingRepository: MikroOrmSubscriptionBillingRepository
	) {
		super(typeOrmSubscriptionBillingRepository, mikroOrmSubscriptionBillingRepository);
	}

	/**
	 * Opens the row for a cycle, or returns the one that already exists for it.
	 *
	 * @param input The subscription, the period, the amount and the instant the cycle becomes payable.
	 * @returns The row, whether it was created by this call or by an earlier one.
	 * @throws BadRequestException when the period is empty or the amount is negative.
	 */
	public async createPending(input: {
		subscriptionId: ID;
		periodStart: Date;
		periodEnd: Date;
		amount: DecimalString | number;
		currency: CurrencyCode;
		dueAt?: Date;
		metadata?: Record<string, unknown>;
	}): Promise<SubscriptionBilling> {
		const { subscriptionId, periodStart, periodEnd, currency } = input;

		if (!(periodStart instanceof Date) || !(periodEnd instanceof Date) || periodEnd.getTime() <= periodStart.getTime()) {
			throw new BadRequestException(
				'SUBSCRIPTION_BILLING_PERIOD_INVALID: a billing period must end after it starts.'
			);
		}

		const amount = this.normalizeAmount(input.amount, currency);

		const existing = await this.findByPeriod(subscriptionId, periodStart);

		if (existing) {
			return existing;
		}

		try {
			return await super.create({
				subscriptionId,
				periodStart,
				periodEnd,
				amount,
				currency,
				status: SubscriptionBillingStatus.PENDING,
				dueAt: input.dueAt ?? periodStart,
				attemptCount: 0,
				metadata: input.metadata,
				...currentScope()
			} as any);
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}

			// Two workers reached the same period at the same instant. The loser reads the winner's
			// row and does nothing further, which is what keeps one period to one charge.
			const raced = await this.findByPeriod(subscriptionId, periodStart);

			if (!raced) {
				throw error;
			}

			return raced;
		}
	}

	/**
	 * Records that a cycle produced an order.
	 *
	 * @param id The cycle.
	 * @param orderId The order it produced.
	 * @param amount The amount actually billed, when it differs from the opened one.
	 * @returns The updated cycle.
	 */
	public async markInvoiced(id: ID, orderId: ID, amount?: DecimalString): Promise<SubscriptionBilling> {
		const billing = await this.findOneScoped(id);

		await super.update(id, {
			orderId,
			status: SubscriptionBillingStatus.INVOICED,
			amount: amount ? this.normalizeAmount(amount, billing.currency) : billing.amount,
			lastError: null
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Records that a cycle's money arrived.
	 *
	 * `paidAt` is non-null exactly when a cycle is `PAID`, which is what makes the pair assert what
	 * the other says rather than merely accompany it.
	 *
	 * @param id The cycle.
	 * @param options The instant the payment settled, the order it settled and the attempt count.
	 * @returns The updated cycle.
	 */
	public async markPaid(
		id: ID,
		options: { paidAt?: Date; orderId?: ID; attemptCount?: number } = {}
	): Promise<SubscriptionBilling> {
		const billing = await this.findOneScoped(id);

		// A cycle that is already paid is settled: recording its payment again is a no-op, not a refusal. The billing
		// run reaches here when an operator recorded the payment while the run's own charge was in flight, and a
		// refusal there would be read as a failed charge and turned into a retry - a second charge (Greptile).
		if (billing.status === SubscriptionBillingStatus.PAID) {
			return billing;
		}

		if (!PAYABLE_FROM.includes(billing.status as SubscriptionBillingStatus)) {
			throw invalidTransition(billing, 'paid', PAYABLE_FROM);
		}

		const refusal = async () => {
			const current = await this.findOneScoped(id);

			return current.status === SubscriptionBillingStatus.PAID ? null : invalidTransition(current, 'paid', PAYABLE_FROM);
		};

		await this.writeIf(id, { status: In([...PAYABLE_FROM]) }, refusal, {
			status: SubscriptionBillingStatus.PAID,
			paidAt: options.paidAt ?? new Date(),
			orderId: options.orderId ?? billing.orderId,
			attemptCount: options.attemptCount ?? billing.attemptCount,
			nextRetryAt: null,
			lastError: null
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Records a failed attempt and when the next one is owed.
	 *
	 * @param id The cycle.
	 * @param options How many attempts it has now used, why it failed, and when to try again.
	 * @returns The updated cycle.
	 */
	public async markFailed(
		id: ID,
		options: { attemptCount: number; error: string; nextRetryAt?: Date | null; orderId?: ID }
	): Promise<SubscriptionBilling> {
		await super.update(id, {
			status: SubscriptionBillingStatus.FAILED,
			attemptCount: options.attemptCount,
			lastError: options.error,
			nextRetryAt: options.nextRetryAt ?? null,
			orderId: options.orderId ?? undefined,
			paidAt: null
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Records that a cycle was deliberately not charged.
	 *
	 * @param id The cycle.
	 * @param options Why, and any note kept beside it.
	 * @returns The updated cycle.
	 */
	public async markWaived(id: ID, options: { reason: string; note?: string } = { reason: '' }): Promise<SubscriptionBilling> {
		const billing = await this.findOneScoped(id);

		if (!WAIVABLE_FROM.includes(billing.status as SubscriptionBillingStatus)) {
			throw invalidTransition(billing, 'waived', WAIVABLE_FROM);
		}

		await this.writeIf(id, { status: In([...WAIVABLE_FROM]) }, async () => invalidTransition(await this.findOneScoped(id), 'waived', WAIVABLE_FROM), {
			status: SubscriptionBillingStatus.WAIVED,
			paidAt: null,
			nextRetryAt: null,
			metadata: {
				...(billing.metadata ?? {}),
				waivedReason: options.reason,
				...(options.note ? { waivedNote: options.note } : {})
			}
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Moves a cycle nothing has billed yet onto another period.
	 *
	 * A subscription created pending carries the cycle of the period it would have started with, and
	 * its first period starts when it is activated (`SubscriptionService.activate`). The cycle moves with
	 * that period, rather than staying behind as a `PENDING` row nothing bills — which a revenue or a
	 * dunning report reads as an unpaid cycle for good. Only a cycle that records no money billed moves:
	 * `PENDING`, with no order and no attempt. Any other is answered unchanged.
	 *
	 * @param id The cycle.
	 * @param period The period it now covers.
	 * @returns The cycle, moved or as it was.
	 * @throws BadRequestException when the period is empty.
	 */
	public async reschedulePending(id: ID, period: { start: Date; end: Date }): Promise<SubscriptionBilling> {
		if (period.end.getTime() <= period.start.getTime()) {
			throw new BadRequestException(
				'SUBSCRIPTION_BILLING_PERIOD_INVALID: a billing period must end after it starts.'
			);
		}

		const billing = await this.findOneScoped(id);

		if (billing.status !== SubscriptionBillingStatus.PENDING || billing.orderId || billing.attemptCount) {
			return billing;
		}

		// Predicated on the cycle still billing nothing, so a charge that reached it after the read above
		// is never moved off the period it was charged for. Losing that race leaves the cycle where the
		// charge put it, which is the answer for a cycle that records money billed.
		await this.writeIf(
			id,
			{ status: SubscriptionBillingStatus.PENDING, orderId: IsNull(), attemptCount: 0 },
			async () => null,
			{ periodStart: period.start, periodEnd: period.end, dueAt: period.start }
		);

		return await this.findOneScoped(id);
	}

	/**
	 * Records that a paid cycle was refunded.
	 *
	 * @param id The cycle.
	 * @param note Why it was refunded.
	 * @returns The updated cycle.
	 */
	public async markRefunded(id: ID, note?: string): Promise<SubscriptionBilling> {
		const billing = await this.findOneScoped(id);

		if (billing.status !== SubscriptionBillingStatus.PAID) {
			throw new BadRequestException(
				`A cycle in status "${billing.status}" cannot be refunded: only a paid cycle has money to give back.`
			);
		}

		await super.update(id, {
			status: SubscriptionBillingStatus.REFUNDED,
			metadata: { ...(billing.metadata ?? {}), refundNote: note }
		} as any);

		return await this.findOneScoped(id);
	}

	/**
	 * @param subscriptionId The subscription to read the history of.
	 * @returns Its cycles, newest period first.
	 */
	public async findForSubscription(subscriptionId: ID): Promise<SubscriptionBilling[]> {
		return await this.typeOrmSubscriptionBillingRepository.find({
			where: {
				subscriptionId,
				...currentScope()
			},
			order: { periodStart: 'DESC' }
		});
	}

	/**
	 * @param subscriptionId The subscription.
	 * @param periodStart The period start that identifies the cycle.
	 * @returns The cycle, or null when the period has never been billed.
	 */
	public async findByPeriod(subscriptionId: ID, periodStart: Date): Promise<SubscriptionBilling | null> {
		return await this.typeOrmSubscriptionBillingRepository.findOne({
			where: {
				subscriptionId,
				periodStart,
				...currentScope()
			}
		});
	}

	/**
	 * Removes a cycle outright, but only one that records no money billed.
	 *
	 * `DELETE /subscription-billings/:id` reached the generic hard delete, while doc 13 §11.4 names
	 * `subscription_billing` in its "soft delete only; no hard delete through the API" row: a cycle is the record of
	 * money billed, and destroying it loses the history a revenue report, a dunning pass and a dispute all read
	 * (handover 2026-09-20 §7.65 item 23 (d)). The route, its permission and its answer are unchanged; what it may
	 * still remove is a cycle nothing has billed yet — a `PENDING` row with no order, no attempt and no payment,
	 * which is a schedule entry rather than a record of money. Anything else is refused with
	 * `SUBSCRIPTION_BILLING_NOT_DELETABLE`, and `DELETE /subscription-billings/:id/soft` retires it while keeping the
	 * history. The refusal is made here, below the route, so any caller of the generic delete is held to it.
	 *
	 * The cycles are read inside the caller's tenant and organization, as `findOneScoped` reads them; a cycle that is
	 * not the caller's is left to the base class, which answers it exactly as it did before.
	 *
	 * @param criteria The cycle, or the conditions that select the cycles to remove.
	 * @param options The inherited options, forwarded to the base class.
	 * @returns The delete result, as the base class answers it.
	 * @throws ConflictException with `SUBSCRIPTION_BILLING_NOT_DELETABLE` when a selected cycle records money billed.
	 */
	public async delete(criteria: ID | FindOptionsWhere<SubscriptionBilling>, options?: any): Promise<DeleteResult> {
		const where = typeof criteria === 'string' ? { id: criteria } : { ...(criteria ?? {}) };
		const cycles = await this.typeOrmSubscriptionBillingRepository.find({
			where: { ...where, ...currentScope() } as FindOptionsWhere<SubscriptionBilling>
		});
		const billed = cycles.find(recordsBilledMoney);

		if (billed) {
			throw new ConflictException({
				message:
					`SUBSCRIPTION_BILLING_NOT_DELETABLE: billing cycle '${billed.id}' is ${billed.status} and records money ` +
					`billed, so it is history rather than a schedule entry; retire it with DELETE ` +
					`/subscription-billings/:id/soft instead.`,
				code: 'SUBSCRIPTION_BILLING_NOT_DELETABLE',
				details: {
					subscriptionBillingId: billed.id,
					status: billed.status,
					...(billed.orderId ? { orderId: billed.orderId } : {}),
					attemptCount: Number(billed.attemptCount ?? 0)
				}
			});
		}

		return super.delete(criteria as any, options);
	}

	/**
	 * Corrects a cycle that has not been charged: its amount, its due date, its metadata (review R4-08).
	 *
	 * `PUT /subscription-billings/:id` and `updateSubscriptionBilling` reach this method, and both say "corrects a cycle
	 * that has not been charged" - but the route wrote `status`, `paidAt`, `attemptCount`, `orderId` and the period
	 * verbatim (`{status:"PAID", paidAt:…}` marked a cycle paid with no order), and neither surface checked the cycle
	 * had not been charged (`{amount:"0"}` on a `PAID` cycle rewrote recorded revenue). The state moves through the
	 * billing run and `pay`/`waive`/`refund`, which write through the base class and are not affected.
	 *
	 * @param id The cycle, or the conditions that select the cycles to correct.
	 * @param partialEntity The members to change.
	 * @returns The update result, as the base class answers it.
	 * @throws BadRequestException with `SUBSCRIPTION_BILLING_FIELD_NOT_WRITABLE` when the write would move a member
	 * other than the amount, the due date or the metadata.
	 * @throws ConflictException with `SUBSCRIPTION_BILLING_SETTLED` when the cycle already records money billed.
	 */
	public async update(id: any, partialEntity: any): Promise<any> {
		if (typeof id !== 'string') {
			throw notWritable('SUBSCRIPTION_BILLING_FIELD_NOT_WRITABLE', 'a cycle is corrected one at a time, by its id.', {
				criteria: id
			});
		}

		const billing = await this.findOneScoped(id);
		const patch = { ...((partialEntity ?? {}) as Record<string, unknown>) };
		const moved = movedReadOnlyMembers(
			billing as unknown as Record<string, unknown>,
			patch,
			SUBSCRIPTION_BILLING_WRITABLE_MEMBERS
		);

		if (moved.length > 0) {
			throw notWritable(
				'SUBSCRIPTION_BILLING_FIELD_NOT_WRITABLE',
				`${moved.join(', ')} of billing cycle '${id}' ${moved.length === 1 ? 'is' : 'are'} written by the billing ` +
					`run and the pay, waive and refund actions, not by a correction.`,
				{ subscriptionBillingId: id, fields: moved, writable: SUBSCRIPTION_BILLING_WRITABLE_MEMBERS }
			);
		}

		const settled = (current: SubscriptionBilling) =>
			new ConflictException({
				message:
					`SUBSCRIPTION_BILLING_SETTLED: billing cycle '${id}' is ${current.status} and records money billed, so ` +
					`it is history rather than a schedule entry and is no longer corrected.`,
				code: 'SUBSCRIPTION_BILLING_SETTLED',
				details: { subscriptionBillingId: id, status: current.status }
			});

		if (recordsBilledMoney(billing)) {
			throw settled(billing);
		}

		let correction = writableOnly(patch, SUBSCRIPTION_BILLING_WRITABLE_MEMBERS);

		if (correction['amount'] !== undefined) {
			correction = { ...correction, amount: this.normalizeAmount(correction['amount'] as DecimalString, billing.currency) };
		}

		// The statement is conditional on the cycle still recording no money billed, so a charge that lands between the
		// read above and this write is not corrected over.
		return this.writeIf(
			id,
			{ status: SubscriptionBillingStatus.PENDING, orderId: IsNull(), paidAt: IsNull(), attemptCount: 0 },
			async () => settled(await this.findOneScoped(id)),
			correction
		);
	}

	/**
	 * Writes a cycle only if it still matches the condition its write was decided on (Greptile).
	 *
	 * The check and the write of a settling action or a correction used to be two statements: a correction could read an
	 * untouched cycle and write its amount after the billing run had charged it, and a `pay` and a `waive` racing on
	 * one cycle could both pass their checks, the second overwriting the first. The condition rides in the statement's
	 * own WHERE, inside the caller's tenant and organization, and a statement that matched no row is answered with the
	 * refusal the caller states, decided on the row as it now stands.
	 *
	 * @param id The cycle.
	 * @param condition The state the write was decided on.
	 * @param refusal Builds the exception for a cycle that no longer matches, or answers null when the state the
	 * cycle reached instead already is the outcome the caller wanted (a payment that landed first).
	 * @param patch The columns to write.
	 * @returns The update result.
	 */
	private async writeIf(
		id: ID,
		condition: FindOptionsWhere<SubscriptionBilling>,
		refusal: () => Promise<Error | null>,
		patch: Record<string, unknown>
	): Promise<{ affected?: number }> {
		const result = await this.typeOrmSubscriptionBillingRepository.update(
			{ id, ...currentScope(), ...condition } as FindOptionsWhere<SubscriptionBilling>,
			patch as any
		);

		if (!result?.affected) {
			const refused = await refusal();

			if (refused) {
				throw refused;
			}
		}

		return result;
	}

	/**
	 * Reads a cycle inside the caller's tenant and organization.
	 *
	 * @param id The cycle to read.
	 * @returns The cycle.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findOneScoped(id: ID): Promise<SubscriptionBilling> {
		const billing = await this.typeOrmSubscriptionBillingRepository.findOne({
			where: {
				id,
				...currentScope()
			}
		});

		if (!billing) {
			throw new NotFoundException('The subscription billing cycle was not found.');
		}

		return billing;
	}

	/**
	 * Reads the cycles whose dunning schedule says another attempt is owed.
	 *
	 * Only a `FAILED` row carries a retry instant, which is what makes the scan an index seek: a
	 * cycle that is still in progress, or that has settled, is not a candidate for another charge.
	 *
	 * @param now The instant to compare against.
	 * @param limit How many cycles one pass may take.
	 * @returns The cycles, oldest retry first.
	 */
	public async findDueRetries(now: Date, limit: number = 200): Promise<SubscriptionBilling[]> {
		return await this.typeOrmSubscriptionBillingRepository.find({
			where: {
				status: SubscriptionBillingStatus.FAILED,
				nextRetryAt: LessThanOrEqual(now),
				...currentScope()
			},
			order: { nextRetryAt: 'ASC' },
			take: Math.max(1, Math.trunc(limit))
		});
	}

	/**
	 * @param amount The amount as it was computed.
	 * @param currency The currency it is expressed in.
	 * @returns The amount at the storage scale of a money column.
	 * @throws BadRequestException when the amount is negative or is not an exact decimal.
	 */
	private normalizeAmount(amount: DecimalString | number, currency: CurrencyCode): DecimalString {
		try {
			const money = Money.of(normalizeDecimal(amount, '0'), currency).round();

			if (money.isNegative()) {
				throw new BadRequestException('SUBSCRIPTION_BILLING_AMOUNT_INVALID: a cycle cannot bill a negative amount.');
			}

			return money.toStorageString();
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}

			throw new BadRequestException(`SUBSCRIPTION_BILLING_AMOUNT_INVALID: ${(error as Error).message}`);
		}
	}
}
