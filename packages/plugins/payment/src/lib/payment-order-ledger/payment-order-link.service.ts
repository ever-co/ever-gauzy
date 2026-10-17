import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { DecimalString, ID } from '@gauzy/contracts';
import { Money, Payment, RequestContext } from '@gauzy/core';
import { PaymentCapture } from '../payment-capture/payment-capture.entity';
import { TypeOrmPaymentCaptureRepository } from '../payment-capture/repository/type-orm-payment-capture.repository';
import { PaymentCollectionService } from '../payment-collection/payment-collection.service';
import { IPaymentCollection, IPaymentOrderMoneyFact } from '../payment.types';

/**
 * Hands a cart's payments over to the order the cart became, and states what they already did (Q7-W1b).
 *
 * **Why it exists.** A buyer pays at checkout, before the order exists: the collection is opened for the
 * *cart* (`payment_collection.cartId`), and the session is authorised against it. Nothing re-pointed that
 * collection when the cart became an order, so the order had no collection, no payment and no money on
 * its ledger, and `paymentSessionId` — which the cart hands to the checkout — was dropped on the floor.
 *
 * The order package calls this through its `ORDER_CHECKOUT_PAYMENTS` port right after it placed the
 * order: the cart's collection and its payments are attached to the order (only while they belong to no
 * order yet, so a second call changes nothing), and the money they already moved is answered as facts
 * the order writes onto its own ledger — at most once each, because the order side keys them by the
 * payment-side row that caused them.
 *
 * Reads and the collection write go through the domain services; the core `payment` row is reached
 * through its TypeORM repository, exactly as the capture and refund services reach it.
 */
@Injectable()
export class PaymentOrderLinkService {
	constructor(
		private readonly paymentCollectionService: PaymentCollectionService,
		private readonly typeOrmPaymentCaptureRepository: TypeOrmPaymentCaptureRepository,
		@InjectRepository(Payment) private readonly paymentRepository: Repository<Payment>
	) {}

	/**
	 * Attaches a cart's collection and payments to its order and answers their money facts.
	 *
	 * @param cartId The cart the order came from.
	 * @param orderId The order.
	 * @returns The facts the order's ledger should carry: an authorisation, a capture and a void per
	 * payment, as far as each has gone. Empty when the cart had no collection.
	 */
	async attachCart(cartId: ID, orderId: ID): Promise<IPaymentOrderMoneyFact[]> {
		const collection = await this.paymentCollectionService.findCollectionForCart(cartId);

		if (!collection) {
			return [];
		}

		if (collection.orderId && collection.orderId !== orderId) {
			// The collection already pays another order: a cart becomes one order, so this is a second
			// checkout of a cart that was already completed, and nothing is moved.
			return [];
		}

		if (!collection.orderId) {
			await this.paymentCollectionService.attachToOrder(collection.id, orderId);
		}

		await this.paymentRepository.update(
			{ paymentCollectionId: collection.id, orderId: IsNull(), ...this.scope } as never,
			{ orderId } as never
		);

		return this.factsForCollection({ ...collection, orderId });
	}

	/**
	 * The money facts of every payment of an order, as far as each has gone.
	 *
	 * Used to re-state an order's ledger from the payment side (an operator's reconciliation, a report
	 * that was lost): every fact is keyed by its reference, so re-recording them all moves nothing that
	 * is already recorded.
	 *
	 * @param orderId The order.
	 * @returns The facts.
	 */
	async factsForOrder(orderId: ID): Promise<IPaymentOrderMoneyFact[]> {
		const payments = await this.paymentRepository.find({ where: { orderId, ...this.scope } as never });

		return this.factsOf(payments, orderId);
	}

	/**
	 * The facts of the payments of one collection.
	 *
	 * @param collection The collection, already attached to its order.
	 * @returns The facts.
	 */
	private async factsForCollection(collection: IPaymentCollection): Promise<IPaymentOrderMoneyFact[]> {
		const payments = await this.paymentRepository.find({
			where: { paymentCollectionId: collection.id, ...this.scope } as never
		});

		return this.factsOf(payments, collection.orderId);
	}

	/**
	 * Turns payment rows into the facts the order's ledger carries.
	 *
	 * @param payments The payments.
	 * @param orderId The order they belong to.
	 * @returns One authorisation per authorised payment, one capture per capture row, one void per
	 * cancelled amount.
	 */
	private async factsOf(payments: Payment[], orderId: ID): Promise<IPaymentOrderMoneyFact[]> {
		if (!orderId || payments.length === 0) {
			return [];
		}

		const captures: PaymentCapture[] = await this.typeOrmPaymentCaptureRepository.find({
			where: { paymentId: In(payments.map((payment) => payment.id)), ...this.scope } as never,
			order: { capturedAt: 'ASC' } as never
		});
		const facts: IPaymentOrderMoneyFact[] = [];

		for (const payment of payments) {
			const currency = payment.currency;

			if (isPositive(payment.authorizedAmount, currency)) {
				facts.push({
					orderId,
					type: 'AUTHORIZATION',
					amount: decimalOf(payment.authorizedAmount, currency),
					currency,
					referenceType: 'PAYMENT',
					referenceId: payment.id,
					paymentId: payment.id,
					occurredAt: payment.authorizedAt ?? payment.createdAt
				});
			}

			for (const capture of captures.filter((row) => row.paymentId === payment.id)) {
				facts.push({
					orderId,
					type: 'CAPTURE',
					amount: decimalOf(capture.amount, capture.currency ?? currency),
					currency: capture.currency ?? currency,
					referenceType: 'PAYMENT_CAPTURE',
					referenceId: capture.id,
					paymentId: payment.id,
					occurredAt: capture.capturedAt
				});
			}

			if (isPositive(payment.canceledAmount, currency)) {
				facts.push({
					orderId,
					type: 'VOID',
					amount: decimalOf(payment.canceledAmount, currency),
					currency,
					referenceType: 'PAYMENT',
					referenceId: payment.id,
					paymentId: payment.id,
					occurredAt: payment.canceledAt ?? payment.updatedAt
				});
			}
		}

		return facts;
	}

	/** The caller's tenant and organization, which every read and write here is scoped by. */
	private get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}
}

/**
 * Whether a stored amount is a positive sum of money.
 *
 * @param value The stored amount.
 * @param currency Its currency.
 * @returns True when it is above zero.
 */
function isPositive(value: unknown, currency: string): boolean {
	return value !== null && value !== undefined && Money.of(String(value), currency).isPositive();
}

/**
 * A stored amount as the exact decimal a fact carries.
 *
 * @param value The stored amount.
 * @param currency Its currency.
 * @returns The decimal.
 */
function decimalOf(value: unknown, currency: string): DecimalString {
	return Money.of(String(value ?? '0'), currency).amount as DecimalString;
}
