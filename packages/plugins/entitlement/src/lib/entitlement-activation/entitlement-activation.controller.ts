import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import {
	AbstractValidationPipe,
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { EntitlementActivation } from './entitlement-activation.entity';
import { Entitlement } from '../entitlement/entitlement.entity';
import { EntitlementActivationService } from './entitlement-activation.service';
import { EntitlementFeatures } from '../entitlement.features';
import { EntitlementPermissions } from '../entitlement.permissions';
import { CreateEntitlementActivationDTO, UpdateEntitlementActivationDTO } from './dto';
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
	 * The retry scope is `entitlement.activate` — the slot operation this plugin serves on a route. The
	 * only other activation the domain performs is the event-driven `EntitlementService.activateGranted`,
	 * which puts a purchased right into force and has no route of its own, so this scope names taking a
	 * seat and nothing else. A key is not required; a client that presents one and repeats the call is
	 * answered from the first attempt rather than taking a second slot.
	 *
	 * @param entity The right, the device and the key when one is used.
	 * @returns The activation, with the right it belongs to and what is left of it as extra members.
	 */
	@ApiOperation({ summary: 'Activate an entitlement for a device or a named seat' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The slot was taken.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The entitlement refuses the activation.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_GRANT)
	@HttpCode(HttpStatus.CREATED)
	@Idempotent({ scope: 'entitlement.activate', required: false, resourceType: 'entitlement_activation' })
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
	 * Corrects the recorded fields of a slot, without giving it back and without taking it away.
	 *
	 * The route is declared here rather than inherited: a body is validated from the type the handler
	 * names, and the base class names the entity's shape as a generic, whose reflected type is
	 * `Object` — a parameter the validation pipe cannot name a class for is skipped, so an inherited
	 * route accepts any body at all and writes it. Occupying a slot, releasing it and revoking it stay
	 * the three routes above and below, each with the checks the right's ceiling and term require; this
	 * is the repair surface for a row's own fields, and it carries the grant that already covers
	 * releasing and revoking rather than the granting one.
	 *
	 * @param id The activation to change.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update an activation' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The activation was updated.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'The activation was not found.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateEntitlementActivationDTO
	) {
		return await this.entitlementActivationService.update(id, entity as any);
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

	/**
	 * Deletes an activation.
	 *
	 * The `DELETE ':id'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `ENTITLEMENTS_EDIT`, the
	 * grant the release and revoke routes here already carry.
	 *
	 * @param id The activation.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete an activation' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The activation was deleted.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes an activation, leaving the row in place.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `ENTITLEMENTS_EDIT`, as the
	 * delete and restore routes here do.
	 *
	 * @param id The activation.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted activation.
	 */
	@ApiOperation({ summary: 'Soft delete an activation' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The activation was soft deleted.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		// The inherited route forwards its rest parameter as one argument, an ARRAY the service itself
		// normalises away (`toFindOneOptions`, crud.service.ts) — never find options. Cast to keep that
		// call byte-for-byte the base class's.
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores an activation that was soft deleted.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `ENTITLEMENTS_EDIT`, as the
	 * delete and soft-delete routes here do.
	 *
	 * @param id The activation.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored activation.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted activation' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The activation was restored.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		// As on the soft-delete route above: the array is what the base class hands over.
		return await super.softRecover(id, ...options);
	}
}
