import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Headers,
	HttpCode,
	HttpStatus,
	NotFoundException,
	Param,
	Post,
	Put,
	Req,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
	 * The answer carries the cart's guest-access `token`, and it is the only answer that does: the cart
	 * stores the token's digest, never the token. A retry under the same key is answered from the record of
	 * the first attempt and so carries the same token — that replay is how a client that lost the first
	 * answer gets its token back, and it lasts only as long as the key's own retention.
	 *
	 * @param entity The cart to create.
	 * @returns The created cart, with its totals computed and its guest-access token.
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
	 * Reads the cart a guest-access token names.
	 *
	 * The token is the one the create answered with; the cart stores only its digest, and the service
	 * looks that digest up inside the caller's tenant, answering nothing when there is no tenant to scope
	 * it by. The grant is the one the cart's read route runs under — the class-level `CARTS_VIEW` — because
	 * this is the same read addressed by another key. The `cartByToken` field answers the same lookup.
	 *
	 * The token is a key, not a credential: it names a cart, and it admits nobody. The route runs under the
	 * guards and the grant every cart route runs under, so its caller is an authenticated caller of the cart's
	 * tenant — a storefront holding the token on behalf of a buyer who has not signed in — exactly as for
	 * `GET /carts/:id`; what the token adds is a handle the buyer can hold that no other buyer can guess.
	 *
	 * **The token rides in the `X-Cart-Token` header, never in the URL.** A URL is written down all the way
	 * along: the ingress and CDN access logs, every proxy's, the request-lifecycle lines
	 * `RequestContextMiddleware` logs with the full URL, and the URL an error report carries — a token in the
	 * path would land in every one of them (CWE-598). A header is in none of those, the error reports filter
	 * a header named like a token, and the API-call log redacts it by name.
	 *
	 * Declared before `:id` **for the router**: `by-token` is one segment, as an id is, and Nest registers a
	 * controller's routes in the order its methods are declared, so this route is matched first. A cart could
	 * not be addressed as `by-token` either way — its id is a UUID, and the id read's pipe refuses anything else.
	 *
	 * @param token The plaintext token, from the `X-Cart-Token` header.
	 * @returns The cart, with its lines, delivery choices and promotions.
	 * @throws BadRequestException when the header is missing or blank.
	 * @throws NotFoundException when no cart of the caller's tenant carries that token.
	 */
	@ApiOperation({ summary: 'Find a cart by its guest-access token' })
	@ApiHeader({
		name: 'X-Cart-Token',
		required: true,
		description: 'The guest-access token the cart create answered with.'
	})
	@ApiResponse({ status: HttpStatus.OK, description: 'Cart found' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'CART_TOKEN_REQUIRED: no X-Cart-Token header' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No cart carries that token' })
	@Get('by-token')
	async findByToken(@Headers('x-cart-token') token?: string): Promise<ICommerceCart> {
		if (typeof token !== 'string' || token.trim() === '') {
			throw new BadRequestException(
				'CART_TOKEN_REQUIRED: state the guest-access token the cart create answered with in the X-Cart-Token header.'
			);
		}

		const cart = await this.commerceCartService.findByToken(token);

		if (!cart) {
			throw new NotFoundException('CART_NOT_FOUND: no cart carries that token.');
		}

		return cart;
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
	 * **The status is not one of them (R2-G25).** The body is `PartialType(CommerceCartDTO)`, which carries
	 * `status`, and `applyChanges` wrote whatever it was handed: `PUT /carts/:id { "status": "ACTIVE" }` on
	 * a COMPLETED cart reopened a cart an order had already been placed from — mutable again, completable
	 * again — and a MERGED or EXPIRED cart came back the same way. A cart's status moves through its own
	 * acts, each with its rules and its grant: `POST /carts/:id/complete`, `/abandon` and `/merge`, and the
	 * expiry sweep. The `updateCart` mutation's input never carried a status, so this is the REST door
	 * brought to the GraphQL one. A body that restates the status the cart already has — a client sending
	 * the whole cart back — is accepted, and the member is dropped; a different status is refused with
	 * `400 CART_STATUS_NOT_WRITABLE` before anything is written.
	 *
	 * @param id The cart.
	 * @param entity The fields to change.
	 * @param request The request, which carries the version the caller read the cart at.
	 * @returns The cart.
	 * @throws BadRequestException `CART_STATUS_NOT_WRITABLE` when the body asks for another status.
	 */
	@ApiOperation({ summary: 'Update a cart' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Cart updated' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'CART_STATUS_NOT_WRITABLE: the status moves through complete, abandon and merge'
	})
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Versioned({ resource: CommerceCartService })
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateCommerceCartDTO,
		@Req() request: Request
	): Promise<ICommerceCart> {
		const changes = await this.withoutStatusChange(id, entity);

		return this.commerceCartService.applyChanges(id, changes as any, versionExpectationOf(request));
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
	 * **The grant is the checkout's (R2-G17).** The `abandonCheckout` mutation reaches the same
	 * `CommerceCartService.abandon` under `CARTS_CHECKOUT`, and this route asked only `CARTS_EDIT`, so a role
	 * refused the act over GraphQL performed it over REST. The two are aligned on the stricter grant rather
	 * than the looser one: abandoning is one of the two ends of a checkout — the other being completion —
	 * and it puts the buyer into the abandoned-cart follow-up audience, which is not something preparing a
	 * cart for a buyer (`CARTS_EDIT`) is meant to decide. Both grants are held by the same default roles, so
	 * only a custom role holding `CARTS_EDIT` without `CARTS_CHECKOUT` sees a difference.
	 *
	 * @param id The cart.
	 * @param request The request, which carries the version the caller read the cart at.
	 * @returns The abandoned cart.
	 */
	@ApiOperation({ summary: 'Mark a cart abandoned' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Cart abandoned' })
	@Permissions(CART_PERMISSIONS.CARTS_CHECKOUT)
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

	/**
	 * The update's change set without its `status` member, refused when it asks for another status.
	 *
	 * See {@link update}. The cart is read only when the body states a status at all, so an update that
	 * does not touch it costs no extra read.
	 *
	 * @param id The cart.
	 * @param entity The validated body.
	 * @returns The change set to write, without `status`.
	 * @throws NotFoundException when the cart does not exist.
	 * @throws BadRequestException `CART_STATUS_NOT_WRITABLE` when the stated status differs from the cart's.
	 */
	private async withoutStatusChange(
		id: string,
		entity: UpdateCommerceCartDTO
	): Promise<Omit<UpdateCommerceCartDTO, 'status'>> {
		const { status, ...changes } = (entity ?? {}) as UpdateCommerceCartDTO;

		if (status === undefined || status === null) {
			return changes;
		}

		const cart = await this.commerceCartService.findOneByIdString(id);

		if (!cart) {
			throw new NotFoundException(`CART_NOT_FOUND: no cart exists with id ${id}.`);
		}

		if (cart.status !== status) {
			throw new BadRequestException({
				message: `CART_STATUS_NOT_WRITABLE: a cart's status is not written by an update; a ${cart.status} cart moves through POST /carts/:id/complete, /abandon or /merge.`,
				code: 'CART_STATUS_NOT_WRITABLE',
				details: { status: cart.status, requested: status }
			});
		}

		return changes;
	}
}
