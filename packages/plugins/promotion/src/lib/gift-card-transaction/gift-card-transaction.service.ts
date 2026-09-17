import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DecimalString, ID } from '@gauzy/contracts';
import {
	CrudService,
	RequestContext,
	STORAGE_SCALE,
	addDecimalStrings,
	formatDecimalUnits,
	normalizeDecimalString,
	toUnitsAtScale
} from '@gauzy/core';
import { GiftCardTransaction } from './gift-card-transaction.entity';
import { TypeOrmGiftCardTransactionRepository } from './repository/type-orm-gift-card-transaction.repository';
import { MikroOrmGiftCardTransactionRepository } from './repository/mikro-orm-gift-card-transaction.repository';
import { GiftCardTransactionType, IGiftCardTransaction } from '../promotion.types';

/**
 * The gift-card ledger.
 *
 * Append-only by construction: nothing here updates or deletes a row, because the balance of a card
 * is the sum of its rows and an edited row is a balance nobody can replay. A correction is an
 * `ADJUST`, which is why the type exists.
 *
 * The service is also the place the balance is derived from, so the materialised `gift_card.balance`
 * column and the ledger are always compared through the same arithmetic: `initialAmount` plus every
 * movement. A disagreement is a defect in the caller that moved the balance, not a rounding artefact.
 */
@Injectable()
export class GiftCardTransactionService extends CrudService<GiftCardTransaction> {
	constructor(
		readonly typeOrmGiftCardTransactionRepository: TypeOrmGiftCardTransactionRepository,
		readonly mikroOrmGiftCardTransactionRepository: MikroOrmGiftCardTransactionRepository
	) {
		super(typeOrmGiftCardTransactionRepository, mikroOrmGiftCardTransactionRepository);
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
	 * Appends one movement and returns it.
	 *
	 * Every caller passes the balance the card holds **after** the movement, because the ledger's job
	 * is to record what happened, not to compute it: the redemption path re-reads the balance under a
	 * row lock and hands the result here, which is what keeps the chain of `balanceAfter` values
	 * consistent with the movement amounts.
	 *
	 * @param input The movement to record.
	 * @returns The stored movement.
	 * @throws BadRequestException when the movement is zero, which is not a movement.
	 */
	async append(input: {
		giftCardId: ID;
		orderId?: ID;
		amount: string;
		balanceAfter: string;
		type: GiftCardTransactionType;
		note?: string;
	}): Promise<IGiftCardTransaction> {
		// A zero movement is not a movement: it would claim the ledger recorded something while the
		// balance stayed exactly where it was. The comparison is made on the decimal, not on a parsed
		// `number`, so `0.000000` and `0` are the same nothing.
		if (normalizeDecimalString(input.amount) === '0') {
			throw new BadRequestException('A zero-amount movement is not recorded on a gift-card ledger.');
		}

		return this.create({
			...input,
			occurredAt: new Date(),
			...this.scope
		} as never);
	}

	/**
	 * Reads the ledger of a card, most recent movement first.
	 *
	 * @param giftCardId The card to read.
	 * @returns The movements.
	 */
	async findByCard(giftCardId: ID): Promise<IGiftCardTransaction[]> {
		const rows = await this.typeOrmGiftCardTransactionRepository.find({
			where: { giftCardId, ...this.scope },
			order: { occurredAt: 'DESC' }
		});

		return rows as unknown as IGiftCardTransaction[];
	}

	/**
	 * Derives a card's balance from its ledger: face value plus every movement of the balance.
	 *
	 * This is the authority. The `gift_card.balance` column is a cache of it, maintained in the same
	 * transaction as each movement so a read never has to sum the ledger, and compared with this
	 * figure by the nightly audit.
	 *
	 * The `ISSUE` row is the ledger's record of the credit that created the card — it carries the face
	 * value itself — so it is not summed a second time: `initialAmount` is what it credited, and adding
	 * both would show every reconciliation twice the card (doc 05 §10.9, doc 08 §13.3 GC1).
	 *
	 * The sum is decimal arithmetic on scaled integers, so a chain of movements that a binary floating
	 * point sum would leave a fraction of a cent out of adds back to the stored balance exactly.
	 *
	 * @param giftCardId The card to derive.
	 * @param initialAmount The card's face value.
	 * @returns The derived balance, at the scale the money columns carry.
	 * @throws NotFoundException never — an unknown card simply has no movements and derives to its
	 * face value; the caller has already loaded the card.
	 */
	async deriveBalance(giftCardId: ID, initialAmount: string): Promise<string> {
		const rows = await this.typeOrmGiftCardTransactionRepository.find({
			where: { giftCardId, ...this.scope }
		});

		const moved = rows
			.filter((row) => row.type !== GiftCardTransactionType.ISSUE)
			.reduce<DecimalString>((sum, row) => addDecimalStrings(sum, row.amount), '0');

		return formatDecimalUnits(toUnitsAtScale(addDecimalStrings(initialAmount, moved), STORAGE_SCALE), STORAGE_SCALE);
	}

	/**
	 * The sum of the movements of one type, which the redemption rules need: a refund may never
	 * exceed what was consumed.
	 *
	 * @param giftCardId The card to total.
	 * @param type The movement type to total.
	 * @returns The signed sum, as an exact decimal.
	 */
	async totalOfType(giftCardId: ID, type: GiftCardTransactionType): Promise<string> {
		const rows = await this.typeOrmGiftCardTransactionRepository.find({
			where: { giftCardId, type, ...this.scope }
		});

		return rows.reduce<DecimalString>((sum, row) => addDecimalStrings(sum, row.amount), '0');
	}
}
