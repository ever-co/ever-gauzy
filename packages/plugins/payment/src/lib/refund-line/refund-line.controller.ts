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
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	BaseQueryDTO,
	CrudController,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { RefundLine } from './refund-line.entity';
import { RefundLineService } from './refund-line.service';
import { CreateRefundLineDTO, UpdateRefundLineDTO } from './dto';
import { IRefundLine, IRefundLineUpdateInput } from '../payment.types';
import { PaymentPermission } from '../payment.permissions';
import { toPaymentListOptions } from '../payment.list-query';

/**
 * Which lines a refund paid back.
 *
 * A line is the money side of the breakdown: it says which order line a part of the refund is
 * attributed to, how much of that line came back and what was given for it. Reading them is
 * `REFUNDS_VIEW`; writing them is `REFUNDS_CREATE`, the same value that records the refund itself —
 * a breakdown maintained by somebody who may not give money back would be a second, quieter way to
 * decide what a refund is for.
 *
 * The ceiling is the refund's own amount, checked at every write against the lines already stored, so
 * the sum of a refund's lines can never pass what the refund gives back. A line is refused outright
 * when the refund has settled: what a refund that has already moved the money paid back is a record,
 * not a draft.
 */
@ApiTags('RefundLine')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
@Controller('/refund-lines')
export class RefundLineController extends CrudController<RefundLine> {
	constructor(private readonly refundLineService: RefundLineService) {
		super(refundLineService);
	}

	/**
	 * Lists the lines of the caller's organization, optionally narrowed to one refund.
	 *
	 * @param filter The query filter: its flat and `where[...]` members are the criterion, merged with
	 * the tenancy scope; `take`, `skip` (a row offset) and `withDeleted` are the page and the visibility.
	 * @returns One page of lines.
	 */
	@ApiOperation({ summary: 'List refund lines' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Refund lines retrieved' })
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Get()
	async findAll(@Query() filter?: BaseQueryDTO<RefundLine>): Promise<IPagination<IRefundLine>> {
		// The query string arrives raw — no validation pipe runs on this route — so it is split into find
		// options and criterion rather than spread whole: `withDeleted` is read as a boolean (the string
		// 'false' is truthy, and both ORMs lifted the soft-delete filter for it), a flat filter such as
		// `?status=` stays a criterion instead of becoming a find option neither ORM reads, and `take` and
		// `skip` are read as numbers, `skip` being a row offset exactly as on the GraphQL connection.
		return this.refundLineService.findLinesPage(toPaymentListOptions(filter));
	}

	/**
	 * Reads one line.
	 *
	 * @param id The line to read.
	 * @returns The line.
	 */
	@ApiOperation({ summary: 'Find a refund line by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Refund line retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Refund line not found' })
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IRefundLine> {
		return this.refundLineService.findLineOrFail(id);
	}

	/**
	 * Records a line against a pending refund.
	 *
	 * @param entity The line to record.
	 * @returns The stored line.
	 */
	@ApiOperation({ summary: 'Record a refund line' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Refund line recorded' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Settled refund, unknown order line, or over the refund' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async create(@Body() entity: CreateRefundLineDTO): Promise<IRefundLine> {
		return this.refundLineService.createLine(entity as never);
	}

	/**
	 * Changes what a line of a pending refund records: its quantity, its amount and its metadata.
	 *
	 * @param id The line to change.
	 * @param entity The fields to change.
	 * @returns The stored line.
	 */
	@ApiOperation({ summary: 'Update a refund line' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Refund line updated' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Settled refund, or a line moved to another order line' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateRefundLineDTO
	): Promise<IRefundLine> {
		return this.refundLineService.updateLine(id, entity as IRefundLineUpdateInput);
	}

	/**
	 * Removes a line from a refund that has not settled.
	 *
	 * @param id The line to remove.
	 * @returns The line as it stood before it was removed.
	 */
	@ApiOperation({ summary: 'Remove a refund line' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Refund line removed' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Settled refund' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Delete(':id')
	@HttpCode(HttpStatus.OK)
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<IRefundLine> {
		return this.refundLineService.removeLine(id);
	}

	/**
	 * Soft deletes a refund line, leaving the breakdown on record.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to
	 * empty metadata with its `isEmpty(permissions)` return, and the inherited handler stood on this
	 * class's read grant alone. It now states `REFUNDS_CREATE`, the grant the create, update and delete
	 * routes here carry and the one the GraphQL `deleteRefundLine` mutation states for the same line.
	 *
	 * @param id The line to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted line.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a refund line that was soft deleted.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to
	 * empty metadata with its `isEmpty(permissions)` return, and the inherited handler stood on this
	 * class's read grant alone. It now states `REFUNDS_CREATE` — restoring is the same grant exercised
	 * backwards, and the delete and soft-delete routes here state it too.
	 *
	 * @param id The line to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored line.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
