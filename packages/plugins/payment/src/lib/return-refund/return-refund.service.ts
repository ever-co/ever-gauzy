import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CurrencyCode, DecimalString, ID, PermissionsEnum } from '@gauzy/contracts';
import { Money, Payment, RequestContext, compareDecimalStrings } from '@gauzy/core';
import { PaymentPermission } from '../payment.permissions';
import {
	IRefund,
	IReturnRefundFound,
	IReturnRefundLookup,
	IReturnRefundRequest,
	IReturnRefundResult,
	REFUND_IDEMPOTENCY_KEY,
	RefundStatus
} from '../payment.types';
import { RefundService } from '../refund/refund.service';
import { PaymentCaptureService } from '../payment-capture/payment-capture.service';
import { RefundReasonService } from '../refund-reason/refund-reason.service';

/**
 * The metadata member an exchange reference is kept under.
 *
 * A refund may be caused by an exchange, and the exchange it was caused by is a row of the domain
 * that ran it: the refund keeps the reference in its own open-ended payload, which is the one place
 * this table keeps identifiers its columns do not name, rather than a column that would tie this
 * domain's schema to another's.
 */
const EXCHANGE_KEY = 'exchangeId';

/** The refusal a refund is given when nothing can be found that explains the money going back. */
const NOT_ATTRIBUTED =
	'REFUND_PAYMENT_UNAVAILABLE: the order has no captured payment the amount can be paid back from, ' +
	'and the request names no return the refund could be attributed to.';

/**
 * The money a return or a claim pays back.
 *
 * Asking for a refund and recording one are different questions, and this is the entry point that
 * answers the first: the caller states the order, the flow that caused it, the exact amount and its
 * currency, and gets back the identifier of the refund that was written. The row itself stays this
 * domain's — the caller never names a payment, a status or a breakdown, and never sees the refund
 * entity — and every rule of the refund lifecycle runs, because the write goes through the service
 * that owns it rather than through this class.
 *
 * Four things it decides that the caller cannot:
 *
 * 1. **What the refund is attributed to.** A refund that cites nothing is a movement nobody can
 *    explain later, so the service that writes one refuses it. The return is the caller's own
 *    reference and is passed through. When the request names none — a claim, which is a complaint
 *    about an order rather than about a return — the attribution is resolved here: the payments
 *    recorded against the order are read inside the caller's tenant and organization, and the one
 *    whose captured money can still cover the amount is named. That is also what makes the refund
 *    answerable at all on a path that names no payment of its own.
 * 2. **That the money was already collected.** A payment can only be named when its captures, less
 *    the refunds that already succeeded against it, still cover the amount — the same figure the
 *    refund service measures against, read rather than assumed. A return refund that no payment can
 *    carry is still recorded against the return, because a return's money may have come in through
 *    means no payment row records; a claim refund with nothing to attribute it to is refused, and
 *    refused by name. **That escape is for an order with no recorded money, not for one being
 *    over-refunded.** An order that does have captured payments is measured against what they can
 *    still give back between them, because a refund that names no payment is a refund
 *    `RefundService.assertRefundable` never sees — which is how a return for one $20 item could be
 *    refunded for 100000, repeatedly, with nothing to stop it.
 * 3. **That the refund has settled.** The capability this answers is "the money went back", not "an
 *    intention to send it": the caller records what it paid back on its own flow, so a refund left
 *    pending would have it record money that has not moved. The record and the settlement are both
 *    the refund service's own transitions — the status machine, the payment's refunded total, its
 *    collection and the domain event all move through them — and the facade composes them rather
 *    than writing a status.
 * 4. **That the answer is the stored refund.** The identifier, the amount and the currency are read
 *    back from the row that was written, never echoed from the request, so an amount the platform
 *    rounded and a currency the payment settles in are answered as they were recorded.
 *
 * The class owns no table and writes nothing of its own.
 */
@Injectable()
export class ReturnRefundService {
	constructor(
		private readonly refundService: RefundService,
		private readonly paymentCaptureService: PaymentCaptureService,
		private readonly refundReasonService: RefundReasonService,
		@InjectRepository(Payment)
		private readonly paymentRepository: Repository<Payment>
	) {}

	/**
	 * Records the refund a return or a claim pays back, and settles it.
	 *
	 * @param request The order, the flow that caused the refund, the amount and its currency.
	 * @returns The refund that was written, named as the caller knows it.
	 * @throws BadRequestException when no order was named, when the amount or the currency is not a
	 * monetary value, when the refund cites a reason that is not the caller's, when the order has no
	 * captured payment the amount can be paid back from and no return to attribute it to, or when the
	 * refund service refuses the request for its own reasons.
	 * @throws NotFoundException when a reason the refund cites is not in the caller's organization.
	 */
	public async createRefund(request: IReturnRefundRequest): Promise<IReturnRefundResult> {
		// Before anything is read or written: this entry point records AND settles the refund, so it is held to
		// the grant that settles one (review R3-09).
		this.assertMayRefund();

		if (!request?.orderId) {
			throw new BadRequestException(
				'REFUND_ORDER_REQUIRED: a refund is recorded against the order it gives money back for.'
			);
		}

		/**
		 * The amount and the currency are read through the platform money layer before anything is
		 * decided, because what the refund may be attributed to depends on the amount: the figure a
		 * payment can still carry is compared against it. A value the kernel refuses is refused here
		 * with the code the refund service refuses it with, rather than being compared as something it
		 * is not.
		 */
		const requested = this.moneyOrFail(request.amount, request.currency);

		if (request.reasonId) {
			// The governed reason is this domain's own row, so a reason that is not the caller's is refused
			// by name here rather than surfacing as a foreign key violation at the end of the write.
			await this.refundReasonService.findReasonOrFail(request.reasonId);
		}

		// **A retry under the same key gets the refund it already produced** (review R3-09r2). A refund whose
		// answer was lost, or whose outcome nobody saw, is found by its return or claim and its key before anything
		// is measured or written: a succeeded one is answered as it is, a pending one is settled.
		if (request.idempotencyKey) {
			const existing = await this.answerExisting(request);

			if (existing) {
				return existing;
			}
		}

		const attribution = await this.attributedPayment(request, requested);
		const paymentId = attribution.paymentId;

		/**
		 * **The escape below is for an order that took money the platform never recorded, not for an
		 * order that is being over-refunded.** A refund the caller could not attribute to a payment is
		 * measured against nothing: `RefundService.assertRefundable` runs only inside `if (paymentId)`,
		 * so a return refund with no payment named passed straight through, and a request for 100000
		 * against a return for one $20 item was written and accumulated without limit. The two cases are
		 * told apart by whether the order has any captured money at all in this currency. It has none —
		 * a manual settlement, a credit the platform never processed — and the documented escape stands.
		 * It has some, and the amount is above what those payments can still give back, and that is an
		 * over-refund whatever it is attributed to: it is refused by the name the refund service already
		 * refuses it by, with the figure it was measured against.
		 */
		if (attribution.headroom !== undefined && compareDecimalStrings(requested.amount, attribution.headroom) > 0) {
			throw new BadRequestException({
				message:
					'REFUND_AMOUNT_EXCEEDS_CAPTURED: the order captured less than this refund would give back, ' +
					'so there is no money on it to pay the amount from.',
				code: 'REFUND_AMOUNT_EXCEEDS_CAPTURED',
				details: {
					orderId: request.orderId,
					requested: requested.amount,
					refundable: attribution.headroom,
					currency: request.currency
				}
			});
		}

		/**
		 * A refund has to be attributable to something, or it is money leaving with no record of why.
		 * A payment that can still carry it is the strongest attribution; a return and a claim are the
		 * other two, and each is sufficient on its own — a claim exists precisely because the money it
		 * gives back may have arrived by means no payment row records (a manual settlement, a credit
		 * the platform never processed), and refusing the refund there would leave the claim unsettled
		 * with nothing written at all.
		 */
		if (!paymentId && !request.returnId && !request.claimId) {
			throw new BadRequestException(NOT_ATTRIBUTED);
		}

		const metadata = {
			...(request.exchangeId ? { [EXCHANGE_KEY]: request.exchangeId } : {}),
			...(request.idempotencyKey ? { [REFUND_IDEMPOTENCY_KEY]: request.idempotencyKey } : {})
		};
		let created: IRefund;

		try {
			created = await this.refundService.createAttributedRefund({
				orderId: request.orderId,
				amount: request.amount,
				currency: request.currency,
				...(request.returnId ? { returnId: request.returnId } : {}),
				...(request.claimId ? { claimId: request.claimId } : {}),
				...(paymentId ? { paymentId } : {}),
				...(request.reasonId ? { reasonId: request.reasonId } : {}),
				...(request.note ? { note: request.note } : {}),
				...(Object.keys(metadata).length ? { metadata } : {})
			});
		} catch (error) {
			// Another call under the same key wrote its refund between the lookup above and this write; the refund
			// service refused the second one under the order's lock, and the first is the answer.
			const existing =
				request.idempotencyKey && this.isKeyInUse(error) ? await this.answerExisting(request) : null;

			if (existing) {
				return existing;
			}

			throw error;
		}

		let settled: IRefund;

		try {
			settled = await this.refundService.approveAttributedRefund(created.id);
		} catch (error) {
			// A retry under the same key found this refund pending and settled it first (Greptile, #10906): the
			// money went back, and answering the refusal of this second settlement would tell the caller — a return
			// that then gives its claimed total back — that it did not.
			const current = await this.refundService.findRefundOrFail(created.id);

			if (current.status !== RefundStatus.SUCCEEDED) {
				throw error;
			}

			settled = current;
		}

		return {
			refundId: settled.id,
			amount: Money.of(settled.amount, settled.currency as CurrencyCode).toStorageString(),
			currency: settled.currency as CurrencyCode
		};
	}

	/**
	 * Finds the refund a return or a claim already produced under a key (review R3-09r2).
	 *
	 * The refunds of the return (or the claim, or failing both the order) are read in the caller's tenant and
	 * organization, in one read, and the standing ones carrying the key are kept: a succeeded refund before a
	 * pending one, the newest first. A cancelled or failed refund moved no money and is not an answer.
	 *
	 * @param query The return or the claim, and the key.
	 * @returns The refund, or `null` when none stands under the key.
	 */
	public async findRefund(query: IReturnRefundLookup): Promise<IReturnRefundFound | null> {
		if (!query?.idempotencyKey || (!query.returnId && !query.claimId && !query.orderId)) {
			return null;
		}

		const where = query.claimId
			? { claimId: query.claimId }
			: query.returnId
				? { returnId: query.returnId }
				: { orderId: query.orderId };
		const rows: IRefund[] =
			(await this.refundService.find({ where: { ...where, ...this.scope() } as never })) ?? [];
		const standing = rows
			.filter((refund) => [RefundStatus.SUCCEEDED, RefundStatus.PENDING].includes(refund.status as RefundStatus))
			.filter((refund) => refund.metadata?.[REFUND_IDEMPOTENCY_KEY] === query.idempotencyKey)
			.sort((left, right) => {
				const settled =
					Number(right.status === RefundStatus.SUCCEEDED) - Number(left.status === RefundStatus.SUCCEEDED);

				return settled !== 0
					? settled
					: new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime();
			});
		const found = standing[0];

		if (!found) {
			return null;
		}

		return {
			refundId: found.id,
			amount: Money.of(found.amount, found.currency as CurrencyCode).toStorageString(),
			currency: found.currency as CurrencyCode,
			status: found.status as RefundStatus
		};
	}

	/**
	 * Answers a request with the refund its key already produced, settling it when it is still pending.
	 *
	 * @param request The request, carrying its key.
	 * @returns The refund as settled, or `null` when the key has produced none yet.
	 */
	private async answerExisting(request: IReturnRefundRequest): Promise<IReturnRefundResult | null> {
		const found = await this.findRefund({
			orderId: request.orderId,
			returnId: request.returnId,
			claimId: request.claimId,
			idempotencyKey: request.idempotencyKey as string
		});

		if (!found) {
			return null;
		}

		if (found.status === RefundStatus.PENDING) {
			try {
				// Recorded, never settled — the outcome nobody saw. The settlement measures it as any other does.
				const settled = await this.refundService.approveAttributedRefund(found.refundId);

				return {
					refundId: settled.id,
					amount: Money.of(settled.amount, settled.currency as CurrencyCode).toStorageString(),
					currency: settled.currency as CurrencyCode
				};
			} catch (error) {
				// A concurrent retry settled it first: the refund it settled is the answer.
				const again = await this.findRefund({
					orderId: request.orderId,
					returnId: request.returnId,
					claimId: request.claimId,
					idempotencyKey: request.idempotencyKey as string
				});

				if (again?.status === RefundStatus.SUCCEEDED) {
					return { refundId: again.refundId, amount: again.amount, currency: again.currency };
				}

				throw error;
			}
		}

		return { refundId: found.refundId, amount: found.amount, currency: found.currency };
	}

	/**
	 * @param error What the refund service threw.
	 * @returns Whether it refused a second refund under a key that already has one.
	 */
	private isKeyInUse(error: unknown): boolean {
		return (
			error instanceof ConflictException &&
			(error.getResponse() as { code?: string })?.code === 'REFUND_IDEMPOTENCY_KEY_IN_USE'
		);
	}

	/**
	 * Refuses a caller who may not settle a refund.
	 *
	 * A return or a claim does not only ask for a refund: this entry point records it and settles it in one
	 * call, so the money has gone back when it answers. The payment domain keeps `REFUNDS_APPROVE` apart
	 * from `REFUNDS_CREATE` because a refund is somebody else's decision; held only to the returns grant
	 * (`RETURNS_RECEIVE`, `CLAIMS_RESOLVE`), a caller settled refunds of any amount (review R3-09). The
	 * returns domain asks this BEFORE it moves goods for a receipt that also refunds, so a refusal leaves the
	 * receipt unwritten rather than half done.
	 *
	 * @throws ForbiddenException with `REFUND_APPROVAL_REQUIRED` when the caller lacks `REFUNDS_APPROVE`.
	 */
	public assertMayRefund(): void {
		if (!RequestContext.hasPermission(PaymentPermission.REFUNDS_APPROVE as unknown as PermissionsEnum)) {
			throw new ForbiddenException({
				message:
					'REFUND_APPROVAL_REQUIRED: settling a refund needs the REFUNDS_APPROVE permission, which this user does not hold.',
				code: 'REFUND_APPROVAL_REQUIRED'
			});
		}
	}

	/**
	 * Resolves the payment a refund is paid back from, when one can carry it.
	 *
	 * The order's payments are read inside the caller's tenant and organization, and each is measured
	 * with the same two figures the refund service measures with: what it captured, less what already
	 * succeeded against it. Only a payment in the refund's own currency is considered, because the two
	 * figures of another currency are not comparable with the amount and the refund service refuses the
	 * pair anyway. The payment with the most left to give is named, and the identifier breaks a tie, so
	 * the same state always attributes a refund the same way.
	 *
	 * It also answers **how much the order can give back in total**, which is the ceiling the caller
	 * refuses an over-refund against. The two questions share one pass over the payments because they
	 * share the expensive part — two ledger sums per payment — and because an answer computed twice is
	 * an answer that can disagree with itself. The total is `undefined`, rather than zero, for an order
	 * that has no payment in this currency at all: that is the case the documented escape is for, and
	 * a zero there would turn it into a refusal. The total is net of the order's refunds that name no payment
	 * (`RefundService.sumUnattributedForOrder`), which no payment's own figure counts.
	 *
	 * @param request The refund being recorded.
	 * @param amount The requested amount, already read as a monetary value.
	 * @returns The payment to pay the refund back from when one can carry it, and what every payment of
	 * the order can still give back between them when the order has any.
	 */
	private async attributedPayment(
		request: IReturnRefundRequest,
		amount: Money
	): Promise<{ paymentId?: ID; headroom?: DecimalString }> {
		const payments = await this.paymentRepository.find({
			where: {
				orderId: request.orderId,
				...this.scope()
			} as FindOptionsWhere<Payment>
		});
		const candidates: Array<{ id: ID; headroom: DecimalString }> = [];
		let total: Money | undefined;

		for (const payment of payments ?? []) {
			const currency = payment.currency ?? request.currency;

			if (String(currency).toUpperCase() !== String(request.currency).toUpperCase()) {
				continue;
			}

			const headroom = Money.of(
				await this.paymentCaptureService.sumCapturedForPayment(payment.id),
				currency as CurrencyCode
			).subtract(Money.of(await this.refundService.sumSucceededForPayment(payment.id), currency as CurrencyCode));

			// A payment that has already given back more than it took carries no headroom, and a negative
			// one must not reduce what the other payments of the order can still give.
			total = (total ?? Money.zero(currency as CurrencyCode)).add(
				headroom.isNegative() ? Money.zero(currency as CurrencyCode) : headroom
			);

			if (headroom.greaterThanOrEqual(amount)) {
				candidates.push({ id: payment.id, headroom: headroom.amount });
			}
		}

		candidates.sort((left, right) => {
			const byHeadroom = compareDecimalStrings(right.headroom, left.headroom);

			return byHeadroom !== 0 ? byHeadroom : String(left.id).localeCompare(String(right.id));
		});

		/**
		 * **A refund this path already recorded with no payment spends from the same order.** When no single
		 * payment can carry an amount the order's payments can carry between them, the refund is recorded
		 * against the return or the claim with no payment — and then no payment's figure above counts it. The
		 * order-wide total read here was therefore the same after every such refund: an order paid 10 + 10 took
		 * a 15 return refund, then another, without limit (review R3-08). Those refunds are taken off the total.
		 */
		if (total) {
			const currency = request.currency as CurrencyCode;
			const unattributed = Money.of(
				await this.refundService.sumUnattributedForOrder(request.orderId, request.currency),
				currency
			);
			const net = total.subtract(unattributed);

			total = net.isNegative() ? Money.zero(currency) : net;
		}

		return {
			...(candidates.length ? { paymentId: candidates[0].id } : {}),
			...(total ? { headroom: total.amount } : {})
		};
	}

	/**
	 * Reads an amount and a currency as a monetary value.
	 *
	 * The currency is read on its own first, so that the two defects are told apart and reported the
	 * way the refund service reports them: an amount that is not an exact decimal and a currency the
	 * platform does not know are different things to fix, and one code for both would hide which one
	 * the caller sent.
	 *
	 * @param amount The requested amount.
	 * @param currency The currency it is in.
	 * @returns The value.
	 * @throws BadRequestException when the amount is not an exact decimal or the currency is not one
	 * the platform knows.
	 */
	private moneyOrFail(amount: DecimalString, currency: CurrencyCode): Money {
		try {
			Money.of('0', currency);
		} catch {
			throw new BadRequestException('PAYMENT_CURRENCY_INVALID');
		}

		try {
			return Money.of(amount, currency);
		} catch {
			throw new BadRequestException('PAYMENT_AMOUNT_INVALID');
		}
	}

	/**
	 * @returns The tenant and organization every read here is scoped to.
	 */
	private scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}
}
