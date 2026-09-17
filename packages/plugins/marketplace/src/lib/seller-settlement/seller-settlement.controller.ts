import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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
import { SellerSettlement } from './seller-settlement.entity';
import { SellerSettlementService } from './seller-settlement.service';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';
import { ISellerScope } from '../seller-scope/seller-scope';

/**
 * The settlement surface: record what a provider reported, reconcile it, dispute it or close it.
 *
 * Recording is what a signature-verified provider callback does, so it carries the edit permission
 * rather than a create one: the platform is transcribing a report, not authoring a document.
 */
@ApiTags('SellerSettlement')
@UseGuards(TenantPermissionGuard, PermissionGuard, SellerAccessGuard)
@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_VIEW)
@Controller('/seller-settlements')
export class SellerSettlementController extends CrudController<SellerSettlement> {
	constructor(private readonly sellerSettlementService: SellerSettlementService) {
		super(sellerSettlementService);
	}

	/** Lists settlements. */
	@ApiOperation({ summary: 'List settlements' })
	@ApiResponse({ status: 200, description: 'Settlements retrieved successfully', type: SellerSettlement })
	@Get('/')
	@UseValidationPipe({ transform: true })
	async findAll(
		@Req() request: any,
		@Query() filter: BaseQueryDTO<SellerSettlement>
	): Promise<IPagination<SellerSettlement>> {
		return this.sellerSettlementService.listSettlements(filter, this.scope(request));
	}

	/** Reads one settlement. */
	@ApiOperation({ summary: 'Read one settlement' })
	@ApiResponse({ status: 200, description: 'Settlement retrieved successfully', type: SellerSettlement })
	@Get('/:id')
	async findById(@Req() request: any, @Param('id', UUIDValidationPipe) id: ID): Promise<SellerSettlement> {
		return this.sellerSettlementService.getSettlement(id, this.scope(request));
	}

	/** Records a settlement reported by a provider. */
	@ApiOperation({ summary: 'Record a settlement reported by a provider' })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_EDIT)
	@Post('/')
	@UseValidationPipe({ transform: true })
	async record(@Body() entity: any): Promise<SellerSettlement> {
		return this.sellerSettlementService.record(entity);
	}

	/** Reconciles a settlement against the platform's lines for its period. */
	@ApiOperation({ summary: 'Reconcile a settlement' })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_EDIT)
	@Post('/:id/reconcile')
	async reconcile(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: { providerReportId?: string; note?: string }
	): Promise<{ settlement: SellerSettlement; differences: Array<{ transactionId: ID; platformNet: string }> }> {
		return this.sellerSettlementService.reconcile(id, body);
	}

	/** Closes a settlement. */
	@ApiOperation({ summary: 'Close a settlement' })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_EDIT)
	@Post('/:id/close')
	async close(@Param('id', UUIDValidationPipe) id: ID, @Body() body: { note?: string }): Promise<SellerSettlement> {
		return this.sellerSettlementService.close(id, body?.note);
	}

	/** Marks a settlement disputed. */
	@ApiOperation({ summary: 'Dispute a settlement' })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_EDIT)
	@Post('/:id/dispute')
	async dispute(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: { reason: string }
	): Promise<SellerSettlement> {
		return this.sellerSettlementService.dispute(id, body?.reason);
	}

	/** The seller scope the guard resolved. */
	private scope(request: any): ISellerScope | undefined {
		return request?.sellerScope as ISellerScope | undefined;
	}
}
