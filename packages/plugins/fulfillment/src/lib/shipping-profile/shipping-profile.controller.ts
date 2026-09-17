import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { ShippingProfile } from './shipping-profile.entity';
import { ShippingProfileService } from './shipping-profile.service';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';
import { CreateShippingProfileDTO } from './dto';

/**
 * The shipping-profile resource.
 *
 * The variant attachment is a route on this controller rather than a resource of its own: attaching a
 * variant to a profile is an edit of the profile's membership, and a caller that could address the pivot
 * directly could put a variant in two profiles without passing the rule that prevents it.
 */
@ApiTags('ShippingProfile')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_VIEW)
@Controller('/shipping-profiles')
export class ShippingProfileController extends CrudController<ShippingProfile> {
	constructor(private readonly shippingProfileService: ShippingProfileService) {
		super(shippingProfileService);
	}

	/**
	 * Creates a profile.
	 *
	 * @param entity The profile to create.
	 * @returns The created profile.
	 */
	@ApiOperation({ summary: 'Create a shipping profile' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Shipping profile created' })
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_CREATE)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateShippingProfileDTO): Promise<ShippingProfile> {
		return this.shippingProfileService.create(entity as any);
	}

	/**
	 * Attaches and detaches variants.
	 *
	 * @param id The profile.
	 * @param body The variants to add and to remove.
	 * @returns The attachments that exist after the change.
	 */
	@ApiOperation({ summary: 'Assign variants to a shipping profile' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Variants assigned' })
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_EDIT)
	@Put(':id/variants')
	@UseValidationPipe({ transform: true, whitelist: true })
	async assignVariants(@Param('id', UUIDValidationPipe) id: string, @Body() body: { add?: string[]; remove?: string[] }) {
		return this.shippingProfileService.assignVariants(id, body ?? {});
	}

	/**
	 * Lists the profiles of the caller's organization.
	 *
	 * @param options The query options.
	 * @returns A page of profiles.
	 */
	@ApiOperation({ summary: 'List shipping profiles' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Shipping profiles found' })
	@Get()
	@UseValidationPipe()
	async findAll(@Query() options: BaseQueryDTO<ShippingProfile>): Promise<IPagination<ShippingProfile>> {
		return this.shippingProfileService.findAll(options);
	}

	/**
	 * Reads one profile with its variants.
	 *
	 * @param id The profile.
	 * @returns The profile.
	 */
	@ApiOperation({ summary: 'Find a shipping profile by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Shipping profile found' })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: string): Promise<ShippingProfile> {
		return this.shippingProfileService.findOneByIdString(id, { relations: ['variants'] });
	}

	/**
	 * The profile a variant ships under, which is its own attachment or the organization's default.
	 *
	 * @param variantId The variant.
	 * @returns The profile, or null when the organization has neither.
	 */
	@ApiOperation({ summary: 'Resolve the shipping profile of a variant' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Resolved profile' })
	@Get('resolve/:variantId')
	async resolve(@Param('variantId', UUIDValidationPipe) variantId: string): Promise<ShippingProfile | null> {
		return this.shippingProfileService.resolveForVariant(variantId);
	}

	/**
	 * Marks a profile as the default, which demotes whichever profile held it.
	 *
	 * @param id The profile.
	 * @returns The profile.
	 */
	@ApiOperation({ summary: 'Set a shipping profile as the default' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Default profile set' })
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_EDIT)
	@Post(':id/set-default')
	@HttpCode(HttpStatus.OK)
	async setDefault(@Param('id', UUIDValidationPipe) id: string): Promise<ShippingProfile> {
		await this.shippingProfileService.update(id, { isDefault: true } as any);

		return this.shippingProfileService.findOneByIdString(id);
	}
}
