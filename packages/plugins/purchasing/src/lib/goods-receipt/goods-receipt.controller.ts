import {
	Body,
	Controller,
	Delete,
	Get,
	Headers,
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
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { parseIfMatch } from '../purchasing.http';
import { PurchasingFeatures } from '../purchasing.features';
import { PurchasingPermissions } from '../purchasing.permissions';
import { CancelGoodsReceiptDTO, CreateGoodsReceiptDTO, UpdateGoodsReceiptDTO } from './dto';
import { GoodsReceipt } from './goods-receipt.entity';
import { GoodsReceiptService } from './goods-receipt.service';

/**
 * Goods receipts.
 *
 * A receipt is a record of something that happened, so this surface is deliberately small: a delivery
 * is recorded, read back with its lines and the movements they produced, and reversed when it was
 * wrong. There is no edit route of its own, because editing a receipt would leave movements in the
 * ledger that no document explains — reversing it writes the compensating movements and leaves both
 * versions readable. The edit route the CRUD base maps is nevertheless declared below, so that the
 * body it accepts is validated rather than written as it arrives.
 *
 * Recording a delivery **demands** the platform's retry key. Receiving a purchase order twice books the
 * stock twice and moves the order's counters twice, and the second booking is not a duplicate row but a
 * second delivery of goods that arrived once — so a client that loses the response to a receipt has to
 * present the key it sent, and a request without one is refused rather than guessed at.
 */
@ApiTags('GoodsReceipt')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(PurchasingFeatures.PURCHASING)
@Permissions(PurchasingPermissions.GOODS_RECEIPTS_VIEW)
@Controller('/goods-receipts')
export class GoodsReceiptController extends CrudController<GoodsReceipt> {
	constructor(private readonly goodsReceiptService: GoodsReceiptService) {
		super(goodsReceiptService);
	}

	/**
	 * Records a delivery against a purchase order, writing the stock movements it produces.
	 *
	 * @param entity The delivery.
	 * @param ifMatch The order version the caller read, when it stated one.
	 * @returns The receipt, carrying what the operation did to the ledger and to the order.
	 */
	@ApiOperation({ summary: 'Receive goods against a purchase order' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The goods were received.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'The order cannot be received, the location differs, or a line exceeds the ordered quantity.' })
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	@Idempotent({ scope: 'purchase_order.receive', required: true, resourceType: 'goods_receipt' })
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(
		@Body() entity: CreateGoodsReceiptDTO,
		@Headers('if-match') ifMatch?: string
	): Promise<GoodsReceipt> {
		return await this.goodsReceiptService.receive({
			...entity,
			expectedVersion: parseIfMatch(ifMatch)
		} as any);
	}

	/**
	 * Corrects the recorded fields of a receipt, and never the quantities it moved.
	 *
	 * The route the CRUD base maps for `PUT /goods-receipts/:id` is declared here rather than
	 * inherited: a body is validated from the type the handler names, and the base class names the
	 * entity's shape as a generic, whose reflected type is `Object` — a parameter the validation pipe
	 * cannot name a class for is skipped, so an inherited route accepts any body at all and writes it.
	 * Reversing a receipt is still what corrects a delivery that was wrong, because the compensating
	 * movements are what keep the ledger explicable; this is the repair surface for the document's own
	 * fields, which is why it carries the receiving grant.
	 *
	 * @param id The receipt to change.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update a goods receipt' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The receipt was updated.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'The receipt does not exist.' })
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateGoodsReceiptDTO) {
		return await this.goodsReceiptService.update(id, entity as any);
	}

	/**
	 * Reverses a receipt, taking its quantities back out of stock and off the order's lines.
	 *
	 * @param id The receipt to reverse.
	 * @param entity Why it was reversed.
	 * @returns The reversed receipt.
	 */
	@ApiOperation({ summary: 'Reverse a goods receipt' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The receipt was reversed.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'No inventory capability is registered.' })
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	@Post(':id/cancel')
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancel(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: CancelGoodsReceiptDTO
	): Promise<GoodsReceipt> {
		return await this.goodsReceiptService.reverse(id, entity.reason);
	}

	/**
	 * Reads a receipt with its lines and the movements they produced.
	 *
	 * @param id The receipt to read.
	 * @returns The receipt.
	 */
	@ApiOperation({ summary: 'Find a goods receipt with its lines' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The receipt was found.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'The receipt does not exist.' })
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_VIEW)
	// The route the CRUD base maps for this method. An override replaces the inherited method *and*
	// its decorators, so the overriding controller restates it — without this line the detail
	// endpoint would simply not exist.
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<GoodsReceipt> {
		return await this.goodsReceiptService.findOneDetailed(id);
	}

	/**
	 * Lists goods receipts.
	 *
	 * @param options The filter, including `filter[purchaseOrderId]` and `filter[warehouseId]`.
	 * @returns The receipts, paginated.
	 */
	@ApiOperation({ summary: 'List goods receipts' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The receipts were listed.' })
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_VIEW)
	// The route the CRUD base maps for this method, restated for the same reason as `findById` above.
	@Get()
	async findAll(@Query() options: BaseQueryDTO<GoodsReceipt>): Promise<IPagination<GoodsReceipt>> {
		return await this.goodsReceiptService.findAll(options);
	}

	/**
	 * Deletes a receipt.
	 *
	 * The `DELETE ':id'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `GOODS_RECEIPTS_CREATE`, the
	 * grant recording a delivery and reversing a receipt both carry.
	 *
	 * @param id The receipt to delete.
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
	 * Soft deletes a receipt.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `GOODS_RECEIPTS_CREATE`, the
	 * grant recording a delivery and reversing a receipt both carry.
	 *
	 * @param id The receipt to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted receipt.
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
	 * Restores a soft-deleted receipt.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata of its own, so
	 * `PermissionGuard` resolves the metadata handler-first-then-class — `getAllAndOverride` over
	 * `PERMISSIONS_METADATA` in `packages/core/src/lib/shared/guards/permission.guard.ts` — and answers
	 * `true` to empty metadata with its `isEmpty(permissions)` return, which left the inherited route
	 * demanding only this controller's class-level view grant. It now states `GOODS_RECEIPTS_CREATE`, the
	 * grant recording a delivery and reversing a receipt both carry.
	 *
	 * @param id The receipt to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored receipt.
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
