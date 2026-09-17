import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, Permissions, PermissionGuard, TenantPermissionGuard, UUIDValidationPipe, UseValidationPipe } from '@gauzy/core';
import { CommerceCheckoutSession } from './commerce-checkout-session.entity';
import { CommerceCheckoutSessionService } from './commerce-checkout-session.service';
import { CART_PERMISSIONS } from '../cart.permissions';
import { CreateCommerceCheckoutSessionDTO } from './dto';

/**
 * The checkout-session resource.
 *
 * A session is optional: a single-request checkout never creates one. When one exists it is the record
 * of how far a multi-step or externally hosted checkout got, and of the durable operation it started.
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
