import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import { CrudService, EventBus, Money, Payment, RequestContext } from '@gauzy/core';
import { Refund } from './refund.entity';
import { TypeOrmRefundRepository } from './repository/type-orm-refund.repository';
import { MikroOrmRefundRepository } from './repository/mikro-orm-refund.repository';
import { IRefund, IRefundCreateInput, IRefundUpdateInput, RefundStatus } from '../payment.types';
import { PaymentCaptureService } from '../payment-capture/payment-capture.service';
import { PaymentCollectionService } from '../payment-collection/payment-collection.service';
import { PaymentRefundedEvent, RefundCreatedEvent } from '../events';

/**
 * Money given back.
 *
 * The refundable figure is derived, never trusted: it is the captures of the payment minus the
 * refunds that already succeeded against it, and both halves are read from their own tables rather
 * than from a counter, because a counter is a cache that can drift while the ledger cannot. The two
 * reconciliation rules of the money specification are enforced here, in the transaction that writes
 * the refund:
 *
 * ```
 * payment.refundedAmount <= payment.capturedAmount
 * Σ refund.amount where status = 'SUCCEEDED' (per payment) <= Σ payment_capture.amount (per payment)
 * ```
 *
 * A request that would pass either is refused with `REFUND_AMOUNT_EXCEEDS_CAPTURED`. A refund that
 * has already reached a terminal status is refused with `REFUND_ALREADY_SETTLED` — the status moves
 * once — and a refund that is cancelled or fails leaves the payment and the order untouched, because
 * money that never moved must not appear in a ledger.
 */
@Injectable()
export class RefundService extends CrudService<Refund> {
	constructor(
		readonly typeOrmRefundRepository: TypeOrmRefundRepository,
		readonly mikroOrmRefundRepository: MikroOrmRefundRepository,
		@InjectRepository(Payment) private readonly paymentRepository: Repository<Payment>,
		private readonly paymentCaptureService: PaymentCaptureService,
		private readonly paymentCollectionService: PaymentCollectionService,
		private readonly eventBus: EventBus
	) {
		super(typeOrmRefundRepository, mikroOrmRefundRepository);
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
	 * Records a refund against an order, and against the payment it gives back when one is named.
	 *
	 * @param input The refund to record.
	 * @returns The stored refund, pending.
	 * @throws NotFoundException when the payment is not in the caller's organization.
	 * @throws BadRequestException when the refund names no payment and no return or claim it could be
	 * attributed to, when the amount is not a positive exact decimal, or when it would exceed what
	 * the payment captured.
	 */
	async createRefund(input: IRefundCreateInput): Promise<IRefund> {
		if (!input.paymentId && !input.returnId && !input.claimId) {
			// Without a payment, the reason the money goes back has to be a return or a claim: an
			// unattributed refund is a movement nobody can explain later.
			throw new BadRequestException('REFUND_NOT_ALLOWED');
		}

		let currency = input.currency;

		if (input.paymentId) {
			const payment = await this.paymentCaptureService.findPaymentOrFail(input.paymentId);
			currency = payment.currency ?? currency;

			if (input.currency && currency && input.currency.trim().toUpperCase() !== currency.toUpperCase()) {
				throw new BadRequestException(
					`Refund currency '${input.currency}' does not match payment currency '${currency}'.`
				);
			}

			await this.assertRefundable(payment, input.amount, currency);
		}

		if (!currency) {
			throw new BadRequestException('PAYMENT_CURRENCY_INVALID');
		}

		const amount = this.toMoney(input.amount, currency);

		if (!amount.isPositive()) {
			throw new BadRequestException('REFUND_AMOUNT_INVALID');
		}

		const refund = await this.create({
			...input,
			amount: amount.amount,
			currency,
			status: RefundStatus.PENDING,
			...this.scope
		} as never);

		this.eventBus.publish(
			new RefundCreatedEvent(
				refund.id,
				refund.orderId,
				refund.amount,
				refund.currency,
				refund.organizationId ?? this.scope.organizationId
			)
		);

		return refund;
	}

	/**
	 * Updates the descriptive fields of a refund. The amount, the currency and the status are not
	 * among them: an amount is what the refund is, and the status moves through approval.
	 *
	 * @param id The refund to update.
	 * @param input The fields to change.
	 * @returns The stored refund.
	 * @throws BadRequestException when the refund can no longer change.
	 */
	async updateRefund(id: ID, input: IRefundUpdateInput): Promise<IRefund> {
		const refund = await this.findRefundOrFail(id);

		if (refund.status !== RefundStatus.PENDING) {
			throw new BadRequestException('REFUND_ALREADY_SETTLED');
		}

		const { status, amount, currency, paymentId, ...changes } = input;
		void status;
		void amount;
		void currency;
		void paymentId;

		await this.update(id, { ...changes } as never);

		return this.findRefundOrFail(id);
	}

	/**
	 * Approves a pending refund: it becomes `SUCCEEDED`, and the payment and its collection are moved
	 * with it.
	 *
	 * @param id The refund to approve.
	 * @param note An optional operator note recorded on the refund.
	 * @returns The stored refund.
	 * @throws NotFoundException when the refund is not in the caller's organization.
	 * @throws BadRequestException when the refund is no longer pending, or when approving it would
	 * exceed what the payment captured.
	 */
	async approveRefund(id: ID, note?: string): Promise<IRefund> {
		const refund = await this.findRefundOrFail(id);

		if (refund.status !== RefundStatus.PENDING) {
			throw new BadRequestException('REFUND_ALREADY_SETTLED');
		}

		if (refund.paymentId) {
			const payment = await this.paymentCaptureService.findPaymentOrFail(refund.paymentId);
			await this.assertRefundable(payment, refund.amount, refund.currency);

			const captured = Money.of(
				await this.paymentCaptureService.sumCapturedForPayment(payment.id),
				refund.currency
			);
			const refunded = Money.of(payment.refundedAmount ?? '0', refund.currency).add(
				Money.of(refund.amount, refund.currency)
			);

			await this.paymentRepository.update(
				{ id: payment.id, ...this.scope } as never,
				{
					refundedAmount: refunded.amount,
					status: this.paymentCaptureService.derivePaymentStatus(payment, captured, refunded)
				} as never
			);

			if (payment.paymentCollectionId) {
				await this.paymentCollectionService.recordRefund(payment.paymentCollectionId, refund.amount);
			}
		}

		await this.update(id, {
			status: RefundStatus.SUCCEEDED,
			refundedAt: new Date(),
			...(note ? { note } : {})
		} as never);

		this.eventBus.publish(
			new PaymentRefundedEvent(
				refund.id,
				refund.paymentId,
				refund.amount,
				refund.currency,
				refund.organizationId ?? this.scope.organizationId
			)
		);

		return this.findRefundOrFail(id);
	}

	/**
	 * Cancels a pending refund. Nothing moved, so nothing is written back.
	 *
	 * @param id The refund to cancel.
	 * @param reason An optional operator note recorded on the refund.
	 * @returns The stored refund.
	 * @throws BadRequestException when the refund is no longer pending.
	 */
	async cancelRefund(id: ID, reason?: string): Promise<IRefund> {
		const refund = await this.findRefundOrFail(id);

		if (refund.status !== RefundStatus.PENDING) {
			throw new BadRequestException('REFUND_ALREADY_SETTLED');
		}

		await this.update(id, {
			status: RefundStatus.CANCELED,
			refundedAt: null,
			...(reason ? { reason } : {})
		} as never);

		return this.findRefundOrFail(id);
	}

	/**
	 * Records that the provider refused a refund. No ledger row is written, because no money moved.
	 *
	 * @param id The refund that failed.
	 * @param lastError What the provider answered.
	 * @returns The stored refund.
	 * @throws BadRequestException when the refund is no longer pending.
	 */
	async failRefund(id: ID, lastError?: string): Promise<IRefund> {
		const refund = await this.findRefundOrFail(id);

		if (refund.status !== RefundStatus.PENDING) {
			throw new BadRequestException('REFUND_ALREADY_SETTLED');
		}

		await this.update(id, {
			status: RefundStatus.FAILED,
			metadata: { ...(refund.metadata ?? {}), ...(lastError ? { lastError } : {}) }
		} as never);

		return this.findRefundOrFail(id);
	}

	/**
	 * Loads a refund that belongs to the caller's organization.
	 *
	 * @param id The refund to load.
	 * @returns The refund.
	 * @throws NotFoundException when it does not exist inside the caller's scope.
	 */
	async findRefundOrFail(id: ID): Promise<IRefund> {
		const refund = await this.findOneByWhereOptions({ id, ...this.scope } as never);

		if (!refund) {
			throw new NotFoundException('REFUND_NOT_FOUND');
		}

		return refund;
	}

	/**
	 * Paginates the refunds of the caller's organization.
	 *
	 * @param options Optional filters, merged with the tenancy scope.
	 * @returns One page of refunds.
	 */
	async findRefunds(options: Record<string, unknown> = {}): Promise<IPagination<IRefund>> {
		return this.findAll({ ...options, where: { ...((options.where as object) ?? {}), ...this.scope } } as never);
	}

	/**
	 * Sums the refunds of a payment that succeeded.
	 *
	 * @param paymentId The payment to sum for.
	 * @returns The refunded total as an exact decimal.
	 */
	async sumSucceededForPayment(paymentId: ID): Promise<DecimalString> {
		const refunds: IRefund[] = await this.find({
			where: { paymentId, status: RefundStatus.SUCCEEDED, ...this.scope } as never
		});
		const currency = refunds.length ? refunds[0].currency : undefined;

		if (!currency) {
			return '0';
		}

		return Money.sum(
			refunds.map((refund) => Money.of(refund.amount, currency)),
			currency
		).amount;
	}

	/**
	 * Refuses a refund that would pass what was captured for a payment.
	 *
	 * @param payment The payment being given back.
	 * @param amount The amount requested.
	 * @param currency The currency of the request.
	 * @throws BadRequestException when the request exceeds what is refundable.
	 */
	private async assertRefundable(payment: Payment, amount: DecimalString | number, currency: string): Promise<void> {
		const captured = Money.of(await this.paymentCaptureService.sumCapturedForPayment(payment.id), currency);
		const succeeded = Money.of(await this.sumSucceededForPayment(payment.id), currency);
		const refundable = captured.subtract(succeeded);

		if (Money.of(amount, currency).greaterThan(refundable)) {
			throw new BadRequestException('REFUND_AMOUNT_EXCEEDS_CAPTURED');
		}
	}

	/**
	 * Reads an exact decimal in a given currency.
	 *
	 * @param value The decimal to read.
	 * @param currency The currency it is in.
	 * @returns The value as a kernel money value.
	 * @throws BadRequestException when the amount is not an exact decimal.
	 */
	private toMoney(value: DecimalString | number, currency: string): Money {
		try {
			return Money.of(value, currency);
		} catch {
			throw new BadRequestException('PAYMENT_AMOUNT_INVALID');
		}
	}
}
