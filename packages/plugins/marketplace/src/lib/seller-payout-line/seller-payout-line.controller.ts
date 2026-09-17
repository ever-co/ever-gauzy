import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { SellerPayoutLine } from './seller-payout-line.entity';
import { SellerPayoutLineService } from './seller-payout-line.service';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';
import { ISellerScope } from '../seller-scope/seller-scope';

/**
 * The payout-line surface: a read of which transactions a payout covered.
 *
 * There is no write route, because a line is written by the payout run and released by a cancellation,
 * and both of those happen inside the payout's own transaction.
 */
@ApiTags('SellerPayoutLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, SellerAccessGuard)
@Permissions(PermissionsEnum.SELLER_PAYOUTS_VIEW)
@Controller('/seller-payout-lines')
export class SellerPayoutLineController extends CrudController<SellerPayoutLine> {
	constructor(private readonly sellerPayoutLineService: SellerPayoutLineService) {
		super(sellerPayoutLineService);
	}

	/** Lists payout lines. */
	@ApiOperation({ summary: 'List payout lines' })
	@ApiResponse({ status: 200, description: 'Payout lines retrieved successfully', type: SellerPayoutLine })
	@Get('/')
	@UseValidationPipe({ transform: true })
	async findAll(
		@Req() request: any,
		@Query() filter: BaseQueryDTO<SellerPayoutLine>
	): Promise<IPagination<SellerPayoutLine>> {
		return this.sellerPayoutLineService.listLines(filter, this.scope(request));
	}

	/** Reads one payout line. */
	@ApiOperation({ summary: 'Read one payout line' })
	@ApiResponse({ status: 200, description: 'Payout line retrieved successfully', type: SellerPayoutLine })
	@Get('/:id')
	async findById(@Req() request: any, @Param('id', UUIDValidationPipe) id: ID): Promise<SellerPayoutLine> {
		return this.sellerPayoutLineService.getLine(id, this.scope(request));
	}

	/** The seller scope the guard resolved. */
	private scope(request: any): ISellerScope | undefined {
		return request?.sellerScope as ISellerScope | undefined;
	}
}
