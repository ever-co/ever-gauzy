import { Controller, Get, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../catalog.permissions';
import { ProductRelationType } from '../catalog.types';
import { ProductRelation } from './product-relation.entity';
import { ProductRelationService } from './product-relation.service';

@ApiTags('ProductRelation')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
@Controller('/product-relations')
export class ProductRelationController extends CrudController<ProductRelation> {
	constructor(private readonly productRelationService: ProductRelationService) {
		super(productRelationService);
	}

	/**
	 * Read the relations declared from one product, which is the direction a product page renders.
	 */
	@ApiOperation({ summary: 'List the relations declared from a product' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Relations found', type: ProductRelation })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Get('by-product/:productId')
	async findFrom(
		@Param('productId', UUIDValidationPipe) productId: string,
		@Query('type') type?: ProductRelationType
	): Promise<ProductRelation[]> {
		return this.productRelationService.findFrom(productId, type);
	}
}
