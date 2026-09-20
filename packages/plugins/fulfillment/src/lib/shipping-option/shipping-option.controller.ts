import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	Idempotent,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { ShippingOption } from './shipping-option.entity';
import { IShippingEligibilityContext, ShippingOptionService } from './shipping-option.service';
import { FULFILLMENT_PERMISSIONS } from '../fulfillment.permissions';
import { CreateShippingOptionDTO, UpdateShippingOptionDTO } from './dto';

/**
 * The shipping-option resource.
 *
 * Eligibility and pricing are read through this controller rather than at checkout only: a storefront
 * asks which deliveries it may offer before it renders a choice, and the answer must be the same one
 * checkout will give.
 *
 * Creating an option honours the platform's retry convention when a key is presented, which is what
 * makes a retried create answer with the option the first attempt wrote rather than with a refusal for
 * a code that is already taken. `eligible` and `calculate` are deliberately not decorated: they are
 * reads expressed as POSTs, and a key on a read cannot duplicate anything.
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
	@Idempotent({ scope: 'shipping_option.create', required: false, resourceType: 'shipping_option' })
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateShippingOptionDTO): Promise<ShippingOption> {
		return this.shippingOptionService.create(entity as any);
	}

	/**
	 * Changes an option: its price, its window, its zone or its priority.
	 *
	 * The route is declared here rather than inherited: a body is validated from the type the handler
	 * names, and the base class names the entity's shape as a generic, whose reflected type is
	 * `Object` — a parameter the validation pipe cannot name a class for is skipped, so an inherited
	 * route accepts any body at all and writes it. The service keeps the two invariants of an edit —
	 * the price shape its type allows and a code that is still free — and bumps the option's
	 * optimistic lock.
	 *
	 * @param id The option to change.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update a shipping option' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Shipping option updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Shipping option not found' })
	@Permissions(FULFILLMENT_PERMISSIONS.SHIPPING_OPTIONS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateShippingOptionDTO) {
		return this.shippingOptionService.update(id, entity as any);
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
