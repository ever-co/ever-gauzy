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
import { CommerceCartPromotion } from './commerce-cart-promotion.entity';
import { CommerceCartPromotionService } from './commerce-cart-promotion.service';
import { CART_PERMISSIONS } from '../cart.permissions';
import { CreateCommerceCartPromotionDTO, UpdateCommerceCartPromotionDTO } from './dto';

/**
 * The applied-promotion resource.
 *
 * Applying and removing a promotion are cart-level operations and live on the cart; this controller
 * exposes the snapshot rows a caller may read to explain a basket's discount.
 */
@ApiTags('CartPromotion')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(CART_PERMISSIONS.CARTS_VIEW)
@Controller('/cart-promotions')
export class CommerceCartPromotionController extends CrudController<CommerceCartPromotion> {
	constructor(private readonly commerceCartPromotionService: CommerceCartPromotionService) {
		super(commerceCartPromotionService);
	}

	/**
	 * Creates an applied promotion.
	 *
	 * The write routes are declared here rather than inherited, because a request body is validated
	 * from the *type* the handler names: the base class takes the entity's shape as a generic, whose
	 * reflected type is `Object`, and Nest's validation pipe skips a parameter it cannot name a class
	 * for. An inherited `create` therefore accepts any body at all — an unknown enumeration member, a
	 * missing required field, a property the resource does not have. Declaring the DTO is what makes
	 * the request validated, and it is also what gives the route a documented body.
	 */
	@ApiOperation({ summary: 'Create an applied cart promotion' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The cart promotion was created',
		type: CommerceCartPromotion
	})
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCommerceCartPromotionDTO): Promise<CommerceCartPromotion> {
		return this.commerceCartPromotionService.create(entity as any);
	}

	/**
	 * Updates an applied promotion.
	 *
	 * The return type is the base class's own: the inherited service answers `update` with the ORM's
	 * update result as readily as with the row, so narrowing it to the entity would be untrue.
	 */
	@ApiOperation({ summary: 'Update an applied cart promotion' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The cart promotion was updated',
		type: CommerceCartPromotion
	})
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateCommerceCartPromotionDTO
	): Promise<any> {
		return this.commerceCartPromotionService.update(id, entity as any);
	}
}
