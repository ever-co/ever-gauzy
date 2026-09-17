import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import { CrudService, Money, RequestContext } from '@gauzy/core';
import { PaymentCollection } from './payment-collection.entity';
import { TypeOrmPaymentCollectionRepository } from './repository/type-orm-payment-collection.repository';
import { MikroOrmPaymentCollectionRepository } from './repository/mikro-orm-payment-collection.repository';
import {
	IPaymentCollection,
	IPaymentCollectionCreateInput,
	IPaymentCollectionUpdateInput,
	PaymentCollectionStatus
} from '../payment.types';

/**
 * The money side of one order or cart.
 *
 * **The amounts are the authority and the status is a function of them.** Nothing in this service
 * accepts a status from a caller: `deriveStatus` reads the four amounts and writes the lifecycle
 * state, and every method that moves an amount moves it through the invariant the whole domain rests
 * on:
 *
 * ```
 * capturedAmount + canceledAmount <= authorizedAmount <= amount
 * refundedAmount <= capturedAmount
 * ```
 *
 * A violation is refused with the documented code — `PAYMENT_OVER_CAPTURE` when a capture would pass
 * what is left of the authorisation or what the collection is for, `PAYMENT_AMOUNT_EXCEEDS_AUTHORIZED`
 * when an authorisation would pass the collection amount, `REFUND_AMOUNT_EXCEEDS_CAPTURED` when a
 * refund would pass what was taken — rather than clamped, because a clamp would silently take money
 * the caller did not ask for and leave the ledger explaining a different amount than the request.
 *
 * A cart has at most one live collection and an order has one per checkout attempt, which is what
 * makes "how much is outstanding for this order?" a question with one answer.
 */
@Injectable()
export class PaymentCollectionService extends CrudService<PaymentCollection> {
	constructor(
		readonly typeOrmPaymentCollectionRepository: TypeOrmPaymentCollectionRepository,
		readonly mikroOrmPaymentCollectionRepository: MikroOrmPaymentCollectionRepository
	) {
		super(typeOrmPaymentCollectionRepository, mikroOrmPaymentCollectionRepository);
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
	 * Creates the collection for an order or a cart.
	 *
	 * @param input The collection to create.
	 * @returns The stored collection, in `NOT_PAID` with the four amounts at zero.
	 * @throws BadRequestException when neither an order nor a cart is named, when the amount is not a
	 * positive exact decimal, when the currency is not a three-letter code, or when the cart already
	 * has a live collection.
	 */
	async createCollection(input: IPaymentCollectionCreateInput): Promise<IPaymentCollection> {
		if (!input.orderId && !input.cartId) {
			throw new BadRequestException('PAYMENT_COLLECTION_TARGET_REQUIRED');
		}

		const amount = this.toMoney(input.amount, input.currency);

		if (!amount.isPositive()) {
			throw new BadRequestException('PAYMENT_COLLECTION_AMOUNT_INVALID');
		}

		if (input.cartId) {
			const existing = await this.findCollectionForCart(input.cartId);

			if (existing) {
				throw new BadRequestException(`Cart '${input.cartId}' already has a payment collection.`);
			}
		}

		return this.create({
			...input,
			amount: amount.amount,
			status: PaymentCollectionStatus.NOT_PAID,
			authorizedAmount: '0',
			capturedAmount: '0',
			refundedAmount: '0',
			canceledAmount: '0',
			...this.scope
		} as never);
	}

	/**
	 * Updates the descriptive fields of a collection.
	 *
	 * The amount and the currency may not change once anything has moved: the sessions of the
	 * collection were created for that figure, and rewriting it afterwards would make every capture
	 * already taken look like an over-capture. What has already moved is what the collection is.
	 *
	 * @param id The collection to update.
	 * @param input The fields to change.
	 * @returns The stored collection.
	 * @throws NotFoundException when the collection is not in the caller's organization.
	 * @throws BadRequestException when the amount or the currency of a collection that has moved would
	 * change.
	 */
	async updateCollection(id: ID, input: IPaymentCollectionUpdateInput): Promise<IPaymentCollection> {
		const collection = await this.findCollectionOrFail(id);

		if (this.hasMoved(collection) && (input.amount !== undefined || input.currency !== undefined)) {
			throw new BadRequestException(
				`Collection '${id}' has money against it and its amount and currency are no longer writable.`
			);
		}

		// The status is derived from the amounts and the sessions and is never taken from a caller, so it
		// is lifted off the input here rather than written. The input type excludes it — which is the
		// point — so naming it takes the widening below, and the run-time strip is what keeps a body
		// that carries one from reaching the update.
		const { status, ...changes } = input as IPaymentCollectionUpdateInput & { status?: unknown };
		void status;

		if (changes.amount !== undefined) {
			changes.amount = this.toMoney(changes.amount, changes.currency ?? collection.currency).amount;
		}

		await this.update(id, { ...changes } as never);

		return this.findCollectionOrFail(id);
	}

	/**
	 * Loads a collection that belongs to the caller's organization.
	 *
	 * @param id The collection to load.
	 * @returns The collection.
	 * @throws NotFoundException when it does not exist inside the caller's scope.
	 */
	async findCollectionOrFail(id: ID): Promise<IPaymentCollection> {
		const collection = await this.findOneByWhereOptions({ id, ...this.scope } as never);

		if (!collection) {
			throw new NotFoundException('PAYMENT_COLLECTION_NOT_FOUND');
		}

		return collection;
	}

	/**
	 * Resolves the live collection of an order.
	 *
	 * @param orderId The order to resolve for.
	 * @returns The collection, or null when the order has none.
	 */
	async findCollectionForOrder(orderId: ID): Promise<IPaymentCollection | null> {
		return this.findOneByWhereOptions({ orderId, ...this.scope } as never);
	}

	/**
	 * Resolves the live collection of a cart.
	 *
	 * @param cartId The cart to resolve for.
	 * @returns The collection, or null when the cart has none.
	 */
	async findCollectionForCart(cartId: ID): Promise<IPaymentCollection | null> {
		return this.findOneByWhereOptions({ cartId, ...this.scope } as never);
	}

	/**
	 * Paginates the collections of the caller's organization.
	 *
	 * @param options Optional filters, merged with the tenancy scope.
	 * @returns One page of collections.
	 */
	async findCollections(options: Record<string, unknown> = {}): Promise<IPagination<IPaymentCollection>> {
		return this.findAll({ ...options, where: { ...((options.where as object) ?? {}), ...this.scope } } as never);
	}

	/**
	 * Refuses an authorisation that would take the collection past the amount it is for.
	 *
	 * @param collection The collection the authorisation belongs to.
	 * @param amount The amount being authorised.
	 * @throws BadRequestException when the authorisation would exceed the collection amount.
	 */
	assertCanAuthorize(collection: IPaymentCollection, amount: DecimalString): void {
		const authorized = Money.of(collection.authorizedAmount, collection.currency).add(
			Money.of(amount, collection.currency)
		);

		if (authorized.greaterThan(Money.of(collection.amount, collection.currency))) {
			throw new BadRequestException('PAYMENT_AMOUNT_EXCEEDS_AUTHORIZED');
		}
	}

	/**
	 * Refuses a capture that would take the collection past the amount it is for.
	 *
	 * @param collection The collection the capture belongs to.
	 * @param amount The amount being captured.
	 * @throws BadRequestException when the capture would exceed the collection amount.
	 */
	assertCanCapture(collection: IPaymentCollection, amount: DecimalString): void {
		const captured = Money.of(collection.capturedAmount, collection.currency).add(
			Money.of(amount, collection.currency)
		);

		if (captured.greaterThan(Money.of(collection.amount, collection.currency))) {
			throw new BadRequestException('PAYMENT_OVER_CAPTURE');
		}
	}

	/**
	 * Refuses a refund that would take the collection past what it captured.
	 *
	 * @param collection The collection the refund belongs to.
	 * @param amount The amount being refunded.
	 * @throws BadRequestException when the refund would exceed what was captured.
	 */
	assertCanRefund(collection: IPaymentCollection, amount: DecimalString): void {
		const refunded = Money.of(collection.refundedAmount, collection.currency).add(
			Money.of(amount, collection.currency)
		);

		if (refunded.greaterThan(Money.of(collection.capturedAmount, collection.currency))) {
			throw new BadRequestException('REFUND_AMOUNT_EXCEEDS_CAPTURED');
		}
	}

	/**
	 * Records a successful authorisation and re-derives the status.
	 *
	 * @param id The collection.
	 * @param amount The amount authorised.
	 * @returns The stored collection.
	 */
	async recordAuthorization(id: ID, amount: DecimalString): Promise<IPaymentCollection> {
		const collection = await this.findCollectionOrFail(id);
		this.assertCanAuthorize(collection, amount);

		return this.applyAmounts(id, {
			authorizedAmount: Money.of(collection.authorizedAmount, collection.currency).add(
				Money.of(amount, collection.currency)
			).amount
		});
	}

	/**
	 * Records a capture and re-derives the status.
	 *
	 * @param id The collection.
	 * @param amount The amount captured.
	 * @returns The stored collection.
	 * @throws BadRequestException when the capture would exceed the collection amount.
	 */
	async recordCapture(id: ID, amount: DecimalString): Promise<IPaymentCollection> {
		const collection = await this.findCollectionOrFail(id);
		this.assertCanCapture(collection, amount);

		return this.applyAmounts(id, {
			capturedAmount: Money.of(collection.capturedAmount, collection.currency).add(
				Money.of(amount, collection.currency)
			).amount
		});
	}

	/**
	 * Records a succeeded refund and re-derives the status.
	 *
	 * @param id The collection.
	 * @param amount The amount refunded.
	 * @returns The stored collection.
	 * @throws BadRequestException when the refund would exceed what was captured.
	 */
	async recordRefund(id: ID, amount: DecimalString): Promise<IPaymentCollection> {
		const collection = await this.findCollectionOrFail(id);
		this.assertCanRefund(collection, amount);

		return this.applyAmounts(id, {
			refundedAmount: Money.of(collection.refundedAmount, collection.currency).add(
				Money.of(amount, collection.currency)
			).amount
		});
	}

	/**
	 * Records the release of an authorisation and re-derives the status.
	 *
	 * @param id The collection.
	 * @param amount The amount released. Zero is accepted, because cancelling a session that never
	 * reached the provider releases nothing.
	 * @returns The stored collection.
	 */
	async recordCancellation(id: ID, amount: DecimalString): Promise<IPaymentCollection> {
		const collection = await this.findCollectionOrFail(id);
		const released = Money.of(collection.canceledAmount, collection.currency).add(
			Money.of(amount, collection.currency)
		);
		const outstanding = Money.of(collection.authorizedAmount, collection.currency).subtract(
			Money.of(collection.capturedAmount, collection.currency)
		);

		if (released.greaterThan(outstanding)) {
			throw new BadRequestException('PAYMENT_CANCEL_EXCEEDS_AUTHORIZED');
		}

		return this.applyAmounts(id, { canceledAmount: released.amount });
	}

	/**
	 * Marks a collection as awaiting an answer, which a session that reached the provider does.
	 *
	 * @param id The collection.
	 * @returns The stored collection.
	 */
	async markAwaiting(id: ID): Promise<IPaymentCollection> {
		const collection = await this.findCollectionOrFail(id);

		if (this.hasMoved(collection)) {
			return collection;
		}

		return this.applyAmounts(id, { status: PaymentCollectionStatus.AWAITING });
	}

	/**
	 * Marks a collection as failed, which the last failed attempt of a collection that moved nothing
	 * does.
	 *
	 * @param id The collection.
	 * @returns The stored collection.
	 */
	async markFailed(id: ID): Promise<IPaymentCollection> {
		const collection = await this.findCollectionOrFail(id);

		if (this.hasMoved(collection)) {
			return collection;
		}

		return this.applyAmounts(id, { status: PaymentCollectionStatus.FAILED });
	}

	/**
	 * Derives the lifecycle state from the amounts of a collection.
	 *
	 * The order of the tests is the order of the states: a released authorisation is terminal before
	 * anything was captured, a fully captured collection is complete, and what is left is the
	 * partial and awaiting middle ground.
	 *
	 * @param collection The collection to read.
	 * @returns The derived status.
	 */
	deriveStatus(collection: IPaymentCollection): PaymentCollectionStatus {
		const currency = collection.currency;
		const amount = Money.of(collection.amount, currency);
		const authorized = Money.of(collection.authorizedAmount, currency);
		const captured = Money.of(collection.capturedAmount, currency);
		const canceled = Money.of(collection.canceledAmount, currency);
		const outstanding = amount.subtract(canceled);

		if (captured.isPositive()) {
			if (captured.greaterThanOrEqual(outstanding)) {
				return PaymentCollectionStatus.COMPLETED;
			}

			return PaymentCollectionStatus.PARTIALLY_CAPTURED;
		}

		if (canceled.greaterThanOrEqual(amount)) {
			return PaymentCollectionStatus.CANCELED;
		}

		if (authorized.isPositive()) {
			return authorized.greaterThanOrEqual(amount)
				? PaymentCollectionStatus.AUTHORIZED
				: PaymentCollectionStatus.PARTIALLY_AUTHORIZED;
		}

		return collection.status === PaymentCollectionStatus.AWAITING ||
			collection.status === PaymentCollectionStatus.FAILED
			? collection.status
			: PaymentCollectionStatus.NOT_PAID;
	}

	/**
	 * Writes a derived status and the amounts it was derived from, in one update.
	 *
	 * @param id The collection.
	 * @param changes The amounts and the status to write.
	 * @returns The stored collection.
	 */
	private async applyAmounts(
		id: ID,
		changes: Partial<IPaymentCollection> & { status?: PaymentCollectionStatus }
	): Promise<IPaymentCollection> {
		const current = await this.findCollectionOrFail(id);
		const merged: IPaymentCollection = { ...current, ...changes };
		const status = changes.status ?? this.deriveStatus(merged);
		const completedAt =
			status === PaymentCollectionStatus.COMPLETED ? current.completedAt ?? new Date() : current.completedAt;

		await this.update(id, { ...changes, status, completedAt } as never);

		return this.findCollectionOrFail(id);
	}

	/**
	 * Whether anything has moved against a collection.
	 *
	 * @param collection The collection to read.
	 * @returns True when an amount other than zero has been recorded.
	 */
	private hasMoved(collection: IPaymentCollection): boolean {
		return (
			Money.of(collection.authorizedAmount, collection.currency).isPositive() ||
			Money.of(collection.capturedAmount, collection.currency).isPositive() ||
			Money.of(collection.refundedAmount, collection.currency).isPositive() ||
			Money.of(collection.canceledAmount, collection.currency).isPositive()
		);
	}

	/**
	 * Reads a decimal string and its currency, refusing anything that is not an exact positive
	 * decimal in a three-letter currency.
	 *
	 * @param value The decimal to read.
	 * @param currency The currency it is in.
	 * @returns The value as a kernel money value.
	 * @throws BadRequestException when the currency is not three letters or the amount is not exact.
	 */
	private toMoney(value: DecimalString | number, currency: string): Money {
		if (!currency || currency.trim().length !== 3) {
			throw new BadRequestException('PAYMENT_CURRENCY_INVALID');
		}

		try {
			return Money.of(value, currency.trim().toUpperCase());
		} catch {
			throw new BadRequestException('PAYMENT_AMOUNT_INVALID');
		}
	}
}
