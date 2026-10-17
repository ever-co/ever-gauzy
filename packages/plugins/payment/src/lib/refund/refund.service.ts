import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
	Optional
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository, SaveOptions } from 'typeorm';
import * as chalk from 'chalk';
import { isMySQL } from '@gauzy/config';
import { CurrencyCode, DecimalString, ID, IPagination } from '@gauzy/contracts';
import { BaseEvent, EventBus, LegacyFindOneOptions, Money, Payment, readAffectedRows } from '@gauzy/core';
import { Refund } from './refund.entity';
import { RefundReason } from '../refund-reason/refund-reason.entity';
import { TypeOrmRefundRepository } from './repository/type-orm-refund.repository';
import { MikroOrmRefundRepository } from './repository/mikro-orm-refund.repository';
import { PaymentScopedCrudService } from '../payment-scoped-crud.service';
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
import { PaymentOrderLedgerMirror } from '../payment-order-ledger/payment-order-ledger.mirror';

/**
 * The statuses a refund may be retired from: the two that moved no money and never will. See
 * `RefundService.softRemove`.
 */
const RETIRABLE_REFUND_STATUSES: readonly RefundStatus[] = Object.freeze([RefundStatus.FAILED, RefundStatus.CANCELED]);

/**
 * The documents a refund names that live in another package's table: the order it gives money back for,
 * and the return or the claim that caused it. Each is read by name (this package imports neither the order
 * nor the returns package), inside the caller's tenant and organization, before a refund may cite it.
 */
const REFUND_SUBJECTS = Object.freeze({
	order: { table: 'order', code: 'REFUND_ORDER_NOT_FOUND', noun: 'order' },
	return: { table: 'order_return', code: 'REFUND_RETURN_NOT_FOUND', noun: 'return' },
	claim: { table: 'order_claim', code: 'REFUND_CLAIM_NOT_FOUND', noun: 'claim' }
});

type RefundSubjectKind = keyof typeof REFUND_SUBJECTS;

/** What a refund says it is for — the members whose ownership is checked before they are written. */
interface IRefundAttribution {
	orderId?: ID | null;
	returnId?: ID | null;
	claimId?: ID | null;
}

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
export class RefundService extends PaymentScopedCrudService<Refund> {
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
		private readonly orderLineRefunds?: IPaymentOrderLineRefundPort,
		/**
		 * Tells the order the money went back (Q7-W1b): the order's ledger carries a `REFUND` row for every
		 * succeeded refund, which is what moves its refunded total and its payment status. Optional and last.
		 */
		@Optional()
		private readonly orderLedger?: PaymentOrderLedgerMirror
	) {
		super(typeOrmRefundRepository, mikroOrmRefundRepository);
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
		// The refund API (REST `POST /refunds`, GraphQL `createRefund`) records money going back from a payment,
		// and is measured against what that payment captured. A refund that names no payment is measured against
		// nothing here — its ceiling is the return or claim that pays it back — so it is recorded only by that
		// flow (`ReturnRefundService`, through `createAttributedRefund`). Through this door it was how a refund
		// naming any return id could give back any amount (review R3-08).
		if (!input?.paymentId) {
			throw new BadRequestException({
				message:
					'REFUND_PAYMENT_REQUIRED: the refund API gives money back from a payment; a refund attributed only to a return or a claim is recorded by that return or claim.',
				code: 'REFUND_PAYMENT_REQUIRED'
			});
		}

		return this.recordRefund(input);
	}

	/**
	 * Records a refund that a return or a claim pays back — the one path on which a refund may name no
	 * payment. Its caller (`ReturnRefundService`) has already measured the amount against what the order's
	 * payments can still give back, and requires `REFUNDS_APPROVE` before it settles anything.
	 *
	 * @param input The refund to record.
	 * @returns The stored refund, pending.
	 */
	async createAttributedRefund(input: IRefundCreateInput): Promise<IRefund> {
		return this.recordRefund(input);
	}

	/**
	 * The write both entry points share.
	 *
	 * @param input The refund to record.
	 * @returns The stored refund, pending.
	 */
	private async recordRefund(input: IRefundCreateInput): Promise<IRefund> {
		if (!input.paymentId && !input.returnId && !input.claimId) {
			// Without a payment, the reason the money goes back has to be a return or a claim: an
			// unattributed refund is a movement nobody can explain later.
			throw new BadRequestException('REFUND_NOT_ALLOWED');
		}

		// What the refund cites has to be the caller's before it is written: the order, the return or the claim
		// and the governed reason. They were plain identifiers before, so a refund could name another
		// organization's (or tenant's) order, return or claim, or a return of a different order (review R3-08).
		await this.assertAttributionInScope(input);
		await this.assertReasonInScope(input.reasonId);

		let currency = input.currency;

		if (input.paymentId) {
			const payment = await this.paymentCaptureService.findPaymentOrFail(input.paymentId);
			currency = payment.currency ?? currency;

			// The refund is recorded against an order and paid back from a payment: they must be the same
			// order's, or the order's ledger would show money returned that its own payments never took.
			if (input.orderId && payment.orderId && String(input.orderId) !== String(payment.orderId)) {
				throw new BadRequestException({
					message: `REFUND_ORDER_MISMATCH: payment '${payment.id}' was not taken for order '${input.orderId}'.`,
					code: 'REFUND_ORDER_MISMATCH'
				});
			}

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

		await this.publish(
			new RefundCreatedEvent(
				refund.id,
				refund.orderId,
				refund.amount,
				refund.currency,
				refund.organizationId ?? this.scope.organizationId,
				refund.tenantId ?? this.scope.tenantId
			),
			`refund ${refund.id}`
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
	 * **What the refund is for is checked again when it changes, and where it lives does not change.** The REST
	 * body carries the whole create shape, so `orderId`, `returnId`, `claimId` and `reasonId` reached the row
	 * unchecked here even after creation had learned to check them — an update could re-point a refund at
	 * another organization's order, or at an order its payment was never taken for. A changed attribution is
	 * held to the same rules creation holds it to; `tenantId` / `organizationId` (and their objects) are never
	 * written from this body, because moving a refund out of the organization would take its money out of
	 * every ceiling the organization measures (review R3-08).
	 *
	 * @param id The refund to update.
	 * @param input The fields to change.
	 * @returns The stored refund.
	 * @throws BadRequestException when the refund can no longer change, or when a changed order, return or
	 * claim is not the caller's or not the refund's order's.
	 * @throws NotFoundException when a changed reason is not in the caller's organization.
	 */
	async updateRefund(id: ID, input: IRefundUpdateInput): Promise<IRefund> {
		const refund = await this.findRefundOrFail(id);

		if (refund.status !== RefundStatus.PENDING) {
			throw new BadRequestException('REFUND_ALREADY_SETTLED');
		}

		const {
			status,
			amount,
			currency,
			paymentId,
			lines,
			tenantId,
			organizationId,
			tenant,
			organization,
			...changes
		} = input as IRefundUpdateInput & Record<string, unknown>;
		void status;
		void amount;
		void currency;
		void paymentId;
		void lines;
		void tenantId;
		void organizationId;
		void tenant;
		void organization;

		const changed = (field: 'orderId' | 'returnId' | 'claimId' | 'reasonId'): boolean =>
			changes[field] !== undefined &&
			changes[field] !== null &&
			String(changes[field]) !== String((refund as unknown as Record<string, unknown>)[field] ?? '');

		// What the row will say once written: an explicit `null` clears a return or a claim, and only a member
		// the body leaves out keeps the stored value. The order is required and cannot be cleared.
		const next: IRefundAttribution = {
			orderId: (changes.orderId as ID) ?? refund.orderId,
			returnId: changes.returnId !== undefined ? (changes.returnId as ID | null) : refund.returnId,
			claimId: changes.claimId !== undefined ? (changes.claimId as ID | null) : refund.claimId
		};

		// A refund with no payment is explained by its return or its claim alone; clearing both would leave a
		// movement nobody can explain, which creation refuses as well.
		const clears = changes.returnId !== undefined || changes.claimId !== undefined;

		if (clears && !refund.paymentId && !next.returnId && !next.claimId) {
			throw new BadRequestException('REFUND_NOT_ALLOWED');
		}

		if (changed('orderId') || changed('returnId') || changed('claimId')) {
			// Ownership first, as on creation; then the payment the refund is paid back from.
			await this.assertAttributionInScope(next);

			if (changed('orderId') && refund.paymentId) {
				const payment = await this.paymentCaptureService.findPaymentOrFail(refund.paymentId);

				if (payment.orderId && String(next.orderId) !== String(payment.orderId)) {
					throw new BadRequestException({
						message: `REFUND_ORDER_MISMATCH: payment '${payment.id}' was not taken for order '${next.orderId}'.`,
						code: 'REFUND_ORDER_MISMATCH'
					});
				}
			}
		}

		if (changed('reasonId')) {
			await this.assertReasonInScope(changes.reasonId as ID);
		}

		await this.update(id, { ...changes } as never);

		return this.findRefundOrFail(id);
	}

	/**
	 * Approves a pending refund: it becomes `SUCCEEDED`, and the payment and its collection are moved
	 * with it.
	 *
	 * **The ceiling and the write are joined, or neither holds.** `assertRefundable` measures the
	 * request against `Σ captures − Σ succeeded refunds`, and the payment row is then written with an
	 * *absolute* new `refundedAmount` computed from the value this call read. Written unconditionally,
	 * two refunds for the whole captured amount approved at the same moment both see zero succeeded, both
	 * pass the ceiling, and both write the same total: the payment reports one refund while two are
	 * `SUCCEEDED` and twice the captured money has gone back. The `UPDATE` therefore names
	 * `refundedAmount` among its criteria, so the second writer changes no row and is refused with
	 * `REFUND_APPROVAL_CONFLICT`.
	 *
	 * **A pending refund counts towards the ceiling while it is being approved.** Two pending refunds are
	 * two intentions to give the same money back, and measuring an approval only against what has already
	 * succeeded admits both of them before either has moved. The approval therefore measures against the
	 * succeeded refunds *and* the other pending ones, which is what makes the compare-and-swap a refusal
	 * of the second rather than a race it happens to lose.
	 *
	 * @param id The refund to approve.
	 * @param note An optional operator note recorded on the refund.
	 * @returns The stored refund.
	 * @throws NotFoundException when the refund is not in the caller's organization.
	 * @throws BadRequestException when the refund is no longer pending, or when approving it would
	 * exceed what the payment captured.
	 * @throws ConflictException with `REFUND_APPROVAL_CONFLICT` when another refund moved the payment's
	 * running total between this call reading it and writing it.
	 */
	async approveRefund(id: ID, note?: string): Promise<IRefund> {
		const refund = await this.findRefundOrFail(id);

		// Approved here, a refund that names no payment would be settled against no ceiling at all; it is
		// settled by the return or claim that recorded it (`approveAttributedRefund`), under `REFUNDS_APPROVE`.
		if (!refund.paymentId) {
			throw new BadRequestException({
				message:
					'REFUND_PAYMENT_REQUIRED: a refund that names no payment is settled by the return or claim that recorded it.',
				code: 'REFUND_PAYMENT_REQUIRED'
			});
		}

		return this.settleRefund(refund, note);
	}

	/**
	 * Settles a refund a return or a claim recorded (`createAttributedRefund`), which may name no payment.
	 *
	 * @param id The refund to settle.
	 * @param note An optional operator note.
	 * @returns The stored refund.
	 */
	async approveAttributedRefund(id: ID, note?: string): Promise<IRefund> {
		return this.settleRefund(await this.findRefundOrFail(id), note);
	}

	/**
	 * The settlement both entry points share.
	 *
	 * @param refund The refund to settle, as read.
	 * @param note An optional operator note.
	 * @returns The stored refund.
	 */
	private async settleRefund(refund: IRefund, note?: string): Promise<IRefund> {
		const id = refund.id;

		if (refund.status !== RefundStatus.PENDING) {
			throw new BadRequestException('REFUND_ALREADY_SETTLED');
		}

		let payment: Payment | undefined;
		let captured: Money | undefined;
		let refunded: Money | undefined;

		if (refund.paymentId) {
			payment = await this.paymentCaptureService.findPaymentOrFail(refund.paymentId);
			await this.assertRefundable(payment, refund.amount, refund.currency, { excludeRefundId: refund.id });

			captured = Money.of(await this.paymentCaptureService.sumCapturedForPayment(payment.id), refund.currency);
			refunded = Money.of(payment.refundedAmount ?? '0', refund.currency).add(
				Money.of(refund.amount, refund.currency)
			);
		}

		// The payment, its collection and the refund's own status are one write. They used to be three: a
		// collection that refused the refund (its ceiling) left the payment already moved and the refund
		// still pending, and the collection's total was read and replaced with no lock, so two approvals
		// against one collection that overlapped both read the same total and one increment was lost.
		await this.typeOrmRefundRepository.manager.transaction(async (manager) => {
			if (payment && captured && refunded) {
				const written = await manager.update(
					Payment,
					{
						id: payment.id,
						// The running total this approval reasoned about. The statement lands only while the
						// payment still holds it, which is what turns the ceiling above into a guarantee rather
						// than a check two concurrent approvals can both pass. A total read as absent is stated
						// as `IS NULL`, because `= NULL` matches nothing and would make the payment permanently
						// unrefundable rather than merely protected.
						refundedAmount: (payment.refundedAmount === null || payment.refundedAmount === undefined
							? IsNull()
							: payment.refundedAmount) as never,
						...this.scope
					} as never,
					{
						refundedAmount: refunded.amount,
						status: this.paymentCaptureService.derivePaymentStatus(payment, captured, refunded)
					} as never
				);

				if (readAffectedRows(written) === 0) {
					throw new ConflictException({
						message: `REFUND_APPROVAL_CONFLICT: payment '${payment.id}' was refunded by another write between this approval reading its running total and writing it, so nothing was overwritten. Read the payment and approve again.`,
						code: 'REFUND_APPROVAL_CONFLICT',
						details: {
							paymentId: payment.id,
							refundId: refund.id,
							refundedAmount: payment.refundedAmount ?? '0'
						}
					});
				}

				if (payment.paymentCollectionId) {
					// Under the collection's row lock and conditional on its totals, on this transaction.
					await this.paymentCollectionService.recordRefund(
						payment.paymentCollectionId,
						refund.amount,
						manager
					);
				}
			}

			// Settled only while it is still pending: an approval that overlapped another approval, a
			// cancellation or a failure of the same refund changes nothing here and rolls its money back.
			const settled = await manager.update(
				Refund,
				{ id: refund.id, status: RefundStatus.PENDING, ...this.scope } as never,
				{
					status: RefundStatus.SUCCEEDED,
					refundedAt: new Date(),
					...(note ? { note } : {})
				} as never
			);

			if (readAffectedRows(settled) === 0) {
				throw new BadRequestException('REFUND_ALREADY_SETTLED');
			}
		});

		/**
		 * The register moves here rather than at creation, because a register counts **succeeded**
		 * refunds: a pending refund is an intention, and one that is cancelled or refused leaves the
		 * order untouched. The status has already moved, so a reader never sees a register counting money
		 * that has not gone back.
		 */
		await this.mirrorToOrderLines(await this.findRefundOrFail(id));

		// A refund that names only the payment it gives back belongs to that payment's order, and the order's
		// ledger has to hear of it all the same (Greptile on #10897).
		const refundOrderId = refund.orderId ?? payment?.orderId;

		if (refundOrderId) {
			await this.orderLedger?.mirror(
				{
					orderId: refundOrderId,
					type: 'REFUND',
					amount: refund.amount,
					currency: refund.currency,
					referenceType: 'REFUND',
					referenceId: refund.id,
					...(refund.paymentId ? { paymentId: refund.paymentId } : {}),
					occurredAt: new Date()
				},
				`refund ${refund.id}`
			);
		}

		await this.publish(
			new PaymentRefundedEvent(
				refund.id,
				refund.paymentId,
				refund.amount,
				refund.currency,
				refund.organizationId ?? this.scope.organizationId,
				refund.tenantId ?? this.scope.tenantId
			),
			`refund ${refund.id}`
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
	 * Announces one refund event, awaited and with its failure absorbed.
	 *
	 * **Awaited**, because `EventBus.publish` is asynchronous and a call left dangling turns a consumer's
	 * throw into an unhandled promise rejection — which, under Node's default policy, terminates the API
	 * process and every in-flight request with it. It also ordered the publish after the response, so a
	 * client reading derived state immediately afterwards saw it stale.
	 *
	 * **Absorbed**, for the reason `mirrorToOrderLines` states just above: by the time this runs the
	 * money has gone back at the provider and the refund is already `SUCCEEDED`, so failing the request
	 * over a consumer would tell the caller the refund failed when it did not, and the caller would
	 * refund again.
	 *
	 * @param event The event to publish.
	 * @param what What the event is about, used in the log line.
	 */
	private async publish(event: BaseEvent, what: string): Promise<void> {
		try {
			await this.eventBus.publish(event);
		} catch (error) {
			console.log(
				chalk.yellow(
					`PAYMENT_EVENT_PUBLISH_FAILED: ${what} was recorded and its event was not delivered ` +
						`(${this.describe(error)}). The refund stands.`
				)
			);
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
	 * Retires a refund recoverably — only one that never moved money and never will.
	 *
	 * **A retired refund drops out of every read, and the refundable figure is one of them.** That figure
	 * is the captures of the payment minus {@link sumSucceededForPayment}, which reads the succeeded
	 * refunds through the ordinary, soft-delete-filtered read. Retiring a `SUCCEEDED` refund therefore
	 * handed the money it gave back to the next refund as refundable again, and the same payment could be
	 * paid back twice. A `PENDING` refund is not retired either: it may still be in flight at the
	 * provider, a callback that settles it would no longer find it, and `cancelRefund` is the act that
	 * withdraws it. What remains — `FAILED` and `CANCELED` — moved nothing, and retiring one changes no
	 * figure. `13` §11.4 keeps `refund` "soft delete only; no hard delete through the API", so this is the
	 * one way a refund leaves the reads, on both surfaces: `DELETE /refunds/:id`, `DELETE /refunds/:id/soft`
	 * and the `softDeleteRefund` field all reach it.
	 *
	 * @param id The refund to retire.
	 * @param options Find options, forwarded to the scoped kernel read.
	 * @param saveOptions The kernel's save options, forwarded unchanged.
	 * @returns The retired refund.
	 * @throws NotFoundException when the refund is not in the caller's organization.
	 * @throws BadRequestException with `REFUND_NOT_RETIRABLE` when the refund succeeded or is still pending.
	 */
	public async softRemove(
		id: ID,
		options?: LegacyFindOneOptions<Refund>,
		saveOptions?: SaveOptions
	): Promise<Refund> {
		const refund = await this.findRefundOrFail(id);

		if (!RETIRABLE_REFUND_STATUSES.includes(refund.status as RefundStatus)) {
			throw new BadRequestException('REFUND_NOT_RETIRABLE');
		}

		return super.softRemove(id, options, saveOptions);
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
	 * The requested amount is read through the same conversion the rest of the request is read with,
	 * so that a malformed amount is the documented `PAYMENT_AMOUNT_INVALID` refusal here as well as on
	 * the path that has no payment to compare it against, rather than the money kernel's own error
	 * escaping as a server fault.
	 *
	 * **An approval measures against the pending refunds too.** At creation the question is "could this
	 * refund be paid?", and a pending refund is an intention rather than money that moved — counting it
	 * would refuse a second request that a cancellation of the first would have made room for. At
	 * approval the question is "may this money leave now?", and every other pending refund of the same
	 * payment is money that is about to leave as well: measuring only against what has already succeeded
	 * admits two full refunds of one capture, because neither has succeeded when either is approved. The
	 * refund being approved is excluded from that sum, since it is the one whose amount is the request.
	 *
	 * @param payment The payment being given back.
	 * @param amount The amount requested.
	 * @param currency The currency of the request.
	 * @param options The refund being approved, whose own pending row is not counted against it. Absent
	 * on the creation path, which measures against the succeeded refunds only.
	 * @throws BadRequestException when the amount is not an exact decimal or when the request exceeds
	 * what is refundable.
	 */
	private async assertRefundable(
		payment: Payment,
		amount: DecimalString | number,
		currency: string,
		options: { excludeRefundId?: ID } = {}
	): Promise<void> {
		const requested = this.toMoney(amount, currency);
		const captured = Money.of(await this.paymentCaptureService.sumCapturedForPayment(payment.id), currency);
		const succeeded = Money.of(await this.sumSucceededForPayment(payment.id), currency);
		const committed = options.excludeRefundId
			? succeeded.add(Money.of(await this.sumPendingForPayment(payment.id, options.excludeRefundId), currency))
			: succeeded;
		const refundable = captured.subtract(committed);

		if (requested.greaterThan(refundable)) {
			throw new BadRequestException('REFUND_AMOUNT_EXCEEDS_CAPTURED');
		}

		// **The order's money is one ceiling, and a refund that names no payment spends from it too.** A return
		// or a claim refund that no single payment could carry is recorded against the return or the claim with
		// no payment (`createAttributedRefund`), so no payment's own figure ever counts it. Measured per payment
		// only, an order paid 10 + 10 that already gave 15 back that way still let each payment refund its own
		// 10 — 35 back on 20 taken (review R3-08). When the order has such refunds, the request is measured
		// against what the order's payments can still give back between them, less those refunds.
		if (payment.orderId) {
			const unattributed = Money.of(await this.sumUnattributedForOrder(payment.orderId, currency), currency);

			if (unattributed.isPositive()) {
				const orderRefundable = Money.of(
					await this.sumOrderHeadroom(payment.orderId, currency, options.excludeRefundId),
					currency
				).subtract(unattributed);

				if (requested.greaterThan(orderRefundable)) {
					throw new BadRequestException('REFUND_AMOUNT_EXCEEDS_CAPTURED');
				}
			}
		}
	}

	/**
	 * Sums the refunds of an order that name no payment and still stand — succeeded, or pending.
	 *
	 * These are the refunds a return or a claim recorded against itself because no single payment could carry
	 * them (`createAttributedRefund`): no payment's own ledger counts them, so the order-wide ceiling has to.
	 * A pending one counts as well, because that path records and settles in one call — a pending row is a
	 * settlement still in flight beside this one, or one that failed half way and is withdrawn with
	 * `cancelRefund`, which is what makes its money count again. A cancelled or failed one moved nothing and
	 * does not count.
	 *
	 * The rows are read by order, status and scope and the missing payment is filtered here, so the read is
	 * the plain criteria both ORMs answer alike.
	 *
	 * @param orderId The order to sum for.
	 * @param currency The currency the ceiling is measured in; a refund in another currency is not comparable.
	 * @returns The total, as an exact decimal.
	 */
	async sumUnattributedForOrder(orderId: ID, currency: string): Promise<DecimalString> {
		const standing: IRefund[] = [];

		for (const status of [RefundStatus.SUCCEEDED, RefundStatus.PENDING]) {
			standing.push(...((await this.find({ where: { orderId, status, ...this.scope } as never })) ?? []));
		}

		const unattributed = standing.filter(
			(refund) => !refund.paymentId && String(refund.currency ?? '').toUpperCase() === currency.toUpperCase()
		);

		if (!unattributed.length) {
			return '0';
		}

		return Money.sum(
			unattributed.map((refund) => Money.of(refund.amount, currency)),
			currency
		).amount;
	}

	/**
	 * What every payment of an order can still give back between them, in one currency — the same two figures
	 * per payment that `assertRefundable` reads (captures less succeeded refunds, less the other pending ones
	 * on an approval), each floored at zero so a payment that gave back more than it took does not reduce the
	 * others.
	 *
	 * @param orderId The order.
	 * @param currency The currency to measure in; a payment in another currency is left out.
	 * @param excludeRefundId On an approval, the refund being approved, whose own pending row is not counted.
	 * @returns The headroom, as an exact decimal.
	 */
	private async sumOrderHeadroom(orderId: ID, currency: string, excludeRefundId?: ID): Promise<DecimalString> {
		const payments: Payment[] =
			(await this.paymentRepository.find({ where: { orderId, ...this.scope } as never })) ?? [];
		let total = Money.zero(currency as CurrencyCode);

		for (const payment of payments) {
			if (String(payment.currency ?? currency).toUpperCase() !== currency.toUpperCase()) {
				continue;
			}

			let headroom = Money.of(
				await this.paymentCaptureService.sumCapturedForPayment(payment.id),
				currency
			).subtract(Money.of(await this.sumSucceededForPayment(payment.id), currency));

			if (excludeRefundId) {
				headroom = headroom.subtract(
					Money.of(await this.sumPendingForPayment(payment.id, excludeRefundId), currency)
				);
			}

			total = total.add(headroom.isNegative() ? Money.zero(currency as CurrencyCode) : headroom);
		}

		return total.amount;
	}

	/**
	 * Refuses an order, a return or a claim that is not the caller's, and a return or a claim of another order.
	 *
	 * The three are other packages' rows, read by table name through the writing manager — the way the line
	 * breakdown reads `order_line` — inside the caller's tenant and organization. Ownership is the question,
	 * not liveness, so a retired row of the caller's still answers. A table the installation does not register
	 * (the order or the returns package is not installed) has nothing to check against and no other tenant's
	 * row to leak into, and the identifier is kept as the plain attribution it always was.
	 *
	 * @param attribution The order, return and claim the refund names.
	 * @throws BadRequestException with `REFUND_ORDER_NOT_FOUND` / `REFUND_RETURN_NOT_FOUND` /
	 * `REFUND_CLAIM_NOT_FOUND` when one is not the caller's, and `REFUND_RETURN_ORDER_MISMATCH` /
	 * `REFUND_CLAIM_ORDER_MISMATCH` when a return or a claim belongs to another order.
	 */
	private async assertAttributionInScope(attribution: IRefundAttribution): Promise<void> {
		const manager = this.typeOrmRefundRepository.manager;

		if (attribution.orderId) {
			await this.findSubjectInScope(manager, 'order', attribution.orderId);
		}

		for (const kind of ['return', 'claim'] as const) {
			const id = kind === 'return' ? attribution.returnId : attribution.claimId;

			if (!id) {
				continue;
			}

			const subject = await this.findSubjectInScope(manager, kind, id);

			if (subject?.orderId && attribution.orderId && String(subject.orderId) !== String(attribution.orderId)) {
				const code = `REFUND_${kind.toUpperCase()}_ORDER_MISMATCH`;

				throw new BadRequestException({
					message: `${code}: ${REFUND_SUBJECTS[kind].noun} '${id}' was not raised against order '${attribution.orderId}'.`,
					code
				});
			}
		}
	}

	/**
	 * Reads one order, return or claim inside the caller's scope.
	 *
	 * @param manager The manager to read through.
	 * @param kind Which document.
	 * @param id Its identifier.
	 * @returns The row's id and, for a return or a claim, its order — or `null` when the installation does
	 * not register the table.
	 * @throws BadRequestException when the row is not the caller's.
	 */
	private async findSubjectInScope(
		manager: EntityManager,
		kind: RefundSubjectKind,
		id: ID
	): Promise<{ id: ID; orderId?: ID | null } | null> {
		const { table, code, noun } = REFUND_SUBJECTS[kind];

		if (!manager?.dataSource?.hasMetadata?.(table)) {
			return null;
		}

		const { tenantId, organizationId } = this.scope;
		const subject = this.q('subject');
		const query = manager
			.createQueryBuilder()
			.select(`${subject}.${this.q('id')}`, 'id')
			.from(table, 'subject')
			.where(`${subject}.${this.q('id')} = :refundSubjectId`, { refundSubjectId: id })
			.andWhere(`${subject}.${this.q('tenantId')} = :tenantId`, { tenantId })
			.andWhere(`${subject}.${this.q('organizationId')} = :organizationId`, { organizationId });

		if (kind !== 'order') {
			query.addSelect(`${subject}.${this.q('orderId')}`, 'orderId');
		}

		const rows: Array<{ id: ID; orderId?: ID | null }> = (await query.getRawMany()) ?? [];

		if (!rows.length) {
			throw new BadRequestException({
				message: `${code}: ${noun} '${id}' is not a ${noun} of this organization.`,
				code
			});
		}

		return rows[0];
	}

	/**
	 * Refuses a governed reason that is not the caller's. The reason is this package's own row and the refund
	 * holds a foreign key to it, so another tenant's reason was accepted and then answered with the refund.
	 *
	 * @param reasonId The reason the refund cites, when it cites one.
	 * @throws NotFoundException with `REFUND_REASON_NOT_FOUND` when it is not in the caller's organization.
	 */
	private async assertReasonInScope(reasonId?: ID | null): Promise<void> {
		if (!reasonId) {
			return;
		}

		const reason = await this.typeOrmRefundRepository.manager.findOne(RefundReason, {
			where: { id: reasonId, ...this.scope } as never
		});

		if (!reason) {
			throw new NotFoundException('REFUND_REASON_NOT_FOUND');
		}
	}

	/**
	 * Quotes an identifier for the active dialect, as the line breakdown's read of `order_line` does.
	 *
	 * @param identifier The column or alias name to quote.
	 * @returns The quoted identifier.
	 */
	private q(identifier: string): string {
		return isMySQL() ? `\`${identifier}\`` : `"${identifier}"`;
	}

	/**
	 * Sums the refunds of a payment that are still waiting for a decision.
	 *
	 * @param paymentId The payment to sum for.
	 * @param exceptRefundId A refund to leave out, which is the one being approved.
	 * @returns The pending total as an exact decimal.
	 */
	private async sumPendingForPayment(paymentId: ID, exceptRefundId: ID): Promise<DecimalString> {
		const refunds: IRefund[] = await this.find({
			where: { paymentId, status: RefundStatus.PENDING, ...this.scope } as never
		});
		const others = refunds.filter((refund) => refund.id !== exceptRefundId);
		const currency = others.length ? others[0].currency : undefined;

		if (!currency) {
			return '0';
		}

		return Money.sum(
			others.map((refund) => Money.of(refund.amount, currency)),
			currency
		).amount;
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
