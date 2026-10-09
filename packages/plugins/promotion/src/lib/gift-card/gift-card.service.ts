import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { EntityManager, IsNull } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import { EventBus, Money, readAffectedRows, RequestContext } from '@gauzy/core';
import { GiftCardRedeemedEvent } from '../events';
import { GiftCard } from './gift-card.entity';
import { TypeOrmGiftCardRepository } from './repository/type-orm-gift-card.repository';
import { MikroOrmGiftCardRepository } from './repository/mikro-orm-gift-card.repository';
import { GiftCardTransactionService } from '../gift-card-transaction/gift-card-transaction.service';
import { GiftCardStatus, GiftCardTransactionType, IGiftCard } from '../promotion.types';
import { TenantScopedCrudService } from '../shared/tenant-scoped-crud.service';

/**
 * How many times a movement is decided again when another writer moved the card between this one
 * reading it and writing it. Under a row lock that cannot happen; the attempts are what the balance
 * predicate falls back on where no row lock is taken.
 */
const MOVEMENT_ATTEMPTS = 3;

/**
 * What a movement does to a card, decided against the card as it was read under its lock.
 *
 * `amount` is the signed movement of the balance, recorded as one ledger row; a decision without one
 * moves no balance and writes no row, and only changes `status`. `status`, when stated, is the status
 * the card holds afterwards; otherwise a debit that empties the card closes it as `REDEEMED` and any
 * other movement leaves the status where it was.
 */
interface IGiftCardMovement {
	amount?: DecimalString;
	type?: GiftCardTransactionType;
	orderId?: ID;
	note?: string;
	status?: GiftCardStatus;
}

/** The ledger as a decision reads it: on the transaction that holds the card's lock. */
interface IGiftCardLedgerReader {
	totalOfType(type: GiftCardTransactionType): Promise<DecimalString>;
}

/** A movement decision, made on the card as it stands under its lock; it throws to refuse. */
type TGiftCardDecision = (
	card: IGiftCard,
	ledger: IGiftCardLedgerReader
) => IGiftCardMovement | Promise<IGiftCardMovement>;

/** A balance write whose predicate no longer matched: another writer moved the card first. */
class GiftCardMovedError extends Error {}

/**
 * Gift cards: a stored-value instrument with its own ledger.
 *
 * Three rules govern every method here.
 *
 * * **The balance is derived, never assumed.** `gift_card.balance` is a cache maintained beside the
 *   ledger, and every change goes through one method that re-reads the card, computes the new
 *   balance, writes the ledger row and stores the balance — in that order, in one transaction, with
 *   the card row locked first. Two concurrent redemptions of the same card therefore serialise, and
 *   a balance can never go negative.
 * * **No conversion, ever.** A card is redeemed against an order in its own currency or not at all:
 *   stored value converted at a rate would silently change what the customer paid for it.
 * * **Nothing is deleted.** A withdrawn card is `CANCELED`; a forfeited balance is an `EXPIRE`
 *   movement, so the history of the liability survives on the ledger.
 */
@Injectable()
export class GiftCardService extends TenantScopedCrudService<GiftCard> {
	constructor(
		readonly typeOrmGiftCardRepository: TypeOrmGiftCardRepository,
		readonly mikroOrmGiftCardRepository: MikroOrmGiftCardRepository,
		private readonly giftCardTransactionService: GiftCardTransactionService,
		private readonly eventBus: EventBus
	) {
		super(typeOrmGiftCardRepository, mikroOrmGiftCardRepository);
	}

	/**
	 * The tenant and organization of the caller.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Issues a card: face value, an `ISSUE` movement for the same amount, and a balance equal to it.
	 *
	 * The `ISSUE` row is the ledger's record of the credit that created the card rather than a movement
	 * of its balance, which is why the ledger-derived balance adds the face value to the movements
	 * *after* it and not to this one: counting the row and the column would show every reconciliation
	 * twice the card (doc 08 §13.3 `ISSUE`, GC1; doc 05 §10.9).
	 *
	 * @param input The card to issue.
	 * @returns The stored card.
	 * @throws BadRequestException when the face value is not positive.
	 */
	async issue(input: {
		code: string;
		initialAmount: string;
		currency: string;
		customerId?: ID;
		orderId?: ID;
		expiresAt?: Date;
		pinHash?: string;
		metadata?: Record<string, unknown>;
	}): Promise<IGiftCard> {
		const faceValue = Money.of(input.initialAmount, input.currency);

		if (!faceValue.isPositive()) {
			throw new BadRequestException('GIFT_CARD_INVALID: a card is issued with a positive face value.');
		}

		const card = await this.create({
			...input,
			balance: faceValue.toStorageString(),
			status: GiftCardStatus.ACTIVE,
			...this.scope
		} as never);

		await this.giftCardTransactionService.append({
			giftCardId: card.id,
			orderId: input.orderId,
			amount: faceValue.toStorageString(),
			balanceAfter: faceValue.toStorageString(),
			type: GiftCardTransactionType.ISSUE,
			note: 'Card issued'
		});

		return card;
	}

	/**
	 * Redeems value against an order.
	 *
	 * The amount applied is `min(balance, outstanding)`: a card can never overpay an order and never
	 * produces a negative outstanding amount. A partial redemption leaves the residual on the card and
	 * the card `ACTIVE`; an exact one closes it as `REDEEMED`.
	 *
	 * @param giftCardId The card to redeem.
	 * @param amount The amount requested.
	 * @param context The order the redemption settles.
	 * @returns The card and the amount actually applied.
	 * @throws NotFoundException when the card is not in the caller's organization.
	 * @throws BadRequestException when the card is not usable or the currency differs from the order's.
	 */
	async redeem(
		giftCardId: ID,
		amount: string,
		context: { orderId?: ID; orderCurrency?: string; outstanding?: string }
	): Promise<{ card: IGiftCard; applied: string }> {
		// Every rule below is decided on the card as it stands under its lock, not on a read taken before
		// it: two redemptions of one card each see the other's debit, so together they can never spend
		// more than the card holds.
		return this.applyMovement(giftCardId, (card) => {
			if (card.status === GiftCardStatus.CANCELED) {
				throw new BadRequestException('GIFT_CARD_ALREADY_REDEEMED: the card was cancelled.');
			}

			if (card.status === GiftCardStatus.REDEEMED) {
				throw new BadRequestException('GIFT_CARD_ALREADY_REDEEMED: the card has no balance left.');
			}

			if (card.expiresAt && new Date(card.expiresAt) <= new Date()) {
				throw new BadRequestException('GIFT_CARD_EXPIRED');
			}

			if (context.orderCurrency && context.orderCurrency !== card.currency) {
				throw new BadRequestException('GIFT_CARD_CURRENCY_MISMATCH: a card is not converted.');
			}

			const balance = Money.of(card.balance, card.currency);
			const requested = Money.of(amount, card.currency);
			const outstanding =
				context.outstanding === undefined ? requested : Money.of(context.outstanding, card.currency);
			// `applied = min(balance, max(0, outstanding))`, on exact decimals: a redemption larger than the
			// card holds is applied up to the balance and never drives it below zero (doc 08 §13.3 GC2).
			const applied = Money.min(
				balance,
				Money.max(Money.zero(card.currency), Money.min(requested, outstanding))
			);

			if (!applied.isPositive()) {
				throw new BadRequestException('GIFT_CARD_INSUFFICIENT_BALANCE');
			}

			return {
				amount: applied.negate().amount,
				type: GiftCardTransactionType.REDEEM,
				orderId: context.orderId,
				note: 'Redeemed against an order'
			};
		});
	}

	/**
	 * Returns value to a card, on a cancellation or a return policy that refunds stored value.
	 *
	 * @param giftCardId The card to credit.
	 * @param amount The amount to return.
	 * @param context The order the refund came from.
	 * @returns The card and the amount returned.
	 * @throws NotFoundException when the card is not in the caller's organization.
	 */
	async refund(
		giftCardId: ID,
		amount: string,
		context: { orderId?: ID; note?: string } = {}
	): Promise<{ card: IGiftCard; applied: string }> {
		return this.applyMovement(giftCardId, async (card, ledger) => {
			const value = Money.of(amount, card.currency);

			if (!value.isPositive()) {
				throw new BadRequestException('A refund to a card is a positive amount.');
			}

			// The ceiling is what the order consumed: a card can never be refunded more than it paid. Both
			// totals are read on the transaction that holds the card's lock, so a concurrent refund of the
			// same card is either already in them or waits for this one: two refunds can never each be
			// measured against a ceiling the other has already used up.
			const consumed = Money.of(await ledger.totalOfType(GiftCardTransactionType.REDEEM), card.currency).abs();
			const alreadyReturned = Money.of(await ledger.totalOfType(GiftCardTransactionType.REFUND), card.currency);
			const refundable = Money.max(Money.zero(card.currency), consumed.subtract(alreadyReturned));
			const applied = Money.min(value, refundable);

			if (!applied.isPositive()) {
				throw new BadRequestException('GIFT_CARD_INSUFFICIENT_BALANCE: nothing is refundable on this card.');
			}

			return {
				amount: applied.amount,
				type: GiftCardTransactionType.REFUND,
				orderId: context.orderId,
				note: context.note ?? 'Refunded to the card'
			};
		});
	}

	/**
	 * Corrects a balance by hand, in either direction. A correction is this method and never an edit
	 * of a ledger row, which is why it is the only way a card's history stays replayable.
	 *
	 * @param giftCardId The card to adjust.
	 * @param amount The signed amount.
	 * @param note Why the correction was made; mandatory.
	 * @returns The card and the amount applied.
	 * @throws BadRequestException when the note is missing or the correction would overdraw the card.
	 */
	async adjust(giftCardId: ID, amount: string, note: string): Promise<{ card: IGiftCard; applied: string }> {
		if (!note?.trim()) {
			throw new BadRequestException('An adjustment to a card needs its reason.');
		}

		return this.applyMovement(giftCardId, (card) => {
			const value = Money.of(amount, card.currency);

			if (value.isNegative() && value.abs().greaterThan(Money.of(card.balance, card.currency))) {
				throw new BadRequestException('GIFT_CARD_INSUFFICIENT_BALANCE: an adjustment cannot overdraw a card.');
			}

			return {
				amount: value.amount,
				type: GiftCardTransactionType.ADJUST,
				note
			};
		});
	}

	/**
	 * Withdraws a card. The balance is kept, because the liability was real even if the card may no
	 * longer be spent, and the ledger is untouched.
	 *
	 * @param giftCardId The card to cancel.
	 * @param reason Why it was withdrawn.
	 * @returns The card.
	 * @throws NotFoundException when the card is not in the caller's organization.
	 */
	async cancel(giftCardId: ID, reason?: string): Promise<IGiftCard> {
		const card = await this.findCardOrFail(giftCardId);

		await this.update(card.id, {
			status: GiftCardStatus.CANCELED,
			metadata: { ...(card.metadata ?? {}), canceledReason: reason ?? null, canceledAt: new Date().toISOString() }
		} as never);

		return this.findCardOrFail(card.id);
	}

	/**
	 * Expires a card at its expiry instant. Under a `FORFEIT` policy the remaining balance leaves the
	 * card as an `EXPIRE` movement, so the write-off is visible on the ledger; under the default
	 * `BLOCK` policy the balance stays as an audit artefact and only new redemptions are refused.
	 *
	 * @param giftCardId The card to expire.
	 * @param forfeit Whether the remaining balance is written off.
	 * @returns The card.
	 */
	async expire(giftCardId: ID, forfeit: boolean): Promise<IGiftCard> {
		// The write-off and the status are one write, decided on the balance as it stands under the lock:
		// a card is never left `EXPIRED` still holding the balance it was meant to forfeit, and a
		// redemption that landed a moment earlier is written off from what it left, not from a balance
		// read before it.
		const { card } = await this.applyMovement(giftCardId, (current) => {
			const balance = Money.of(current.balance, current.currency);

			if (forfeit && balance.isPositive()) {
				return {
					amount: balance.negate().amount,
					type: GiftCardTransactionType.EXPIRE,
					note: 'Balance forfeited at expiry',
					status: GiftCardStatus.EXPIRED
				};
			}

			return { status: GiftCardStatus.EXPIRED };
		});

		return card;
	}

	/**
	 * Looks a card up by its code, for the balance endpoint. A card that carries a PIN requires it:
	 * the code alone is printed on a card and is not a secret.
	 *
	 * @param code The code presented.
	 * @param pin The second factor, when the card has one.
	 * @returns The balance and the status.
	 * @throws NotFoundException when no card matches the code.
	 * @throws BadRequestException when the PIN is missing or wrong.
	 */
	async balanceByCode(code: string, pin?: string): Promise<{ balance: string; currency: string; status: GiftCardStatus }> {
		const card = await this.typeOrmGiftCardRepository.findOne({
			where: { code: (code ?? '').trim().toUpperCase(), ...this.scope },
			// A projection is a column map: the columns this lookup reads, and nothing else. `pin` is
			// named although it is the digest the comparison only needs in memory, because the column
			// is declared `select: false` — a lookup that left it out would refuse every card that
			// carries a second factor.
			select: { id: true, balance: true, currency: true, status: true, pin: true }
		});

		if (!card) {
			throw new NotFoundException('GIFT_CARD_NOT_FOUND');
		}

		if (card.pin && !this.pinMatches(pin, card.pin)) {
			throw new BadRequestException('GIFT_CARD_INVALID: the second factor is missing or wrong.');
		}

		return { balance: card.balance, currency: card.currency, status: card.status };
	}

	/**
	 * A page of cards of the caller's organization. The code is masked in the projection by the
	 * controller, so a list never exposes a redeemable string in full.
	 *
	 * @param options Optional filters.
	 * @returns One page of cards.
	 */
	async findGiftCards(options: Record<string, unknown> = {}): Promise<IPagination<IGiftCard>> {
		return this.findAll({ ...options, where: { ...((options.where as object) ?? {}), ...this.scope } } as never);
	}

	/**
	 * Loads a card of the caller's organization.
	 *
	 * @param id The card to load.
	 * @returns The card.
	 * @throws NotFoundException when it is not in the caller's scope.
	 */
	async findCardOrFail(id: ID): Promise<IGiftCard> {
		const card = await this.findOneByWhereOptions({ id, ...this.scope } as never);

		if (!card) {
			throw new NotFoundException('GIFT_CARD_NOT_FOUND');
		}

		return card;
	}

	/**
	 * Moves a balance and records it, as one indivisible write.
	 *
	 * **The card is locked before anything is decided about it.** The decision (how much a redemption
	 * applies, whether a refund is under its ceiling, whether an adjustment overdraws) is made by
	 * `decide` on the card as this transaction read it under `SELECT … FOR UPDATE` on Postgres and
	 * MySQL, so a second movement of the same card waits for this one to commit and then decides on the
	 * balance it left. What this replaces read the card, wrote the ledger row and then replaced the
	 * balance with no lock and no transaction: two redemptions of 80 against 100 both read 100, both
	 * passed, both wrote a movement and both stored 20, so 160 was spent from a card that held 100.
	 *
	 * **The balance write is also conditional on the balance and the status it was decided on.** That is
	 * the guard where no row lock is taken (SQLite, whose single writer is the lock) and the belt beside
	 * the lock everywhere else. A write whose predicate no longer matches changes nothing, and the
	 * movement is decided again against the card as it now stands, a bounded number of times.
	 *
	 * **The balance and its ledger row commit together, balance first.** The ledger row is written only
	 * once the balance write is known to have landed, inside the same transaction, so a refused or failed
	 * movement leaves neither, and no ledger row ever explains a balance that was not stored: the stock
	 * engine's compare-and-set-then-insert, applied to stored value.
	 *
	 * The transaction is the platform's relational connection, which runs beside either ORM (TypeORM is
	 * initialised under `DB_ORM=mikro-orm` too, with these entities fully mapped), so the lock, the
	 * predicate and the insert are written once, as `StockLevelService` and `PaymentCaptureService` write
	 * theirs, rather than once per ORM where the two copies could drift. The card handed back is read on
	 * the same transaction, so it is the row that was committed and never a copy an ORM cached earlier.
	 *
	 * The balance is money, so it is moved as money: `0.30` less `0.10` is `0.2` and never the
	 * `0.19999999999999998` a binary floating-point subtraction leaves behind, because a balance no
	 * money column accepts is a card no customer can spend (doc 07 §1.2, doc 08 §13.3 GC4).
	 *
	 * @param giftCardId The card to move.
	 * @param decide Decides the movement from the locked card, and throws to refuse it.
	 * @returns The card as the movement left it, and the amount applied.
	 * @throws NotFoundException when the card is not in the caller's organization.
	 * @throws ConflictException with `GIFT_CARD_CONFLICT` when the card kept moving under every attempt.
	 */
	private async applyMovement(
		giftCardId: ID,
		decide: TGiftCardDecision
	): Promise<{ card: IGiftCard; applied: string }> {
		for (let attempt = 1; ; attempt++) {
			try {
				const moved = await this.typeOrmGiftCardRepository.manager.transaction((manager: EntityManager) =>
					this.applyMovementOn(manager, giftCardId, decide)
				);

				if (moved.type === GiftCardTransactionType.REDEEM) {
					// Emitted once the balance and its ledger row have both committed, so a subscriber that
					// shows the new balance can never read the old one, and a movement that rolled back is
					// never announced.
					await this.eventBus.publish(
						GiftCardRedeemedEvent.from(moved.card, moved.amount.abs().amount, moved.balanceAfter, moved.orderId)
					);
				}

				return { card: moved.card, applied: moved.amount.amount };
			} catch (error) {
				if (!(error instanceof GiftCardMovedError)) {
					throw error;
				}

				if (attempt >= MOVEMENT_ATTEMPTS) {
					throw new ConflictException(
						`GIFT_CARD_CONFLICT: gift card '${giftCardId}' was moved by another write on each of ${MOVEMENT_ATTEMPTS} attempts, so nothing was written. Try again.`
					);
				}
			}
		}
	}

	/**
	 * One attempt of {@link applyMovement}, on the transaction it opened.
	 *
	 * @param manager The open transaction.
	 * @param giftCardId The card to move.
	 * @param decide Decides the movement from the locked card.
	 * @returns What the attempt wrote.
	 * @throws GiftCardMovedError when the conditional balance write matched no row.
	 */
	private async applyMovementOn(
		manager: EntityManager,
		giftCardId: ID,
		decide: TGiftCardDecision
	): Promise<{
		card: IGiftCard;
		amount: Money;
		balanceAfter: DecimalString;
		type?: GiftCardTransactionType;
		orderId?: ID;
	}> {
		const current = await this.lockCard(manager, giftCardId);
		const movement = await decide(current, {
			totalOfType: (type) => this.giftCardTransactionService.totalOfType(current.id, type, manager)
		});
		const amount = Money.of(movement.amount ?? '0', current.currency);
		const balanceAfter = Money.of(current.balance, current.currency).add(amount);

		if (balanceAfter.isNegative()) {
			throw new BadRequestException('GIFT_CARD_INSUFFICIENT_BALANCE');
		}

		const status =
			movement.status ??
			(balanceAfter.isZero() && amount.isNegative() ? GiftCardStatus.REDEEMED : current.status);

		// The balance and the status this movement was decided on are part of the criteria, so the
		// statement lands only while the card still holds them. A decision that moves no balance writes
		// the status alone and leaves the balance column exactly as it was stored.
		const written = await manager.update(
			GiftCard,
			{
				id: current.id,
				balance: this.asRead(current.balance),
				status: this.asRead(current.status),
				...this.readScope
			} as never,
			(amount.isZero() ? { status } : { balance: balanceAfter.amount, status }) as never
		);

		if (readAffectedRows(written) === 0) {
			throw new GiftCardMovedError();
		}

		if (!amount.isZero()) {
			await this.giftCardTransactionService.append(
				{
					giftCardId: current.id,
					orderId: movement.orderId,
					amount: amount.amount,
					balanceAfter: balanceAfter.amount,
					type: movement.type,
					note: movement.note,
					tenantId: current.tenantId,
					organizationId: current.organizationId
				},
				manager
			);
		}

		const card = (await manager.findOne(GiftCard, { where: { id: current.id } as never })) as IGiftCard;

		return {
			card,
			amount,
			balanceAfter: balanceAfter.amount,
			type: amount.isZero() ? undefined : movement.type,
			orderId: movement.orderId
		};
	}

	/**
	 * Reads a card of the caller's organization and holds it for the rest of the transaction.
	 *
	 * Postgres and MySQL take `FOR UPDATE` on the row, which is what serialises two movements of one
	 * card. SQLite has no row lock (its single writer is the lock), so the read is plain there, and the
	 * conditional balance write is what refuses a writer that decided on a balance that has since moved.
	 *
	 * @param manager The open transaction.
	 * @param giftCardId The card to read.
	 * @returns The card, as it stands under the lock.
	 * @throws NotFoundException when it is not in the caller's scope.
	 */
	private async lockCard(manager: EntityManager, giftCardId: ID): Promise<GiftCard> {
		const query = manager
			.createQueryBuilder(GiftCard, 'giftCard')
			.where({ id: giftCardId, ...this.readScope } as never);
		const card = this.takesRowLocks(manager)
			? await query.setLock('pessimistic_write').getOne()
			: await query.getOne();

		if (!card) {
			throw new NotFoundException('GIFT_CARD_NOT_FOUND');
		}

		return card;
	}

	/**
	 * @param manager The open transaction.
	 * @returns Whether the dialect behind it has row locks to take.
	 */
	private takesRowLocks(manager: EntityManager): boolean {
		const type = manager.connection?.options?.type as string | undefined;

		return type === DatabaseTypeEnum.postgres || type === DatabaseTypeEnum.mysql;
	}

	/**
	 * One column value as the criteria of a conditional write must state it.
	 *
	 * `= NULL` matches nothing in SQL, so a column read as absent is stated as `IS NULL`; stated as a
	 * value, it would make every movement of such a card a permanent conflict.
	 *
	 * @param value The value as the read handed it over.
	 * @returns The criteria value that matches the row as it was read.
	 */
	private asRead(value: unknown): unknown {
		return value === null || value === undefined ? IsNull() : value;
	}

	/**
	 * Compares a presented second factor with the stored hash, in constant time.
	 *
	 * A card's code is printed on the card and is not a secret; the second factor is, which is why it
	 * is stored only as a digest and why the comparison does not return early on the first difference.
	 *
	 * @param presented The value the caller presented.
	 * @param stored The stored digest.
	 * @returns True when they match.
	 */
	private pinMatches(presented: string | undefined, stored: string): boolean {
		if (!presented) {
			return false;
		}

		const presentedDigest = createHash('sha256').update(String(presented)).digest('hex');
		const left = this.hexToBytes(presentedDigest);
		const right = this.hexToBytes(stored);

		return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
	}

	/**
	 * Turns a hexadecimal digest into its bytes, so a comparison can run over the digest rather than
	 * over its textual form.
	 *
	 * @param hex The hexadecimal digest.
	 * @returns Its bytes.
	 */
	private hexToBytes(hex: string): Uint8Array {
		const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
		const bytes = new Uint8Array(clean.length / 2);

		for (let index = 0; index < bytes.length; index++) {
			bytes[index] = parseInt(clean.substr(index * 2, 2), 16);
		}

		return bytes;
	}
}
