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
