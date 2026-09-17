import { Body, Controller, Get, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import {
	CrudController,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../catalog.permissions';
import { ProductRelationType } from '../catalog.types';
import { CreateProductRelationDTO, UpdateProductRelationDTO } from './dto';
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
	 * Creates one relation a product declares to another.
	 *
	 * Declared rather than inherited: a request body is validated from the type the handler names, and the
	 * base class names the entity's shape, whose reflected type is `Object` — a parameter the validation
	 * pipe skips. The DTO is what makes the body validated and the route documented.
	 */
	@ApiOperation({ summary: 'Create a product relation' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The relation was created', type: ProductRelation })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateProductRelationDTO): Promise<ProductRelation> {
		return this.productRelationService.create(entity as any);
	}

	/**
	 * Updates one relation, which is how its type, rank or window is corrected.
	 */
	@ApiOperation({ summary: 'Update a product relation' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The relation was updated', type: ProductRelation })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateProductRelationDTO
	): Promise<ProductRelation> {
		return this.productRelationService.update(id, entity as any);
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
