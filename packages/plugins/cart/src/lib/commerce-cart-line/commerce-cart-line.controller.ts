import { Body, Controller, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import {
	CrudController,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { CommerceCartLine } from './commerce-cart-line.entity';
import { CommerceCartLineService } from './commerce-cart-line.service';
import { CART_PERMISSIONS } from '../cart.permissions';
import { CreateCommerceCartLineDTO, UpdateCommerceCartLineDTO } from './dto';

/**
 * The cart-line resource.
 *
 * A line is a child of its cart, so the add, change and remove routes are additionally reachable one
 * level deep from the cart itself; this controller is where a line is addressed by its own id.
 */
@ApiTags('CartLine')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(CART_PERMISSIONS.CARTS_VIEW)
@Controller('/cart-lines')
export class CommerceCartLineController extends CrudController<CommerceCartLine> {
	constructor(private readonly commerceCartLineService: CommerceCartLineService) {
		super(commerceCartLineService);
	}

	/**
	 * Creates a cart line.
	 *
	 * The write routes are declared here rather than inherited, because a request body is validated
	 * from the *type* the handler names: the base class takes the entity's shape as a generic, whose
	 * reflected type is `Object`, and Nest's validation pipe skips a parameter it cannot name a class
	 * for. An inherited `create` therefore accepts any body at all — an unknown enumeration member, a
	 * missing required field, a property the resource does not have. Declaring the DTO is what makes
	 * the request validated, and it is also what gives the route a documented body.
	 */
	@ApiOperation({ summary: 'Create a cart line' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The cart line was created', type: CommerceCartLine })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCommerceCartLineDTO): Promise<CommerceCartLine> {
		return this.commerceCartLineService.create(entity as any);
	}

	/**
	 * Updates a cart line.
	 *
	 * The return type is the base class's own: the inherited service answers `update` with the ORM's
	 * update result as readily as with the row, so narrowing it to the entity would be untrue.
	 */
	@ApiOperation({ summary: 'Update a cart line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The cart line was updated', type: CommerceCartLine })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateCommerceCartLineDTO
	): Promise<any> {
		return this.commerceCartLineService.update(id, entity as any);
	}
}
