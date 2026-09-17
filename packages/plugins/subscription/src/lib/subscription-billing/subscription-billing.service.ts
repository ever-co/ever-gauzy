import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LessThanOrEqual } from 'typeorm';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { Money, RequestContext, TenantAwareCrudService, isUniqueViolation } from '@gauzy/core';
import { SubscriptionBillingStatus } from '../subscription.types';
import { currentScope } from '../subscription.scope';
import { normalizeDecimal } from '../subscription.cycle';
import { SubscriptionBilling } from './subscription-billing.entity';
import { MikroOrmSubscriptionBillingRepository } from './repository/mikro-orm-subscription-billing.repository';
import { TypeOrmSubscriptionBillingRepository } from './repository/type-orm-subscription-billing.repository';

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

		await super.update(id, {
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

		await super.update(id, {
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
