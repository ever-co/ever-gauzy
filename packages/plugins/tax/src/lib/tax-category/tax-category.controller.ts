import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, UseGuards, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	CrudController,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { TAX_PERMISSION_VALUES, taxPermission } from '../tax.permissions';
import { TaxWriteInput } from '../tax.types';
import { CreateTaxCategoryDTO, UpdateTaxCategoryDTO } from './dto';
import { TaxCategory } from './tax-category.entity';
import { TaxCategoryService } from './tax-category.service';

/**
 * The tax category resource.
 *
 * The class carries the reading permission, so the routes the platform's CRUD surface already provides
 * — list, count, pagination, detail and recover — are read-guarded without restating it, and each
 * authoring route below carries the editing permission instead. That is what makes the two permissions
 * the package declares both effective: a role that may read the catalogue of categories need not be
 * able to change it.
 *
 * There is one API surface: this controller. A caller outside the platform reaches the same routes with
 * a tenant API key and is constrained by the permissions of the role that key is bound to.
 */
@ApiTags('TaxCategory')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_CATEGORIES_VIEW))
@Controller('/tax-categories')
export class TaxCategoryController extends CrudController<TaxCategory> {
	constructor(private readonly taxCategoryService: TaxCategoryService) {
		super(taxCategoryService);
	}

	/**
	 * Create a tax category.
	 *
	 * @param entity The category to create.
	 * @returns The created category.
	 */
	@ApiOperation({ summary: 'Create a new tax category' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The tax category was created.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The code is missing or already taken.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_CATEGORIES_EDIT))
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateTaxCategoryDTO): Promise<TaxCategory> {
		return await this.taxCategoryService.create(entity as TaxWriteInput<TaxCategory>);
	}

	/**
	 * Update a tax category.
	 *
	 * @param id The category to update.
	 * @param entity The members to change.
	 * @returns The updated category.
	 */
	@ApiOperation({ summary: 'Update a tax category' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The tax category was updated.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax category in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_CATEGORIES_EDIT))
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateTaxCategoryDTO): Promise<TaxCategory> {
		return await this.taxCategoryService.update(id, entity as TaxWriteInput<TaxCategory>);
	}

	/**
	 * Retire a tax category.
	 *
	 * The row is kept rather than removed: the rates of the category are what already placed tax lines
	 * point at, and a hard delete would cascade into them.
	 *
	 * @param id The category to retire.
	 * @returns The delete result.
	 */
	@ApiOperation({ summary: 'Retire a tax category' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The tax category was retired.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax category in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_CATEGORIES_EDIT))
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return super.delete(id);
	}

	/**
	 * Soft delete a tax category.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that
	 * empty metadata with its `isEmpty(permissions)` return, which left the inherited handler standing on
	 * this controller's class-level read grant alone. It now states `TAX_CATEGORIES_EDIT`, the grant the
	 * plugin's `deleteTaxCategory` mutation carries, so both surfaces ask the same caller.
	 *
	 * @param id The category to soft delete.
	 * @returns The soft-deleted category.
	 */
	@ApiOperation({ summary: 'Soft delete a tax category' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The tax category was soft deleted.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax category in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_CATEGORIES_EDIT))
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restore a soft-deleted tax category.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that
	 * empty metadata with its `isEmpty(permissions)` return, which left the inherited handler standing on
	 * this controller's class-level read grant alone. It now states `TAX_CATEGORIES_EDIT` — restoring is the
	 * same grant exercised backwards, exactly as the delete route above states it.
	 *
	 * @param id The category to restore.
	 * @returns The restored category.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted tax category' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The tax category was restored.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such tax category in this organization.' })
	@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_CATEGORIES_EDIT))
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
