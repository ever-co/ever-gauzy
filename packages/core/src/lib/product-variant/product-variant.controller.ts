import { Controller, HttpStatus, Post, Body, Get, HttpCode, Put, Param, UseGuards, Delete, UsePipes } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { ProductVariant } from './product-variant.entity';
import { ProductVariantService } from './product-variant.service';
import { ProductVariantCreateCommand, ProductVariantDeleteCommand } from './commands';
import { Product } from '../product/product.entity';
import { IPagination, IProductVariant, IVariantCreateInput, ID, PermissionsEnum } from '@gauzy/contracts';
import { TenantPermissionGuard, PermissionGuard } from './../shared/guards';
import { UUIDValidationPipe, AbstractValidationPipe } from './../shared/pipes';
import { Permissions } from '../shared/decorators';
import { TenantOrganizationBaseDTO } from '../core/dto';

@ApiTags('ProductVariant')
@UseGuards(TenantPermissionGuard)
@Controller('/product-variants')
export class ProductVariantController extends CrudController<ProductVariant> {
	constructor(
		private readonly productVariantService: ProductVariantService,
		private readonly commandBus: CommandBus
	) {
		super(productVariantService);
	}

	@ApiOperation({
		summary: 'Find all variants by product id'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found product variants',
		type: Product
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('product/:productId')
	async findAllVariantsByProduct(
		@Param('productId', UUIDValidationPipe) productId: string
	): Promise<IPagination<IProductVariant>> {
		return this.productVariantService.findAllVariantsByProductId(productId);
	}

	@ApiOperation({ summary: 'Create product variants' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'These records have been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('variants')
	async createProductVariants(@Body() entity: IVariantCreateInput): Promise<IProductVariant[]> {
		return await this.commandBus.execute(new ProductVariantCreateCommand(entity));
	}

	@ApiOperation({
		summary: 'Find all product variants'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found product variants',
		type: Product
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(): Promise<IPagination<IProductVariant>> {
		return this.productVariantService.findAllProductVariants();
	}

	@ApiOperation({
		summary: 'Find all product variants'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found product variants',
		type: Product
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: string): Promise<IProductVariant> {
		return this.productVariantService.findOneByIdString(id);
	}

	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() productVariant: ProductVariant
	): Promise<IProductVariant> {
		return this.productVariantService.updateVariant(productVariant);
	}

	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<DeleteResult> {
		return await this.commandBus.execute(new ProductVariantDeleteCommand(id));
	}

	@ApiOperation({ summary: 'Delete featured image' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete('/featured-image/:variantId')
	async deleteFeaturedImage(@Param('variantId', UUIDValidationPipe) variantId: string): Promise<IProductVariant> {
		return this.productVariantService.deleteFeaturedImage(variantId);
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could retire the row. It now states `ORG_INVENTORY_PRODUCT_EDIT`: the inventory edit grant the
	 * product routes state (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
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
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<ProductVariant> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could restore the row. It now states `ORG_INVENTORY_PRODUCT_EDIT`: the inventory edit grant
	 * the product routes state (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
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
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<ProductVariant> {
		return await super.softRecover(id, ...options);
	}
}
