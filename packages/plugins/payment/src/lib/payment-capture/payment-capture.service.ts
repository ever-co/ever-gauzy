import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as chalk from 'chalk';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import { EventBus, Money, Payment, readAffectedRows } from '@gauzy/core';
import { PaymentCapture } from './payment-capture.entity';
import { TypeOrmPaymentCaptureRepository } from './repository/type-orm-payment-capture.repository';
import { MikroOrmPaymentCaptureRepository } from './repository/mikro-orm-payment-capture.repository';
import { PaymentScopedCrudService } from '../payment-scoped-crud.service';
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
export class PaymentCaptureService extends PaymentScopedCrudService<PaymentCapture> {
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
	 * Records a capture against a payment, and moves the payment and its collection with it.
	 *
	 * **The over-capture guard is only a guard while the write is conditional on what it read.** The
	 * ceiling above is computed from `payment.capturedAmount` as this call read it, and the payment row
	 * is then written with an *absolute* new total. Written unconditionally, two concurrent captures of
	 * the full authorisation both read `capturedAmount = 0`, both compute a remaining of the whole
	 * amount, both pass, and both write the same total: two `payment_capture` rows totalling twice the
	 * authorisation while the payment row claims one of them. `sumCapturedForPayment` then reports the
	 * doubled figure, and `RefundService.assertRefundable` authorises refunds against money that was
	 * never taken. The `UPDATE` therefore names `capturedAmount` among its criteria — the same
	 * compare-and-swap `OrderLineService.recordRefund` makes — so the second writer changes no row and
	 * is answered with `PAYMENT_CAPTURE_CONFLICT` instead of silently winning.
	 *
	 * **The payment row and the ledger row are written in one transaction, payment first.** The order
	 * matters: a capture row written before the swap would be left behind by a refused swap, as a ledger
	 * entry for money the payment does not account for. Inside one transaction neither can outlive the
	 * other.
	 *
	 * @param input The capture to record.
	 * @returns The stored capture.
	 * @throws NotFoundException when the payment is not in the caller's organization.
	 * @throws BadRequestException when the payment was never authorised, when it is already fully
	 * captured, when the capture would pass what remains of the authorisation, or when it would take
	 * the collection past the amount it is for.
	 * @throws ConflictException with `PAYMENT_CAPTURE_CONFLICT` when another capture moved the payment's
	 * running total between this call reading it and writing it.
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

		const capturedAt = input.capturedAt ?? new Date();
		const capturedTotal = captured.add(amount);
		const capture = await this.typeOrmPaymentCaptureRepository.manager.transaction(async (manager) => {
			// The running total this call reasoned about is part of the criteria, so the statement lands
			// only while the payment still holds it. A second capture that read the same total changes no
			// row here and is refused below rather than overwriting the first one's figure.
			const written = await manager.update(
				Payment,
				{ id: payment.id, capturedAmount: this.asRead(payment.capturedAmount), ...this.scope } as never,
				{
					capturedAmount: capturedTotal.amount,
					capturedAt,
					status: this.derivePaymentStatus(
						payment,
						capturedTotal,
						Money.of(payment.refundedAmount ?? '0', currency)
					)
				} as never
			);

			if (readAffectedRows(written) === 0) {
				throw new ConflictException({
					message: `PAYMENT_CAPTURE_CONFLICT: payment '${payment.id}' was captured by another write between this capture reading its running total and writing it, so nothing was overwritten. Read the payment and capture again.`,
					code: 'PAYMENT_CAPTURE_CONFLICT',
					details: { paymentId: payment.id, capturedAmount: captured.amount }
				});
			}

			return manager.save(
				PaymentCapture,
				manager.create(PaymentCapture, {
					...input,
					paymentId: payment.id,
					amount: amount.amount,
					currency,
					capturedAt,
					...this.scope
				} as never)
			);
		});

		if (payment.paymentCollectionId) {
			await this.paymentCollectionService.recordCapture(payment.paymentCollectionId, amount.amount);
		}

		await this.publish(
			new PaymentCapturedEvent(
				capture.id,
				payment.id,
				amount.amount,
				currency,
				payment.organizationId ?? this.scope.organizationId
			),
			`capture ${capture.id}`
		);

		return this.findCaptureOrFail(capture.id);
	}

	/**
	 * One running total as the criteria of a compare-and-swap must state it.
	 *
	 * `= NULL` matches nothing in SQL, so a column that was read as absent has to be stated as
	 * `IS NULL` rather than as a zero that would look equivalent in JavaScript and match no row at all —
	 * which would turn every capture against such a payment into a permanent conflict. The column
	 * carries `default 0` and is written on every path, so this is the belt rather than the braces; a
	 * compare-and-swap whose criteria can silently match nothing is not one worth having.
	 *
	 * @param value The running total as the read handed it over.
	 * @returns The criteria value that matches the row this call read.
	 */
	private asRead(value: number | string | null | undefined): unknown {
		return value === null || value === undefined ? IsNull() : value;
	}

	/**
	 * Announces one capture event, awaited and with its failure absorbed.
	 *
	 * **Awaited**, because `EventBus.publish` is asynchronous and a call left dangling turns a consumer's
	 * throw into an unhandled promise rejection — which, under Node's default policy, terminates the API
	 * process and every in-flight request with it. It also ordered the publish after the response, so a
	 * client reading derived state immediately afterwards saw it stale.
	 *
	 * **Absorbed**, because by the time this runs the money has moved at the provider and the ledger row
	 * is committed. Failing the request over a consumer would tell the caller the capture failed when it
	 * did not, and the caller would capture again. The refusal is named and logged instead — the same
	 * division `RefundService.mirrorToOrderLines` makes for the same reason.
	 *
	 * @param event The event to publish.
	 * @param what What the event is about, used in the log line.
	 */
	private async publish(event: PaymentCapturedEvent, what: string): Promise<void> {
		try {
			await this.eventBus.publish(event);
		} catch (error) {
			console.log(
				chalk.yellow(
					`PAYMENT_EVENT_PUBLISH_FAILED: ${what} was recorded and its event was not delivered ` +
						`(${error instanceof Error ? error.message : String(error)}). The capture stands.`
				)
			);
		}
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
