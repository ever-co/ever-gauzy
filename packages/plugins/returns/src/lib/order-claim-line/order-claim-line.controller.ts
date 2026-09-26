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
import { ReturnsFeatures } from '../returns.features';
import { ReturnsPermissions } from '../returns.permissions';
import { CreateOrderClaimLineDTO, UpdateOrderClaimLineDTO } from './dto';
import { OrderClaimLine } from './order-claim-line.entity';
import { OrderClaimLineService } from './order-claim-line.service';

/**
 * Claim lines.
 *
 * A claim may have two lines about the same order line — one damaged, one missing — which is why
 * there is no uniqueness constraint on the pair and no merged "adjust the quantity" endpoint: the
 * distinction between the two is what the resolution depends on.
 */
@ApiTags('OrderClaimLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(ReturnsFeatures.RETURNS)
@Permissions(ReturnsPermissions.CLAIMS_VIEW)
@Controller('/order-claim-lines')
export class OrderClaimLineController extends CrudController<OrderClaimLine> {
	constructor(private readonly orderClaimLineService: OrderClaimLineService) {
		super(orderClaimLineService);
	}

	/**
	 * Lists claim lines.
	 *
	 * @param options The filter, including `filter[claimId]`.
	 * @returns The lines, paginated.
	 */
	@ApiOperation({ summary: 'List claim lines' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The lines were listed.' })
	@Permissions(ReturnsPermissions.CLAIMS_VIEW)
	// The route the CRUD base maps for this method. An override replaces the inherited
	// method *and* its decorators, so the overriding controller restates it.
	@Get()
	async findAll(@Query() options: BaseQueryDTO<OrderClaimLine>): Promise<IPagination<OrderClaimLine>> {
		return await this.orderClaimLineService.findAll(options);
	}

	/**
	 * Adds a line to a claim that is still open.
	 *
	 * @param entity The line to add.
	 * @returns The created line.
	 */
	@ApiOperation({ summary: 'Add a line to a claim' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The line was added.' })
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderClaimLineDTO): Promise<OrderClaimLine> {
		return await this.orderClaimLineService.create(entity as any);
	}

	/**
	 * Updates a claim line.
	 *
	 * @param id The line to update.
	 * @param entity The fields to change.
	 * @returns The updated line.
	 */
	@ApiOperation({ summary: 'Update a claim line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was updated.' })
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrderClaimLineDTO
	): Promise<OrderClaimLine> {
		await this.orderClaimLineService.update(id, entity as any);

		return await this.orderClaimLineService.findOneByIdString(id);
	}

	/**
	 * Deletes a claim line.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `DELETE :id` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. This line joins a claim, and the plugin declares no
	 * `CLAIMS_DELETE`, so this states `CLAIMS_CREATE`, the grant that already lets a caller write a
	 * claim line.
	 *
	 * @param id The claim line to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a claim line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was deleted.' })
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft-deletes a claim line.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `DELETE :id/soft` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. Soft removal is the same destructive write staged for recovery,
	 * so it states `CLAIMS_CREATE` as well.
	 *
	 * @param id The claim line to soft delete.
	 * @returns The soft-deleted claim line.
	 */
	@ApiOperation({ summary: 'Soft delete a claim line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was soft deleted.' })
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted claim line.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `PUT :id/recover` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. Restoring is the same destructive grant exercised backwards, so
	 * it states `CLAIMS_CREATE` as well.
	 *
	 * @param id The claim line to restore.
	 * @returns The restored claim line.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted claim line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was restored.' })
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
