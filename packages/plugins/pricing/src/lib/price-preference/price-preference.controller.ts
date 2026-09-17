import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult, UpdateResult } from 'typeorm';
import { ID } from '@gauzy/contracts';
import {
	CrudController,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { PRICING_PERMISSION_VALUES, pricingPermission } from '../pricing.permissions';
import { PricePreference } from './price-preference.entity';
import { PricePreferenceService } from './price-preference.service';
import { CreatePricePreferenceDTO, UpdatePricePreferenceDTO } from './dto';

/**
 * Tax-inclusivity preferences.
 *
 * A preference is configuration rather than a resource with a lifecycle of its own, which is why it
 * is governed by the `PRODUCT_PRICES_*` permissions rather than by a pair of its own: the person who
 * prices a catalogue is the person who decides how its prices are presented.
 */
@ApiTags('PricePreference')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_VIEW))
@Controller('/price-preferences')
export class PricePreferenceController extends CrudController<PricePreference> {
	constructor(private readonly pricePreferenceService: PricePreferenceService) {
		super(pricePreferenceService);
	}

	/**
	 * Create a preference.
	 *
	 * @param entity The preference to create.
	 * @returns The created preference.
	 */
	@ApiOperation({ summary: 'Create a price preference' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The preference was created.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'That scope already has a preference.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT))
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreatePricePreferenceDTO): Promise<PricePreference> {
		return await this.pricePreferenceService.createOne(entity);
	}

	/**
	 * Update a preference.
	 *
	 * @param id The preference to update.
	 * @param entity The fields to change.
	 * @returns The updated preference.
	 */
	@ApiOperation({ summary: 'Update a price preference' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The preference was updated.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such preference in this organization.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT))
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdatePricePreferenceDTO
	): Promise<UpdateResult | PricePreference> {
		return await this.pricePreferenceService.updateOne(id, entity);
	}

	/**
	 * Delete a preference.
	 *
	 * @param id The preference to delete.
	 * @param force Whether the removal is a hard delete.
	 * @returns The delete result, or the soft-deleted preference.
	 */
	@ApiOperation({ summary: 'Delete a price preference' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The preference was deleted.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such preference in this organization.' })
	@Permissions(pricingPermission(PRICING_PERMISSION_VALUES.PRODUCT_PRICES_EDIT))
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('force') force?: string | boolean
	): Promise<DeleteResult | UpdateResult | PricePreference> {
		await this.pricePreferenceService.findOneByIdString(id);

		return force === true || force === 'true'
			? await this.pricePreferenceService.delete(id)
			: await this.pricePreferenceService.softDelete(id);
	}
}
