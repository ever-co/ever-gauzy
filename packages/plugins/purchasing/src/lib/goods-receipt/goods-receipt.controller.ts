import {
	Body,
	Controller,
	Get,
	Headers,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
	UseGuards
} from '@nestjs/common';
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
import { parseIfMatch } from '../purchasing.http';
import { PurchasingFeatures } from '../purchasing.features';
import { PurchasingPermissions } from '../purchasing.permissions';
import { CancelGoodsReceiptDTO, CreateGoodsReceiptDTO } from './dto';
import { GoodsReceipt } from './goods-receipt.entity';
import { GoodsReceiptService } from './goods-receipt.service';

/**
 * Goods receipts.
 *
 * A receipt is a record of something that happened, so this surface is deliberately small: a delivery
 * is recorded, read back with its lines and the movements they produced, and reversed when it was
 * wrong. There is no edit route, because editing a receipt would leave movements in the ledger that no
 * document explains — reversing it writes the compensating movements and leaves both versions
 * readable.
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
}
