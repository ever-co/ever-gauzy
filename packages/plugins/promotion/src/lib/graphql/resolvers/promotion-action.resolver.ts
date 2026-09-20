import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DecimalString, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PromotionPermission } from '../../promotion.permissions';
import { IPromotion, IPromotionAction } from '../../promotion.types';
import { PromotionService } from '../../promotion/promotion.service';
import { toDecimal } from '../wire';

/**
 * Promotion actions over GraphQL.
 *
 * An action has no root field of its own and does not need one: it is always read as part of the
 * offer it belongs to, through `Promotion.actions`, because an action's position among its siblings
 * is part of its meaning and a page of actions detached from their promotion could not be applied.
 * The relation is resolved here rather than on the promotion's resolver so that every field of this
 * type is answered by the class that owns it.
 *
 * What an action does is decided by the service and never restated here: a type, a target and an
 * allocation that the promotion's own type does not allow is refused by the service, on both surfaces
 * alike, and a value that is not an exact decimal is rendered as one on the way out.
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
@Resolver('PromotionAction')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PromotionPermission.PROMOTIONS_VIEW as PermissionsEnum)
export class PromotionActionResolver {
	constructor(private readonly promotionService: PromotionService) {}

	/**
	 * The promotion the action belongs to.
	 *
	 * @param action The action being read.
	 * @returns The promotion, or null when it has since been removed.
	 */
	@ResolveField('promotion')
	async promotion(@Parent() action: IPromotionAction): Promise<IPromotion | null> {
		if (action.promotion) {
			return action.promotion;
		}

		try {
			return await this.promotionService.findPromotionOrFail(action.promotionId);
		} catch (error) {
			return null;
		}
	}

	/**
	 * The amount, the fraction or the bundle price the action applies.
	 *
	 * The column is `numeric(20,6)` and is read through the platform's numeric transformer, which hands
	 * over a number; the schema declares a `Decimal`, so the value is rendered as an exact decimal here
	 * rather than exposed as a float.
	 *
	 * @param action The action being read.
	 * @returns The value.
	 */
	@ResolveField('value')
	value(@Parent() action: IPromotionAction): DecimalString {
		return toDecimal(action.value) ?? '0.000000';
	}

	/**
	 * The upper bound on the benefit the action may give.
	 *
	 * @param action The action being read.
	 * @returns The bound, or null when the action is unbounded.
	 */
	@ResolveField('maxQuantity')
	maxQuantity(@Parent() action: IPromotionAction): DecimalString | null {
		return toDecimal(action.maxQuantity);
	}

	/**
	 * The units the benefit applies to.
	 *
	 * @param action The action being read.
	 * @returns The quantity, or null when every eligible unit is included.
	 */
	@ResolveField('applyToQuantity')
	applyToQuantity(@Parent() action: IPromotionAction): DecimalString | null {
		return toDecimal(action.applyToQuantity);
	}

	/**
	 * The units that must be bought before a buy-and-get action fires.
	 *
	 * @param action The action being read.
	 * @returns The quantity, or null for an action that has no buy rules.
	 */
	@ResolveField('buyRulesMinQuantity')
	buyRulesMinQuantity(@Parent() action: IPromotionAction): DecimalString | null {
		return toDecimal(action.buyRulesMinQuantity);
	}
}
