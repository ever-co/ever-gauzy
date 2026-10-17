import {
	Body,
	Controller,
	Delete,
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
import { ID, IPagination } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	CrudController,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe,
	Versioned,
	versionExpectationOf
} from '@gauzy/core';
import { CommerceCartShippingMethod } from './commerce-cart-shipping-method.entity';
import { CommerceCartShippingMethodService } from './commerce-cart-shipping-method.service';
import { CommerceCartService } from '../commerce-cart/commerce-cart.service';
import { cartOfBody } from '../commerce-cart/cart-of-body';
import { CART_PERMISSIONS } from '../cart.permissions';
import { CreateCommerceCartShippingMethodDTO, UpdateCommerceCartShippingMethodDTO } from './dto';

/**
 * The cart delivery-choice resource.
 *
 * The set-and-replace route lives on the cart, because replacing a delivery choice is a cart-level
 * operation; this controller addresses one method by its own id.
 */
@ApiTags('CartShippingMethod')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(CART_PERMISSIONS.CARTS_VIEW)
@Controller('/cart-shipping-methods')
export class CommerceCartShippingMethodController extends CrudController<CommerceCartShippingMethod> {
	constructor(
		private readonly commerceCartShippingMethodService: CommerceCartShippingMethodService,
		private readonly commerceCartService: CommerceCartService
	) {
		super(commerceCartShippingMethodService);
	}

	/**
	 * Creates a cart delivery choice.
	 *
	 * The write routes are declared here rather than inherited, because a request body is validated
	 * from the *type* the handler names: the base class takes the entity's shape as a generic, whose
	 * reflected type is `Object`, and Nest's validation pipe skips a parameter it cannot name a class
	 * for. An inherited `create` therefore accepts any body at all — an unknown enumeration member, a
	 * missing required field, a property the resource does not have. Declaring the DTO is what makes
	 * the request validated, and it is also what gives the route a documented body.
	 *
	 * **The choice is set by the cart (R2-G25).** This route used to hand the body to the delivery
	 * choice's own `CrudService.create`, so it wrote a row the cart had not agreed to: on a COMPLETED,
	 * MERGED or EXPIRED cart, naming another tenant's option, with no version and no re-pricing — and
	 * beside the choice already there, so the next recalculation summed a stale and a current delivery
	 * into `shippingSubtotal`. The `setCartShippingMethod` mutation and `POST /carts/:id/shipping-methods`
	 * both go through `CommerceCartService.setShippingMethod`, which refuses all of that and retires the
	 * previous choice; this route now does the same, under the same cart version (the `If-Match` header
	 * states the version of the cart the body's `cartId` names, as on the nested route). The answer is
	 * still the delivery choice: the one the cart now holds.
	 *
	 * @param entity The chosen method, naming its cart.
	 * @param request The request, which carries the version the caller read the cart at.
	 * @returns The delivery choice the cart now holds.
	 */
	@ApiOperation({ summary: 'Create a cart shipping method' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The cart shipping method was created',
		type: CommerceCartShippingMethod
	})
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Versioned({ resource: CommerceCartService, identify: cartOfBody })
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(
		@Body() entity: CreateCommerceCartShippingMethodDTO,
		@Req() request?: Request
	): Promise<CommerceCartShippingMethod> {
		await this.commerceCartService.setShippingMethod(entity.cartId, entity as any, versionExpectationOf(request));

		const { items } = (await this.commerceCartShippingMethodService.findAll({
			where: { cartId: entity.cartId }
		})) as IPagination<CommerceCartShippingMethod>;

		// `setShippingMethod` retires every earlier choice before it writes this one, so the cart's one live
		// row is the answer; the newest is taken should a concurrent choice have landed in between.
		return (items ?? []).reduce<CommerceCartShippingMethod | undefined>(
			(found, method) =>
				!found || new Date(method.createdAt ?? 0).getTime() >= new Date(found.createdAt ?? 0).getTime()
					? method
					: found,
			undefined
		);
	}

	/**
	 * Updates a cart delivery choice.
	 *
	 * The return type is the base class's own: the inherited service answers `update` with the ORM's
	 * update result as readily as with the row, so narrowing it to the entity would be untrue.
	 */
	@ApiOperation({ summary: 'Update a cart shipping method' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The cart shipping method was updated',
		type: CommerceCartShippingMethod
	})
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateCommerceCartShippingMethodDTO
	): Promise<any> {
		return this.commerceCartShippingMethodService.update(id, entity as any);
	}

	/**
	 * Deletes a cart shipping method.
	 *
	 * This route is `CrudController.delete()`'s, re-declared here only to state the grant it requires.
	 * The base declares it with no permission metadata at all, so `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that empty metadata
	 * — its `isEmpty(permissions)` return — and the inherited route otherwise stood on the class-level
	 * `CARTS_VIEW` alone. Removing a delivery choice is a `CARTS_EDIT` action, the same grant the
	 * `removeCartShippingMethod` mutation states.
	 *
	 * @param id The cart shipping method.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete a cart shipping method' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The cart shipping method was deleted' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft-deletes a cart shipping method.
	 *
	 * This route is `CrudController.softRemove()`'s, re-declared here only to state the grant it
	 * requires. The base declares it with no permission metadata at all, so `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that empty metadata
	 * — its `isEmpty(permissions)` return — and the inherited route otherwise stood on the class-level
	 * `CARTS_VIEW` alone. Soft-deleting a delivery choice archives the row a restore puts back, and it
	 * states the same `CARTS_EDIT` grant the `removeCartShippingMethod` mutation does.
	 *
	 * @param id The cart shipping method.
	 * @returns The soft-deleted cart shipping method.
	 */
	@ApiOperation({ summary: 'Soft delete a cart shipping method' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The cart shipping method was soft deleted' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted cart shipping method.
	 *
	 * This route is `CrudController.softRecover()`'s, re-declared here only to state the grant it
	 * requires. The base declares it with no permission metadata at all, so `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that empty metadata
	 * — its `isEmpty(permissions)` return — and the inherited route otherwise stood on the class-level
	 * `CARTS_VIEW` alone. Restoring a delivery choice undoes a removal, so it states the same
	 * `CARTS_EDIT` grant the `removeCartShippingMethod` mutation does.
	 *
	 * @param id The cart shipping method.
	 * @returns The restored cart shipping method.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted cart shipping method' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The cart shipping method was restored' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
