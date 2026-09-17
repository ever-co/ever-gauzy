import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	Permissions,
	PermissionGuard,
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
		return this.paymentSessionService.findSessions({ where: { ...((filter ?? {}) as Record<string, unknown>) } });
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
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async create(@Body() entity: CreatePaymentSessionDTO): Promise<IPaymentSession> {
		return this.paymentSessionService.openSession(entity as never);
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
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<IPaymentSession> {
		return this.paymentSessionService.voidSession(id);
	}
}
