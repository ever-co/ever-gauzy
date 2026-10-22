import { Controller, UseGuards, Get, Query, HttpStatus, Post, Body, Param, ValidationPipe, Delete, HttpCode, Put, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IInvoiceItem, IPagination, PermissionsEnum, ID } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { InvoiceItem } from './invoice-item.entity';
import { InvoiceItemService } from './invoice-item.service';
import { InvoiceItemBulkCreateCommand } from './commands';
import { BulkBodyLoadTransformPipe, ParseJsonPipe, UUIDValidationPipe, AbstractValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { InvoiceItemBulkInputDTO } from './dto';
import { TenantOrganizationBaseDTO } from '../core/dto';

@ApiTags('InvoiceItem')
@UseGuards(TenantPermissionGuard)
@Controller('/invoice-item')
export class InvoiceItemController extends CrudController<InvoiceItem> {
	constructor(private readonly invoiceItemService: InvoiceItemService, private readonly commandBus: CommandBus) {
		super(invoiceItemService);
	}

	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IInvoiceItem>> {
		const { relations = [], findInput = null } = data;
		return this.invoiceItemService.findAll({
			where: findInput,
			relations
		});
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
	 * Creates one invoice item.
	 *
	 * Overrides the inherited `CrudController.create()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the tenant
	 * (a candidate or a viewer included) could add a billed line to any of its invoices. It now states `INVOICES_EDIT`:
	 * the grant its bulk-write route states (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param entity The invoice item.
	 * @returns The created invoice item.
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Record created successfully' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input provided' })
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Post()
	async create(@Body() entity: DeepPartial<InvoiceItem>): Promise<InvoiceItem> {
		return await super.create(entity);
	}

	/**
	 * Changes one invoice item: its quantity, its price, what it bills.
	 *
	 * Overrides the inherited `CrudController.update()` route only to attach `INVOICES_EDIT`, for the reason
	 * {@link create} gives. Method metadata is not inherited by an override, so the base route's `@HttpCode` is
	 * restated to keep the response status unchanged.
	 *
	 * @param id The invoice item.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record updated successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVOICES_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<InvoiceItem>
	): Promise<any> {
		return await super.update(id, entity);
	}

	/**
	 * Removes one invoice item outright.
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach `INVOICES_EDIT`, for the reason
	 * {@link create} gives.
	 *
	 * @param id The invoice item.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
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
