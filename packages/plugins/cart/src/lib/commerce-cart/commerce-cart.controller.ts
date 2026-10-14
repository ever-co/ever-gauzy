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
	Req,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CommerceCartValidationMode, ICommerceCart } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	CrudController,
	Idempotent,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe,
	Versioned,
	versionExpectationOf
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
 *
 * Two conventions are adopted on the mutating routes and are deliberately identical on the GraphQL
 * mutations that mirror them:
 *
 * - `@Idempotent(...)` makes a route safe to retry under a client-supplied key. Completing a checkout
 *   requires one, because a lost response to it costs a duplicate order; the remaining writes honour a
 *   key when one is presented and behave exactly as they always did when none is.
 * - `@Versioned({ resource: CommerceCartService })` refuses a write based on a cart that has moved on
 *   and publishes the cart's version as an `ETag`, which is the header the next write states back.
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
	 * A cart is created once per basket, so a retry that presents a key is answered from the record of
	 * the first attempt. No version is required of the caller — there is no cart to have read yet — and
	 * the created cart's version is published in the response for the writes that follow.
	 *
	 * @param entity The cart to create.
	 * @returns The created cart, with its totals computed.
	 */
	@ApiOperation({ summary: 'Create a cart' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Cart created' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Idempotent({ scope: 'cart.create', required: false, resourceType: 'cart' })
	@Versioned({ resource: CommerceCartService, required: false })
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
	 * @param request The request, which carries the version the caller read the cart at.
	 * @returns The cart.
	 */
	@ApiOperation({ summary: 'Update a cart' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Cart updated' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Versioned({ resource: CommerceCartService })
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateCommerceCartDTO,
		@Req() request: Request
	): Promise<ICommerceCart> {
		return this.commerceCartService.applyChanges(id, entity as any, versionExpectationOf(request));
	}

	/**
	 * Recomputes a cart's prices, promotions and totals.
	 *
	 * @param id The cart.
	 * @param request The request, which carries the version the caller read the cart at.
	 * @returns The cart with its recomputed totals.
	 */
	@ApiOperation({ summary: 'Recalculate a cart' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Cart recalculated' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Versioned({ resource: CommerceCartService })
	@Post(':id/recalculate')
	@HttpCode(HttpStatus.OK)
	async recalculate(@Param('id', UUIDValidationPipe) id: string, @Req() request: Request): Promise<ICommerceCart> {
		return this.commerceCartService.recalculate(id, 'MANUAL', versionExpectationOf(request));
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
	 * This is the route a lost response costs an order on: the order is placed by the handler the cart
	 * hands the request to, and a client that never saw the answer would place a second one by
	 * retrying. A key is therefore mandatory here rather than optional, and a retry that presents the
	 * key of the attempt that was lost is answered with the order that attempt placed.
	 *
	 * @param id The cart.
	 * @param body The checkout request.
	 * @param request The request, which carries the version the caller read the cart at.
	 * @returns The order's identity and the completed cart.
	 */
	@ApiOperation({ summary: 'Complete checkout and place the order' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Order placed' })
	@Permissions(CART_PERMISSIONS.CARTS_CHECKOUT)
	@Idempotent({ scope: 'checkout.complete', required: true, resourceType: 'order' })
	@Versioned({ resource: CommerceCartService })
	@Post(':id/complete')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async complete(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: { idempotencyKey?: string; paymentSessionId?: string },
		@Req() request: Request
	) {
		return this.commerceCartService.complete(id, body ?? {}, versionExpectationOf(request));
	}

	/**
	 * Marks a cart abandoned and makes it a notification target.
	 *
	 * @param id The cart.
	 * @param request The request, which carries the version the caller read the cart at.
	 * @returns The abandoned cart.
	 */
	@ApiOperation({ summary: 'Mark a cart abandoned' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Cart abandoned' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Versioned({ resource: CommerceCartService })
	@Post(':id/abandon')
	@HttpCode(HttpStatus.OK)
	async abandon(@Param('id', UUIDValidationPipe) id: string, @Req() request: Request): Promise<ICommerceCart> {
		return this.commerceCartService.abandon(id, versionExpectationOf(request));
	}

	/**
	 * Merges another cart into this one.
	 *
	 * @param id The cart that survives.
	 * @param body The cart to merge away.
	 * @param request The request, which carries the version the caller read the cart at.
	 * @returns The merged cart.
	 */
	@ApiOperation({ summary: 'Merge a cart into this one' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Carts merged' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Idempotent({ scope: 'cart.merge', required: false, resourceType: 'cart' })
	@Versioned({ resource: CommerceCartService })
	@Post(':id/merge')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async merge(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: { sourceCartId: string },
		@Req() request: Request
	): Promise<ICommerceCart> {
		return this.commerceCartService.merge(id, body.sourceCartId, versionExpectationOf(request));
	}

	/**
	 * Adds a line to a cart.
	 *
	 * @param id The cart.
	 * @param entity The line.
	 * @param request The request, which carries the version the caller read the cart at.
	 * @returns The cart after the addition.
	 */
	@ApiOperation({ summary: 'Add a line to a cart' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Line added' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Idempotent({ scope: 'cart.line.create', required: false, resourceType: 'cart_line' })
	@Versioned({ resource: CommerceCartService })
	@Post(':id/lines')
	@UseValidationPipe({ transform: true, whitelist: true })
	async addLine(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: CreateCommerceCartLineDTO,
		@Req() request: Request
	): Promise<ICommerceCart> {
		return this.commerceCartService.addLine(id, entity as any, versionExpectationOf(request));
	}

	/**
	 * Changes a line of a cart.
	 *
	 * @param id The cart.
	 * @param lineId The line.
	 * @param entity The fields to change.
	 * @param request The request, which carries the version the caller read the cart at.
	 * @returns The cart after the change.
	 */
	@ApiOperation({ summary: 'Change a line of a cart' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Line changed' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Versioned({ resource: CommerceCartService })
	@Put(':id/lines/:lineId')
	@UseValidationPipe({ transform: true, whitelist: true })
	async updateLine(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('lineId', UUIDValidationPipe) lineId: string,
		@Body() entity: Partial<CreateCommerceCartLineDTO>,
		@Req() request: Request
	): Promise<ICommerceCart> {
		return this.commerceCartService.updateLine(id, lineId, entity as any, versionExpectationOf(request));
	}

	/**
	 * Removes a line from a cart.
	 *
	 * @param id The cart.
	 * @param lineId The line.
	 * @param request The request, which carries the version the caller read the cart at.
	 * @returns The cart after the removal.
	 */
	@ApiOperation({ summary: 'Remove a line from a cart' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Line removed' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Versioned({ resource: CommerceCartService })
	@Post(':id/lines/:lineId/remove')
	@HttpCode(HttpStatus.OK)
	async removeLine(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('lineId', UUIDValidationPipe) lineId: string,
		@Req() request: Request
	): Promise<ICommerceCart> {
		return this.commerceCartService.removeLine(id, lineId, versionExpectationOf(request));
	}

	/**
	 * Sets the cart's delivery choice.
	 *
	 * @param id The cart.
	 * @param entity The chosen method.
	 * @param request The request, which carries the version the caller read the cart at.
	 * @returns The cart after the choice.
	 */
	@ApiOperation({ summary: 'Set the delivery choice of a cart' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Delivery choice set' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Idempotent({ scope: 'cart.shipping.set', required: false, resourceType: 'cart_shipping_method' })
	@Versioned({ resource: CommerceCartService })
	@Post(':id/shipping-methods')
	@UseValidationPipe({ transform: true, whitelist: true })
	async setShippingMethod(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: CreateCommerceCartShippingMethodDTO,
		@Req() request: Request
	): Promise<ICommerceCart> {
		return this.commerceCartService.setShippingMethod(id, entity as any, versionExpectationOf(request));
	}

	/**
	 * Applies a promotion to the cart.
	 *
	 * @param id The cart.
	 * @param entity The applied promotion.
	 * @param request The request, which carries the version the caller read the cart at.
	 * @returns The cart after the application.
	 */
	@ApiOperation({ summary: 'Apply a promotion to a cart' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Promotion applied' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Idempotent({ scope: 'cart.promotion.apply', required: false, resourceType: 'cart_promotion' })
	@Versioned({ resource: CommerceCartService })
	@Post(':id/promotions')
	@UseValidationPipe({ transform: true, whitelist: true })
	async applyPromotion(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: CreateCommerceCartPromotionDTO,
		@Req() request: Request
	): Promise<ICommerceCart> {
		return this.commerceCartService.applyPromotion(id, entity as any, versionExpectationOf(request));
	}

	/**
	 * Removes an applied promotion from the cart.
	 *
	 * @param id The cart.
	 * @param code The promotion's code or id.
	 * @param request The request, which carries the version the caller read the cart at.
	 * @returns The cart after the removal.
	 */
	@ApiOperation({ summary: 'Remove an applied promotion' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Promotion removed' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Versioned({ resource: CommerceCartService })
	@Post(':id/promotions/:code/remove')
	@HttpCode(HttpStatus.OK)
	async removePromotion(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('code') code: string,
		@Req() request: Request
	): Promise<ICommerceCart> {
		return this.commerceCartService.removePromotion(id, code, versionExpectationOf(request));
	}

	/**
	 * Deletes a cart.
	 *
	 * This route is `CrudController.delete()`'s, re-declared here only to state the grant it requires.
	 * The base declares it with no permission metadata at all, so `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that empty metadata
	 * — its `isEmpty(permissions)` return — and the inherited route otherwise stood on the class-level
	 * `CARTS_VIEW` alone. Removing a cart is a `CARTS_DELETE` action, the same grant the `deleteCart`
	 * mutation states.
	 *
	 * @param id The cart.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete a cart' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Cart deleted' })
	@Permissions(CART_PERMISSIONS.CARTS_DELETE)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft-deletes a cart.
	 *
	 * This route is `CrudController.softRemove()`'s, re-declared here only to state the grant it
	 * requires. The base declares it with no permission metadata at all, so `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that empty metadata
	 * — its `isEmpty(permissions)` return — and the inherited route otherwise stood on the class-level
	 * `CARTS_VIEW` alone. Soft-deleting a cart archives the row a restore puts back, and it states the
	 * same `CARTS_DELETE` grant the `deleteCart` mutation does.
	 *
	 * @param id The cart.
	 * @returns The soft-deleted cart.
	 */
	@ApiOperation({ summary: 'Soft delete a cart' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Cart soft deleted' })
	@Permissions(CART_PERMISSIONS.CARTS_DELETE)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted cart.
	 *
	 * This route is `CrudController.softRecover()`'s, re-declared here only to state the grant it
	 * requires. The base declares it with no permission metadata at all, so `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that empty metadata
	 * — its `isEmpty(permissions)` return — and the inherited route otherwise stood on the class-level
	 * `CARTS_VIEW` alone. Restoring a cart undoes a deletion, so it states the same `CARTS_DELETE`
	 * grant the `deleteCart` mutation does.
	 *
	 * @param id The cart.
	 * @returns The restored cart.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted cart' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Cart restored' })
	@Permissions(CART_PERMISSIONS.CARTS_DELETE)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
