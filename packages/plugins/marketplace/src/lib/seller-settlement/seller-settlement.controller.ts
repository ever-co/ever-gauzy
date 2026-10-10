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
	Req,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	BaseQueryDTO,
	CrudController,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
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
	 *
	 * `seller.settlement.record` is adopted as retry-safe without requiring a key: this is what a
	 * signature-verified provider callback lands on, and a callback that is delivered twice must record
	 * one settlement rather than two. A client that presents a key is answered from its first attempt.
	 * The key stays optional because the report's own uniqueness already refuses the second row, which
	 * is the guarantee that keeps holding when the retry store is unavailable.
	 */
	@ApiOperation({ summary: 'Record a settlement reported by a provider' })
	@ApiResponse({ status: 201, description: 'Settlement recorded successfully', type: SellerSettlement })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_EDIT)
	@Idempotent({ scope: 'seller.settlement.record', required: false, resourceType: 'seller_settlement' })
	@Post('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Req() request: any, @Body() entity: CreateSellerSettlementDTO): Promise<SellerSettlement> {
		return this.sellerSettlementService.record(entity as Partial<SellerSettlement>, this.scope(request));
	}

	/**
	 * Updates what a settlement states about itself: its period, its report and external references, the
	 * holder it pays, its note and its metadata.
	 *
	 * Its status and its figures are not in the body: the status moves through the reconcile, close and
	 * dispute routes below, each with its own checks, and the figures are the provider's report as recorded.
	 * `UpdateSellerSettlementDTO` omits them and the service refuses them, so an edit cannot close a
	 * settlement without the close or state a net its own figures do not produce.
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

	/**
	 * Reconciles a settlement against the platform's lines for its period.
	 *
	 * `seller.settlement.reconcile` is adopted as retry-safe without requiring a key: the comparison is
	 * computed from the ledger, and a client that re-sends a reconciliation it never saw the answer to
	 * would stamp a second reconciled date over the first. A client that presents a key is answered from
	 * its first attempt instead; the key stays optional because the second run reaches the same verdict.
	 */
	@ApiOperation({ summary: 'Reconcile a settlement' })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_EDIT)
	@Idempotent({ scope: 'seller.settlement.reconcile', required: false, resourceType: 'seller_settlement' })
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

	/**
	 * DELETE a settlement by id
	 *
	 * The route belongs to `CrudController`, which declares it with no permission metadata of its own, and
	 * `PermissionGuard` answers `true` to that empty metadata — its `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited handler stood on this
	 * controller's class-level view grant alone. This override exists only to state its permission: the path
	 * and the body are the base class's, and a settlement is a child row of the seller, so deleting one takes
	 * SELLERS_DELETE, the DELETE value the catalogue declares for the seller it reports on.
	 *
	 * @param id The settlement id.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete a settlement' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Settlement deleted successfully' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * SOFT DELETE a settlement by id
	 *
	 * The route belongs to `CrudController.softRemove()`, which declares it with no permission metadata at
	 * all, so `PermissionGuard` answers `true` to the empty metadata — the `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — and only this controller's class-level view
	 * grant was left in front of it. This override exists only to state its permission: the route and its
	 * body are unchanged, and archiving a child row of the seller takes SELLERS_DELETE.
	 *
	 * @param id The settlement id.
	 * @returns The soft-deleted settlement.
	 */
	@ApiOperation({ summary: 'Soft delete a settlement' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Settlement soft deleted successfully' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * RESTORE a soft-deleted settlement by id
	 *
	 * The route belongs to `CrudController.softRecover()` and carries no permission metadata of its own, so
	 * `PermissionGuard` answers `true` to the empty metadata — the `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — before it consults the role grants at all.
	 * This override exists only to state its permission on the same path and the same body: restoring a row
	 * under the seller takes SELLERS_DELETE, the same destructive grant its deletion takes.
	 *
	 * @param id The settlement id.
	 * @returns The restored settlement.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted settlement' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Settlement restored successfully' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}

	/** The seller scope the guard resolved. */
	private scope(request: any): ISellerScope | undefined {
		return request?.sellerScope as ISellerScope | undefined;
	}
}
