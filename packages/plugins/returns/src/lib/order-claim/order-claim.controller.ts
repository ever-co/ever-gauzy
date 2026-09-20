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
import {
	AbstractValidationPipe,
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { IRefundResult } from '../returns.types';
import { ReturnsFeatures } from '../returns.features';
import { ReturnsPermissions } from '../returns.permissions';
import {
	ApproveOrderClaimDTO,
	CreateOrderClaimCreateDTO,
	EditOrderClaimDTO,
	ReasonedOrderClaimActionDTO
} from './dto';
import { OrderClaim } from './order-claim.entity';
import { OrderClaimService } from './order-claim.service';

/**
 * Claims.
 *
 * The routes mirror the resolution rather than the record: a claim is raised, then approved (which
 * settles it in money or hands it to a replacement), rejected or cancelled. Approval answers with the
 * refund when one was issued, because that is the fact the caller needs and it is not recoverable
 * from the claim alone.
 */
@ApiTags('OrderClaim')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(ReturnsFeatures.RETURNS)
@Permissions(ReturnsPermissions.CLAIMS_VIEW)
@Controller('/order-claims')
export class OrderClaimController extends CrudController<OrderClaim> {
	constructor(private readonly orderClaimService: OrderClaimService) {
		super(orderClaimService);
	}

	/**
	 * Creates a claim against an order.
	 *
	 * @param entity The claim.
	 * @returns The created claim.
	 */
	@ApiOperation({ summary: 'Create a claim (refund or replace)' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The claim was created.' })
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderClaimCreateDTO): Promise<OrderClaim> {
		return await this.orderClaimService.create(entity as any);
	}

	/**
	 * Updates a claim that has not been decided yet.
	 *
	 * @param id The claim to update.
	 * @param entity The fields to change.
	 * @returns The updated claim.
	 */
	@ApiOperation({ summary: 'Update an open claim' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The claim was updated.' })
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: EditOrderClaimDTO): Promise<OrderClaim> {
		const { lines, ...changes } = entity;

		if (changes.reason !== undefined || changes.note !== undefined) {
			await this.orderClaimService.update(id, changes as any);
		}

		if (lines?.length) {
			await this.orderClaimService.replaceLines(id, lines as any);
		}

		return await this.orderClaimService.findOneDetailed(id);
	}

	/**
	 * Approves and settles a claim.
	 *
	 * @param id The claim to approve.
	 * @param entity The refund amount and note.
	 * @returns The claim and the refund, when one was issued.
	 */
	@ApiOperation({ summary: 'Approve and settle a claim' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The claim was settled.' })
	@Permissions(ReturnsPermissions.CLAIMS_RESOLVE)
	@Post(':id/approve')
	@UseValidationPipe({ transform: true, whitelist: true })
	async approve(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ApproveOrderClaimDTO
	): Promise<{ claim: OrderClaim; refund?: IRefundResult }> {
		return await this.orderClaimService.approve(id, entity.refundAmount, entity.note);
	}

	/**
	 * Rejects a claim.
	 *
	 * @param id The claim to reject.
	 * @param entity Why it was rejected.
	 * @returns The rejected claim.
	 */
	@ApiOperation({ summary: 'Reject a claim' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The claim was rejected.' })
	@Permissions(ReturnsPermissions.CLAIMS_RESOLVE)
	@Post(':id/reject')
	@UseValidationPipe({ transform: true, whitelist: true })
	async reject(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReasonedOrderClaimActionDTO
	): Promise<OrderClaim> {
		return await this.orderClaimService.reject(id, entity.reason);
	}

	/**
	 * Cancels a claim.
	 *
	 * @param id The claim to cancel.
	 * @param entity Why it was cancelled.
	 * @returns The cancelled claim.
	 */
	@ApiOperation({ summary: 'Cancel a claim' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The claim was cancelled.' })
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	@Post(':id/cancel')
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancel(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReasonedOrderClaimActionDTO
	): Promise<OrderClaim> {
		return await this.orderClaimService.cancel(id, entity.reason);
	}

	/**
	 * Closes an approved replacement claim whose shipment has gone out.
	 *
	 * @param id The claim to close.
	 * @param entity An optional note.
	 * @returns The closed claim.
	 */
	@ApiOperation({ summary: 'Close an approved claim' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The claim was closed.' })
	@Permissions(ReturnsPermissions.CLAIMS_RESOLVE)
	@Post(':id/close')
	@UseValidationPipe({ transform: true, whitelist: true })
	async close(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReasonedOrderClaimActionDTO
	): Promise<OrderClaim> {
		return await this.orderClaimService.close(id, entity.note);
	}

	/**
	 * Reads a claim with its lines and its linked return.
	 *
	 * @param id The claim to read.
	 * @returns The claim.
	 */
	@ApiOperation({ summary: 'Find a claim with its lines' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The claim was found.' })
	@Permissions(ReturnsPermissions.CLAIMS_VIEW)
	// The route the CRUD base maps for this method. An override replaces the inherited
	// method *and* its decorators, so the overriding controller restates it.
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<OrderClaim> {
		return await this.orderClaimService.findOneDetailed(id);
	}

	/**
	 * Lists claims.
	 *
	 * @param options The filter, including `filter[status]`, `filter[type]` and `filter[orderId]`.
	 * @returns The claims, paginated.
	 */
	@ApiOperation({ summary: 'List claims' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The claims were listed.' })
	@Permissions(ReturnsPermissions.CLAIMS_VIEW)
	// The route the CRUD base maps for this method. An override replaces the inherited
	// method *and* its decorators, so the overriding controller restates it.
	@Get()
	async findAll(@Query() options: BaseQueryDTO<OrderClaim>): Promise<IPagination<OrderClaim>> {
		return await this.orderClaimService.findAll(options);
	}

	/**
	 * Deletes a claim.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `DELETE :id` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. The plugin declares no `CLAIMS_DELETE`, so this states
	 * `CLAIMS_CREATE`, the grant that already lets a caller write a claim.
	 *
	 * @param id The claim to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a claim' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The claim was deleted.' })
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft-deletes a claim.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `DELETE :id/soft` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. Soft removal is the same destructive write staged for recovery,
	 * so it states `CLAIMS_CREATE` as well.
	 *
	 * @param id The claim to soft delete.
	 * @returns The soft-deleted claim.
	 */
	@ApiOperation({ summary: 'Soft delete a claim' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The claim was soft deleted.' })
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted claim.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `PUT :id/recover` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. Restoring is the same destructive grant exercised backwards, so
	 * it states `CLAIMS_CREATE` as well.
	 *
	 * @param id The claim to restore.
	 * @returns The restored claim.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted claim' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The claim was restored.' })
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
