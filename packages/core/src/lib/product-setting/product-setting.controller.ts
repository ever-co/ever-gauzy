import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud';
import { Body, Controller, UseGuards, Delete, HttpCode, HttpStatus, Param, Post, Put, UsePipes } from '@nestjs/common';
import { ProductVariantSetting } from './product-setting.entity';
import { ProductVariantSettingService } from './product-setting.service';
import { TenantPermissionGuard, PermissionGuard } from '../shared/guards';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { AbstractValidationPipe, UUIDValidationPipe } from '../shared/pipes';
import { TenantOrganizationBaseDTO } from '../core/dto';
import { DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

@ApiTags('ProductVariantSetting')
@UseGuards(TenantPermissionGuard)
@Controller('/product-variant-settings')
export class ProductVariantSettingController extends CrudController<ProductVariantSetting> {
	constructor(readonly productVariantSettingService: ProductVariantSettingService) {
		super(productVariantSettingService);
	}

	/**
	 * Creates the settings of a product variant.
	 *
	 * Overrides the inherited `CrudController.create()` route only to attach a permission. The base declares the
	 * route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of
	 * the tenant could write the inventory. It now states `ORG_INVENTORY_PRODUCT_EDIT`: the inventory edit grant
	 * the product routes state (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
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
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Post()
	async create(
		@Body() entity: DeepPartial<ProductVariantSetting>,
		...options: any[]
	): Promise<ProductVariantSetting> {
		return await super.create(entity, ...options);
	}

	/**
	 * Updates the settings of a product variant.
	 *
	 * Overrides the inherited `CrudController.update()` route only to attach a permission, for the reason `create`
	 * gives: `ORG_INVENTORY_PRODUCT_EDIT` (GHSA-v79w-54p2-wmh5). The base route still strips the members a body
	 * never writes.
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
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<ProductVariantSetting>,
		...options: any[]
	): Promise<any> {
		return await super.update(id, entity, ...options);
	}

	/**
	 * Deletes the settings of a product variant.
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach a permission, for the reason `create`
	 * gives: `ORG_INVENTORY_PRODUCT_EDIT` (GHSA-v79w-54p2-wmh5).
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
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.delete(id, ...options);
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
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<ProductVariantSetting> {
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
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<ProductVariantSetting> {
		return await super.softRecover(id, ...options);
	}
}
