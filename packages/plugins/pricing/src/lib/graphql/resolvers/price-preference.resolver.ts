import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FindOptionsWhere, In } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PRICING_PERMISSION_VALUES, pricingPermission } from '../../pricing.permissions';
import { PricePreference } from '../../price-preference/price-preference.entity';
import { PricePreferenceService } from '../../price-preference/price-preference.service';
import {
	IPageInput,
	IPricePreferenceFilter,
	IPricePreferenceSort,
	IUpdatePricePreferenceInput,
	PricePreferenceConnection,
	PricePreferenceSortField
} from '../graphql.types';
import { readConnection } from '../pagination';

/**
 * Tax-inclusivity preferences over GraphQL.
 *
 * There is no create and no delete here, and that is deliberate: a preference is created with the
 * scope it answers for, so it is authored once through the resource that owns the configuration,
 * and from then on the only thing that changes is the answer. Exposing a create beside the update
 * would invite two rows for one scope, which is exactly what the table's unique constraint exists to
 * prevent.
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
@Resolver('PricePreference')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_VIEW))
export class PricePreferenceResolver {
	constructor(private readonly pricePreferenceService: PricePreferenceService) {}

	/**
	 * Lists the tax-inclusivity preferences of the caller's organization.
	 *
	 * @param filter How to narrow the list.
	 * @param sort How to order it.
	 * @param page The cursor window, when one is asked for.
	 * @param limit The page size, when one is asked for.
	 * @param offset The offset, when one is asked for.
	 * @returns The page and its boundary.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_VIEW))
	@Query('pricePreferences')
	async pricePreferences(
		@Args('filter') filter?: IPricePreferenceFilter,
		@Args('sort') sort?: IPricePreferenceSort,
		@Args('page') page?: IPageInput,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<PricePreferenceConnection> {
		return await readConnection(page, limit, offset, (window) =>
			this.pricePreferenceService.findAll({
				where: this.whereOf(filter),
				order: this.orderOf(sort),
				take: window.take,
				skip: window.skip,
				...(withDeleted ? { withDeleted: true } : {})
			})
		);
	}

	/**
	 * Reads one preference.
	 *
	 * @param id The preference to read.
	 * @returns The preference.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_VIEW))
	@Query('pricePreference')
	async pricePreference(@Args('id') id: ID): Promise<PricePreference> {
		return await this.pricePreferenceService.findOneByIdString(id);
	}

	/**
	 * Changes the answer a scope gives.
	 *
	 * @param input The preference to change and the answer to store.
	 * @returns The preference, as it now stands.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT))
	@Mutation('updatePricePreference')
	async updatePricePreference(@Args('input') input: IUpdatePricePreferenceInput): Promise<PricePreference> {
		await this.pricePreferenceService.updateOne(input.id, { isTaxInclusive: input.isTaxInclusive });

		return await this.pricePreferenceService.findOneByIdString(input.id);
	}

	/**
	 * @param filter The GraphQL filter.
	 * @returns The equivalent row predicate.
	 */
	private whereOf(filter?: IPricePreferenceFilter): FindOptionsWhere<PricePreference> {
		const where: FindOptionsWhere<PricePreference> = {};

		if (!filter) {
			return where;
		}

		if (filter.ids?.length) {
			where.id = In(filter.ids);
		}

		if (filter.attribute) {
			where.attribute = filter.attribute;
		}

		if (filter.value) {
			where.value = filter.value;
		}

		return where;
	}

	/**
	 * @param sort The GraphQL sort.
	 * @returns The equivalent ordering, by scope by default so that the three scopes of one tenant
	 * read together.
	 */
	private orderOf(sort?: IPricePreferenceSort): Record<string, 'ASC' | 'DESC'> {
		const direction = sort?.direction;

		switch (sort?.field) {
			case PricePreferenceSortField.ATTRIBUTE:
				return { attribute: direction ?? 'ASC' };
			case PricePreferenceSortField.VALUE:
				return { value: direction ?? 'ASC' };
			case PricePreferenceSortField.CREATED_AT:
				return { createdAt: direction ?? 'DESC' };
			case PricePreferenceSortField.UPDATED_AT:
				return { updatedAt: direction ?? 'DESC' };
			default:
				return { attribute: 'ASC', value: 'ASC' };
		}
	}
}
