import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, UseGuards, HttpStatus, Get, Query, Delete, HttpCode, Param, Put, UsePipes } from '@nestjs/common';
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
