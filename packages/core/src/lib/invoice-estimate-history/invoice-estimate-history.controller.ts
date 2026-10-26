import {
	Controller,
	UseGuards,
	Query,
	Get,
	Delete,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	UsePipes,
	Body
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DeepPartial, FindOptionsWhere } from 'typeorm';
import { PermissionsEnum, IInvoiceEstimateHistory, IPagination, ID } from '@gauzy/contracts';
import { CrudController, BaseQueryDTO } from './../core/crud';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, AbstractValidationPipe, UUIDValidationPipe } from './../shared/pipes';
import { InvoiceEstimateHistory } from './invoice-estimate-history.entity';
import { InvoiceEstimateHistoryService } from './invoice-estimate-history.service';
import { TenantOrganizationBaseDTO } from '../core/dto';

/**
 * The activity log of an invoice or an estimate.
 *
 * The guard pair and the invoices' edit grant are stated on the class, so every route — the edit and the
 * delete, which this controller inherits from the CRUD base without overriding them, included — runs under
 * them. They used to be stated on three handlers only, and the inherited count, pagination, node, create, edit and delete ran
 * with no guard and no permission: any member of the tenant could read, file, rewrite or delete the log of
 * any invoice. The reads are narrowed to `INVOICES_VIEW` below, the grant the invoice reads themselves
 * state; the estimates are invoices on the API side and go through the same `INVOICES_*` grants.
 */
@ApiTags('InvoiceEstimateHistory')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INVOICES_EDIT)
@Controller('/invoice-estimate-history')
export class InvoiceEstimateHistoryController extends CrudController<InvoiceEstimateHistory> {
	constructor(private readonly invoiceEstimateHistoryService: InvoiceEstimateHistoryService) {
		super(invoiceEstimateHistoryService);
	}

	/**
	 * Counts the log entries.
	 *
	 * Overrides the inherited `CrudController.getCount()` route only to state the read grant.
	 */
	@ApiOperation({ summary: 'Get total record count' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Total record count retrieved successfully' })
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get('count')
	async getCount(@Query() options?: FindOptionsWhere<InvoiceEstimateHistory>): Promise<number | void> {
		return await super.getCount(options);
	}

	/**
	 * Pages through the log entries.
	 *
	 * Overrides the inherited `CrudController.pagination()` route only to state the read grant.
	 */
	@ApiOperation({ summary: 'Get paginated records' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Records retrieved successfully' })
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get('pagination')
	async pagination(
		@Query() filter?: BaseQueryDTO<InvoiceEstimateHistory>,
		...options: any[]
	): Promise<IPagination<InvoiceEstimateHistory> | undefined> {
		return await super.pagination(filter, ...options);
	}

	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IInvoiceEstimateHistory>> {
		const { relations = [], findInput = null } = data;
		return this.invoiceEstimateHistoryService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * Reads one log entry.
	 *
	 * Overrides the inherited `CrudController.findById()` route only to state the read grant.
	 */
	@ApiOperation({ summary: 'Find record by ID' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Record retrieved successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<InvoiceEstimateHistory> {
		return await super.findById(id, ...options);
	}

	/**
	 * Files a log entry.
	 *
	 * Overrides the inherited `CrudController.create()` route only to state who may file one. The web app
	 * files an entry as the side effect of the action it records, and the list page lets a reader comment on
	 * the log, so the route admits every grant those run under: `INVOICES_VIEW` (downloading an invoice or an
	 * estimate, commenting on it), `INVOICES_EDIT` (adding, editing, duplicating, converting, sending and
	 * e-mailing one) and `ORG_PAYMENT_ADD_EDIT` (recording, editing or deleting a payment against one, from the
	 * invoice's payments page or the payments page). `checkRolePermission` uses `IN (:...permissions)`, so
	 * holding any one of them passes.
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Record created successfully' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input provided' })
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.INVOICES_VIEW, PermissionsEnum.INVOICES_EDIT, PermissionsEnum.ORG_PAYMENT_ADD_EDIT)
	@Post()
	async create(
		@Body() entity: DeepPartial<InvoiceEstimateHistory>,
		...options: any[]
	): Promise<InvoiceEstimateHistory> {
		return await super.create(entity, ...options);
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could retire the row. It now states `INVOICES_EDIT`: the write grant of the invoices whose
	 * history this is (its list route reads under `INVOICES_VIEW`) (GHSA-v79w-54p2-wmh5). The GraphQL field that
	 * mirrors it states the same.
	 *
	 * @param id The record to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted record.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<InvoiceEstimateHistory> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could restore the row. It now states `INVOICES_EDIT`: the write grant of the invoices whose
	 * history this is (its list route reads under `INVOICES_VIEW`) (GHSA-v79w-54p2-wmh5). The GraphQL field that
	 * mirrors it states the same.
	 *
	 * @param id The record to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored record.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<InvoiceEstimateHistory> {
		return await super.softRecover(id, ...options);
	}
}
