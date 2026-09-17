import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
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
}
