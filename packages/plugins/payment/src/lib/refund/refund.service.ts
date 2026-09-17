import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as chalk from 'chalk';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import { CrudService, EventBus, Money, Payment, RequestContext } from '@gauzy/core';
import { Refund } from './refund.entity';
import { TypeOrmRefundRepository } from './repository/type-orm-refund.repository';
import { MikroOrmRefundRepository } from './repository/mikro-orm-refund.repository';
import {
	IPaymentOrderLineRefundPort,
	IRefund,
	IRefundCreateInput,
	IRefundLine,
	IRefundUpdateInput,
	PAYMENT_ORDER_LINE_REFUND,
	RefundStatus
} from '../payment.types';
import { PaymentCaptureService } from '../payment-capture/payment-capture.service';
import { PaymentCollectionService } from '../payment-collection/payment-collection.service';
import { RefundLineService } from '../refund-line/refund-line.service';
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
 *
 * **What the refund paid back is rows, not an array.** A request may carry the `lines` it settles, and
 * they are written with the refund in one transaction through the refund-line service, which is what
 * makes `Σ refund_line.amount <= refund.amount` a fact about the stored data rather than a hope about
 * the caller.
 *
 * **A succeeded refund moves the order line's register, through a port rather than an import.** The
 * lines this domain stores are the evidence for `order_line.refundedQuantity` / `refundedAmount`, which
 * the order package owns and is the only place that can move — one guarded write, conditional on the
 * counters the transaction read. This service reports what it paid back, per line, through
 * `IPaymentOrderLineRefundPort`, which is optional: a deployment without the order package still
 * refunds, and the lines it could not mirror are reported under
 * `PAYMENT_ORDER_LINE_REFUND_UNAVAILABLE` rather than left silently unmirrored.
 */
@Injectable()
export class RefundService extends CrudService<Refund> {
	constructor(
		readonly typeOrmRefundRepository: TypeOrmRefundRepository,
		readonly mikroOrmRefundRepository: MikroOrmRefundRepository,
		@InjectRepository(Payment) private readonly paymentRepository: Repository<Payment>,
		private readonly paymentCaptureService: PaymentCaptureService,
		private readonly paymentCollectionService: PaymentCollectionService,
		private readonly refundLineService: RefundLineService,
		private readonly eventBus: EventBus,
		/**
		 * The order line's refund register, when the order capability is registered. Optional in the
		 * literal sense: nothing in this package provides the token, and a deployment that does not
		 * install the order package must still boot and refund.
		 */
		@Optional()
		@Inject(PAYMENT_ORDER_LINE_REFUND)
		private readonly orderLineRefunds?: IPaymentOrderLineRefundPort
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
	 * **The refund row and the lines that explain it are written in one transaction.** A request that
	 * carries `lines` writes one `refund_line` row per entry as part of the same unit of work that
	 * writes the refund, so a refund can never be stored without the breakdown it was asked for, and no
	 * reader can observe a refund whose lines sum to more than it gives back. Every line is checked
	 * first: it must name an order line of the caller's organization, its magnitudes must be positive
	 * exact decimals, and the sum of the lines may not pass the refund's own amount.
	 *
	 * @param input The refund to record, with the lines it paid back when the caller knows them.
	 * @returns The stored refund, pending.
	 * @throws NotFoundException when the payment is not in the caller's organization.
	 * @throws BadRequestException when the refund names no payment and no return or claim it could be
	 * attributed to, when the amount is not a positive exact decimal, when it would exceed what the
	 * payment captured, or when a line it carries is not writable.
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

		const { lines, ...fields } = input;

		const refund = await this.typeOrmRefundRepository.manager.transaction(async (manager) => {
			const row = manager.create(Refund, {
				...fields,
				amount: amount.amount,
				currency,
				status: RefundStatus.PENDING,
				...this.scope
			} as Partial<Refund>);
			const saved = await manager.save(Refund, row);

			if (lines?.length) {
				await this.refundLineService.appendLines(manager, saved, lines);
			}

			return saved;
		});

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
	 * among them: an amount is what the refund is, and the status moves through approval. Neither is
	 * the line breakdown, which is written with the refund and maintained through the refund-line
	 * routes — a breakdown changed from here would be a second, quieter way to say what the refund is
	 * for.
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

		const { status, amount, currency, paymentId, lines, ...changes } = input;
		void status;
		void amount;
		void currency;
		void paymentId;
		void lines;

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

		/**
		 * The register moves here rather than at creation, because a register counts **succeeded**
		 * refunds: a pending refund is an intention, and one that is cancelled or refused leaves the
		 * order untouched. The status has already moved, so a reader never sees a register counting money
		 * that has not gone back.
		 */
		await this.mirrorToOrderLines(await this.findRefundOrFail(id));

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
	 * Reports a succeeded refund to the order line's register, one line at a time.
	 *
	 * The register is the order package's column and this service never writes it: it reports what it
	 * paid back, per line, and the capability that owns the line moves the counter in one guarded write.
	 * The lines are read from `refund_line`, which is this package's own table, so a refund whose
	 * breakdown is an array in its metadata — one written before the breakdown became rows — is reported
	 * from that array rather than skipped.
	 *
	 * **Nothing here may fail the refund.** The money has already moved at the provider and the refund is
	 * already `SUCCEEDED`, so a report that throws afterwards would tell the caller the refund failed
	 * when it did not, and the caller would retry a refund that has already gone back. A refused report
	 * is logged under a named code and the remaining lines are still reported, because one line the
	 * register cannot move — a line that has not been invoiced enough, say — is no reason to leave the
	 * others unmirrored. The reconciliation half is the order package's `recomputeRefundCounters`, which
	 * re-derives the register from totals this domain reports, so a report that was lost converges
	 * rather than needing a manual correction.
	 *
	 * @param refund The refund that has just succeeded.
	 */
	private async mirrorToOrderLines(refund: IRefund): Promise<void> {
		const lines = await this.refundLineService.findLines(refund.id);

		if (!lines.length) {
			// A refund that names no order line — one settled against a return, a claim or a bare
			// payment — has no register to move, which is a fact rather than a failure.
			return;
		}

		if (!this.orderLineRefunds) {
			console.log(
				chalk.yellow(
					`PAYMENT_ORDER_LINE_REFUND_UNAVAILABLE: refund ${refund.id} succeeded and the order line ` +
						`register is not registered in this deployment, so ${lines.length} order line(s) were ` +
						'not mirrored. Re-report them through the order capability once it is present.'
				)
			);

			return;
		}

		for (const line of lines) {
			try {
				await this.orderLineRefunds.recordRefund({
					orderLineId: line.orderLineId,
					quantity: line.quantity,
					amount: line.amount,
					currency: line.currency ?? refund.currency
				});
			} catch (error) {
				console.log(
					chalk.yellow(
						`PAYMENT_ORDER_LINE_REFUND_FAILED: refund ${refund.id} succeeded and order line ` +
							`${line.orderLineId} was not mirrored (${this.describe(error)}). The refund stands; ` +
							'recompute the line register from the refund totals to reconcile it.'
					)
				);
			}
		}
	}

	/**
	 * A thrown value as a line of text, for a report that must not itself throw.
	 *
	 * @param error Whatever was thrown.
	 * @returns The message, or the value as text.
	 */
	private describe(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
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
	 * The lines a refund paid back, resolved through the refund-line service.
	 *
	 * A refund does not map its breakdown as a relation: the lines are owned by their own service, which
	 * is also the only place that knows how to answer for a refund written before the breakdown became
	 * rows.
	 *
	 * @param id The refund to read.
	 * @returns The lines of the refund, each marked `legacy` when it came from the metadata array of a
	 * refund written before this package recorded a line as a row.
	 * @throws NotFoundException when the refund is not in the caller's organization.
	 */
	async findRefundLines(id: ID): Promise<IRefundLine[]> {
		return this.refundLineService.findLines(id);
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
