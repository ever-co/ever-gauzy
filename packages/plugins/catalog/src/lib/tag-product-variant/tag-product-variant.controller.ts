import { Body, Controller, Get, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
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
import { CreateTagProductVariantDTO, UpdateTagProductVariantDTO } from './dto';
import { TagProductVariant } from './tag-product-variant.entity';
import { TagProductVariantService } from './tag-product-variant.service';

@ApiTags('ProductVariantFacet')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
@Controller('/product-variant-tags')
export class TagProductVariantController extends CrudController<TagProductVariant> {
	constructor(private readonly tagProductVariantService: TagProductVariantService) {
		super(tagProductVariantService);
	}

	/**
	 * Creates one facet row of a variant.
	 *
	 * Declared rather than inherited: a request body is validated from the type the handler names, and the
	 * base class names the entity's shape, whose reflected type is `Object` — a parameter the validation
	 * pipe skips. The DTO is what makes the body validated and the route documented.
	 */
	@ApiOperation({ summary: 'Create a facet row of a variant' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The facet row was created', type: TagProductVariant })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateTagProductVariantDTO): Promise<TagProductVariant> {
		return this.tagProductVariantService.create(entity as any);
	}

	/**
	 * Updates one facet row: its value, and its position among the variant's facets.
	 *
	 * The return is the platform's own: the service's `update` answers either the row or the result of a
	 * partial update, which is why the CRUD base declares `Promise<any>` on this route too.
	 */
	@ApiOperation({ summary: 'Update a facet row of a variant' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The facet row was updated', type: TagProductVariant })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateTagProductVariantDTO
	): Promise<any> {
		return this.tagProductVariantService.update(id, entity as any);
	}

	/**
	 * Read the facet values of one variant.
	 */
	@ApiOperation({ summary: 'List the facet values of a variant' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Facet rows found', type: TagProductVariant })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW))
	@Get('by-variant/:variantId')
	async findByVariant(@Param('variantId', UUIDValidationPipe) variantId: string): Promise<TagProductVariant[]> {
		return this.tagProductVariantService.findByVariant(variantId);
	}

	/**
	 * Replace the facet values of one variant.
	 */
	@ApiOperation({ summary: 'Replace the facet values of a variant' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Facet rows replaced', type: TagProductVariant })
	@Permissions(catalogPermission(CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT))
	@Put('by-variant/:variantId')
	async replaceTags(
		@Param('variantId', UUIDValidationPipe) variantId: string,
		@Body() body: { tagIds: ID[] }
	): Promise<TagProductVariant[]> {
		return this.tagProductVariantService.replaceTags(variantId, body.tagIds ?? []);
	}
}
