import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import { Money, readAffectedRows } from '@gauzy/core';
import { PaymentCollection } from './payment-collection.entity';
import { TypeOrmPaymentCollectionRepository } from './repository/type-orm-payment-collection.repository';
import { MikroOrmPaymentCollectionRepository } from './repository/mikro-orm-payment-collection.repository';
import { PaymentScopedCrudService } from '../payment-scoped-crud.service';
import {
	IPaymentCollection,
	IPaymentCollectionCreateInput,
	IPaymentCollectionUpdateInput,
	PaymentCollectionStatus
} from '../payment.types';

/**
 * How many times a movement this service opened its own transaction for is decided again when another
 * writer moved the collection between this one reading it and writing it. Under the row lock that
 * cannot happen; the attempts are what the conditional write falls back on where no row lock is taken.
 */
const MOVEMENT_ATTEMPTS = 3;

/** The columns of a collection one movement writes, decided on the collection as it stands under its lock. */
type TCollectionChanges = Partial<IPaymentCollection> & { status?: PaymentCollectionStatus };

/** A conditional write that matched no row: another writer moved the collection first. */
class PaymentCollectionMovedError extends Error {}

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
 *
 * **Every movement of an amount is decided under the collection's row lock and written conditionally on
 * what it was decided on.** The four running totals used to be read, added to in memory and written
 * back as absolute values with no lock, so two captures, refunds or authorisations of one collection
 * that overlapped both read the same total and the second write erased the first one's increment, and
 * each ceiling above was checked against a figure that might already have moved. A movement now reads
 * the row `FOR UPDATE` (Postgres, MySQL; SQLite's single writer is the lock there), checks its ceiling
 * against that read, and writes with the four totals and the status it read among the criteria. A
 * caller that moves a payment or writes a ledger row with the movement hands its transaction in, so
 * the collection moves with them or not at all.
 */
@Injectable()
export class PaymentCollectionService extends PaymentScopedCrudService<PaymentCollection> {
	constructor(
		readonly typeOrmPaymentCollectionRepository: TypeOrmPaymentCollectionRepository,
		readonly mikroOrmPaymentCollectionRepository: MikroOrmPaymentCollectionRepository
	) {
		super(typeOrmPaymentCollectionRepository, mikroOrmPaymentCollectionRepository);
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
			currency: amount.currency,
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

		if (changes.currency !== undefined) {
			changes.currency = this.canonicalCurrency(changes.currency);
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
	 * Absence is an answer: the read is the fail-soft half of the pair — `findOneOrFailByWhereOptions`,
	 * whose `ITryRequest` carries `success: false` — because "this order has no collection yet" is the
	 * ordinary state of an order and not a refusal.
	 *
	 * @param orderId The order to resolve for.
	 * @returns The collection, or null when the order has none.
	 */
	async findCollectionForOrder(orderId: ID): Promise<IPaymentCollection | null> {
		const outcome = await this.findOneOrFailByWhereOptions({ orderId, ...this.scope } as never);

		return outcome.success ? (outcome.record as IPaymentCollection) : null;
	}

	/**
	 * Resolves the live collection of a cart.
	 *
	 * The same fail-soft read as `findCollectionForOrder`, and the same reason: the caller that asks
	 * is the create path's one-live-collection guard, for which "none" is what it wants to hear.
	 *
	 * @param cartId The cart to resolve for.
	 * @returns The collection, or null when the cart has none.
	 */
	async findCollectionForCart(cartId: ID): Promise<IPaymentCollection | null> {
		const outcome = await this.findOneOrFailByWhereOptions({ cartId, ...this.scope } as never);

		return outcome.success ? (outcome.record as IPaymentCollection) : null;
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
	 * @param manager The transaction to move the collection on, when the caller holds one.
	 * @returns The stored collection.
	 * @throws BadRequestException when the authorisation would exceed the collection amount.
	 */
	async recordAuthorization(id: ID, amount: DecimalString, manager?: EntityManager): Promise<IPaymentCollection> {
		return this.moveAmounts(
			id,
			(collection) => {
				this.assertCanAuthorize(collection, amount);

				return {
					authorizedAmount: Money.of(collection.authorizedAmount, collection.currency).add(
						Money.of(amount, collection.currency)
					).amount
				};
			},
			manager
		);
	}

	/**
	 * Records a capture and re-derives the status.
	 *
	 * @param id The collection.
	 * @param amount The amount captured.
	 * @param manager The transaction to move the collection on, when the caller holds one.
	 * @returns The stored collection.
	 * @throws BadRequestException when the capture would exceed the collection amount.
	 */
	async recordCapture(id: ID, amount: DecimalString, manager?: EntityManager): Promise<IPaymentCollection> {
		return this.moveAmounts(
			id,
			(collection) => {
				this.assertCanCapture(collection, amount);

				return {
					capturedAmount: Money.of(collection.capturedAmount, collection.currency).add(
						Money.of(amount, collection.currency)
					).amount
				};
			},
			manager
		);
	}

	/**
	 * Records a succeeded refund and re-derives the status.
	 *
	 * @param id The collection.
	 * @param amount The amount refunded.
	 * @param manager The transaction to move the collection on, when the caller holds one.
	 * @returns The stored collection.
	 * @throws BadRequestException when the refund would exceed what was captured.
	 */
	async recordRefund(id: ID, amount: DecimalString, manager?: EntityManager): Promise<IPaymentCollection> {
		return this.moveAmounts(
			id,
			(collection) => {
				this.assertCanRefund(collection, amount);

				return {
					refundedAmount: Money.of(collection.refundedAmount, collection.currency).add(
						Money.of(amount, collection.currency)
					).amount
				};
			},
			manager
		);
	}

	/**
	 * Records the release of an authorisation and re-derives the status.
	 *
	 * @param id The collection.
	 * @param amount The amount released. Zero is accepted, because cancelling a session that never
	 * reached the provider releases nothing.
	 * @param manager The transaction to move the collection on, when the caller holds one.
	 * @returns The stored collection.
	 * @throws BadRequestException when the release would pass what is still authorised and uncaptured.
	 */
	async recordCancellation(id: ID, amount: DecimalString, manager?: EntityManager): Promise<IPaymentCollection> {
		return this.moveAmounts(
			id,
			(collection) => {
				const released = Money.of(collection.canceledAmount, collection.currency).add(
					Money.of(amount, collection.currency)
				);
				const outstanding = Money.of(collection.authorizedAmount, collection.currency).subtract(
					Money.of(collection.capturedAmount, collection.currency)
				);

				if (released.greaterThan(outstanding)) {
					throw new BadRequestException('PAYMENT_CANCEL_EXCEEDS_AUTHORIZED');
				}

				return { canceledAmount: released.amount };
			},
			manager
		);
	}

	/**
	 * Marks a collection as awaiting an answer, which a session that reached the provider does.
	 *
	 * Decided under the same lock as the amounts, so a status written for a collection that had not
	 * moved can never land on one an authorisation moved in the meantime.
	 *
	 * @param id The collection.
	 * @param manager The transaction to write on, when the caller holds one.
	 * @returns The stored collection.
	 */
	async markAwaiting(id: ID, manager?: EntityManager): Promise<IPaymentCollection> {
		return this.moveAmounts(
			id,
			(collection) => (this.hasMoved(collection) ? null : { status: PaymentCollectionStatus.AWAITING }),
			manager
		);
	}

	/**
	 * Marks a collection as failed, which the last failed attempt of a collection that moved nothing
	 * does.
	 *
	 * @param id The collection.
	 * @param manager The transaction to write on, when the caller holds one.
	 * @returns The stored collection.
	 */
	async markFailed(id: ID, manager?: EntityManager): Promise<IPaymentCollection> {
		return this.moveAmounts(
			id,
			(collection) => (this.hasMoved(collection) ? null : { status: PaymentCollectionStatus.FAILED }),
			manager
		);
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
	 * Moves a collection: decides the change on the row as it stands under its lock, and writes the
	 * change and the status derived from it in one conditional statement.
	 *
	 * Inside a caller's transaction the movement is part of it, so a refusal here (a ceiling, or a write
	 * that matched nothing) rolls the caller's payment row and ledger row back with it. Without one, the
	 * movement opens its own, and a write that matched nothing is decided again on the row as it now
	 * stands, a bounded number of times.
	 *
	 * @param id The collection.
	 * @param decide Decides the columns to write from the locked row; `null` writes nothing.
	 * @param manager The caller's transaction, when it holds one.
	 * @returns The stored collection.
	 * @throws NotFoundException when the collection is not in the caller's scope.
	 * @throws ConflictException with `PAYMENT_COLLECTION_CONFLICT` when another writer moved the row
	 * between this read and this write.
	 */
	private async moveAmounts(
		id: ID,
		decide: (collection: IPaymentCollection) => TCollectionChanges | null,
		manager?: EntityManager
	): Promise<IPaymentCollection> {
		const conflict = () =>
			new ConflictException({
				message: `PAYMENT_COLLECTION_CONFLICT: payment collection '${id}' was moved by another write between this one reading it and writing it, so nothing was overwritten. Try again.`,
				code: 'PAYMENT_COLLECTION_CONFLICT',
				details: { paymentCollectionId: id }
			});

		if (manager) {
			try {
				return await this.moveAmountsOn(manager, id, decide);
			} catch (error) {
				throw error instanceof PaymentCollectionMovedError ? conflict() : error;
			}
		}

		for (let attempt = 1; ; attempt++) {
			try {
				return await this.typeOrmPaymentCollectionRepository.manager.transaction((transactional: EntityManager) =>
					this.moveAmountsOn(transactional, id, decide)
				);
			} catch (error) {
				if (!(error instanceof PaymentCollectionMovedError)) {
					throw error;
				}

				if (attempt >= MOVEMENT_ATTEMPTS) {
					throw conflict();
				}
			}
		}
	}

	/**
	 * One movement of a collection, on an open transaction.
	 *
	 * The row is read `FOR UPDATE` where the dialect has row locks, and the write names every running
	 * total and the status it read among its criteria: the status is derived from all four totals, so a
	 * write predicated on only the one it moves could still store a status another writer's change had
	 * made wrong.
	 *
	 * @param manager The open transaction.
	 * @param id The collection.
	 * @param decide Decides the columns to write from the locked row.
	 * @returns The stored collection, read on the same transaction.
	 * @throws PaymentCollectionMovedError when the conditional write matched no row.
	 */
	private async moveAmountsOn(
		manager: EntityManager,
		id: ID,
		decide: (collection: IPaymentCollection) => TCollectionChanges | null
	): Promise<IPaymentCollection> {
		const where = { id, ...this.scope };
		const current = (await manager.findOne(PaymentCollection, {
			where: where as never,
			...(this.takesRowLocks(manager) ? { lock: { mode: 'pessimistic_write' as const } } : {})
		})) as IPaymentCollection | null;

		if (!current) {
			throw new NotFoundException('PAYMENT_COLLECTION_NOT_FOUND');
		}

		const changes = decide(current);

		if (!changes) {
			return current;
		}

		const merged: IPaymentCollection = { ...current, ...changes };
		const status = changes.status ?? this.deriveStatus(merged);
		const completedAt =
			status === PaymentCollectionStatus.COMPLETED ? current.completedAt ?? new Date() : current.completedAt;

		const written = await manager.update(
			PaymentCollection,
			{
				...where,
				authorizedAmount: this.asRead(current.authorizedAmount),
				capturedAmount: this.asRead(current.capturedAmount),
				refundedAmount: this.asRead(current.refundedAmount),
				canceledAmount: this.asRead(current.canceledAmount),
				status: this.asRead(current.status)
			} as never,
			{ ...changes, status, completedAt } as never
		);

		if (readAffectedRows(written) === 0) {
			throw new PaymentCollectionMovedError();
		}

		return (await manager.findOne(PaymentCollection, { where: where as never })) as IPaymentCollection;
	}

	/**
	 * @param manager The open transaction.
	 * @returns Whether the dialect behind it has row locks to take; SQLite's single writer is its lock.
	 */
	private takesRowLocks(manager: EntityManager): boolean {
		const type = manager.connection?.options?.type as string | undefined;

		return type === DatabaseTypeEnum.postgres || type === DatabaseTypeEnum.mysql;
	}

	/**
	 * One running total as the criteria of a conditional write must state it: a value read as absent is
	 * `IS NULL`, because `= NULL` matches nothing and would make the collection permanently unmovable.
	 *
	 * @param value The value as the read handed it over.
	 * @returns The criteria value that matches the row as it was read.
	 */
	private asRead(value: unknown): unknown {
		return value === null || value === undefined ? IsNull() : value;
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
	 * @returns The value as a kernel money value, carrying the canonical currency.
	 * @throws BadRequestException when the currency is not three letters or the amount is not exact.
	 */
	private toMoney(value: DecimalString | number, currency: string): Money {
		const canonical = this.canonicalCurrency(currency);

		try {
			return Money.of(value, canonical);
		} catch {
			throw new BadRequestException('PAYMENT_AMOUNT_INVALID');
		}
	}

	/**
	 * The canonical spelling of a currency code: trimmed and upper-cased, which is the form the money
	 * kernel reads a code into and the form this domain stores.
	 *
	 * **The amount and the currency are one figure and are canonicalised together.** A stored amount
	 * carries no redundant trailing fractional zeroes, and a stored code carries the kernel's own
	 * spelling, because two spellings of one currency are two values to every comparison downstream:
	 * a session that states `USD` does not equal a collection stored as `usd`, and a report grouped by
	 * `currency` shows one currency twice.
	 *
	 * @param currency The currency code as the caller stated it.
	 * @returns The code in its canonical form.
	 * @throws BadRequestException when the code is not three letters.
	 */
	private canonicalCurrency(currency: string): string {
		if (!currency || currency.trim().length !== 3) {
			throw new BadRequestException('PAYMENT_CURRENCY_INVALID');
		}

		return currency.trim().toUpperCase();
	}
}
