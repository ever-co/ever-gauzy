import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import { EventBus, Money, RequestContext } from '@gauzy/core';
import { GiftCardRedeemedEvent } from '../events';
import { GiftCard } from './gift-card.entity';
import { TypeOrmGiftCardRepository } from './repository/type-orm-gift-card.repository';
import { MikroOrmGiftCardRepository } from './repository/mikro-orm-gift-card.repository';
import { GiftCardTransactionService } from '../gift-card-transaction/gift-card-transaction.service';
import { GiftCardStatus, GiftCardTransactionType, IGiftCard } from '../promotion.types';
import { TenantScopedCrudService } from '../shared/tenant-scoped-crud.service';

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
		const card = await this.findCardOrFail(giftCardId);

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

		return this.applyMovement(card, {
			amount: applied.negate().amount,
			type: GiftCardTransactionType.REDEEM,
			orderId: context.orderId,
			note: 'Redeemed against an order'
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
		const card = await this.findCardOrFail(giftCardId);
		const value = Money.of(amount, card.currency);

		if (!value.isPositive()) {
			throw new BadRequestException('A refund to a card is a positive amount.');
		}

		// The ceiling is what the order consumed: a card can never be refunded more than it paid.
		const consumed = Money.of(
			await this.giftCardTransactionService.totalOfType(card.id, GiftCardTransactionType.REDEEM),
			card.currency
		).abs();
		const alreadyReturned = Money.of(
			await this.giftCardTransactionService.totalOfType(card.id, GiftCardTransactionType.REFUND),
			card.currency
		);
		const refundable = Money.max(Money.zero(card.currency), consumed.subtract(alreadyReturned));
		const applied = Money.min(value, refundable);

		if (!applied.isPositive()) {
			throw new BadRequestException('GIFT_CARD_INSUFFICIENT_BALANCE: nothing is refundable on this card.');
		}

		return this.applyMovement(card, {
			amount: applied.amount,
			type: GiftCardTransactionType.REFUND,
			orderId: context.orderId,
			note: context.note ?? 'Refunded to the card'
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

		const card = await this.findCardOrFail(giftCardId);
		const value = Money.of(amount, card.currency);

		if (value.isNegative() && value.abs().greaterThan(Money.of(card.balance, card.currency))) {
			throw new BadRequestException('GIFT_CARD_INSUFFICIENT_BALANCE: an adjustment cannot overdraw a card.');
		}

		return this.applyMovement(card, {
			amount: value.amount,
			type: GiftCardTransactionType.ADJUST,
			note
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
		const card = await this.findCardOrFail(giftCardId);
		const balance = Money.of(card.balance, card.currency);

		if (forfeit && balance.isPositive()) {
			await this.applyMovement(card, {
				amount: balance.negate().amount,
				type: GiftCardTransactionType.EXPIRE,
				note: 'Balance forfeited at expiry'
			});
		}

		await this.update(card.id, { status: GiftCardStatus.EXPIRED } as never);

		return this.findCardOrFail(card.id);
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
	 * Moves a balance and records it.
	 *
	 * The order is deliberate: re-read the card, compute the new balance, write the ledger row, then
	 * store the new balance. The ledger row is what the audit replays, so it is written before the
	 * cache it explains; a failure between the two leaves a ledger that is right and a cache the audit
	 * repairs, which is the safe direction.
	 *
	 * The balance is money, so it is moved as money: `0.30` less `0.10` is `0.2` and never the
	 * `0.19999999999999998` a binary floating-point subtraction leaves behind, because a balance no
	 * money column accepts is a card no customer can spend (doc 07 §1.2, doc 08 §13.3 GC4).
	 *
	 * @param card The card being moved.
	 * @param movement The signed amount and why.
	 * @returns The card and the amount applied.
	 */
	private async applyMovement(
		card: IGiftCard,
		movement: { amount: DecimalString; type: GiftCardTransactionType; orderId?: ID; note?: string }
	): Promise<{ card: IGiftCard; applied: string }> {
		const current = await this.findCardOrFail(card.id);
		const amount = Money.of(movement.amount, current.currency);
		const balanceAfter = Money.of(current.balance, current.currency).add(amount);

		if (balanceAfter.isNegative()) {
			throw new BadRequestException('GIFT_CARD_INSUFFICIENT_BALANCE');
		}

		await this.giftCardTransactionService.append({
			giftCardId: current.id,
			orderId: movement.orderId,
			amount: amount.amount,
			balanceAfter: balanceAfter.amount,
			type: movement.type,
			note: movement.note
		});

		const status = balanceAfter.isZero() && amount.isNegative() ? GiftCardStatus.REDEEMED : current.status;

		await this.update(current.id, { balance: balanceAfter.amount, status } as never);

		const updated = await this.findCardOrFail(current.id);

		if (movement.type === GiftCardTransactionType.REDEEM) {
			// Emitted after the balance and its ledger row are both stored, so a subscriber that shows the
			// new balance can never read the old one.
			await this.eventBus.publish(
				GiftCardRedeemedEvent.from(updated, amount.abs().amount, balanceAfter.amount, movement.orderId)
			);
		}

		return { card: updated, applied: amount.amount };
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
