import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Body,
	Controller,
	UseGuards,
	HttpStatus,
	Get,
	Query,
	Delete,
	HttpCode,
	Param,
	Post,
	Put,
	UsePipes
} from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IOrganizationDocument, IPagination, ID, PermissionsEnum } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { OrganizationDocument } from './organization-document.entity';
import { OrganizationDocumentService } from './organization-document.service';
import { TenantPermissionGuard, PermissionGuard } from './../shared/guards';
import { ParseJsonPipe, AbstractValidationPipe, UUIDValidationPipe } from './../shared/pipes';
import { Permissions } from '../shared/decorators';
import { TenantOrganizationBaseDTO } from '../core/dto';

@ApiTags('OrganizationDocument')
@UseGuards(TenantPermissionGuard)
@Controller('/organization-documents')
export class OrganizationDocumentController extends CrudController<OrganizationDocument> {
	constructor(private readonly organizationDocumentService: OrganizationDocumentService) {
		super(organizationDocumentService);
	}

	/**
	 * GET all organization documents
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all organization document.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organization document',
		type: OrganizationDocument
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IOrganizationDocument>> {
		const { findInput } = data;
		return this.organizationDocumentService.findAll({ where: findInput });
	}

	/**
	 * Creates an organization document.
	 *
	 * Overrides the inherited `CrudController.create()` route only to attach a permission. The base declares the
	 * route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of
	 * the tenant could write the organization's documents. It now states `ALL_ORG_EDIT`, the grant its soft
	 * delete and recovery state (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param entity The record to create.
	 * @param options The inherited options, forwarded to the base route.
	 * @returns The created record.
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Record created successfully' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input provided' })
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Post()
	async create(@Body() entity: DeepPartial<OrganizationDocument>, ...options: any[]): Promise<OrganizationDocument> {
		return await super.create(entity, ...options);
	}

	/**
	 * Updates an organization document.
	 *
	 * Overrides the inherited `CrudController.update()` route only to attach a permission, for the reason `create`
	 * gives: `ALL_ORG_EDIT` (GHSA-v79w-54p2-wmh5). The base route still strips the members a body never writes.
	 *
	 * @param id The record to update.
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
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<OrganizationDocument>,
		...options: any[]
	): Promise<any> {
		return await super.update(id, entity, ...options);
	}

	/**
	 * Deletes an organization document.
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach a permission, for the reason `create`
	 * gives: `ALL_ORG_EDIT` (GHSA-v79w-54p2-wmh5).
	 *
	 * @param id The record to delete.
	 * @param options The inherited options, forwarded to the base route.
	 * @returns The store's delete result, as the base route answers it.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Record deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.delete(id, ...options);
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could retire the row. It now states `ALL_ORG_EDIT`: the organization-settings edit grant
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
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<OrganizationDocument> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could restore the row. It now states `ALL_ORG_EDIT`: the organization-settings edit grant
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
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<OrganizationDocument> {
		return await super.softRecover(id, ...options);
	}
}
