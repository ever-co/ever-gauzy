import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrencyCode, ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PurchasingPermissions } from '../../purchasing.permissions';
import { VendorTermStatus } from '../../purchasing.types';
import { VendorProductTermService } from '../../vendor-product-term/vendor-product-term.service';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { toUserError } from '../wire';

/** The request that writes a term, as the schema declares it. */
interface IVendorProductTermInputArgs {
	vendorId: ID;
	variantId: ID;
	currency?: string;
	unitCost?: string;
	packPrice?: string;
	packSize?: string;
	packLabel?: string;
	discountPercent?: string;
	minQuantity?: string;
	leadTimeDays?: number;
	vendorProductCode?: string;
	vendorProductName?: string;
	overReceiptTolerancePercent?: string;
	priority?: number;
	startsAt?: Date;
	endsAt?: Date;
	status?: VendorTermStatus;
}

/** The question a resolution answers, as the schema declares it. */
interface IResolveVendorProductTermArgs {
	vendorId: ID;
	variantId: ID;
	quantity: string;
	currency: string;
	date?: Date;
}

/**
 * The purchasing domain's vendor-term root fields.
 *
 * The resolvers call the same service the REST controller calls, so a term written over GraphQL and one
 * written over REST obey the same band-overlap invariant, the same window rule and the same
 * defaulting of the currency, and the two surfaces cannot drift.
 *
 * Authorisation is carried here as well as on the controller, under the same two permissions and the
 * same two protocol guards: a term is procurement's, and `VENDOR_TERMS_VIEW` deliberately does not come
 * with `PURCHASE_ORDERS_VIEW`. The platform's feature guard is carried here too, which it was not
 * before, and the reason that kept it off this class does not hold: a guard resolves its dependencies
 * from the module that hosts the handler, and every host of this resolver reaches the feature service —
 * the plugin's own module imports `FeatureModule`, and so does the host the endpoint scans,
 * `GraphqlApiModule`. The plugin's own `PURCHASING` code is deliberately not stated beside the platform
 * gate: the platform's feature metadata carries one value per target and `FeatureFlagGuard` resolves the
 * first, so a second code would be a statement that never runs rather than a capability that is checked.
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
@Resolver('VendorProductTerm')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PurchasingPermissions.VENDOR_TERMS_VIEW)
export class VendorProductTermResolver {
	constructor(private readonly vendorProductTermService: VendorProductTermService) {}

	/**
	 * Lists the standing terms.
	 *
	 * @param filter The term filter.
	 * @param page The page.
	 * @returns One page of terms.
	 */
	@Query('vendorProductTerms')
	@Permissions(PurchasingPermissions.VENDOR_TERMS_VIEW)
	async vendorProductTerms(
		@Args('filter')
		filter?: {
			vendorId?: ID;
			variantId?: ID;
			currency?: CurrencyCode;
			status?: VendorTermStatus;
			vendorProductCode?: string;
		},
		@Args('page') page?: IPageSelection
	) {
		const { skip, take } = resolvePageWindow(page);
		const result = await this.vendorProductTermService.findAll({
			where: {
				...(filter?.vendorId ? { vendorId: filter.vendorId } : {}),
				...(filter?.variantId ? { variantId: filter.variantId } : {}),
				...(filter?.currency ? { currency: filter.currency } : {}),
				...(filter?.status ? { status: filter.status } : {}),
				...(filter?.vendorProductCode ? { vendorProductCode: filter.vendorProductCode } : {})
			},
			skip,
			take,
			order: { priority: 'ASC', createdAt: 'DESC' }
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one term.
	 *
	 * @param id The term.
	 * @returns The term, or null when it is not the caller's.
	 */
	@Query('vendorProductTerm')
	@Permissions(PurchasingPermissions.VENDOR_TERMS_VIEW)
	async vendorProductTerm(@Args('id') id: ID) {
		try {
			return await this.vendorProductTermService.findScoped(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Answers what a quantity of one unit costs, when bought from one supplier on one date.
	 *
	 * This is the resolution the table exists for, exposed rather than hidden: a caller that is about to
	 * raise an order can ask what the standing agreement prices it at, and the answer says which term
	 * won, what lead time it carries and what was missing when none matched.
	 *
	 * @param input What is being priced.
	 * @returns The resolution.
	 */
	@Query('resolveVendorProductTerm')
	@Permissions(PurchasingPermissions.VENDOR_TERMS_VIEW)
	async resolveVendorProductTerm(@Args('input') input: IResolveVendorProductTermArgs) {
		return await this.vendorProductTermService.resolve({
			vendorId: input.vendorId,
			variantId: input.variantId,
			quantity: input.quantity,
			currency: input.currency as CurrencyCode,
			date: input.date
		});
	}

	/**
	 * Writes a term.
	 *
	 * @param input The term to write.
	 * @returns The payload, with the term or the reason it was refused.
	 */
	@Mutation('createVendorProductTerm')
	@Permissions(PurchasingPermissions.VENDOR_TERMS_EDIT)
	async createVendorProductTerm(@Args('input') input: IVendorProductTermInputArgs) {
		try {
			return {
				vendorProductTerm: await this.vendorProductTermService.create(input as any),
				vendorProductTerms: [],
				userErrors: []
			};
		} catch (error) {
			return { vendorProductTerm: null, vendorProductTerms: [], userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Writes several terms in one call.
	 *
	 * @param input The terms to write.
	 * @returns The payload, with the terms or the reason they were refused.
	 */
	@Mutation('bulkVendorProductTerms')
	@Permissions(PurchasingPermissions.VENDOR_TERMS_EDIT)
	async bulkVendorProductTerms(@Args('input') input: { terms: IVendorProductTermInputArgs[] }) {
		try {
			return {
				vendorProductTerm: null,
				vendorProductTerms: await this.vendorProductTermService.bulkUpsert(input.terms as any),
				userErrors: []
			};
		} catch (error) {
			return { vendorProductTerm: null, vendorProductTerms: [], userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Amends a term.
	 *
	 * @param id The term.
	 * @param input The fields to change.
	 * @returns The payload.
	 */
	@Mutation('updateVendorProductTerm')
	@Permissions(PurchasingPermissions.VENDOR_TERMS_EDIT)
	async updateVendorProductTerm(@Args('id') id: ID, @Args('input') input: Partial<IVendorProductTermInputArgs>) {
		try {
			return {
				vendorProductTerm: await this.vendorProductTermService.update(id, input as any),
				vendorProductTerms: [],
				userErrors: []
			};
		} catch (error) {
			return { vendorProductTerm: null, vendorProductTerms: [], userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires a term.
	 *
	 * A term a placed order used is kept and moved to `INACTIVE` rather than removed, which is what
	 * keeps the price provenance on those orders readable.
	 *
	 * @param id The term.
	 * @returns The payload, carrying the identity that was retired.
	 */
	@Mutation('deleteVendorProductTerm')
	@Permissions(PurchasingPermissions.VENDOR_TERMS_EDIT)
	async deleteVendorProductTerm(@Args('id') id: ID) {
		try {
			await this.vendorProductTermService.delete(id);

			return { id, userErrors: [] };
		} catch (error) {
			return { id: null, userErrors: [toUserError(error)] };
		}
	}
}
