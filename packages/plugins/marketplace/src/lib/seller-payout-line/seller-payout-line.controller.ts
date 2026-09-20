import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	MethodNotAllowedException,
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
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { SellerPayoutLine } from './seller-payout-line.entity';
import { SellerPayoutLineService } from './seller-payout-line.service';
import { CreateSellerPayoutLineDTO, UpdateSellerPayoutLineDTO } from './dto';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';
import { ISellerScope } from '../seller-scope/seller-scope';

/** What both write routes answer with, because neither of them writes. */
const A_LINE_IS_WRITTEN_BY_THE_PAYOUT_RUN =
	'A payout line is created by the payout run and released by a cancellation; it is never authored by a caller.';

/**
 * The payout-line surface: a read of which transactions a payout covered.
 *
 * The two write routes are declared and refuse: a line is written by the payout run and released by a
 * cancellation, and both of those happen inside the payout's own transaction.
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

	/**
	 * Refuses a caller-authored line.
	 *
	 * The write routes are declared rather than inherited, because an inherited `create` names the
	 * entity's shape — a type that reflects as `Object`, which the validation pipe skips — so any body at
	 * all would reach the service. They refuse, because a line is not authored: the payout run creates one
	 * per included transaction and a cancellation releases it, and both of those happen inside the
	 * payout's own transaction. Declaring them is what leaves the endpoint addressable and validated; it
	 * is not an invitation to write.
	 */
	@ApiOperation({ summary: 'Refuse a caller-authored payout line' })
	@ApiResponse({ status: 405, description: 'A line is written by the payout run, not by a caller' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_CREATE)
	@Post('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateSellerPayoutLineDTO): Promise<SellerPayoutLine> {
		throw new MethodNotAllowedException(A_LINE_IS_WRITTEN_BY_THE_PAYOUT_RUN);
	}

	/**
	 * Refuses a caller-authored edit of a line.
	 *
	 * The amount a line carries is the transaction's net and the pair it names is what makes a transaction
	 * payable at most once, so neither is editable; releasing a line is a cancellation, which the payout
	 * owns.
	 */
	@ApiOperation({ summary: 'Refuse a caller-authored edit of a payout line' })
	@ApiResponse({ status: 405, description: 'A line is released by a payout cancellation, not by a caller' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_CREATE)
	@Put('/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateSellerPayoutLineDTO
	): Promise<SellerPayoutLine> {
		throw new MethodNotAllowedException(A_LINE_IS_WRITTEN_BY_THE_PAYOUT_RUN);
	}

	/**
	 * DELETE a payout line by id
	 *
	 * The route belongs to `CrudController`, which declares it with no permission metadata of its own, and
	 * `PermissionGuard` answers `true` to that empty metadata — its `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — so the inherited handler stood on this
	 * controller's class-level view grant alone. This override exists only to state its permission: the path
	 * and the body are the base class's, and a line is the join row of one payout and one transaction, so
	 * deleting one takes SELLERS_DELETE, the DELETE value the catalogue declares for the seller whose rows
	 * every row under it belongs to.
	 *
	 * @param id The payout line id.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete a payout line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Payout line deleted successfully' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * SOFT DELETE a payout line by id
	 *
	 * The route belongs to `CrudController.softRemove()`, which declares it with no permission metadata at
	 * all, so `PermissionGuard` answers `true` to the empty metadata — the `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — and only this controller's class-level view
	 * grant was left in front of it. This override exists only to state its permission: the route and its
	 * body are unchanged, and archiving a join row under the seller takes SELLERS_DELETE.
	 *
	 * @param id The payout line id.
	 * @returns The soft-deleted payout line.
	 */
	@ApiOperation({ summary: 'Soft delete a payout line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Payout line soft deleted successfully' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * RESTORE a soft-deleted payout line by id
	 *
	 * The route belongs to `CrudController.softRecover()` and carries no permission metadata of its own, so
	 * `PermissionGuard` answers `true` to the empty metadata — the `isEmpty(permissions)` return in
	 * `packages/core/src/lib/shared/guards/permission.guard.ts` — before it consults the role grants at all.
	 * This override exists only to state its permission on the same path and the same body: restoring a join
	 * row under the seller takes SELLERS_DELETE, the same destructive grant its deletion takes.
	 *
	 * @param id The payout line id.
	 * @returns The restored payout line.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted payout line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Payout line restored successfully' })
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
