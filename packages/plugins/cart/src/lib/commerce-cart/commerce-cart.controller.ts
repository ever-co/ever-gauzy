import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommerceCartValidationMode, ICommerceCart } from '@gauzy/contracts';
import {
	CrudController,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { CommerceCart } from './commerce-cart.entity';
import { CommerceCartService } from './commerce-cart.service';
import { CART_PERMISSIONS } from '../cart.permissions';
import { CreateCommerceCartLineDTO } from '../commerce-cart-line/dto';
import { CreateCommerceCartShippingMethodDTO } from '../commerce-cart-shipping-method/dto';
import { CreateCommerceCartPromotionDTO } from '../commerce-cart-promotion/dto';
import { CreateCommerceCartDTO, UpdateCommerceCartDTO } from './dto';

/**
 * The cart resource, and the one place a checkout is started.
 *
 * There is one API surface: this controller serves a staff caller and a buyer alike, and what each may
 * do is decided by the guard and the permission on the route, never by a second base path. The
 * cart's child resources are handled by their own controllers and are additionally reachable one level
 * deep from their cart, which is the single nesting the path convention allows.
 */
@ApiTags('Cart')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(CART_PERMISSIONS.CARTS_VIEW)
@Controller('/carts')
export class CommerceCartController extends CrudController<CommerceCart> {
	constructor(private readonly commerceCartService: CommerceCartService) {
		super(commerceCartService);
	}

	/**
	 * Creates a cart.
	 *
	 * @param entity The cart to create.
	 * @returns The created cart, with its totals computed.
	 */
	@ApiOperation({ summary: 'Create a cart' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Cart created' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCommerceCartDTO): Promise<ICommerceCart> {
		return this.commerceCartService.create(entity);
	}

	/**
	 * Reads a cart with its lines, its delivery choices and its promotions.
	 *
	 * @param id The cart.
	 * @returns The cart.
	 */
	@ApiOperation({ summary: 'Find a cart by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Cart found' })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: string): Promise<ICommerceCart> {
		return this.commerceCartService.findOneWithContent(id);
	}

	/**
	 * Changes a cart's contact details, addresses or note.
	 *
	 * @param id The cart.
	 * @param entity The fields to change.
	 * @returns The cart.
	 */
	@ApiOperation({ summary: 'Update a cart' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Cart updated' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateCommerceCartDTO
	): Promise<ICommerceCart> {
		await this.commerceCartService.update(id, entity as any);

		return this.commerceCartService.recalculate(id, 'CART_UPDATED');
	}

	/**
	 * Recomputes a cart's prices, promotions and totals.
	 *
	 * @param id The cart.
	 * @returns The cart with its recomputed totals.
	 */
	@ApiOperation({ summary: 'Recalculate a cart' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Cart recalculated' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Post(':id/recalculate')
	@HttpCode(HttpStatus.OK)
	async recalculate(@Param('id', UUIDValidationPipe) id: string): Promise<ICommerceCart> {
		return this.commerceCartService.recalculate(id, 'MANUAL');
	}

	/**
	 * Runs the checkout validation ladder without side effects.
	 *
	 * @param id The cart.
	 * @returns The verdict.
	 */
	@ApiOperation({ summary: 'Validate a cart before checkout' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Validation report' })
	@Get(':id/validate')
	async validate(@Param('id', UUIDValidationPipe) id: string) {
		return this.commerceCartService.validate(id, CommerceCartValidationMode.STRICT);
	}

	/**
	 * Completes a cart and places the order it becomes.
	 *
	 * @param id The cart.
	 * @param body The checkout request.
	 * @returns The order's identity and the completed cart.
	 */
	@ApiOperation({ summary: 'Complete checkout and place the order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order placed' })
	@Permissions(CART_PERMISSIONS.CARTS_CHECKOUT)
	@Post(':id/complete')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async complete(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: { idempotencyKey?: string; paymentSessionId?: string }
	) {
		return this.commerceCartService.complete(id, body ?? {});
	}

	/**
	 * Marks a cart abandoned and makes it a notification target.
	 *
	 * @param id The cart.
	 * @returns The abandoned cart.
	 */
	@ApiOperation({ summary: 'Mark a cart abandoned' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Cart abandoned' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Post(':id/abandon')
	@HttpCode(HttpStatus.OK)
	async abandon(@Param('id', UUIDValidationPipe) id: string): Promise<ICommerceCart> {
		return this.commerceCartService.abandon(id);
	}

	/**
	 * Merges another cart into this one.
	 *
	 * @param id The cart that survives.
	 * @param body The cart to merge away.
	 * @returns The merged cart.
	 */
	@ApiOperation({ summary: 'Merge a cart into this one' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Carts merged' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Post(':id/merge')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async merge(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: { sourceCartId: string }
	): Promise<ICommerceCart> {
		return this.commerceCartService.merge(id, body.sourceCartId);
	}

	/**
	 * Adds a line to a cart.
	 *
	 * @param id The cart.
	 * @param entity The line.
	 * @returns The cart after the addition.
	 */
	@ApiOperation({ summary: 'Add a line to a cart' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Line added' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Post(':id/lines')
	@UseValidationPipe({ transform: true, whitelist: true })
	async addLine(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: CreateCommerceCartLineDTO
	): Promise<ICommerceCart> {
		return this.commerceCartService.addLine(id, entity as any);
	}

	/**
	 * Changes a line of a cart.
	 *
	 * @param id The cart.
	 * @param lineId The line.
	 * @param entity The fields to change.
	 * @returns The cart after the change.
	 */
	@ApiOperation({ summary: 'Change a line of a cart' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Line changed' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Put(':id/lines/:lineId')
	@UseValidationPipe({ transform: true, whitelist: true })
	async updateLine(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('lineId', UUIDValidationPipe) lineId: string,
		@Body() entity: Partial<CreateCommerceCartLineDTO>
	): Promise<ICommerceCart> {
		return this.commerceCartService.updateLine(id, lineId, entity as any);
	}

	/**
	 * Removes a line from a cart.
	 *
	 * @param id The cart.
	 * @param lineId The line.
	 * @returns The cart after the removal.
	 */
	@ApiOperation({ summary: 'Remove a line from a cart' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Line removed' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Post(':id/lines/:lineId/remove')
	@HttpCode(HttpStatus.OK)
	async removeLine(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('lineId', UUIDValidationPipe) lineId: string
	): Promise<ICommerceCart> {
		return this.commerceCartService.removeLine(id, lineId);
	}

	/**
	 * Sets the cart's delivery choice.
	 *
	 * @param id The cart.
	 * @param entity The chosen method.
	 * @returns The cart after the choice.
	 */
	@ApiOperation({ summary: 'Set the delivery choice of a cart' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Delivery choice set' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Post(':id/shipping-methods')
	@UseValidationPipe({ transform: true, whitelist: true })
	async setShippingMethod(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: CreateCommerceCartShippingMethodDTO
	): Promise<ICommerceCart> {
		return this.commerceCartService.setShippingMethod(id, entity as any);
	}

	/**
	 * Applies a promotion to the cart.
	 *
	 * @param id The cart.
	 * @param entity The applied promotion.
	 * @returns The cart after the application.
	 */
	@ApiOperation({ summary: 'Apply a promotion to a cart' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Promotion applied' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Post(':id/promotions')
	@UseValidationPipe({ transform: true, whitelist: true })
	async applyPromotion(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: CreateCommerceCartPromotionDTO
	): Promise<ICommerceCart> {
		return this.commerceCartService.applyPromotion(id, entity as any);
	}

	/**
	 * Removes an applied promotion from the cart.
	 *
	 * @param id The cart.
	 * @param code The promotion's code or id.
	 * @returns The cart after the removal.
	 */
	@ApiOperation({ summary: 'Remove an applied promotion' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Promotion removed' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Post(':id/promotions/:code/remove')
	@HttpCode(HttpStatus.OK)
	async removePromotion(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('code') code: string
	): Promise<ICommerceCart> {
		return this.commerceCartService.removePromotion(id, code);
	}
}
