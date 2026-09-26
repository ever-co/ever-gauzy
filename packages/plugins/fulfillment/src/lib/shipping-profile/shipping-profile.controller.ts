import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	BaseQueryDTO,
	CrudController,
	Idempotent,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { ShippingProfile } from './shipping-profile.entity';
import { ShippingProfileService } from './shipping-profile.service';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';
import { CreateShippingProfileDTO, UpdateShippingProfileDTO } from './dto';

/**
 * The shipping-profile resource.
 *
 * The variant attachment is a route on this controller rather than a resource of its own: attaching a
 * variant to a profile is an edit of the profile's membership, and a caller that could address the pivot
 * directly could put a variant in two profiles without passing the rule that prevents it.
 *
 * Creating a profile honours the platform's retry convention when a key is presented, so a retried
 * create is answered with the profile the first attempt wrote rather than with a refusal for a code that
 * is already taken. Marking a profile as the default is not decorated: it is idempotent by construction
 * — setting the same profile as the default twice leaves one default — and a key would add nothing.
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
	@Idempotent({ scope: 'shipping_profile.create', required: false, resourceType: 'shipping_profile' })
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateShippingProfileDTO): Promise<ShippingProfile> {
		return this.shippingProfileService.create(entity as any);
	}

	/**
	 * Changes a profile: its code, its carrier, its zones or its default flag.
	 *
	 * The route is declared here rather than inherited: a body is validated from the type the handler
	 * names, and the base class names the entity's shape as a generic, whose reflected type is
	 * `Object` — a parameter the validation pipe cannot name a class for is skipped, so an inherited
	 * route accepts any body at all and writes it. The service keeps the two invariants of an edit —
	 * a code that is still free and one default profile per organization.
	 *
	 * @param id The profile to change.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update a shipping profile' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Shipping profile updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Shipping profile not found' })
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateShippingProfileDTO) {
		return this.shippingProfileService.update(id, entity as any);
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

	/**
	 * Deletes a shipping profile.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission: the
	 * base declares it with no permission metadata at all, and `PermissionGuard`
	 * (`shared/guards/permission.guard.ts`) returns `true` to empty metadata — `if (isEmpty(permissions))
	 * { return true; }` — so an inherited handler stands on the class-level view grant alone. The
	 * plugin's own `deleteShippingProfile` mutation demands `SHIPPING_OPTIONS_DELETE` — a profile is
	 * shipping configuration, not a resource with a grant of its own — so REST states the same grant.
	 *
	 * @param id The profile.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a shipping profile' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Shipping profile deleted' })
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_DELETE)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft-deletes a shipping profile.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission: the
	 * base declares it with no permission metadata at all, and `PermissionGuard`
	 * (`shared/guards/permission.guard.ts`) returns `true` to empty metadata — `if (isEmpty(permissions))
	 * { return true; }` — so an inherited handler stands on the class-level view grant alone. A withdrawn
	 * profile is deleted as far as a variant is concerned, so it states `SHIPPING_OPTIONS_DELETE` too.
	 *
	 * @param id The profile.
	 * @returns The soft-deleted profile.
	 */
	@ApiOperation({ summary: 'Soft delete a shipping profile' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Shipping profile soft deleted' })
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_DELETE)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted shipping profile.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission: the
	 * base declares it with no permission metadata at all, and `PermissionGuard`
	 * (`shared/guards/permission.guard.ts`) returns `true` to empty metadata — `if (isEmpty(permissions))
	 * { return true; }` — so an inherited handler stands on the class-level view grant alone. Restoring
	 * hands the profile back to the variants that ship under it, so it states
	 * `SHIPPING_OPTIONS_DELETE` as well.
	 *
	 * @param id The profile.
	 * @returns The restored profile.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted shipping profile' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Shipping profile restored' })
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_DELETE)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
