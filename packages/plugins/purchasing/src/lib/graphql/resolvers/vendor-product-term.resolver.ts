import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrencyCode, ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PurchasingFeatures } from '../../purchasing.features';
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
 * with `PURCHASE_ORDERS_VIEW`. The read fields answer under the class's view grant, and every write —
 * including the withdrawal and the recovery the inherited CRUD routes serve — states `VENDOR_TERMS_EDIT`
 * field by field, which is what the term controller's own overrides state and the direction in which the
 * two surfaces must not disagree. The platform's feature guard is carried here too, which it was not
 * before, and the reason that kept it off this class does not hold: a guard resolves its dependencies
 * from the module that hosts the handler, and every host of this resolver reaches the feature service —
 * the plugin's own module imports `FeatureModule`, and so does the host the endpoint scans,
 * `GraphqlApiModule`. The plugin's own `PURCHASING` code used to be left off this class because the
 * platform's feature metadata carried one value per target, so a second code would have been a statement
 * that never ran; the decorator now accumulates, and the code is stated below.
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
 *
 * **The plugin's own gate stands beside it.** The class also declares `PurchasingFeatures.PURCHASING`
 * (`FEATURE_PURCHASING`), the code every purchasing REST controller declares with `@FeatureFlag`, so a
 * tenant that switched purchasing off is refused here exactly as its routes refuse it — rather than finding
 * every write the routes withhold still served over GraphQL. The two codes are two questions, both of which
 * must be answered yes: the endpoint is on, and the capability is on. The platform's decorator accumulates
 * the codes stated on one target and `FeatureFlagGuard` requires every one of them.
 */
@Resolver('VendorProductTerm')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(PurchasingFeatures.PURCHASING)
@Permissions(PurchasingPermissions.VENDOR_TERMS_VIEW)
export class VendorProductTermResolver {
	constructor(private readonly vendorProductTermService: VendorProductTermService) {}

	/**
	 * Lists the standing terms.
	 *
	 * @param filter The term filter.
	 * @param page The page.
	 * @param withDeleted Whether retired rows are included.
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
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
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
			order: { priority: 'ASC', createdAt: 'DESC' },
			...(withDeleted ? { withDeleted: true } : {})
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

	/**
	 * Withdraws a term without removing the row.
	 *
	 * The field mirrors `DELETE /vendor-product-terms/:id/soft`, which the term's controller inherits from
	 * `CrudController<T>` and overrides only to state a permission the inherited declaration left
	 * unstated — the base declares the route with no permission metadata, so `PermissionGuard` fell
	 * through to the class-level read grant while every write route of this resource demands
	 * `VENDOR_TERMS_EDIT`. The field states the grant the route states, read off that same override,
	 * because a field that left the act to its class would let whoever may read a supplier's terms
	 * withdraw one — and unlike `deleteVendorProductTerm` above, which retires a term the org no longer
	 * wants by moving it to `INACTIVE`, this pair is the recoverable half: the row and everything that
	 * points at it stay put, and `recoverVendorProductTerm` reads it back.
	 *
	 * The answer is the payload the resource's own write mutations answer rather than the term itself, so
	 * a generated client sees one shape for a write on this resource, and the refusal travels in
	 * `userErrors` exactly as `createVendorProductTerm` and `updateVendorProductTerm` report it — the
	 * `DeleteVendorProductTermPayload` of the destructive retire is deliberately not reused, because that
	 * shape belongs to the act that ends a term rather than to the act that withdraws it recoverably. The
	 * service is called as the route calls it: the route forwards the (empty) option list its own handler
	 * parameters collected and the field collects none, which the service reads as one thing.
	 *
	 * @param id The term to withdraw.
	 * @returns The payload, carrying the withdrawn term.
	 */
	@Mutation('softDeleteVendorProductTerm')
	@Permissions(PurchasingPermissions.VENDOR_TERMS_EDIT)
	async softDeleteVendorProductTerm(@Args('id') id: ID) {
		try {
			return {
				vendorProductTerm: await this.vendorProductTermService.softRemove(id),
				vendorProductTerms: [],
				userErrors: []
			};
		} catch (error) {
			return { vendorProductTerm: null, vendorProductTerms: [], userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Puts a withdrawn term back.
	 *
	 * The other half of the same inherited pair, answered and permissioned as the withdrawal is: the
	 * route is `PUT /vendor-product-terms/:id/recover`, and its override states `VENDOR_TERMS_EDIT` for
	 * the same reason.
	 *
	 * @param id The term to restore.
	 * @returns The payload, carrying the restored term.
	 */
	@Mutation('recoverVendorProductTerm')
	@Permissions(PurchasingPermissions.VENDOR_TERMS_EDIT)
	async recoverVendorProductTerm(@Args('id') id: ID) {
		try {
			return {
				vendorProductTerm: await this.vendorProductTermService.softRecover(id),
				vendorProductTerms: [],
				userErrors: []
			};
		} catch (error) {
			return { vendorProductTerm: null, vendorProductTerms: [], userErrors: [toUserError(error)] };
		}
	}
}
