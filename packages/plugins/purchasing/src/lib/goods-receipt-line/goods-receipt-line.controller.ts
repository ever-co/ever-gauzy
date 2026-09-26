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
import { PurchasingFeatures } from '../purchasing.features';
import { PurchasingPermissions } from '../purchasing.permissions';
import { GoodsReceiptService } from '../goods-receipt/goods-receipt.service';
import { CreateGoodsReceiptLineDTO, UpdateGoodsReceiptLineDTO } from './dto';
import { GoodsReceiptLine } from './goods-receipt-line.entity';
import { GoodsReceiptLineService } from './goods-receipt-line.service';

/**
 * Goods-receipt lines.
 *
 * The lines of a receipt are written with the receipt itself, in the same operation that records the
 * movements they produced. This surface exists for reading them back by order line — "what has this
 * line actually received" — for annotating one, and for recording one further line against a receipt
 * that was already posted; it deliberately has no route that rewrites a quantity, because a receipt
 * line's quantities are what the stock ledger was told.
 */
@ApiTags('GoodsReceiptLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(PurchasingFeatures.PURCHASING)
@Permissions(PurchasingPermissions.GOODS_RECEIPTS_VIEW)
@Controller('/goods-receipt-lines')
export class GoodsReceiptLineController extends CrudController<GoodsReceiptLine> {
	constructor(
		private readonly goodsReceiptLineService: GoodsReceiptLineService,
		private readonly goodsReceiptService: GoodsReceiptService
	) {
		super(goodsReceiptLineService);
	}

	/**
	 * Lists goods-receipt lines.
	 *
	 * @param options The filter, including `filter[receiptId]` and `filter[purchaseOrderLineId]`.
	 * @returns The lines, paginated.
	 */
	@ApiOperation({ summary: 'List goods-receipt lines' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The lines were listed.' })
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_VIEW)
	// The route the CRUD base maps for this method. An override replaces the inherited method *and*
	// its decorators, so the overriding controller restates it.
	@Get()
	async findAll(@Query() options: BaseQueryDTO<GoodsReceiptLine>): Promise<IPagination<GoodsReceiptLine>> {
		return await this.goodsReceiptLineService.findAll(options);
	}

	/**
	 * Reads the receipt lines written against one order line.
	 *
	 * @param purchaseOrderLineId The order line to read.
	 * @returns The receipt lines, oldest first.
	 */
	@ApiOperation({ summary: 'Find the receipt lines written against one order line' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The receipt lines were listed.' })
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_VIEW)
	@Get('by-order-line/:purchaseOrderLineId')
	async findByOrderLine(
		@Param('purchaseOrderLineId', UUIDValidationPipe) purchaseOrderLineId: ID
	): Promise<GoodsReceiptLine[]> {
		return await this.goodsReceiptLineService.findByPurchaseOrderLine(purchaseOrderLineId);
	}

	/**
	 * Annotates a receipt line.
	 *
	 * @param id The line to annotate.
	 * @param entity The fields to change.
	 * @returns The updated line.
	 */
	@ApiOperation({ summary: 'Annotate a goods-receipt line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was annotated.' })
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateGoodsReceiptLineDTO
	): Promise<GoodsReceiptLine> {
		const { quantity, damagedQuantity, unitCost, stockMovementId, receiptId, purchaseOrderLineId, ...changes } =
			entity as any;

		await this.goodsReceiptLineService.update(id, changes);

		return await this.goodsReceiptLineService.findOneByIdString(id);
	}

	/**
	 * Writes a receipt line on its own, outside a receipt's line set.
	 *
	 * Guarded by the receiving permission rather than by an edit one, because writing a line here is
	 * recording a delivery. It goes through the receipt service rather than writing the row directly:
	 * a receipt line that no movement explains is exactly the state the domain forbids, so this route
	 * applies the same ceiling check, writes the same movements and updates the order the same way the
	 * receipt route does.
	 *
	 * @param entity The line to write.
	 * @returns The created line.
	 */
	@ApiOperation({ summary: 'Write a goods-receipt line' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The line was written.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The receipt was reversed, or the line exceeds the ordered quantity.' })
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateGoodsReceiptLineDTO): Promise<GoodsReceiptLine> {
		return await this.goodsReceiptService.recordSingleLine(entity.receiptId, entity as any);
	}

	/**
	 * Deletes a receipt line.
	 *
	 * The `DELETE ':id'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `GOODS_RECEIPTS_CREATE`, the
	 * grant the receipt these rows are written by carries.
	 *
	 * @param id The line to delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The deletion result.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record deleted successfully' })
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft deletes a receipt line.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `GOODS_RECEIPTS_CREATE`, the
	 * grant the receipt these rows are written by carries.
	 *
	 * @param id The line to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted line.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		// The base hands this same array over; the service's signature names find options, hence the cast.
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted receipt line.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `GOODS_RECEIPTS_CREATE`, the
	 * grant the receipt these rows are written by carries.
	 *
	 * @param id The line to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored line.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		// The base hands this same array over; the service's signature names find options, hence the cast.
		return await super.softRecover(id, ...options);
	}
}
