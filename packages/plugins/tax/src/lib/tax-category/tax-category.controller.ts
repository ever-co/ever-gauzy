import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { TAX_PERMISSION_VALUES, taxPermission } from '../tax.permissions';
import { TaxCategory } from './tax-category.entity';
import { TaxCategoryService } from './tax-category.service';

/**
 * The tax category resource.
 *
 * The routes are the platform's CRUD surface for the entity — list, count, pagination, detail, create,
 * update, delete, soft delete and recover — and the guards are the same two every other resource uses,
 * so a caller's role permissions decide the same way here as everywhere else.
 */
@ApiTags('TaxCategory')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(taxPermission(TAX_PERMISSION_VALUES.TAX_CATEGORIES_VIEW))
@Controller('/tax-categories')
export class TaxCategoryController extends CrudController<TaxCategory> {
	constructor(private readonly taxCategoryService: TaxCategoryService) {
		super(taxCategoryService);
	}
}
