import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, Req, UseGuards, UsePipes } from '@nestjs/common';
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
import { CommerceCartLine } from './commerce-cart-line.entity';
import { CommerceCartLineService } from './commerce-cart-line.service';
import { CommerceCartService } from '../commerce-cart/commerce-cart.service';
import { cartOfBody } from '../commerce-cart/cart-of-body';
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
	constructor(
		private readonly commerceCartLineService: CommerceCartLineService,
		private readonly commerceCartService: CommerceCartService
	) {
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
	 *
	 * **The line is added by the cart (R2-G25).** This route used to hand the body to the line's own
	 * `CrudService.create`, so it wrote a row the cart had not agreed to: into a COMPLETED, MERGED or
	 * EXPIRED cart, past the stock the variant has, naming another tenant's variant or warehouse, with
	 * no version and no re-pricing — the cart's totals still described the cart without the line. The
	 * `addCartLine` mutation and `POST /carts/:id/lines` both go through `CommerceCartService.addLine`,
	 * which refuses every one of those; this route now does the same, under the same cart version (the
	 * `If-Match` header states the version of the cart the body's `cartId` names, as on the nested route).
	 * The answer is still the line: the row the addition created, or the existing line it merged into when
	 * the two describe the same purchase.
	 *
	 * @param entity The line to add, naming its cart.
	 * @param request The request, which carries the version the caller read the cart at.
	 * @returns The line the cart now holds for that purchase.
	 */
	@ApiOperation({ summary: 'Create a cart line' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The cart line was created', type: CommerceCartLine })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Versioned({ resource: CommerceCartService, identify: cartOfBody })
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCommerceCartLineDTO, @Req() request?: Request): Promise<CommerceCartLine> {
		await this.commerceCartService.addLine(entity.cartId, entity as any, versionExpectationOf(request));

		return this.lineFor(entity);
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

	/**
	 * Deletes a cart line.
	 *
	 * This route is `CrudController.delete()`'s, re-declared here only to state the grant it requires.
	 * The base declares it with no permission metadata at all, so `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that empty metadata
	 * — its `isEmpty(permissions)` return — and the inherited route otherwise stood on the class-level
	 * `CARTS_VIEW` alone. Removing a line is a `CARTS_EDIT` action, the same grant the `removeCartLine`
	 * mutation states.
	 *
	 * @param id The cart line.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete a cart line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The cart line was deleted' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft-deletes a cart line.
	 *
	 * This route is `CrudController.softRemove()`'s, re-declared here only to state the grant it
	 * requires. The base declares it with no permission metadata at all, so `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that empty metadata
	 * — its `isEmpty(permissions)` return — and the inherited route otherwise stood on the class-level
	 * `CARTS_VIEW` alone. Soft-deleting a line archives the row a restore puts back, and it states the
	 * same `CARTS_EDIT` grant the `removeCartLine` mutation does.
	 *
	 * @param id The cart line.
	 * @returns The soft-deleted cart line.
	 */
	@ApiOperation({ summary: 'Soft delete a cart line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The cart line was soft deleted' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted cart line.
	 *
	 * This route is `CrudController.softRecover()`'s, re-declared here only to state the grant it
	 * requires. The base declares it with no permission metadata at all, so `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that empty metadata
	 * — its `isEmpty(permissions)` return — and the inherited route otherwise stood on the class-level
	 * `CARTS_VIEW` alone. Restoring a line undoes a removal, so it states the same `CARTS_EDIT` grant
	 * the `removeCartLine` mutation does.
	 *
	 * @param id The cart line.
	 * @returns The restored cart line.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted cart line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The cart line was restored' })
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}

	/**
	 * The line the cart holds for the purchase a create described.
	 *
	 * `addLine` merges an addition into an existing line when the variant, warehouse, unit price, tax
	 * mode and plan all match, so the row to answer with is the one carrying those attributes — the newest
	 * of them, should two exist from before the merge rule. Any line of the cart is the fallback, which can
	 * only be reached if the cart re-priced the line between the write and this read.
	 *
	 * @param entity The created line's body.
	 * @returns The line.
	 */
	private async lineFor(entity: CreateCommerceCartLineDTO): Promise<CommerceCartLine> {
		const { items } = (await this.commerceCartLineService.findAll({
			where: { cartId: entity.cartId }
		})) as IPagination<CommerceCartLine>;
		const same = (items ?? []).filter(
			(line) =>
				line.variantId === entity.variantId &&
				(line.warehouseId ?? null) === (entity.warehouseId ?? null) &&
				(line.subscriptionPlanId ?? null) === (entity.subscriptionPlanId ?? null) &&
				Number(line.unitPrice) === Number(entity.unitPrice)
		);
		const newest = (rows: CommerceCartLine[]) =>
			rows.reduce<CommerceCartLine | undefined>(
				(found, line) =>
					!found || new Date(line.updatedAt ?? 0).getTime() >= new Date(found.updatedAt ?? 0).getTime()
						? line
						: found,
				undefined
			);

		return newest(same) ?? newest(items ?? []);
	}
}
