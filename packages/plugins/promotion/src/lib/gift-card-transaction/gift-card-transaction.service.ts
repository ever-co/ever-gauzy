import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DecimalString, ID } from '@gauzy/contracts';
import {
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
import { TenantScopedCrudService } from '../shared/tenant-scoped-crud.service';

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
export class GiftCardTransactionService extends TenantScopedCrudService<GiftCardTransaction> {
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
	 * **A movement of a balance is written on the transaction that moved the balance.** The card's
	 * `applyMovement` locks the card, writes the new balance and hands its transaction here, so the
	 * ledger row and the balance it explains commit together or not at all. Without a transaction the
	 * row is written on its own, which is what issuing a card does: a new card has no balance to race.
	 *
	 * @param input The movement to record. `tenantId` and `organizationId`, when stated, are the card's
	 * own scope, and take precedence over the caller's: the ledger row belongs where its card is.
	 * @param manager The transaction to write on, when the caller holds one.
	 * @returns The stored movement.
	 * @throws BadRequestException when the movement is zero, which is not a movement.
	 */
	async append(
		input: {
			giftCardId: ID;
			orderId?: ID;
			amount: string;
			balanceAfter: string;
			type: GiftCardTransactionType;
			note?: string;
			tenantId?: ID;
			organizationId?: ID;
		},
		manager?: EntityManager
	): Promise<IGiftCardTransaction> {
		// A zero movement is not a movement: it would claim the ledger recorded something while the
		// balance stayed exactly where it was. The comparison is made on the decimal, not on a parsed
		// `number`, so `0.000000` and `0` are the same nothing.
		if (normalizeDecimalString(input.amount) === '0') {
			throw new BadRequestException('A zero-amount movement is not recorded on a gift-card ledger.');
		}

		const { tenantId, organizationId, ...movement } = input;
		const row = {
			...movement,
			occurredAt: new Date(),
			...this.scope,
			...(tenantId ? { tenantId } : {}),
			...(organizationId ? { organizationId } : {})
		};

		if (manager) {
			return (await manager.save(
				GiftCardTransaction,
				manager.create(GiftCardTransaction, row as never)
			)) as unknown as IGiftCardTransaction;
		}

		return super.create(row as never);
	}

	/**
	 * Refuses a movement written from outside the card's own operations (review R3-06).
	 *
	 * `POST /gift-card-transactions` used to write whatever row it was given: a `REDEEM` of -1000 that no order
	 * spent, which `refund()` then measured its ceiling from and credited back as money. A movement is appended by
	 * the operation that causes it (`issue`, `redeem`, `refund`, `adjust`, `expire`, through `append`), and a
	 * correction is `POST /gift-cards/:id/adjust`.
	 *
	 * @param entity The refused movement.
	 * @throws BadRequestException with `GIFT_CARD_TRANSACTION_APPEND_ONLY`, always.
	 */
	async create(entity: unknown): Promise<never> {
		void entity;

		throw appendOnly('a movement is appended by the card operation that causes it; correct a balance with POST /gift-cards/:id/adjust');
	}

	/**
	 * Refuses an edit of a movement. The balance is the sum of the rows, and an edited row is a balance nobody can
	 * replay.
	 *
	 * @throws BadRequestException with `GIFT_CARD_TRANSACTION_APPEND_ONLY`, always.
	 */
	async update(id: unknown, partialEntity?: unknown): Promise<never> {
		void id;
		void partialEntity;

		throw appendOnly('a movement is never edited; record the correction as an adjustment');
	}

	/**
	 * Refuses to erase a movement.
	 *
	 * @throws BadRequestException with `GIFT_CARD_TRANSACTION_APPEND_ONLY`, always.
	 */
	async delete(criteria: unknown): Promise<never> {
		void criteria;

		throw appendOnly('a movement is never removed; record the correction as an adjustment');
	}

	/**
	 * Refuses to retire a movement: a retired row drops out of the sum `refund()` measures its ceiling from while
	 * the card's balance keeps it, and recovering it puts it back - the ledger and the card would disagree with
	 * nothing to reconcile them.
	 *
	 * @throws BadRequestException with `GIFT_CARD_TRANSACTION_APPEND_ONLY`, always.
	 */
	async softRemove(id: unknown, ...options: unknown[]): Promise<never> {
		void id;
		void options;

		throw appendOnly('a movement is never retired; record the correction as an adjustment');
	}

	/**
	 * Refuses to restore a retired movement, for the reason `softRemove` gives.
	 *
	 * @throws BadRequestException with `GIFT_CARD_TRANSACTION_APPEND_ONLY`, always.
	 */
	async softRecover(id: unknown, ...options: unknown[]): Promise<never> {
		void id;
		void options;

		throw appendOnly('a movement is never retired or restored; record the correction as an adjustment');
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
	 * A rule that is decided on this figure reads it on the transaction that holds the card's lock,
	 * so the figure cannot move between the decision and the write: two refunds of the same card each
	 * read the other's movement or neither runs.
	 *
	 * @param giftCardId The card to total.
	 * @param type The movement type to total.
	 * @param manager The transaction to read on, when the caller holds one.
	 * @returns The signed sum, as an exact decimal.
	 */
	async totalOfType(giftCardId: ID, type: GiftCardTransactionType, manager?: EntityManager): Promise<string> {
		const where = { giftCardId, type, ...this.scope };
		const rows = manager
			? await manager.find(GiftCardTransaction, { where: where as never })
			: await this.typeOrmGiftCardTransactionRepository.find({ where });

		return rows.reduce<DecimalString>((sum, row) => addDecimalStrings(sum, row.amount), '0');
	}
}

/** The refusal every write of the ledger outside `append` answers with. */
function appendOnly(reason: string): BadRequestException {
	return new BadRequestException({
		message: `GIFT_CARD_TRANSACTION_APPEND_ONLY: ${reason}.`,
		code: 'GIFT_CARD_TRANSACTION_APPEND_ONLY'
	});
}
