import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
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
import { CreateSellerSettlementDTO, UpdateSellerSettlementDTO } from './dto';
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

	/**
	 * Records a settlement reported by a provider.
	 *
	 * This is the resource's create route, and it is declared rather than inherited: the CRUD base takes
	 * the entity's shape, whose reflected type is `Object`, so the validation pipe is skipped and an
	 * inherited `create` would write any body at all. The service call is the recorder's, which is what
	 * this route has always done.
	 */
	@ApiOperation({ summary: 'Record a settlement reported by a provider' })
	@ApiResponse({ status: 201, description: 'Settlement recorded successfully', type: SellerSettlement })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_EDIT)
	@Post('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateSellerSettlementDTO): Promise<SellerSettlement> {
		return this.sellerSettlementService.record(entity as Partial<SellerSettlement>);
	}

	/**
	 * Updates the fields a settlement may still move: its status and what reconciliation found.
	 *
	 * The return is the platform's own: the service's `update` answers either the row or the result of a
	 * partial update, which is why the CRUD base declares `Promise<any>` on this route too.
	 */
	@ApiOperation({ summary: 'Update a settlement' })
	@ApiResponse({ status: 200, description: 'Settlement updated successfully', type: SellerSettlement })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_EDIT)
	@Put('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateSellerSettlementDTO
	): Promise<any> {
		return this.sellerSettlementService.update(id, entity as any);
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
