import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
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
import { ShippingOption } from './shipping-option.entity';
import { IShippingEligibilityContext, ShippingOptionService } from './shipping-option.service';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';
import { CreateShippingOptionDTO } from './dto';

/**
 * The shipping-option resource.
 *
 * Eligibility and pricing are read through this controller rather than at checkout only: a storefront
 * asks which deliveries it may offer before it renders a choice, and the answer must be the same one
 * checkout will give.
 */
@ApiTags('ShippingOption')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_VIEW)
@Controller('/shipping-options')
export class ShippingOptionController extends CrudController<ShippingOption> {
	constructor(private readonly shippingOptionService: ShippingOptionService) {
		super(shippingOptionService);
	}

	/**
	 * Creates a shipping option.
	 *
	 * @param entity The option to create.
	 * @returns The created option.
	 */
	@ApiOperation({ summary: 'Create a shipping option' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Shipping option created' })
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_CREATE)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateShippingOptionDTO): Promise<ShippingOption> {
		return this.shippingOptionService.create(entity as any);
	}

	/**
	 * The options a cart context may choose between, each with the reason it is or is not available.
	 *
	 * @param context What the cart looks like.
	 * @returns The options, ordered by priority.
	 */
	@ApiOperation({ summary: 'List the shipping options available to a cart' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Eligible options' })
	@Post('eligible')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async eligible(@Body() context: IShippingEligibilityContext) {
		return this.shippingOptionService.findEligible(context ?? {});
	}

	/**
	 * Prices one option for a cart context.
	 *
	 * @param body The option and the context.
	 * @returns The amount, or the strategy that must be called to obtain it.
	 */
	@ApiOperation({ summary: 'Calculate the price of one shipping option' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Calculated price' })
	@Post('calculate')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async calculate(@Body() body: { shippingOptionId: string } & IShippingEligibilityContext) {
		return this.shippingOptionService.calculate(body.shippingOptionId, body ?? {});
	}

	/**
	 * Lists the options of the caller's organization.
	 *
	 * @param options The query options.
	 * @returns A page of options.
	 */
	@ApiOperation({ summary: 'List shipping options' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Shipping options found' })
	@Get()
	@UseValidationPipe()
	async findAll(@Query() options: BaseQueryDTO<ShippingOption>): Promise<IPagination<ShippingOption>> {
		return this.shippingOptionService.findAll(options);
	}

	/**
	 * Reads one option.
	 *
	 * @param id The option.
	 * @returns The option.
	 */
	@ApiOperation({ summary: 'Find a shipping option by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Shipping option found' })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: string): Promise<ShippingOption> {
		return this.shippingOptionService.findOneByIdString(id);
	}
}
