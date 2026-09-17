import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import {
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { EntitlementActivation } from './entitlement-activation.entity';
import { Entitlement } from '../entitlement/entitlement.entity';
import { EntitlementActivationService } from './entitlement-activation.service';
import { EntitlementFeatures } from '../entitlement.features';
import { EntitlementPermissions } from '../entitlement.permissions';
import { CreateEntitlementActivationDTO } from './dto';
import {
	ReleaseEntitlementActivationDTO,
	RevokeEntitlementActivationDTO
} from './dto/entitlement-activation-action.dto';

/**
 * Activations.
 *
 * Creating an activation is the one write here that is not an operator's decision: it is what a
 * customer's device does when it launches, which is why it is a `POST` that answers with the slot it
 * took rather than a state a body may set. Releasing and revoking are the two ways a slot is given
 * back, and they are separate permissions-guarded routes because they are separate facts: one is the
 * holder's decision and the other is ours.
 */
@ApiTags('EntitlementActivation')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(EntitlementFeatures.ENTITLEMENT)
@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
@Controller('/entitlement-activations')
export class EntitlementActivationController extends CrudController<EntitlementActivation> {
	constructor(private readonly entitlementActivationService: EntitlementActivationService) {
		super(entitlementActivationService);
	}

	/**
	 * Occupies a slot of a right.
	 *
	 * The route is idempotent: a device that already holds a slot gets the row it holds, refreshed,
	 * rather than a second one. It is refused with a stable code when the right is withdrawn, past its
	 * term, above its activation ceiling or out of seats.
	 *
	 * @param entity The right, the device and the key when one is used.
	 * @returns The activation, with the right it belongs to and what is left of it as extra members.
	 */
	@ApiOperation({ summary: 'Activate an entitlement for a device or a named seat' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The slot was taken.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The entitlement refuses the activation.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_GRANT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(
		@Body() entity: CreateEntitlementActivationDTO
	): Promise<EntitlementActivation & { entitlement: Entitlement; created: boolean; remainingQuantity: number | null }> {
		const result = await this.entitlementActivationService.activate(entity as any);

		return {
			...result.activation,
			entitlement: result.entitlement,
			created: result.created,
			remainingQuantity: result.remainingQuantity
		};
	}

	/**
	 * Gives a slot back, because the holder chose to.
	 *
	 * @param id The activation.
	 * @param entity An optional note.
	 * @returns The released activation.
	 */
	@ApiOperation({ summary: 'Release an activation' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The slot was given back.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Post(':id/release')
	@UseValidationPipe({ transform: true, whitelist: true })
	async release(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReleaseEntitlementActivationDTO
	): Promise<EntitlementActivation> {
		return await this.entitlementActivationService.release(id, entity.reason);
	}

	/**
	 * Takes a slot away, because support or a policy decided to.
	 *
	 * @param id The activation.
	 * @param entity Why.
	 * @returns The revoked activation.
	 */
	@ApiOperation({ summary: 'Revoke an activation' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The slot was taken away.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Post(':id/revoke')
	@UseValidationPipe({ transform: true, whitelist: true })
	async revoke(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: RevokeEntitlementActivationDTO
	): Promise<EntitlementActivation> {
		return await this.entitlementActivationService.revoke(id, entity.reason);
	}

	/**
	 * Reads one activation.
	 *
	 * @param id The activation.
	 * @returns The activation.
	 */
	@ApiOperation({ summary: 'Find an activation' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The activation was found.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<EntitlementActivation> {
		return await this.entitlementActivationService.findOneScoped(id);
	}

	/**
	 * Lists activations.
	 *
	 * @param options The filter, including `filter[entitlementId]` and `filter[status]`.
	 * @returns The activations, paginated.
	 */
	@ApiOperation({ summary: 'List activations' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The activations were listed.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
	@Get()
	async findAll(@Query() options: BaseQueryDTO<EntitlementActivation>): Promise<IPagination<EntitlementActivation>> {
		return await this.entitlementActivationService.findAll(options);
	}
}
