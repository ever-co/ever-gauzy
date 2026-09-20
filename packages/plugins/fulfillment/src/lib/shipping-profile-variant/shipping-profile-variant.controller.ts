import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, UseGuards, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	AbstractValidationPipe,
	CrudController,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
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

	/**
	 * Deletes a shipping profile variant.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission: the
	 * base declares it with no permission metadata at all, and `PermissionGuard`
	 * (`shared/guards/permission.guard.ts`) returns `true` to empty metadata — `if (isEmpty(permissions))
	 * { return true; }` — so an inherited handler stands on the class-level view grant alone. The
	 * attachment is a join row, and the profile whose variants it joins is deleted under
	 * `SHIPPING_OPTIONS_DELETE` (`deleteShippingProfile`, graphql/shipping-option.resolver.ts), so this
	 * states the grant the profile routes already use.
	 *
	 * @param id The attachment.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a shipping profile variant' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Shipping profile variant deleted' })
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_DELETE)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft-deletes a shipping profile variant.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission: the
	 * base declares it with no permission metadata at all, and `PermissionGuard`
	 * (`shared/guards/permission.guard.ts`) returns `true` to empty metadata — `if (isEmpty(permissions))
	 * { return true; }` — so an inherited handler stands on the class-level view grant alone. Detaching a
	 * variant changes which profile ships it, which the profile routes gate on
	 * `SHIPPING_OPTIONS_DELETE`, so it states that same grant.
	 *
	 * @param id The attachment.
	 * @returns The soft-deleted attachment.
	 */
	@ApiOperation({ summary: 'Soft delete a shipping profile variant' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Shipping profile variant soft deleted' })
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_DELETE)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted shipping profile variant.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission: the
	 * base declares it with no permission metadata at all, and `PermissionGuard`
	 * (`shared/guards/permission.guard.ts`) returns `true` to empty metadata — `if (isEmpty(permissions))
	 * { return true; }` — so an inherited handler stands on the class-level view grant alone. Restoring
	 * re-attaches the variant, which the profile routes gate on `SHIPPING_OPTIONS_DELETE` as well.
	 *
	 * @param id The attachment.
	 * @returns The restored attachment.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted shipping profile variant' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Shipping profile variant restored' })
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_DELETE)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
