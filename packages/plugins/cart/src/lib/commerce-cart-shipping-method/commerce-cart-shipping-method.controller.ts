import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, UseGuards, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	CrudController,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { CommerceCartShippingMethod } from './commerce-cart-shipping-method.entity';
import { CommerceCartShippingMethodService } from './commerce-cart-shipping-method.service';
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
	constructor(private readonly commerceCartShippingMethodService: CommerceCartShippingMethodService) {
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
	 */
	@ApiOperation({ summary: 'Create a cart shipping method' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The cart shipping method was created',
		type: CommerceCartShippingMethod
	})
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCommerceCartShippingMethodDTO): Promise<CommerceCartShippingMethod> {
		return this.commerceCartShippingMethodService.create(entity as any);
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
