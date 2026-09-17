import { Body, Controller, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	CrudController,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { ShippingProfileVariant } from './shipping-profile-variant.entity';
import { ShippingProfileVariantService } from './shipping-profile-variant.service';
import { CreateShippingProfileVariantDTO, UpdateShippingProfileVariantDTO } from './dto';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';

/**
 * The ShippingProfileVariant resource.
 *
 * One controller per entity, on the entity's own concept path, with the same guards and permissions the
 * rest of the platform uses. There is no second surface and no parallel controller for this resource.
 *
 * A variant is normally attached to its profile through the profile's own route, which is where the
 * rule that keeps a variant in one profile lives; the two write routes below are the repair surface for
 * an attachment recorded on its own, and they carry the shipping-option grants the profile routes use.
 * They are declared rather than inherited because a body is validated from the type the handler names —
 * the base class names the entity's shape as a generic, whose reflected type is `Object`, and a
 * parameter the validation pipe cannot name a class for is skipped, so an inherited route accepts any
 * body at all and writes it.
 */
@ApiTags('ShippingProfileVariant')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_VIEW)
@Controller('/shipping-profile-variants')
export class ShippingProfileVariantController extends CrudController<ShippingProfileVariant> {
	constructor(private readonly service: ShippingProfileVariantService) {
		super(service);
	}

	/**
	 * Attaches one variant to a profile.
	 *
	 * @param entity The attachment to record.
	 * @returns The created attachment.
	 */
	@ApiOperation({ summary: 'Create a shipping profile variant' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Shipping profile variant created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid attachment input' })
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_CREATE)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateShippingProfileVariantDTO): Promise<ShippingProfileVariant> {
		return this.service.create(entity as any);
	}

	/**
	 * Corrects one attachment.
	 *
	 * @param id The attachment.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update a shipping profile variant' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Shipping profile variant updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Shipping profile variant not found' })
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateShippingProfileVariantDTO) {
		return this.service.update(id, entity as any);
	}
}
