import {
	Body,
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
	UsePipes
} from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PermissionsEnum, IInvoiceEstimateHistory, IPagination, ID } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, AbstractValidationPipe, UUIDValidationPipe } from './../shared/pipes';
import { InvoiceEstimateHistory } from './invoice-estimate-history.entity';
import { InvoiceEstimateHistoryService } from './invoice-estimate-history.service';
import { TenantOrganizationBaseDTO } from '../core/dto';

@ApiTags('InvoiceEstimateHistory')
@Controller('/invoice-estimate-history')
export class InvoiceEstimateHistoryController extends CrudController<InvoiceEstimateHistory> {
	constructor(private readonly invoiceEstimateHistoryService: InvoiceEstimateHistoryService) {
		super(invoiceEstimateHistoryService);
	}

	@UseGuards(TenantPermissionGuard, PermissionGuard)
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
	 * Files a log entry against an invoice or an estimate.
	 *
	 * Overrides the inherited `CrudController.create()` route only to attach a permission. The base declares the route
	 * with no guard and no permission metadata, so any member of the tenant (a candidate or a viewer included) could
	 * write an invoice's audit trail. It now states the edit grant of the document the entry is filed against:
	 * `INVOICES_EDIT` or `ESTIMATES_EDIT`, since both the invoice and the estimate screens file entries
	 * (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param entity The log entry.
	 * @returns The created log entry.
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Record created successfully' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input provided' })
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT, PermissionsEnum.ESTIMATES_EDIT)
	@Post()
	async create(@Body() entity: DeepPartial<InvoiceEstimateHistory>): Promise<InvoiceEstimateHistory> {
		return await super.create(entity);
	}

	/**
	 * Changes a log entry.
	 *
	 * Overrides the inherited `CrudController.update()` route only to attach `INVOICES_EDIT`, the grant the retire and
	 * restore routes below state, for the reason {@link create} gives. Method metadata is not inherited by an override,
	 * so the base route's `@HttpCode` is restated to keep the response status unchanged.
	 *
	 * @param id The log entry.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record updated successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<InvoiceEstimateHistory>
	): Promise<any> {
		return await super.update(id, entity);
	}

	/**
	 * Removes a log entry outright.
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach `INVOICES_EDIT`, for the reason
	 * {@link create} gives.
	 *
	 * @param id The log entry.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		return await super.delete(id);
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
	@UseGuards(TenantPermissionGuard, PermissionGuard)
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
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<InvoiceEstimateHistory> {
		return await super.softRecover(id, ...options);
	}
}
