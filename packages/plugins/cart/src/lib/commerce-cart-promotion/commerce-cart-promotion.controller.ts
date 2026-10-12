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

	/**
	 * Deletes an applied cart promotion.
	 *
	 * This route is `CrudController.delete()`'s, re-declared here only to state the grant it requires.
	 * The base declares it with no permission metadata at all, so `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that empty metadata
	 * — its `isEmpty(permissions)` return — and the inherited route otherwise stood on the class-level
	 * `CARTS_VIEW` alone. Removing an applied promotion is a `CARTS_EDIT` action, the same grant the
	 * `removeCartPromotion` mutation states.
	 *
	 * @param id The applied promotion.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete an applied cart promotion' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The cart promotion was deleted' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft-deletes an applied cart promotion.
	 *
	 * This route is `CrudController.softRemove()`'s, re-declared here only to state the grant it
	 * requires. The base declares it with no permission metadata at all, so `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that empty metadata
	 * — its `isEmpty(permissions)` return — and the inherited route otherwise stood on the class-level
	 * `CARTS_VIEW` alone. Soft-deleting an applied promotion archives the row a restore puts back, and
	 * it states the same `CARTS_EDIT` grant the `removeCartPromotion` mutation does.
	 *
	 * @param id The applied promotion.
	 * @returns The soft-deleted cart promotion.
	 */
	@ApiOperation({ summary: 'Soft delete an applied cart promotion' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The cart promotion was soft deleted' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted cart promotion.
	 *
	 * This route is `CrudController.softRecover()`'s, re-declared here only to state the grant it
	 * requires. The base declares it with no permission metadata at all, so `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that empty metadata
	 * — its `isEmpty(permissions)` return — and the inherited route otherwise stood on the class-level
	 * `CARTS_VIEW` alone. Restoring an applied promotion undoes a removal, so it states the same
	 * `CARTS_EDIT` grant the `removeCartPromotion` mutation does.
	 *
	 * @param id The applied promotion.
	 * @returns The restored cart promotion.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted cart promotion' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The cart promotion was restored' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
