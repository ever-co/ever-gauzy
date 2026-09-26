import {
	BadRequestException,
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
import { EntitlementKey } from './entitlement-key.entity';
import { EntitlementKeyService } from './entitlement-key.service';
import { EntitlementFeatures } from '../entitlement.features';
import { EntitlementPermissions } from '../entitlement.permissions';
import { IEntitlementKeyReissueResult } from '../entitlement.types';
import { AssignEntitlementKeyDTO, ReissueEntitlementKeyDTO, RevokeEntitlementKeyDTO } from './dto';
import { CreateEntitlementKeyDTO } from './dto/entitlement-key.dto';

/**
 * Licence keys.
 *
 * The credential a customer types into the product. Reading one never returns the key or its digest —
 * a caller sees the prefix, the state and the holder — and the only route that returns key material
 * is the issuance that creates it, once. Re-issue is the recovery path for a lost key, and revoke
 * releases the activations the key was used for without touching the right behind it.
 */
@ApiTags('EntitlementKey')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(EntitlementFeatures.ENTITLEMENT)
@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
@Controller('/entitlement-keys')
export class EntitlementKeyController extends CrudController<EntitlementKey> {
	constructor(private readonly entitlementKeyService: EntitlementKeyService) {
		super(entitlementKeyService);
	}

	/**
	 * Issues a key.
	 *
	 * This is the same operation as `POST /entitlements/:id/keys`, reached the other way round: the
	 * right is named in the body here and in the path there, and both call the one method that mints a
	 * credential. The two therefore declare the same retry scope rather than two namespaces, because a
	 * retry of either is a retry of that one operation — and neither can be answered with the other's
	 * response, since the fingerprint of a request is its method, its path and its body, and the two
	 * paths differ.
	 *
	 * @param entity The right, the format and the holder.
	 * @returns The issued key, with its plaintext as an extra member, returned once and never again.
	 */
	@ApiOperation({ summary: 'Issue a licence key' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The key was issued.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The right cannot carry a key.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_GRANT)
	@Idempotent({ scope: 'entitlement_key.issue', required: false, resourceType: 'entitlement_key' })
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateEntitlementKeyDTO): Promise<EntitlementKey & { plaintextKey: string }> {
		if (!entity.entitlementId) {
			throw new BadRequestException('A licence key is issued against an entitlement, so `entitlementId` is required.');
		}

		const result = await this.entitlementKeyService.issue(entity as any);

		return { ...result.key, plaintextKey: result.plaintext };
	}

	/**
	 * Records who holds a key.
	 *
	 * @param id The key.
	 * @param entity The holder.
	 * @returns The updated key.
	 */
	@ApiOperation({ summary: 'Assign a licence key to its holder' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The holder was recorded.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: AssignEntitlementKeyDTO): Promise<EntitlementKey> {
		return await this.entitlementKeyService.assign(id, entity);
	}

	/**
	 * Withdraws a key, releasing the activations it was used for.
	 *
	 * @param id The key.
	 * @param entity Why.
	 * @returns The withdrawn key.
	 */
	@ApiOperation({ summary: 'Revoke a licence key' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The key was withdrawn.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Post(':id/revoke')
	@UseValidationPipe({ transform: true, whitelist: true })
	async revoke(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: RevokeEntitlementKeyDTO): Promise<EntitlementKey> {
		return await this.entitlementKeyService.revoke(id, entity.reason);
	}

	/**
	 * Replaces a key with a freshly generated one.
	 *
	 * @param id The key being replaced.
	 * @param entity The format of the replacement and why.
	 * @returns The new key, its plaintext — returned once — and the key it replaced.
	 */
	@ApiOperation({ summary: 'Re-issue a licence key' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The key was replaced.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Post(':id/reissue')
	@UseValidationPipe({ transform: true, whitelist: true })
	async reissue(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReissueEntitlementKeyDTO
	): Promise<IEntitlementKeyReissueResult> {
		return await this.entitlementKeyService.reissue(id, entity);
	}

	/**
	 * Re-displays a key to its holder.
	 *
	 * Only a key that was issued recoverable can be shown again; a write-only key is recovered by
	 * re-issuing it, which revokes the old one and leaves an audit trail.
	 *
	 * @param id The key.
	 * @returns The key in clear.
	 */
	@ApiOperation({ summary: 'Re-display a recoverable licence key' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The key was re-displayed.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The key was issued write-only.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_GRANT)
	@Post(':id/reveal')
	async reveal(@Param('id', UUIDValidationPipe) id: ID): Promise<{ key: string }> {
		return { key: await this.entitlementKeyService.reveal(id) };
	}

	/**
	 * Reads one key. The digest and the ciphertext are never part of the answer.
	 *
	 * @param id The key.
	 * @returns The key row.
	 */
	@ApiOperation({ summary: 'Find a licence key' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The key was found.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<EntitlementKey> {
		return await this.entitlementKeyService.findOneScoped(id);
	}

	/**
	 * Lists issued keys.
	 *
	 * @param options The filter, including `filter[entitlementId]` and `filter[status]`.
	 * @returns The keys, paginated.
	 */
	@ApiOperation({ summary: 'List licence keys' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The keys were listed.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
	@Get()
	async findAll(@Query() options: BaseQueryDTO<EntitlementKey>): Promise<IPagination<EntitlementKey>> {
		return await this.entitlementKeyService.findAll(options);
	}

	/**
	 * Deletes a licence key.
	 *
	 * The `DELETE ':id'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `ENTITLEMENTS_EDIT`, the
	 * grant the revoke and re-issue routes here already carry.
	 *
	 * @param id The key.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a licence key' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The key was deleted.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes a licence key, leaving the row in place.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `ENTITLEMENTS_EDIT`, as the
	 * delete and restore routes here do.
	 *
	 * @param id The key.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted key.
	 */
	@ApiOperation({ summary: 'Soft delete a licence key' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The key was soft deleted.' })
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
	 * Restores a licence key that was soft deleted.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `ENTITLEMENTS_EDIT`, as the
	 * delete and soft-delete routes here do.
	 *
	 * @param id The key.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored key.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted licence key' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The key was restored.' })
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		// As on the soft-delete route above: the array is what the base class hands over.
		return await super.softRecover(id, ...options);
	}
}
