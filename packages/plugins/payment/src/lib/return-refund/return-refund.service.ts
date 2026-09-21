import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { Money, Payment, RequestContext, compareDecimalStrings } from '@gauzy/core';
import { IReturnRefundRequest, IReturnRefundResult } from '../payment.types';
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

		const created = await this.refundService.createRefund({
			orderId: request.orderId,
			amount: request.amount,
			currency: request.currency,
			...(request.returnId ? { returnId: request.returnId } : {}),
			...(request.claimId ? { claimId: request.claimId } : {}),
			...(paymentId ? { paymentId } : {}),
			...(request.reasonId ? { reasonId: request.reasonId } : {}),
			...(request.note ? { note: request.note } : {}),
			...(request.exchangeId ? { metadata: { [EXCHANGE_KEY]: request.exchangeId } } : {})
		});

		const settled = await this.refundService.approveRefund(created.id);

		return {
			refundId: settled.id,
			amount: Money.of(settled.amount, settled.currency as CurrencyCode).toStorageString(),
			currency: settled.currency as CurrencyCode
		};
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
	 * a zero there would turn it into a refusal.
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
			).subtract(
				Money.of(
					await this.refundService.sumSucceededForPayment(payment.id),
					currency as CurrencyCode
				)
			);

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
