import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DecimalString, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PromotionPermission } from '../../promotion.permissions';
import { IGiftCard, IGiftCardTransaction } from '../../promotion.types';
import { GiftCardService } from '../../gift-card/gift-card.service';
import { toDecimal } from '../wire';

/**
 * Gift-card movements over GraphQL.
 *
 * The ledger is append-only and is the authority on what a card is worth: the balance column on the
 * card is a materialised cache of these rows, so a row is written and never edited or removed, and
 * every row was written by one of the gift-card operations through the same service this resolver
 * reads. Reaching it here is what lets a card's balance be reconciled against its history, and there
 * is nothing on this resolver to write with — the only way a balance moves is a movement on the card.
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
@Resolver('GiftCardTransaction')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PromotionPermission.GIFT_CARDS_VIEW as PermissionsEnum)
export class GiftCardTransactionResolver {
	constructor(private readonly giftCardService: GiftCardService) {}

	/**
	 * The card the movement was recorded on.
	 *
	 * @param transaction The movement being read.
	 * @returns The card, or null when it has since been removed.
	 */
	@ResolveField('giftCard')
	async giftCard(@Parent() transaction: IGiftCardTransaction): Promise<IGiftCard | null> {
		if (transaction.giftCard) {
			return transaction.giftCard;
		}

		try {
			return await this.giftCardService.findCardOrFail(transaction.giftCardId);
		} catch (error) {
			return null;
		}
	}

	/**
	 * The amount of the movement: negative when value was spent, positive when it was returned.
	 *
	 * The column is `numeric(20,6)` and is read through the platform's numeric transformer, which hands
	 * over a number; the schema declares a `Decimal`, so the value is rendered as an exact decimal here
	 * rather than exposed as a float.
	 *
	 * @param transaction The movement being read.
	 * @returns The amount.
	 */
	@ResolveField('amount')
	amount(@Parent() transaction: IGiftCardTransaction): DecimalString {
		return toDecimal(transaction.amount) ?? '0.000000';
	}

	/**
	 * The balance the card held after this movement, which is what makes the ledger explain itself
	 * without being recomputed.
	 *
	 * @param transaction The movement being read.
	 * @returns The balance after it.
	 */
	@ResolveField('balanceAfter')
	balanceAfter(@Parent() transaction: IGiftCardTransaction): DecimalString {
		return toDecimal(transaction.balanceAfter) ?? '0.000000';
	}
}
