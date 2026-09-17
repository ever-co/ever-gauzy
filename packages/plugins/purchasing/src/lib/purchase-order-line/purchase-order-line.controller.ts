import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
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
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import { CreatePurchaseOrderLineDTO, UpdatePurchaseOrderLineDTO } from './dto';
import { PurchaseOrderLine } from './purchase-order-line.entity';
import { PurchaseOrderLineService } from './purchase-order-line.service';

/**
 * Purchase-order lines.
 *
 * The lines of an order are normally written with the order itself; this surface exists for the
 * operator who corrects one line. Every write here still obeys the order's rule — only a draft order's
 * line set may be written — and every write recomputes the order's header, because the header is a
 * function of the whole line set and a line changed here must leave it exactly as correct as one
 * changed through the order.
 */
@ApiTags('PurchaseOrderLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(PurchasingFeatures.PURCHASING)
@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
@Controller('/purchase-order-lines')
export class PurchaseOrderLineController extends CrudController<PurchaseOrderLine> {
	constructor(
		private readonly purchaseOrderLineService: PurchaseOrderLineService,
		private readonly purchaseOrderService: PurchaseOrderService
	) {
		super(purchaseOrderLineService);
	}

	/**
	 * Lists purchase-order lines.
	 *
	 * @param options The filter, including `filter[purchaseOrderId]` and `filter[variantId]`.
	 * @returns The lines, paginated.
	 */
	@ApiOperation({ summary: 'List purchase-order lines' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The lines were listed.' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
	// The route the CRUD base maps for this method. An override replaces the inherited method *and*
	// its decorators, so the overriding controller restates it.
	@Get()
	async findAll(@Query() options: BaseQueryDTO<PurchaseOrderLine>): Promise<IPagination<PurchaseOrderLine>> {
		return await this.purchaseOrderLineService.findAll(options);
	}

	/**
	 * Adds a line to a draft purchase order.
	 *
	 * @param entity The line to add.
	 * @returns The created line.
	 */
	@ApiOperation({ summary: 'Add a line to a draft purchase order' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The line was added.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The order has left DRAFT, or the variant is already ordered on it.' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreatePurchaseOrderLineDTO): Promise<PurchaseOrderLine> {
		const purchaseOrder = await this.purchaseOrderService.assertEditable(entity.purchaseOrderId);

		const line = await this.purchaseOrderLineService.addLine(
			purchaseOrder.id,
			{
				variantId: entity.variantId,
				quantity: entity.quantity,
				unitId: entity.unitId,
				conversionFactor: entity.conversionFactor,
				unitCost: entity.unitCost,
				taxRate: entity.taxRate,
				discountTotal: entity.discountTotal,
				expectedAt: entity.expectedAt,
				note: entity.note
			},
			// The supplier and the currency are what a line with no stated cost is priced from: the
			// standing agreement with that supplier, in the order's own currency.
			{ vendorId: purchaseOrder.vendorId, currency: purchaseOrder.currency }
		);

		// The line's own total and the header's totals are both derived, and both are rewritten here:
		// a line added through this surface has to leave the order exactly as correct as one added
		// with the order itself.
		await this.purchaseOrderLineService.rewriteLineTotals(purchaseOrder.id, purchaseOrder.currency);
		await this.purchaseOrderService.recomputeTotalsFor(purchaseOrder.id);

		return await this.purchaseOrderLineService.findOneByIdString(line.id);
	}

	/**
	 * Updates a line of a draft purchase order.
	 *
	 * The received counters are not reachable from here: they are the order's record of what the stock
	 * ledger already holds, and only a goods receipt moves them.
	 *
	 * @param id The line to update.
	 * @param entity The fields to change.
	 * @returns The updated line.
	 */
	@ApiOperation({ summary: 'Update a purchase-order line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was updated.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The order has left DRAFT.' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdatePurchaseOrderLineDTO
	): Promise<PurchaseOrderLine> {
		const line = await this.purchaseOrderLineService.findOneByIdString(id);
		const purchaseOrder = await this.purchaseOrderService.assertEditable(line.purchaseOrderId);

		const { receivedQuantity, damagedQuantity, total, ...changes } = entity as any;

		await this.purchaseOrderLineService.update(id, changes);
		await this.purchaseOrderLineService.rewriteLineTotals(purchaseOrder.id, purchaseOrder.currency);
		await this.purchaseOrderService.recomputeTotalsFor(purchaseOrder.id);

		return await this.purchaseOrderLineService.findOneByIdString(id);
	}

	/**
	 * Removes a line from a draft purchase order.
	 *
	 * @param id The line to remove.
	 * @returns The deletion result.
	 */
	@ApiOperation({ summary: 'Remove a purchase-order line' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The line was removed.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The order has left DRAFT.' })
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		const line = await this.purchaseOrderLineService.findOneByIdString(id);
		const purchaseOrder = await this.purchaseOrderService.assertEditable(line.purchaseOrderId);

		const result = await this.purchaseOrderLineService.delete(id);

		await this.purchaseOrderLineService.rewriteLineTotals(purchaseOrder.id, purchaseOrder.currency);
		await this.purchaseOrderService.recomputeTotalsFor(purchaseOrder.id);

		return result;
	}
}
