import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID, IPagination } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { Entitlement } from '../../entitlement/entitlement.entity';
import { EntitlementService } from '../../entitlement/entitlement.service';
import { EntitlementActivation } from '../../entitlement-activation/entitlement-activation.entity';
import { EntitlementActivationService } from '../../entitlement-activation/entitlement-activation.service';
import { EntitlementActivationStatus } from '../../entitlement.enums';
import { EntitlementPermissions } from '../../entitlement.permissions';
import { IEntitlementActivationInput } from '../../entitlement.types';
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
 */
@Resolver('EntitlementActivation')
@UseGuards(TenantPermissionGuard, PermissionGuard)
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
	 * @returns One page of activations.
	 */
	@Query('entitlementActivations')
	async entitlementActivations(
		@Args('filter') filter?: IEntitlementActivationFilter,
		@Args('page') page?: IPageSelection
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
			order: { activatedAt: 'DESC' }
		} as any);

		return buildConnection(result as IPagination<EntitlementActivation>, skip);
	}

	/**
	 * Occupies a slot of a right.
	 *
	 * @param input The right, the device and the key when one is used.
	 * @returns The payload, carrying the activation and the right it belongs to.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_GRANT)
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
}
