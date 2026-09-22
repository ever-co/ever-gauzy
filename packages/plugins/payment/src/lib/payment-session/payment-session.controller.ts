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
	Query,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	BaseQueryDTO,
	CrudController,
	Idempotent,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { PaymentSession } from './payment-session.entity';
import { PaymentSessionService } from './payment-session.service';
import { CreatePaymentSessionDTO, UpdatePaymentSessionDTO } from './dto';
import { IPaymentSession, IPaymentSessionUpdateInput } from '../payment.types';
import { PaymentPermission } from '../payment.permissions';

/**
 * The attempts made at collecting a collection.
 *
 * Opening, authorising, refreshing and voiding are four separate routes because they are four
 * separate acts: reserving money, taking it, asking where it stands, and giving it back. Each carries
 * the permission that names it, and none of them can be reached by a role that only reads.
 *
 * `POST /payment-sessions` is also the off-session path. A body that carries `paymentMethodTokenId`
 * charges an instrument the provider already holds: the attempt then issues no client secret, can
 * never wait for a next action — there is nobody to perform one — and, because it moves money with
 * nobody present, the call additionally requires the platform's own `PAYMENT_METHOD_TOKENS_CHARGE`
 * permission, which belongs to core and is therefore enforced by the caller's role rather than
 * declared here.
 */
@ApiTags('PaymentSession')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PaymentPermission.PAYMENT_SESSIONS_VIEW as PermissionsEnum)
@Controller('/payment-sessions')
export class PaymentSessionController extends CrudController<PaymentSession> {
	constructor(private readonly paymentSessionService: PaymentSessionService) {
		super(paymentSessionService);
	}

	/**
	 * Lists the sessions of the caller's organization.
	 *
	 * @param filter The query filter, merged with the tenancy scope.
	 * @returns One page of sessions.
	 */
	@ApiOperation({ summary: 'List payment sessions' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Sessions retrieved' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_VIEW as PermissionsEnum)
	@Get()
	async findAll(@Query() filter?: BaseQueryDTO<PaymentSession>): Promise<IPagination<IPaymentSession>> {
		// The DTO is the find-options object, not a criterion, so it is spread whole. Nesting it under
		// `where` — which is what this route used to do — turns the DTO’s own members (`take`, `skip`,
		// `withDeleted`) into predicates on columns that do not exist, so every paged or soft-delete-aware
		// request answered `500 Property "take" was not found in "PaymentSession"` while a bare read looked fine:
		// the query string this route advertises was unusable.
		return this.paymentSessionService.findSessions({ ...(filter ?? {}) });
	}

	/**
	 * Reads one session.
	 *
	 * @param id The session to read.
	 * @returns The session. The client secret it may hold is not part of any admin projection.
	 */
	@ApiOperation({ summary: 'Find a payment session by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Session retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Session not found' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_VIEW as PermissionsEnum)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IPaymentSession> {
		return this.paymentSessionService.findSessionOrFail(id);
	}

	/**
	 * Creates or switches the attempt of a `(collection, provider)` pair.
	 *
	 * @param entity The attempt to open.
	 * @returns The stored session.
	 */
	@ApiOperation({ summary: 'Create or switch a payment session' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Session created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Provider disabled, or a live authorised session' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE as PermissionsEnum)
	// Opening an attempt reserves nothing yet and the service switches the pair rather than opening a
	// second attempt, so the key is optional: a client that presents one is answered from the record
	// instead of switching the attempt again.
	@Idempotent({ scope: 'payment.session.create', required: false, resourceType: 'payment_session' })
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async create(@Body() entity: CreatePaymentSessionDTO): Promise<IPaymentSession> {
		return this.paymentSessionService.openSession(entity as never);
	}

	/**
	 * Corrects the recorded fields of an attempt, without running any of its four verbs.
	 *
	 * The route is declared here rather than inherited: a body is validated from the type the handler
	 * names, and the base class names the entity's shape as a generic, whose reflected type is
	 * `Object` — a parameter the validation pipe cannot name a class for is skipped, so an inherited
	 * route accepts any body at all and writes it. Opening, authorising, refreshing and voiding remain
	 * the routes that run the operations the domain owns, each with the checks it performs; this one
	 * is the repair surface for a row's own fields, which is why it carries the authorising grant
	 * rather than the reading one.
	 *
	 * @param id The session to change.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update a payment session' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Session updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Session not found' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE as PermissionsEnum)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdatePaymentSessionDTO) {
		return this.paymentSessionService.update(id, entity as never);
	}

	/**
	 * Records the provider's approval of an attempt and reserves the amount on its collection.
	 *
	 * @param id The session to authorise.
	 * @param entity The data the provider returned with the approval.
	 * @returns The stored session.
	 */
	@ApiOperation({ summary: 'Authorise a payment session' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Session authorised' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Session expired, closed or declined' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE as PermissionsEnum)
	// Recording an approval reserves the amount on the collection, and the service refuses a session that
	// is already authorised, so the key is optional: a client that presents one is answered from the
	// record instead of being refused for a retry of the same approval.
	@Idempotent({ scope: 'payment.session.authorize', required: false, resourceType: 'payment_session' })
	@Post(':id/authorize')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async authorize(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdatePaymentSessionDTO
	): Promise<IPaymentSession> {
		return this.paymentSessionService.authorizeSession(id, entity as IPaymentSessionUpdateInput);
	}

	/**
	 * Re-reads the state of an attempt, closing one that has outlived its lifetime.
	 *
	 * @param id The session to refresh.
	 * @returns The stored session.
	 */
	@ApiOperation({ summary: 'Refresh a payment session' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Session refreshed' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Session not found' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE as PermissionsEnum)
	@Post(':id/refresh')
	@HttpCode(HttpStatus.OK)
	async refresh(@Param('id', UUIDValidationPipe) id: ID): Promise<IPaymentSession> {
		return this.paymentSessionService.refreshSession(id);
	}

	/**
	 * Cancels an attempt and releases the authorisation it holds.
	 *
	 * @param id The session to cancel.
	 * @returns The stored session.
	 */
	@ApiOperation({ summary: 'Cancel a payment session' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Session cancelled' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Session already closed' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_CANCEL as PermissionsEnum)
	// Cancelling an attempt releases the authorisation it holds, which is a movement of money even though
	// no row is written back. The scope names the cancellation itself rather than the verb that carries
	// it, so a client retrying a cancel presents the same key whatever surface it retries on.
	@Idempotent({ scope: 'payment.cancel', required: false, resourceType: 'payment_session' })
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<IPaymentSession> {
		return this.paymentSessionService.voidSession(id);
	}

	/**
	 * Soft deletes a payment session, leaving the attempt on record.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to
	 * empty metadata with its `isEmpty(permissions)` return, and the inherited handler stood on this
	 * class's read grant alone. It now states `PAYMENT_SESSIONS_CANCEL`, the grant the delete route here
	 * carries and the one the GraphQL `voidPaymentSession` mutation states for the same attempt.
	 *
	 * @param id The session to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted session.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_CANCEL as PermissionsEnum)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a payment session that was soft deleted.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to
	 * empty metadata with its `isEmpty(permissions)` return, and the inherited handler stood on this
	 * class's read grant alone. It now states `PAYMENT_SESSIONS_CANCEL` — restoring is the same grant
	 * exercised backwards, and the delete and soft-delete routes here state it too.
	 *
	 * @param id The session to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored session.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_CANCEL as PermissionsEnum)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}
