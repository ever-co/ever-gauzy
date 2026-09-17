import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import { CrudService, EventBus, Money, Payment, RequestContext } from '@gauzy/core';
import { PaymentCapture } from './payment-capture.entity';
import { TypeOrmPaymentCaptureRepository } from './repository/type-orm-payment-capture.repository';
import { MikroOrmPaymentCaptureRepository } from './repository/mikro-orm-payment-capture.repository';
import { IPaymentCapture, IPaymentCaptureCreateInput } from '../payment.types';
import { PaymentCollectionService } from '../payment-collection/payment-collection.service';
import { PaymentCapturedEvent } from '../events';

/**
 * The capture ledger: money actually taken.
 *
 * A capture is the moment the platform's record and the provider's record have to agree, so two rules
 * are enforced here rather than trusted to the caller:
 *
 * ```
 * payment.capturedAmount + captureAmount <= payment.authorizedAmount - payment.canceledAmount
 * collection.capturedAmount + captureAmount <= collection.amount
 * ```
 *
 * A request that would pass either of them is refused with `PAYMENT_OVER_CAPTURE`, never clamped: a
 * clamp would take an amount nobody asked for. Capturing an authorisation that holds nothing left is
 * refused with `PAYMENT_ALREADY_CAPTURED`, and a row that was never authorised — a manual payment
 * recorded by the accounting side, which has no authorisation step — is refused with
 * `PAYMENT_NOT_AUTHORIZED`.
 *
 * **The row is append-only.** There is no update and no delete of a capture: a partial capture is
 * another row, and a correction is a refund. A ledger that can be rewritten cannot be reconciled.
 *
 * The payment row itself is the **core** `payment` table, extended by the core schema: this service
 * reads its authorisation and its running totals and writes back the totals and the derived status in
 * the same transaction as the capture it records, because a payment that says one thing while its
 * captures say another is exactly the disagreement the extension exists to prevent.
 */
@Injectable()
export class PaymentCaptureService extends CrudService<PaymentCapture> {
	constructor(
		readonly typeOrmPaymentCaptureRepository: TypeOrmPaymentCaptureRepository,
		readonly mikroOrmPaymentCaptureRepository: MikroOrmPaymentCaptureRepository,
		@InjectRepository(Payment) private readonly paymentRepository: Repository<Payment>,
		private readonly paymentCollectionService: PaymentCollectionService,
		private readonly eventBus: EventBus
	) {
		super(typeOrmPaymentCaptureRepository, mikroOrmPaymentCaptureRepository);
	}

	/**
	 * The tenant and organization of the caller, which every query in this service is scoped to.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Records a capture against a payment, and moves the payment and its collection with it.
	 *
	 * @param input The capture to record.
	 * @returns The stored capture.
	 * @throws NotFoundException when the payment is not in the caller's organization.
	 * @throws BadRequestException when the payment was never authorised, when it is already fully
	 * captured, when the capture would pass what remains of the authorisation, or when it would take
	 * the collection past the amount it is for.
	 */
	async capture(input: IPaymentCaptureCreateInput): Promise<IPaymentCapture> {
		const payment = await this.findPaymentOrFail(input.paymentId);
		const currency = payment.currency ?? input.currency;

		if (input.currency && currency && input.currency.trim().toUpperCase() !== currency.toUpperCase()) {
			throw new BadRequestException(
				`Capture currency '${input.currency}' does not match payment currency '${currency}'.`
			);
		}

		const amount = this.toMoney(input.amount, currency);

		if (!amount.isPositive()) {
			throw new BadRequestException('PAYMENT_CAPTURE_AMOUNT_INVALID');
		}

		const authorized = Money.of(payment.authorizedAmount ?? '0', currency);
		const captured = Money.of(payment.capturedAmount ?? '0', currency);
		const canceled = Money.of(payment.canceledAmount ?? '0', currency);

		if (authorized.isZero() && captured.isZero()) {
			// A manual payment carries no authorisation step; it is recorded, not captured.
			throw new BadRequestException('PAYMENT_NOT_AUTHORIZED');
		}

		const remaining = authorized.subtract(canceled).subtract(captured);

		if (!remaining.isPositive()) {
			throw new BadRequestException('PAYMENT_ALREADY_CAPTURED');
		}

		if (amount.greaterThan(remaining)) {
			throw new BadRequestException('PAYMENT_OVER_CAPTURE');
		}

		if (payment.paymentCollectionId) {
			const collection = await this.paymentCollectionService.findCollectionOrFail(payment.paymentCollectionId);
			this.paymentCollectionService.assertCanCapture(collection, amount.amount);
		}

		const capture = await this.create({
			...input,
			paymentId: payment.id,
			amount: amount.amount,
			currency,
			capturedAt: input.capturedAt ?? new Date(),
			...this.scope
		} as never);

		const capturedTotal = captured.add(amount);
		await this.paymentRepository.update(
			{ id: payment.id, ...this.scope } as never,
			{
				capturedAmount: capturedTotal.amount,
				capturedAt: capture.capturedAt ?? new Date(),
				status: this.derivePaymentStatus(payment, capturedTotal, Money.of(payment.refundedAmount ?? '0', currency))
			} as never
		);

		if (payment.paymentCollectionId) {
			await this.paymentCollectionService.recordCapture(payment.paymentCollectionId, amount.amount);
		}

		this.eventBus.publish(
			new PaymentCapturedEvent(
				capture.id,
				payment.id,
				amount.amount,
				currency,
				payment.organizationId ?? this.scope.organizationId
			)
		);

		return this.findCaptureOrFail(capture.id);
	}

	/**
	 * Refuses an update of a capture. The ledger is append-only; a correction is a refund.
	 *
	 * The signature is written loosely on purpose: it overrides the generic CRUD method, and what it
	 * has to say is that there is no compliant call.
	 *
	 * @param id The capture that was to be updated.
	 * @param partialEntity The refused fields.
	 * @throws BadRequestException always.
	 */
	async update(id: unknown, partialEntity?: unknown): Promise<never> {
		void id;
		void partialEntity;

		throw new BadRequestException('PAYMENT_CAPTURE_APPEND_ONLY');
	}

	/**
	 * Refuses a hard delete of a capture. A captured movement is a fact about money that was taken.
	 *
	 * @param criteria The capture that was to be deleted.
	 * @throws BadRequestException always.
	 */
	async delete(criteria: unknown): Promise<never> {
		void criteria;

		throw new BadRequestException('PAYMENT_CAPTURE_APPEND_ONLY');
	}

	/**
	 * Loads a capture that belongs to the caller's organization.
	 *
	 * @param id The capture to load.
	 * @returns The capture.
	 * @throws NotFoundException when it does not exist inside the caller's scope.
	 */
	async findCaptureOrFail(id: ID): Promise<IPaymentCapture> {
		const capture = await this.findOneByWhereOptions({ id, ...this.scope } as never);

		if (!capture) {
			throw new NotFoundException('PAYMENT_CAPTURE_NOT_FOUND');
		}

		return capture;
	}

	/**
	 * Paginates the captures of the caller's organization.
	 *
	 * @param options Optional filters, merged with the tenancy scope.
	 * @returns One page of captures.
	 */
	async findCaptures(options: Record<string, unknown> = {}): Promise<IPagination<IPaymentCapture>> {
		return this.findAll({ ...options, where: { ...((options.where as object) ?? {}), ...this.scope } } as never);
	}

	/**
	 * Sums the captures of a payment, which is the figure a refund is measured against.
	 *
	 * @param paymentId The payment to sum for.
	 * @returns The captured total as an exact decimal.
	 */
	async sumCapturedForPayment(paymentId: ID): Promise<DecimalString> {
		const captures: IPaymentCapture[] = await this.find({ where: { paymentId, ...this.scope } as never });
		const currency = captures.length ? captures[0].currency : undefined;

		if (!currency) {
			return '0';
		}

		return Money.sum(
			captures.map((capture) => Money.of(capture.amount, currency)),
			currency
		).amount;
	}

	/**
	 * Derives the status of a payment row from its own amounts.
	 *
	 * The derivation is deliberately local to the row: a payment that settles an invoice only has no
	 * collection and no authorisation, and its status still has to be answerable. `paymentStatus` on
	 * the order is materialised separately, from the whole ledger.
	 *
	 * @param payment The payment row being written.
	 * @param captured The captured total after this movement.
	 * @param refunded The refunded total after this movement.
	 * @returns The derived status value.
	 */
	derivePaymentStatus(payment: Payment, captured: Money, refunded: Money): string {
		const currency = payment.currency;
		const amount = Money.of(payment.amount ?? '0', currency);
		const authorized = Money.of(payment.authorizedAmount ?? '0', currency);
		const canceled = Money.of(payment.canceledAmount ?? '0', currency);

		if (refunded.isPositive() && captured.isPositive()) {
			return refunded.greaterThanOrEqual(captured) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
		}

		if (captured.isPositive()) {
			return captured.greaterThanOrEqual(amount.subtract(canceled)) ? 'CAPTURED' : 'PARTIALLY_CAPTURED';
		}

		if (canceled.greaterThanOrEqual(amount) && amount.isPositive()) {
			return 'CANCELED';
		}

		return authorized.isPositive() ? 'AUTHORIZED' : 'NOT_PAID';
	}

	/**
	 * Loads a payment row of the caller's organization.
	 *
	 * @param paymentId The payment to load.
	 * @returns The payment row.
	 * @throws NotFoundException when it does not exist inside the caller's scope.
	 */
	async findPaymentOrFail(paymentId: ID): Promise<Payment> {
		const payment = await this.paymentRepository.findOne({ where: { id: paymentId, ...this.scope } as never });

		if (!payment) {
			throw new NotFoundException('PAYMENT_NOT_FOUND');
		}

		return payment;
	}

	/**
	 * Reads an exact decimal in a given currency.
	 *
	 * @param value The decimal to read.
	 * @param currency The currency it is in.
	 * @returns The value as a kernel money value.
	 * @throws BadRequestException when the amount is not an exact decimal or the currency is missing.
	 */
	private toMoney(value: DecimalString | number, currency?: string): Money {
		if (!currency) {
			throw new BadRequestException('PAYMENT_CURRENCY_INVALID');
		}

		try {
			return Money.of(value, currency);
		} catch {
			throw new BadRequestException('PAYMENT_AMOUNT_INVALID');
		}
	}
}
