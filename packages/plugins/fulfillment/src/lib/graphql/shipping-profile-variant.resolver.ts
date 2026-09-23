import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { ShippingProfileVariant } from '../shipping-profile-variant/shipping-profile-variant.entity';
import { ShippingProfileVariantService } from '../shipping-profile-variant/shipping-profile-variant.service';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';

/**
 * The variant attachments: which variants ship under which profile.
 *
 * **This resolver exists for one capability and no other.** `ShippingProfileVariantController` extends
 * `CrudController<ShippingProfileVariant>`, so it serves `DELETE /:id/soft` and `PUT /:id/recover` with
 * `SHIPPING_OPTIONS_DELETE` stated on both — and §3.1 requires one mutation per REST write route. Every
 * other field of this resource is already reachable: its type is declared in the document, its variants
 * are read through `ShippingProfile.variants`, and attaching and detaching them is
 * `assignShippingProfileVariant` on `ShippingOptionResolver`. What had no counterpart was the lifecycle
 * pair, and the alternative to a resolver of its own was to make that pair reach a third service the
 * shipping resolver does not inject — which is a wider change to a class every controller spec of this
 * package constructs by hand than a new class is. The resource is a pivot, not a document: the pair is
 * all it has to say for itself.
 *
 * **The claim above is contested, and the contest is recorded here rather than left for a reader to
 * find.** `PUT /shipping-profile-variants/:id` is a write route of this resource with no field, and
 * whether it *needs* one is the one row of this domain's parity reading that could not be settled by
 * reading the code — so it was refused rather than delivered, and both readings are stated. It is
 * **bucket 1, a genuine gap**, because the set field reaches `pivotService.create` and
 * `pivotService.delete` and never `pivotService.update`: a move is expressible only as a delete followed
 * by a create, so the row's identifier changes under the caller and its `metadata` member is unwritable
 * over this surface by any route. It is **bucket 3, a child-through-parent set field**, because
 * `05-database-schema-specification.md` §13.2 declares this table's columns as exactly `profileId` and
 * `variantId` and gives it no `metadata` column at all — so the delivered `metadata` member is
 * code-beyond-spec and the only thing a pivot row can be asked to say is which pair it joins, which
 * `assignShippingProfileVariant` already says. An owner ruling the other way gets
 * `updateShippingProfileVariant(id: ID!, input: UpdateShippingProfileVariantInput!):
 * ShippingProfileVariant!`, reaching `ShippingProfileVariantService.update` under `SHIPPING_OPTIONS_EDIT`
 * with the same DTO the route validates, and declaring no retry scope because the route declares none.
 * The delivered entity concedes the divergence in its own comment: the `metadata` column is "Open-ended
 * payload, retained because a pivot row is the place where a per-attachment exception lives" — retained,
 * that is, by the entity and not by the table the specification declares.
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the guard chain and the code it reads
 * is `FEATURE_GRAPHQL` — the commerce catalogue's entry for "the GraphQL endpoint and its resolvers, under
 * the same guards and permissions as REST" — imported rather than restated, because a literal that drifted
 * names a code no catalogue row carries, which the guard resolves as disabled, so every field here would
 * answer `Cannot query field <name>` for every caller with nothing red anywhere.
 */
@Resolver(() => ShippingProfileVariant)
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_VIEW)
export class ShippingProfileVariantResolver {
	constructor(private readonly profileVariantService: ShippingProfileVariantService) {}

	/**
	 * Retires a variant attachment recoverably, keeping the variant in the group it was placed in.
	 *
	 * The route it mirrors is `DELETE /shipping-profile-variants/:id/soft`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base left unstated. Detaching a
	 * variant through `assignShippingProfileVariant` answers what exists afterwards and says nothing about
	 * the row it removed, so without this field a caller could withdraw an attachment over GraphQL and
	 * never read back what it withdrew.
	 *
	 * The permission is the controller's own for the route — `SHIPPING_OPTIONS_DELETE` — and not the
	 * class-level view grant, because withdrawing an attachment changes how the variant ships.
	 *
	 * @param id The attachment to retire.
	 * @returns The attachment, as the soft delete left it.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_DELETE)
	@Mutation(() => Object, { name: 'softDeleteShippingProfileVariant' })
	async softDeleteShippingProfileVariant(@Args('id', { type: () => ID }) id: string): Promise<ShippingProfileVariant> {
		return this.profileVariantService.softRemove(id);
	}

	/**
	 * Restores a variant attachment that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /shipping-profile-variants/:id/recover`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base left unstated. A restored
	 * attachment is what makes the variant ship under the profile it names again, which is why the route
	 * states the deleting grant rather than the reading one.
	 *
	 * @param id The attachment to restore.
	 * @returns The restored attachment.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_DELETE)
	@Mutation(() => Object, { name: 'recoverShippingProfileVariant' })
	async recoverShippingProfileVariant(@Args('id', { type: () => ID }) id: string): Promise<ShippingProfileVariant> {
		return this.profileVariantService.softRecover(id);
	}
}
