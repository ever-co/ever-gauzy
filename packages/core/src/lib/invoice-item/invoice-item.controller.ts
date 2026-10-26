import { Controller, UseGuards, Get, Query, HttpStatus, Post, Body, Param, ValidationPipe, Delete, HttpCode, Put, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { IInvoiceItem, IPagination, PermissionsEnum, ID } from '@gauzy/contracts';
import { BaseQueryDTO, CrudController } from './../core/crud';
import { InvoiceItem } from './invoice-item.entity';
import { InvoiceItemService } from './invoice-item.service';
import { InvoiceItemBulkCreateCommand } from './commands';
import { BulkBodyLoadTransformPipe, ParseJsonPipe, UUIDValidationPipe, AbstractValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { InvoiceItemBulkInputDTO } from './dto';
import { TenantOrganizationBaseDTO } from '../core/dto';
import { DeepPartial, FindOptionsWhere } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

/**
 * The lines of an invoice or an estimate.
 *
 * Every write states `INVOICES_EDIT` (GHSA-v79w-54p2-wmh5) and every read states `INVOICES_VIEW`: the grant the
 * invoice reads themselves state (`InvoiceController`), and the one the invoice history reads state. A line is
 * part of the document it bills, so it is read under the document's own grant and never wider; the estimates
 * are invoices on the API side and go through the same `INVOICES_*` grants. The reads used to state no
 * permission at all behind `TenantPermissionGuard` alone, so any member of the tenant (a VIEWER, a CANDIDATE)
 * could list every line of every invoice and estimate: what was billed, to whom, for how much. The web app
 * never reads this resource on its own — its invoice and estimate pages read the lines as a relation of
 * `/invoices`, which already required `INVOICES_VIEW` — so no page loses anything; every default role that
 * holds `ESTIMATES_VIEW` holds `INVOICES_VIEW` too. The GraphQL fields that mirror these reads state the same.
 */
@ApiTags('InvoiceItem')
@UseGuards(TenantPermissionGuard)
@Controller('/invoice-item')
export class InvoiceItemController extends CrudController<InvoiceItem> {
	constructor(private readonly invoiceItemService: InvoiceItemService, private readonly commandBus: CommandBus) {
		super(invoiceItemService);
	}

	/**
	 * Counts the lines.
	 *
	 * Overrides the inherited `CrudController.getCount()` route only to state the read grant, `INVOICES_VIEW`.
	 *
	 * @param options The criterion, forwarded to the base route.
	 * @returns How many lines match.
	 */
	@ApiOperation({ summary: 'Get total record count' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Total record count retrieved successfully' })
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get('count')
	async getCount(@Query() options?: FindOptionsWhere<InvoiceItem>): Promise<number | void> {
		return await super.getCount(options);
	}

	/**
	 * Pages through the lines.
	 *
	 * Overrides the inherited `CrudController.pagination()` route only to state the read grant, `INVOICES_VIEW`.
	 *
	 * @param filter The page and the criterion, forwarded to the base route.
	 * @param options The inherited options, forwarded to the base route.
	 * @returns One page of lines.
	 */
	@ApiOperation({ summary: 'Get paginated records' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Records retrieved successfully' })
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get('pagination')
	async pagination(
		@Query() filter?: BaseQueryDTO<InvoiceItem>,
		...options: any[]
	): Promise<IPagination<InvoiceItem> | undefined> {
		return await super.pagination(filter, ...options);
	}

	/**
	 * Lists the lines, under the read grant `INVOICES_VIEW`.
	 *
	 * @param data The `findInput` and the `relations` to read.
	 * @returns The lines that match.
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IInvoiceItem>> {
		const { relations = [], findInput = null } = data;
		return this.invoiceItemService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * Reads one line.
	 *
	 * Overrides the inherited `CrudController.findById()` route only to state the read grant, `INVOICES_VIEW`.
	 * It is declared after `count` and `pagination` so that `:id` does not shadow them.
	 *
	 * @param id The line to read.
	 * @param options The inherited options, forwarded to the base route.
	 * @returns The line.
	 */
	@ApiOperation({ summary: 'Find record by ID' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Record retrieved successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<InvoiceItem> {
		return await super.findById(id, ...options);
	}

	@ApiOperation({ summary: 'Create invoice item in Bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Invoice item have been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Post('/bulk/:invoiceId')
	async createBulk(
		@Param('invoiceId', UUIDValidationPipe) invoiceId: string,
		@Body(BulkBodyLoadTransformPipe, new ValidationPipe({ transform: true })) input: InvoiceItemBulkInputDTO
	): Promise<any> {
		return this.commandBus.execute(new InvoiceItemBulkCreateCommand(invoiceId, input.list));
	}

	/**
	 * Records one line.
	 *
	 * Overrides the inherited `CrudController.create()` route only to attach a permission. The base declares the
	 * route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of
	 * the tenant could add a line to any invoice or estimate and change what it bills. It now states
	 * `INVOICES_EDIT`: the grant its bulk-write route states, which is the route the invoice and estimate forms
	 * save their lines through (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param entity The line to record.
	 * @param options The inherited options, forwarded to the base route.
	 * @returns The recorded line.
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Record created successfully' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input provided' })
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Post()
	async create(@Body() entity: DeepPartial<InvoiceItem>, ...options: any[]): Promise<InvoiceItem> {
		return await super.create(entity, ...options);
	}

	/**
	 * Changes a line that exists.
	 *
	 * Overrides the inherited `CrudController.update()` route only to attach a permission, for the reason `create`
	 * gives: `INVOICES_EDIT` (GHSA-v79w-54p2-wmh5). The base route still strips the members a body never writes.
	 *
	 * @param id The line to change.
	 * @param entity The columns to change.
	 * @param options The inherited options, forwarded to the base route.
	 * @returns The store's update result, as the base route answers it.
	 */
	@ApiOperation({ summary: 'Update existing record' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Record updated successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input provided for update' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<InvoiceItem>,
		...options: any[]
	): Promise<any> {
		return await super.update(id, entity, ...options);
	}

	/**
	 * Removes a line outright.
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach a permission, for the reason `create`
	 * gives: `INVOICES_EDIT` (GHSA-v79w-54p2-wmh5).
	 *
	 * @param id The line to remove.
	 * @param options The inherited options, forwarded to the base route.
	 * @returns The store's delete result, as the base route answers it.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Record deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.delete(id, ...options);
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could retire the row. It now states `INVOICES_EDIT`: the grant its bulk-write route states
	 * (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted record.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<InvoiceItem> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could restore the row. It now states `INVOICES_EDIT`: the grant its bulk-write route states
	 * (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored record.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<InvoiceItem> {
		return await super.softRecover(id, ...options);
	}
}
