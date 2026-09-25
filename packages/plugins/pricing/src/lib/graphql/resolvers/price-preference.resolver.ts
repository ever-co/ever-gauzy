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
	ICreatePricePreferenceInput,
	IDeletePricePreferencePayload,
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
 * The create and the delete were absent here and are delivered beside this note. The absence was argued
 * for on the ground that "a preference is created with the scope it answers for, so it is authored once
 * through the resource that owns the configuration" — and that resource does not exist: no field of this
 * document, and no route of this controller other than `POST /price-preferences` itself, reaches
 * `createOne`, and `updateOne` refuses an id it cannot read, so a preference that was never created over
 * REST could not be created over GraphQL at all. A capability one protocol has and the other does not is
 * the break §3.1 exists to close, so both are mirrored, and the uniqueness the old note was protecting is
 * protected where it actually lives: in `createOne`, which refuses a second live row for a scope with
 * `PRICE_PREFERENCE_EXISTS` rather than in the absence of a field.
 *
 * The hard half of the delete is mirrored for the same reason: `DELETE /price-preferences/:id` reaches
 * `delete(id)` when `force` is true and `softDelete(id)` otherwise, and the field reaches the same pair
 * for the same input. **The two are not the pair the sibling `softDeletePricePreference` reaches.** That
 * field reads `softRemove(id)`, which finds the row through the tenant-scoped read before removing it,
 * while this route's own soft branch reads `softDelete(id)`, which does not — a divergence this wave
 * reports rather than copies, because a field that changed method to match a sibling would stop
 * answering the route it names.
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
		return await readConnection(page, limit, offset, this.orderOf(sort), (window) =>
			this.pricePreferenceService.findAll({
				where: this.whereOf(filter),
				order: window.order,
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
	 * Creates the preference a scope answers with.
	 *
	 * The route it mirrors is `POST /price-preferences`, which is the only door a preference has ever
	 * been created through, and the field reaches the same method the route reaches — `createOne`, which
	 * canonicalises the scope value and refuses a second live row for it with `PRICE_PREFERENCE_EXISTS`.
	 * The refusal is therefore the service's, on both surfaces: a GraphQL caller that re-states a scope
	 * is answered the same `400` a REST caller is, rather than a duplicate row.
	 *
	 * The route declares no retry scope, so neither does the field. `06-api-specification.md` §7.5 marks
	 * the route idempotent and the route does not carry the decorator; inventing one here would make the
	 * two protocols dedupe differently, which is the divergence §3.1's authorisation dimension forbids,
	 * so the gap is reported rather than closed from one side.
	 *
	 * @param input The scope and the answer it gives.
	 * @returns The stored preference.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT))
	@Mutation('createPricePreference')
	async createPricePreference(@Args('input') input: ICreatePricePreferenceInput): Promise<PricePreference> {
		return await this.pricePreferenceService.createOne(input);
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
	 * Deletes a preference, outright when `force` is true and recoverably otherwise.
	 *
	 * The route it mirrors is `DELETE /price-preferences/:id`, and it is mirrored branch for branch: the
	 * field reads the row first for the same reason the route does — the read is what scopes the write to
	 * the caller's tenant and refuses an id the caller cannot see — and then reaches `delete(id)` for
	 * `force === true` and `softDelete(id)` otherwise, exactly the pair the route reaches.
	 *
	 * The two are one statement about a row: `DELETE …?force=true` takes the row out of the database and
	 * `DELETE …` takes it out of every read while leaving it restorable, which is a distinction the
	 * payload carries rather than one the caller has to infer from which field answered.
	 *
	 * @param id The preference to delete.
	 * @param force Whether the removal is a hard delete.
	 * @returns What the deletion did.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT))
	@Mutation('deletePricePreference')
	async deletePricePreference(
		@Args('id') id: ID,
		@Args('force') force?: boolean
	): Promise<IDeletePricePreferencePayload> {
		await this.pricePreferenceService.findOneByIdString(id);

		if (force === true) {
			await this.pricePreferenceService.delete(id);
		} else {
			await this.pricePreferenceService.softDelete(id);
		}

		return { id, deleted: true, hard: force === true };
	}

	/**
	 * Retires a preference recoverably, so that its scope falls back to the next answer.
	 *
	 * The route it mirrors is `DELETE /price-preferences/:id/soft` — the one this controller overrides
	 * to state a permission, which the base declares without any. The field matters more here than on
	 * a resource that already has a delete field: this resolver serves no delete at all, so before it
	 * a preference retired over REST was frozen — GraphQL could neither retire nor restore it, and the
	 * two surfaces of one lifecycle disagreed about which of them could complete it.
	 *
	 * The permission is the route's own — `PRODUCT_PRICES_EDIT` — and not the class-level
	 * `PRODUCT_PRICES_VIEW`, because retiring a preference changes what a tax-inclusive price resolves
	 * to for a whole currency, region or channel rather than one row.
	 *
	 * @param id The preference to soft delete.
	 * @returns The soft-deleted preference.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT))
	@Mutation('softDeletePricePreference')
	async softDeletePricePreference(@Args('id') id: ID): Promise<PricePreference> {
		return await this.pricePreferenceService.softRemove(id);
	}

	/**
	 * Restores a soft-deleted preference, so that its scope answers from it again.
	 *
	 * The route it mirrors is `PUT /price-preferences/:id/recover`. A restore is the only move that
	 * can put a preference back in front of the fallback the removal exposed, which is why the pair
	 * travels together: a removal with no way back over the same protocol is a one-way door.
	 *
	 * The permission is the route's own — `PRODUCT_PRICES_EDIT` — because a restored preference
	 * changes the tax-inclusive answer again, which is the same act read the other way.
	 *
	 * @param id The preference to restore.
	 * @returns The restored preference.
	 */
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT))
	@Mutation('recoverPricePreference')
	async recoverPricePreference(@Args('id') id: ID): Promise<PricePreference> {
		return await this.pricePreferenceService.softRecover(id);
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
