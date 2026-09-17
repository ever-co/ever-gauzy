import { Body, Controller, Get, HttpStatus, Param, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import { CrudController, PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { CATALOG_PERMISSION_VALUES, catalogPermission } from '../catalog.permissions';
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
