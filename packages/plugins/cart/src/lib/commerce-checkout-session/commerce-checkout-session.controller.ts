import { Body, Controller, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID } from '@gauzy/contracts';
import {
	CrudController,
	Idempotent,
	Permissions,
	PermissionGuard,
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
}
