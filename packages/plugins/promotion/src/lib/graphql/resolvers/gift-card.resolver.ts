import { Args, Mutation, Parent, Query, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { filter } from 'rxjs';
import { DecimalString, ID, PermissionsEnum } from '@gauzy/contracts';
import { EventBus, FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PromotionPermission } from '../../promotion.permissions';
import { IGiftCard, IGiftCardTransaction } from '../../promotion.types';
import { GiftCardRedeemedEvent } from '../../events';
import { CouponService, DEFAULT_COUPON_FORMAT } from '../../coupon/coupon.service';
import { GiftCardService } from '../../gift-card/gift-card.service';
import { GiftCardTransactionService } from '../../gift-card-transaction/gift-card-transaction.service';
import { toDecimal, toUserError, toWhere } from '../wire';
import {
	IGiftCardBalancePayload,
	IGiftCardRedeemedPayload,
	IIssueGiftCardInput,
	IPageInput,
	IRedeemGiftCardInput,
	ISortInput,
	IVoidGiftCardInput,
	IssueGiftCardPayload,
	RedeemGiftCardPayload,
	VoidGiftCardPayload,
	cursorOffset,
	toAsyncIterable,
	toConnection,
	toOrder,
	toWindow
} from '../types';

/**
 * The column each sortable field of a gift-card page names.
 */
const GIFT_CARD_SORT_COLUMNS: Readonly<Record<string, string>> = {
	CODE: 'code',
	BALANCE: 'balance',
	STATUS: 'status',
	EXPIRES_AT: 'expiresAt',
	CREATED_AT: 'createdAt',
	UPDATED_AT: 'updatedAt'
};

/**
 * Gift cards over GraphQL.
 *
 * A card is a liability, which is why issuing it is a permission of its own rather than one more
 * thing an editor may do: every card issued is money the business owes, and the four movements that
 * follow — spending it, returning value to it, correcting it and withdrawing it — are the edit
 * permission. Each movement is recorded in the card's own ledger rather than as an edit of the
 * balance, so the history a card is explained by survives every correction.
 *
 * `balance` is the one read that takes a code rather than an identifier. It exists for the caller who
 * holds a card and not its id — a customer, or an agent on the phone — and it is answered from the
 * ledger, so the figure it reports is the one the card would actually spend.
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the guard chain this resolver
 * already carried, and the code it reads is `FEATURE_GRAPHQL` — the commerce catalogue's entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because the value has to agree with the catalogue's `code` and nothing
 * checks one string against another: a literal that drifted names a code no catalogue row carries, which
 * the guard resolves as disabled, so every field here would answer `Cannot query field <name>` for every
 * caller with nothing red anywhere. One statement on the class puts every field behind it, and a tenant
 * that switched the capability off is answered the refusal a disabled capability's routes answer with a
 * 404.
 */
@Resolver('GiftCard')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PromotionPermission.GIFT_CARDS_VIEW as PermissionsEnum)
export class GiftCardResolver {
	constructor(
		private readonly giftCardService: GiftCardService,
		private readonly giftCardTransactionService: GiftCardTransactionService,
		private readonly couponService: CouponService,
		private readonly eventBus: EventBus
	) {}

	/**
	 * Lists the cards of the caller's organization.
	 *
	 * @param filter How the listing is narrowed.
	 * @param sort How the listing is ordered.
	 * @param page The cursor window, when the caller walks one.
	 * @param limit The page size, when the caller states one instead.
	 * @param offset The offset, when the caller states one instead.
	 * @param withDeleted Whether retired rows are included.
	 * @returns One page of cards.
	 */
	@Permissions(PromotionPermission.GIFT_CARDS_VIEW as PermissionsEnum)
	@Query('giftCards')
	async giftCards(
		@Args('filter') filter?: Record<string, unknown>,
		@Args('sort') sort?: ISortInput,
		@Args('page') page?: IPageInput,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const order = toOrder(sort, GIFT_CARD_SORT_COLUMNS);
		const result = await this.giftCardService.findGiftCards({
			where: toWhere(filter),
			...(order ? { order } : {}),
			...toWindow(page, limit, offset),
			...(withDeleted ? { withDeleted: true } : {})
		});

		return toConnection(result, cursorOffset(page, offset));
	}

	/**
	 * Reads one card by id.
	 *
	 * @param id The card to read.
	 * @returns The card, or null when it is not the caller's.
	 */
	@Permissions(PromotionPermission.GIFT_CARDS_VIEW as PermissionsEnum)
	@Query('giftCard')
	async giftCard(@Args('id') id: ID): Promise<IGiftCard | null> {
		try {
			return await this.giftCardService.findCardOrFail(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Reads the balance of a card from its code, for a caller who holds the card and not its id.
	 *
	 * @param code The code presented.
	 * @param pin The second factor, when the card carries one.
	 * @returns The balance, the currency and the status.
	 */
	@Permissions(PromotionPermission.GIFT_CARDS_VIEW as PermissionsEnum)
	@Query('giftCardBalance')
	async giftCardBalance(
		@Args('code') code: string,
		@Args('pin') pin?: string
	): Promise<IGiftCardBalancePayload> {
		const balance = await this.giftCardService.balanceByCode(code, pin);

		return {
			balance: toDecimal(balance.balance) ?? '0.000000',
			currency: balance.currency,
			status: balance.status
		};
	}

	/**
	 * Issues a card, crediting its face value as the ledger's first row.
	 *
	 * @param input The card to issue.
	 * @returns The payload.
	 */
	@Permissions(PromotionPermission.GIFT_CARDS_ISSUE as PermissionsEnum)
	@Mutation('issueGiftCard')
	async issueGiftCard(@Args('input') input: IIssueGiftCardInput): Promise<IssueGiftCardPayload> {
		try {
			const card = await this.giftCardService.issue({
				...input,
				// A card is identified by its code and the column is not nullable, so a caller who does not
				// mint one is given one from the platform's own code generator rather than a card that
				// could never be spent.
				code: input.code ?? this.couponService.generateCode(DEFAULT_COUPON_FORMAT)
			});

			return { giftCard: card, operation: null, userErrors: [] };
		} catch (error) {
			return { giftCard: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Spends part of a card's balance against an order.
	 *
	 * The amount applied is the smallest of what was asked for, the balance the ledger holds, and what
	 * the order still owes — a card never overpays an order and never spends more than it carries.
	 *
	 * @param id The card to spend.
	 * @param input The amount requested and the order it is spent against.
	 * @returns The payload, carrying the amount actually applied.
	 */
	@Permissions(PromotionPermission.GIFT_CARDS_EDIT as PermissionsEnum)
	@Mutation('redeemGiftCard')
	async redeemGiftCard(
		@Args('id') id: ID,
		@Args('input') input: IRedeemGiftCardInput
	): Promise<RedeemGiftCardPayload> {
		try {
			const { card, applied } = await this.giftCardService.redeem(id, input.amount, {
				orderId: input.orderId,
				orderCurrency: input.orderCurrency,
				outstanding: input.outstanding
			});

			return {
				giftCard: card,
				applied: toDecimal(applied) ?? '0.000000',
				operation: null,
				userErrors: []
			};
		} catch (error) {
			return { giftCard: null, applied: '0.000000', operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Withdraws a card from circulation.
	 *
	 * The card is cancelled rather than deleted and its ledger is left intact: the money that was spent
	 * with it, and the balance that was forfeited, are facts the books have to keep.
	 *
	 * @param id The card to withdraw.
	 * @param input Why it is being withdrawn.
	 * @returns The payload.
	 */
	@Permissions(PromotionPermission.GIFT_CARDS_EDIT as PermissionsEnum)
	@Mutation('voidGiftCard')
	async voidGiftCard(@Args('id') id: ID, @Args('input') input?: IVoidGiftCardInput): Promise<VoidGiftCardPayload> {
		try {
			return { giftCard: await this.giftCardService.cancel(id, input?.reason), operation: null, userErrors: [] };
		} catch (error) {
			return { giftCard: null, operation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Streams the cards that are spent with, optionally narrowed to one card.
	 *
	 * The balance after the movement travels with the event, because the consumer that reacts to a
	 * redemption needs the figure the customer will see next, and reading it separately would race with
	 * the next movement on the same card.
	 *
	 * @param giftCardId The card to narrow the stream to, when the caller wants one.
	 * @returns The stream.
	 */
	@Permissions(PromotionPermission.GIFT_CARDS_VIEW as PermissionsEnum)
	@Subscription('giftCardRedeemed')
	giftCardRedeemed(@Args('giftCardId') giftCardId?: ID): AsyncIterable<IGiftCardRedeemedPayload> {
		const source = this.eventBus.ofType(GiftCardRedeemedEvent);

		return toAsyncIterable(giftCardId ? source.pipe(filter((event) => event.giftCardId === giftCardId)) : source);
	}

	/**
	 * Every movement on the card, most recent first.
	 *
	 * @param giftCard The card being read.
	 * @returns The ledger rows.
	 */
	@ResolveField('transactions')
	async transactions(@Parent() giftCard: IGiftCard): Promise<IGiftCardTransaction[]> {
		if (Array.isArray(giftCard.transactions)) {
			return giftCard.transactions;
		}

		return await this.giftCardTransactionService.findByCard(giftCard.id);
	}

	/**
	 * The face value at issue.
	 *
	 * The column is `numeric(20,6)` and is read through the platform's numeric transformer, which hands
	 * over a number; the schema declares a `Decimal`, so the value is rendered as an exact decimal here
	 * rather than exposed as a float.
	 *
	 * @param giftCard The card being read.
	 * @returns The face value.
	 */
	@ResolveField('initialAmount')
	initialAmount(@Parent() giftCard: IGiftCard): DecimalString {
		return toDecimal(giftCard.initialAmount) ?? '0.000000';
	}

	/**
	 * The card's current balance, which is a cache of its ledger and never the authority.
	 *
	 * @param giftCard The card being read.
	 * @returns The balance.
	 */
	@ResolveField('balance')
	balance(@Parent() giftCard: IGiftCard): DecimalString {
		return toDecimal(giftCard.balance) ?? '0.000000';
	}
}
