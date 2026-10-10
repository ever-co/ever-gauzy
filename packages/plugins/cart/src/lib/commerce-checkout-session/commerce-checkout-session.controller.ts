import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, UseGuards, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	CrudController,
	Idempotent,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { CommerceCheckoutSession } from './commerce-checkout-session.entity';
import { CommerceCheckoutSessionService } from './commerce-checkout-session.service';
import { CART_PERMISSIONS } from '../cart.permissions';
import { CreateCommerceCheckoutSessionDTO, UpdateCommerceCheckoutSessionDTO } from './dto';

/**
 * The checkout-session resource.
 *
 * A session is optional: a single-request checkout never creates one. When one exists it is the record
 * of how far a multi-step or externally hosted checkout got, and of the durable operation it started.
 *
 * The two write routes that a client is expected to retry — starting a session, and reporting that a
 * step completed — adopt `@Idempotent(...)`. A key is optional on both: the session's own uniqueness
 * rule already makes a second start return the open session, and a step that is reported twice
 * appends once, so a caller that presents no key is answered exactly as it was before.
 */
@ApiTags('CheckoutSession')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(CART_PERMISSIONS.CARTS_VIEW)
@Controller('/checkout-sessions')
export class CommerceCheckoutSessionController extends CrudController<CommerceCheckoutSession> {
	constructor(private readonly commerceCheckoutSessionService: CommerceCheckoutSessionService) {
		super(commerceCheckoutSessionService);
	}

	/**
	 * Starts a checkout session for a cart.
	 *
	 * At most one non-terminal session exists per cart: a second attempt while one is open is refused
	 * rather than allowed to race for the same lines.
	 *
	 * @param entity The session to start.
	 * @returns The created session, or the one already open.
	 */
	@ApiOperation({ summary: 'Start a checkout session' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Checkout session started' })
	@Permissions(CART_PERMISSIONS.CARTS_CHECKOUT)
	@Idempotent({ scope: 'checkout.session.create', required: false, resourceType: 'checkout_session' })
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCommerceCheckoutSessionDTO): Promise<CommerceCheckoutSession> {
		const open = await this.commerceCheckoutSessionService.findOpenForCart(entity.cartId);

		if (open) {
			return open;
		}

		return this.commerceCheckoutSessionService.create(entity as any);
	}

	/**
	 * Updates a checkout session.
	 *
	 * The write routes are declared here rather than inherited, because a request body is validated
	 * from the *type* the handler names: the base class takes the entity's shape as a generic, whose
	 * reflected type is `Object`, and Nest's validation pipe skips a parameter it cannot name a class
	 * for. An inherited `update` therefore accepts any body at all — an unknown enumeration member, a
	 * missing required field, a property the resource does not have. Declaring the DTO is what makes
	 * the request validated, and it is also what gives the route a documented body.
	 *
	 * The return type is the base class's own: the inherited service answers `update` with the ORM's
	 * update result as readily as with the row, so narrowing it to the entity would be untrue.
	 *
	 * @param id The session.
	 * @param entity The fields to change.
	 * @returns The updated session.
	 */
	@ApiOperation({ summary: 'Update a checkout session' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The checkout session was updated',
		type: CommerceCheckoutSession
	})
	@Permissions(CART_PERMISSIONS.CARTS_CHECKOUT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateCommerceCheckoutSessionDTO
	): Promise<any> {
		return this.commerceCheckoutSessionService.update(id, entity as any);
	}

	/**
	 * Records that a checkout step completed.
	 *
	 * @param id The session.
	 * @param step The step key.
	 * @param data The input the step accumulated.
	 * @returns The updated session.
	 */
	@ApiOperation({ summary: 'Complete a checkout step' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Step completed' })
	@Permissions(CART_PERMISSIONS.CARTS_CHECKOUT)
	@Idempotent({ scope: 'checkout.step.complete', required: false, resourceType: 'checkout_session' })
	@Post(':id/steps/:step')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	async completeStep(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('step') step: string,
		@Body() data: Record<string, unknown>
	): Promise<CommerceCheckoutSession> {
		return this.commerceCheckoutSessionService.completeStep(id, step, data);
	}

	/**
	 * Deletes a checkout session.
	 *
	 * This route is `CrudController.delete()`'s, re-declared here only to state the grant it requires.
	 * The base declares it with no permission metadata at all, so `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that empty metadata
	 * — its `isEmpty(permissions)` return — and the inherited route otherwise stood on the class-level
	 * `CARTS_VIEW` alone. A session is a child row of the cart it converts, so removing one takes the
	 * cart's own `CARTS_DELETE` grant, the value the plugin's permissions file declares for deleting or
	 * expiring a cart.
	 *
	 * @param id The checkout session.
	 * @returns The result of the deletion.
	 */
	@ApiOperation({ summary: 'Delete a checkout session' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Checkout session deleted' })
	@Permissions(CART_PERMISSIONS.CARTS_DELETE)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft-deletes a checkout session.
	 *
	 * This route is `CrudController.softRemove()`'s, re-declared here only to state the grant it
	 * requires. The base declares it with no permission metadata at all, so `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that empty metadata
	 * — its `isEmpty(permissions)` return — and the inherited route otherwise stood on the class-level
	 * `CARTS_VIEW` alone. Soft-deleting a session archives a child row of the cart, so it states the
	 * same `CARTS_DELETE` grant the cart's deletion takes.
	 *
	 * @param id The checkout session.
	 * @returns The soft-deleted checkout session.
	 */
	@ApiOperation({ summary: 'Soft delete a checkout session' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Checkout session soft deleted' })
	@Permissions(CART_PERMISSIONS.CARTS_DELETE)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted checkout session.
	 *
	 * This route is `CrudController.softRecover()`'s, re-declared here only to state the grant it
	 * requires. The base declares it with no permission metadata at all, so `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that empty metadata
	 * — its `isEmpty(permissions)` return — and the inherited route otherwise stood on the class-level
	 * `CARTS_VIEW` alone. Restoring a session undoes the removal of a cart's child row, so it states
	 * the same `CARTS_DELETE` grant the cart's deletion takes.
	 *
	 * @param id The checkout session.
	 * @returns The restored checkout session.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted checkout session' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Checkout session restored' })
	@Permissions(CART_PERMISSIONS.CARTS_DELETE)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
