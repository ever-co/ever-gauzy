import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IPagination, ShippingPriceType } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	IConnectionPageSelection,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	connectionFromOffsetPage,
	resolveConnectionWindow
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { ShippingOption } from '../shipping-option/shipping-option.entity';
import { IShippingEligibilityContext, ShippingOptionService } from '../shipping-option/shipping-option.service';
import { ShippingProfile } from '../shipping-profile/shipping-profile.entity';
import { ShippingProfileService } from '../shipping-profile/shipping-profile.service';
import { ShippingProfileVariant } from '../shipping-profile-variant/shipping-profile-variant.entity';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';
import { IShippingOptionConnection, IShippingOptionEligibility, IShippingProfileConnection, IShippingRate } from './types';

/**
 * The shipping configuration: profiles, their variant attachments, and the sellable options.
 *
 * Profiles and options share a resolver because they are one configuration: an option names the profile
 * it is offered for, and the pairing is what decides whether a cart of digital goods is offered a
 * courier at all.
 *
 * Creating a profile and creating an option carry the retry declarations their REST routes carry, under
 * the same scope names: a retried create over either protocol is answered with what the first attempt
 * wrote rather than with a refusal for a code that is already taken.
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
@Resolver(() => ShippingOption)
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_VIEW)
export class ShippingOptionResolver {
	constructor(
		private readonly optionService: ShippingOptionService,
		private readonly profileService: ShippingProfileService
	) {}

	/**
	 * Lists shipping profiles.
	 *
	 * @param page The page.
	 * @param withDeleted Whether retired rows are included.
	 * @returns A page of profiles.
	 */
	@Query(() => Object, { name: 'shippingProfiles' })
	async shippingProfiles(
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<IShippingProfileConnection> {
		const { skip, take } = resolveConnectionWindow(page);
		const listing = (await this.profileService.findAll({
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		})) as IPagination<ShippingProfile>;

		return connectionFromOffsetPage(listing, skip);
	}

	/**
	 * Reads one shipping profile.
	 *
	 * @param id The profile.
	 * @returns The profile with its variants.
	 */
	@Query(() => Object, { name: 'shippingProfile', nullable: true })
	async shippingProfile(@Args('id', { type: () => ID }) id: string): Promise<ShippingProfile> {
		return this.profileService.findOneByIdString(id, { relations: ['variants'] });
	}

	/**
	 * The profile a variant ships under.
	 *
	 * @param variantId The variant.
	 * @returns The profile, or null when the organization has neither an attachment nor a default.
	 */
	@Query(() => Object, { name: 'shippingProfileForVariant', nullable: true })
	async shippingProfileForVariant(
		@Args('variantId', { type: () => ID }) variantId: string
	): Promise<ShippingProfile> {
		return this.profileService.resolveForVariant(variantId);
	}

	/**
	 * Lists shipping options.
	 *
	 * @param page The page.
	 * @param withDeleted Whether retired rows are included.
	 * @returns A page of options.
	 */
	@Query(() => Object, { name: 'shippingOptions' })
	async shippingOptions(
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<IShippingOptionConnection> {
		const { skip, take } = resolveConnectionWindow(page);
		const listing = (await this.optionService.findAll({
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		})) as IPagination<ShippingOption>;

		return connectionFromOffsetPage(listing, skip);
	}

	/**
	 * Reads one shipping option.
	 *
	 * @param id The option.
	 * @returns The option.
	 */
	@Query(() => Object, { name: 'shippingOption', nullable: true })
	async shippingOption(@Args('id', { type: () => ID }) id: string): Promise<ShippingOption> {
		return this.optionService.findOneByIdString(id);
	}

	/**
	 * The options a cart may choose between.
	 *
	 * @param input What the cart looks like.
	 * @returns The options, each with its reason when it is not available.
	 */
	@Query(() => [Object], { name: 'shippingOptionsForContext' })
	async shippingOptionsForContext(
		@Args('input', { type: () => Object, nullable: true }) input?: IShippingEligibilityContext
	): Promise<IShippingOptionEligibility[]> {
		return this.optionService.findEligible(input ?? {});
	}

	/**
	 * Prices one option for a cart.
	 *
	 * @param shippingOptionId The option.
	 * @param input What the cart looks like.
	 * @returns The amount, or the strategy that must be asked for it.
	 */
	@Query(() => Object, { name: 'shippingRate', nullable: true })
	async shippingRate(
		@Args('shippingOptionId', { type: () => ID }) shippingOptionId: string,
		@Args('input', { type: () => Object, nullable: true }) input?: IShippingEligibilityContext
	): Promise<IShippingRate> {
		return this.optionService.calculate(shippingOptionId, input ?? {});
	}

	/**
	 * Creates a shipping profile.
	 *
	 * @param input The profile to create.
	 * @returns The created profile.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_CREATE)
	@Idempotent({ scope: 'shipping_profile.create', required: false, resourceType: 'shipping_profile' })
	@Mutation(() => Object, { name: 'createShippingProfile' })
	async createShippingProfile(
		@Args('input', { type: () => Object }) input: Record<string, any>
	): Promise<ShippingProfile> {
		return this.profileService.create(input as any);
	}

	/**
	 * Updates a shipping profile.
	 *
	 * @param id The profile.
	 * @param input The fields to change.
	 * @returns The profile.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_EDIT)
	@Mutation(() => Object, { name: 'updateShippingProfile' })
	async updateShippingProfile(
		@Args('id', { type: () => ID }) id: string,
		@Args('input', { type: () => Object }) input: Record<string, any>
	): Promise<ShippingProfile> {
		await this.profileService.update(id, input as any);

		return this.profileService.findOneByIdString(id);
	}

	/**
	 * Deletes a shipping profile.
	 *
	 * @param id The profile.
	 * @returns True when the profile was removed.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_DELETE)
	@Mutation(() => Boolean, { name: 'deleteShippingProfile' })
	async deleteShippingProfile(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
		const result = await this.profileService.delete(id);

		return Boolean(result);
	}

	/**
	 * Retires a shipping profile recoverably, keeping the group and the variants placed in it.
	 *
	 * The route it mirrors is `DELETE /shipping-profiles/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. Without this field
	 * a profile a caller retired over GraphQL could not be brought back over GraphQL, while a REST caller
	 * could do both — and every variant attached to it would have lost the group it ships under for good.
	 *
	 * The permission is the controller's own for the route — `SHIPPING_OPTIONS_DELETE` — and not the
	 * class-level view grant, because retiring a profile takes the option a storefront chooses between out
	 * of service.
	 *
	 * @param id The profile to retire.
	 * @returns The profile, as the soft delete left it.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_DELETE)
	@Mutation(() => Object, { name: 'softDeleteShippingProfile' })
	async softDeleteShippingProfile(@Args('id', { type: () => ID }) id: string): Promise<ShippingProfile> {
		return this.profileService.softRemove(id);
	}

	/**
	 * Restores a shipping profile that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /shipping-profiles/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored profile
	 * is offered for its variants again, which is why the route states the deleting grant rather than the
	 * reading one.
	 *
	 * @param id The profile to restore.
	 * @returns The restored profile.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_DELETE)
	@Mutation(() => Object, { name: 'recoverShippingProfile' })
	async recoverShippingProfile(@Args('id', { type: () => ID }) id: string): Promise<ShippingProfile> {
		return this.profileService.softRecover(id);
	}

	/**
	 * Attaches and detaches variants.
	 *
	 * @param input The profile and the variants to add and remove.
	 * @returns The attachments that exist after the change.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_EDIT)
	@Mutation(() => [Object], { name: 'assignShippingProfileVariant' })
	async assignShippingProfileVariant(
		@Args('input', { type: () => Object }) input: Record<string, any>
	): Promise<ShippingProfileVariant[]> {
		return this.profileService.assignVariants(input.profileId, {
			add: input.add,
			remove: input.remove
		});
	}

	/**
	 * Creates a shipping option.
	 *
	 * @param input The option to create.
	 * @returns The created option.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_CREATE)
	@Idempotent({ scope: 'shipping_option.create', required: false, resourceType: 'shipping_option' })
	@Mutation(() => Object, { name: 'createShippingOption' })
	async createShippingOption(
		@Args('input', { type: () => Object }) input: Record<string, any>
	): Promise<ShippingOption> {
		return this.optionService.create({
			...(input as any),
			priceType: (input.priceType as ShippingPriceType) ?? ShippingPriceType.FLAT
		});
	}

	/**
	 * Updates a shipping option.
	 *
	 * @param id The option.
	 * @param input The fields to change.
	 * @returns The option.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_EDIT)
	@Mutation(() => Object, { name: 'updateShippingOption' })
	async updateShippingOption(
		@Args('id', { type: () => ID }) id: string,
		@Args('input', { type: () => Object }) input: Record<string, any>
	): Promise<ShippingOption> {
		await this.optionService.update(id, input as any);

		return this.optionService.findOneByIdString(id);
	}

	/**
	 * Deletes a shipping option.
	 *
	 * @param id The option.
	 * @returns True when the option was removed.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_DELETE)
	@Mutation(() => Boolean, { name: 'deleteShippingOption' })
	async deleteShippingOption(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
		const result = await this.optionService.delete(id);

		return Boolean(result);
	}

	/**
	 * Retires a shipping option recoverably, keeping the price a cart was quoted.
	 *
	 * The route it mirrors is `DELETE /shipping-options/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. Without this field
	 * an option a caller retired over GraphQL could not be brought back over GraphQL, while a REST caller
	 * could do both — and a rate a cart already carries would name a row nothing could restore.
	 *
	 * The permission is the controller's own for the route — `SHIPPING_OPTIONS_DELETE` — and not the
	 * class-level view grant, because retiring an option stops it being offered to any cart.
	 *
	 * @param id The option to retire.
	 * @returns The option, as the soft delete left it.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_DELETE)
	@Mutation(() => Object, { name: 'softDeleteShippingOption' })
	async softDeleteShippingOption(@Args('id', { type: () => ID }) id: string): Promise<ShippingOption> {
		return this.optionService.softRemove(id);
	}

	/**
	 * Restores a shipping option that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /shipping-options/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored option
	 * is a candidate for the carts it matched again, which is why the route states the deleting grant
	 * rather than the reading one.
	 *
	 * @param id The option to restore.
	 * @returns The restored option.
	 */
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_DELETE)
	@Mutation(() => Object, { name: 'recoverShippingOption' })
	async recoverShippingOption(@Args('id', { type: () => ID }) id: string): Promise<ShippingOption> {
		return this.optionService.softRecover(id);
	}
}
