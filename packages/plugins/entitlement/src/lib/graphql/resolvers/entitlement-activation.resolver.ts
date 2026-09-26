import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID, IPagination } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	Versioned
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { EntitlementFeatures } from '../../entitlement.features';
import { EntitlementService } from '../../entitlement/entitlement.service';
import { EntitlementActivation } from '../../entitlement-activation/entitlement-activation.entity';
import { EntitlementActivationService } from '../../entitlement-activation/entitlement-activation.service';
import { EntitlementActivationStatus } from '../../entitlement.enums';
import { EntitlementPermissions } from '../../entitlement.permissions';
import { IEntitlementActivationEditInput, IEntitlementActivationInput } from '../../entitlement.types';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { toUserError } from '../wire';

/** The filter the activations connection accepts. */
interface IEntitlementActivationFilter {
	entitlementId?: ID;
	status?: EntitlementActivationStatus;
	deviceId?: string;
	activatedByCustomerId?: ID;
}

/**
 * The activations of a right, over GraphQL.
 *
 * Creating an activation is the customer's device taking a slot and is guarded by the grant
 * permission; releasing or revoking one is an operator's decision and is guarded by the edit
 * permission. Both call the same service the REST controller calls, so the seat arithmetic is one
 * implementation.
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
 * **The plugin's own gate stands beside it.** The class also declares `EntitlementFeatures.ENTITLEMENT`
 * (`FEATURE_ENTITLEMENT`), the code every entitlement REST controller declares with `@FeatureFlag`, so a
 * tenant that switched entitlement off is refused here exactly as its routes refuse it — rather than finding
 * every write the routes withhold still served over GraphQL. The two codes are two questions, both of which
 * must be answered yes: the endpoint is on, and the capability is on. The platform's decorator accumulates
 * the codes stated on one target and `FeatureFlagGuard` requires every one of them.
 */
@Resolver('EntitlementActivation')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(EntitlementFeatures.ENTITLEMENT)
@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
export class EntitlementActivationResolver {
	constructor(
		private readonly entitlementActivationService: EntitlementActivationService,
		private readonly entitlementService: EntitlementService
	) {}

	/**
	 * Lists activations.
	 *
	 * @param filter The activation filter.
	 * @param page The page.
	 * @param withDeleted Whether retired rows are included.
	 * @returns One page of activations.
	 */
	@Versioned({ resource: EntitlementService, write: false })
	@Query('entitlementActivations')
	async entitlementActivations(
		@Args('filter') filter?: IEntitlementActivationFilter,
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const { skip, take } = resolvePageWindow(page);
		const result = await this.entitlementActivationService.findAll({
			where: {
				...(filter?.entitlementId ? { entitlementId: filter.entitlementId } : {}),
				...(filter?.status ? { status: filter.status } : {}),
				...(filter?.deviceId ? { deviceId: filter.deviceId } : {}),
				...(filter?.activatedByCustomerId ? { activatedByCustomerId: filter.activatedByCustomerId } : {})
			},
			skip,
			take,
			order: { activatedAt: 'DESC' },
			...(withDeleted ? { withDeleted: true } : {})
		} as any);

		return buildConnection(result as IPagination<EntitlementActivation>, skip);
	}

	/**
	 * Occupies a slot of a right.
	 *
	 * The retry scope is `entitlement.activate`, which the activation route declares as well: taking a
	 * seat is the one activate this plugin serves, and a device that repeats the mutation under one key
	 * is answered from the first attempt rather than taking a second slot.
	 *
	 * @param input The right, the device and the key when one is used.
	 * @returns The payload, carrying the activation and the right it belongs to.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_GRANT)
	@Idempotent({ scope: 'entitlement.activate', required: false, resourceType: 'entitlement_activation' })
	@Mutation('activateEntitlement')
	async activateEntitlement(@Args('input') input: IEntitlementActivationInput) {
		try {
			const result = await this.entitlementActivationService.activate(input);

			return { activation: result.activation, entitlement: result.entitlement, created: result.created, userErrors: [] };
		} catch (error) {
			return { activation: null, entitlement: null, created: false, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Gives a slot back: released by the holder, or revoked by support.
	 *
	 * @param id The activation.
	 * @param reason Why.
	 * @param revoked True when the release was imposed rather than chosen.
	 * @returns The payload.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Mutation('deactivateEntitlement')
	async deactivateEntitlement(
		@Args('id') id: ID,
		@Args('reason') reason?: string,
		@Args('revoked') revoked?: boolean
	) {
		try {
			const activation = revoked
				? await this.entitlementActivationService.revoke(id, reason ?? 'REVOKED')
				: await this.entitlementActivationService.release(id, reason);

			return {
				activation,
				entitlement: await this.entitlementService.findOneScoped(activation.entitlementId),
				userErrors: []
			};
		} catch (error) {
			return { activation: null, entitlement: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Corrects the recorded fields of a slot, without giving it back and without taking it away.
	 *
	 * The route it mirrors is `PUT /entitlement-activations/:id`, which this plugin's controller
	 * declares rather than inherits so that the body is validated at all: the base class names the
	 * entity's shape as a generic, whose reflected type is `Object`, which the validation pipe cannot
	 * name a class for and therefore skips.
	 *
	 * The write reaches the service's **inherited** `update`, and the field makes that same call with
	 * the same input — `entitlementActivationService.update(id, input)` — because the seam parity is
	 * about is the delegation, not a body this package owns. The service's `update` answers an
	 * `UpdateResult` rather than a row on both ORMs, so the field then reads the slot back and answers
	 * it in the payload this resource's mutations declare; the route hands the raw result to its caller,
	 * which is a difference of the answer and not of the write.
	 *
	 * **The correction path moves nothing the slot's lifecycle owns, on either surface.** The route's body
	 * and this input used to carry `status`, `entitlementId`, `entitlementKeyId`, `deviceId` and
	 * `revocationReason`, and the inherited `update` wrote every member it was handed: a caller holding
	 * `ENTITLEMENTS_EDIT` set a `REVOKED` slot back to `ACTIVE` beside the one that replaced it — two live
	 * activations against a limit of one, because the limit is only counted when a slot is taken — or
	 * repointed a slot at another right without that right's limit being counted, or rewrote the reason
	 * that bars a device withdrawn for abuse from coming back. Those five members are gone from
	 * `UpdateEntitlementActivationInput` and from `UpdateEntitlementActivationDTO` alike, so the two
	 * surfaces still accept the same write, and `EntitlementActivationService.update` refuses them
	 * whichever way they arrive. A slot's state moves through release and revoke (`deactivateEntitlement`),
	 * and a slot is taken through activate.
	 *
	 * No permission is left to the class and neither write convention is invented: the route declares
	 * `ENTITLEMENTS_EDIT` and no `@Idempotent` and no `@Versioned`, and so does this field.
	 *
	 * @param id The activation.
	 * @param input The recorded fields to change.
	 * @returns The payload, carrying the activation as the correction left it.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Mutation('updateEntitlementActivation')
	async updateEntitlementActivation(@Args('id') id: ID, @Args('input') input: IEntitlementActivationEditInput) {
		try {
			await this.entitlementActivationService.update(id, input as any);

			return { activation: await this.entitlementActivationService.findOneScoped(id), userErrors: [] };
		} catch (error) {
			return { activation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires an activation recoverably, leaving the row and the seat's history in place.
	 *
	 * The route it mirrors is `DELETE /entitlement-activations/:id/soft`, inherited from `CrudController`
	 * and overridden by this plugin's controller only to state the permission the base left unstated.
	 * Without this field a slot taken over GraphQL could be given back only by releasing or revoking it —
	 * both of which move the activation's own status — while a REST caller could retire one and bring it
	 * back unchanged.
	 *
	 * The permission is the route's own, `ENTITLEMENTS_EDIT`, because retiring a slot is the same
	 * operator decision the release and revoke routes already carry, and not the grant permission the
	 * activation route carries: a device taking its own seat must not be able to retire another's.
	 *
	 * The answer is the payload this field's own act declares, `EntitlementActivationPayload`: the
	 * deactivation payload of the sibling route states an act the caller did not perform, and the key
	 * resource's payload — one row and the refusal channel — is the shape this resource was missing.
	 *
	 * @param id The activation.
	 * @returns The payload, carrying the activation as the soft delete left it.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Mutation('softDeleteEntitlementActivation')
	async softDeleteEntitlementActivation(@Args('id') id: ID) {
		try {
			return { activation: await this.entitlementActivationService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { activation: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores an activation that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /entitlement-activations/:id/recover`. A restored slot counts against
	 * its right's activation limit again, which is why the route states the destructive grant rather than
	 * the granting one — and why this field states `ENTITLEMENTS_EDIT` too.
	 *
	 * @param id The activation.
	 * @returns The payload, carrying the restored activation.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Mutation('recoverEntitlementActivation')
	async recoverEntitlementActivation(@Args('id') id: ID) {
		try {
			return { activation: await this.entitlementActivationService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { activation: null, userErrors: [toUserError(error)] };
		}
	}
}
