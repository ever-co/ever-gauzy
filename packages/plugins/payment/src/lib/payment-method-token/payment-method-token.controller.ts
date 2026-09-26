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
import { ID, IPagination, IPaymentMethodToken, PermissionsEnum } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	CrudController,
	Idempotent,
	PaymentMethodToken,
	PaymentMethodTokenService,
	Permissions,
	PermissionGuard,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { CreatePaymentMethodTokenDTO, PaymentMethodTokenQueryDTO, UpdatePaymentMethodTokenDTO } from './dto';
import {
	IPaymentMethodTokenDefaultResult,
	PaymentMethodTokenLifecycleService
} from './payment-method-token-lifecycle.service';
import { PaymentPermission } from '../payment.permissions';
import { UseCardDataRefusal } from '../payment.card-data.pipe';

/**
 * The saved instruments of the remembered payer.
 *
 * The resource exists so that a party can be charged again without being present, and every rule in
 * this file follows from that single purpose.
 *
 * **A row exists only because the provider issued the reference.** `POST /` takes the reference the
 * provider's own client-side flow handed the buyer, plus the provider's confirmation that the
 * platform re-read the instrument at the provider, and the service refuses a creation whose reference
 * and confirmation disagree. A reference a caller composed therefore never becomes a stored
 * instrument — and a body that carries a card number instead is refused before the contract is
 * applied, with `PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED` and the member named.
 *
 * **The stored reference leaves this controller only where the contract allows it.** No list carries
 * it, for any caller; a single row carries it only for a caller that may charge the instrument. The
 * projection is the platform's own field gate, so the REST answer and the GraphQL answer to the same
 * question agree by construction.
 *
 * **Deleting is revoking.** `DELETE /:id` sets `status = REVOKED`, stamps `revokedAt` and leaves the
 * row, because the charges that used the instrument have to keep resolving. Re-adding a removed
 * instrument is a new row, which is what the uniqueness rule's predicate permits.
 *
 * The inherited CRUD routes are still mapped — including the soft-delete and recovery pair of §7.1 —
 * and every method this class declares restates its route, because an override without one is an
 * endpoint that quietly stops existing.
 */
@ApiTags('PaymentMethodToken')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_VIEW as PermissionsEnum)
@Controller('/payment-method-tokens')
export class PaymentMethodTokenController extends CrudController<PaymentMethodToken> {
	constructor(
		private readonly paymentMethodTokenService: PaymentMethodTokenService,
		private readonly paymentMethodTokens: PaymentMethodTokenLifecycleService
	) {
		super(paymentMethodTokenService);
	}

	/**
	 * Lists the saved instruments of the caller's organization, defaults first.
	 *
	 * Both filter spellings are accepted. The page is read inside the caller's own tenant and
	 * organization; a `contactId` narrowing resolves that party's accounts first, so a party that holds
	 * no account answers an empty page rather than an unfiltered one.
	 *
	 * @param query The narrowing and the page to read.
	 * @returns One page of instruments, with the stored reference projected out.
	 */
	@ApiOperation({ summary: 'List saved payment instruments' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Instruments retrieved' })
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_VIEW as PermissionsEnum)
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query?: PaymentMethodTokenQueryDTO): Promise<IPagination<IPaymentMethodToken>> {
		return this.paymentMethodTokens.list(this.narrowing(query), { take: query?.take, skip: query?.skip });
	}

	/**
	 * Reads one instrument.
	 *
	 * @param id The instrument to read.
	 * @returns The instrument, with the stored reference projected for a caller that may charge it.
	 */
	@ApiOperation({ summary: 'Find a saved payment instrument by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Instrument retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Instrument not found' })
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_VIEW as PermissionsEnum)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IPaymentMethodToken> {
		return this.paymentMethodTokens.read(id);
	}

	/**
	 * Saves an instrument from a reference the provider issued and confirmed.
	 *
	 * @param entity The instrument as the provider issued and confirmed it.
	 * @returns The stored instrument, `ACTIVE`.
	 */
	@ApiOperation({ summary: 'Save a payment instrument from a provider-issued token' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Instrument saved' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Unconfirmed reference, or card data in the body' })
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT as PermissionsEnum)
	// Saving an instrument is a write at the provider as well as a row here, so a retry that lost its
	// answer must be given the stored instrument back rather than save a second one. The key is
	// therefore mandatory here.
	@Idempotent({ scope: 'payment.instrument.create', required: true, resourceType: 'payment_method_token' })
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	@UseCardDataRefusal()
	async create(@Body() entity: CreatePaymentMethodTokenDTO): Promise<IPaymentMethodToken> {
		return this.paymentMethodTokens.register(entity as never);
	}

	/**
	 * Corrects the display facts of an instrument.
	 *
	 * This is the repair surface for the row's own descriptive fields, and it is deliberately not the
	 * default change below: what a caller may edit here is the brand, the last four, the expiry, the
	 * name and the billing address. The reference, the account, the provider and the kind are refused
	 * by the whitelisting pipe, because none of the four is a descriptive fact — an instrument never
	 * moves between accounts or providers, and its kind decides the default rule and the mandate
	 * requirement.
	 *
	 * The route is declared here rather than inherited: a body is validated from the type the handler
	 * names, and the base class names the entity's shape as a generic, whose reflected type is
	 * `Object` — a parameter the validation pipe cannot name a class for is skipped, so an inherited
	 * route accepts any body at all and writes it.
	 *
	 * @param id The instrument to change.
	 * @param entity The display facts to change.
	 * @returns The stored instrument.
	 */
	@ApiOperation({ summary: 'Update the display facts of a saved payment instrument' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Instrument updated' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Card data in the body, or a terminal instrument' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Instrument not found' })
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT as PermissionsEnum)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	@UseCardDataRefusal()
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdatePaymentMethodTokenDTO
	): Promise<IPaymentMethodToken> {
		return this.paymentMethodTokens.update(id, entity as never);
	}

	/**
	 * Makes an instrument the default for its kind, clearing the previous default.
	 *
	 * Only an `ACTIVE` instrument may hold the default: a default is what a renewal charges, so a
	 * default that cannot be charged is worse than no default at all. The previous default of the same
	 * kind is cleared in the same transaction under a row lock on the account, and the answer names
	 * the instrument it displaced.
	 *
	 * @param id The instrument to make the default.
	 * @returns The stored instrument and the identifier of the instrument it replaced, when there was one.
	 */
	@ApiOperation({ summary: 'Make a saved instrument the default for its kind' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Default changed' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The instrument is not active' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Instrument not found' })
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT as PermissionsEnum)
	@Put(':id/default')
	@HttpCode(HttpStatus.OK)
	async setDefault(@Param('id', UUIDValidationPipe) id: ID): Promise<IPaymentMethodTokenDefaultResult> {
		return this.paymentMethodTokens.makeDefault(id);
	}

	/**
	 * Revokes an instrument — never a hard delete.
	 *
	 * @param id The instrument to revoke.
	 * @returns The stored instrument, `REVOKED`.
	 */
	@ApiOperation({ summary: 'Revoke a saved payment instrument' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Instrument revoked' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Instrument not found' })
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT as PermissionsEnum)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<IPaymentMethodToken> {
		return this.paymentMethodTokens.revoke(id);
	}

	/**
	 * Soft deletes a saved instrument, leaving the row the charges resolve through.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to
	 * empty metadata with its `isEmpty(permissions)` return, and the inherited handler stood on this
	 * class's read grant alone. It now states `PAYMENT_METHOD_TOKENS_EDIT`, the grant the create,
	 * update, default and revoke routes here carry and the one the GraphQL `revokePaymentMethodToken`
	 * mutation states for the same instrument.
	 *
	 * @param id The instrument to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted instrument.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT as PermissionsEnum)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a saved instrument that was soft deleted.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state
	 * the permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to
	 * empty metadata with its `isEmpty(permissions)` return, and the inherited handler stood on this
	 * class's read grant alone. It now states `PAYMENT_METHOD_TOKENS_EDIT` — restoring is the same
	 * grant exercised backwards, and the delete and soft-delete routes here state it too.
	 *
	 * @param id The instrument to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored instrument.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@Permissions(PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT as PermissionsEnum)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}

	/**
	 * The equality members of the list query, from whichever spelling stated them.
	 *
	 * Members that were not stated are left out rather than written as `undefined`, because a
	 * repository handed an explicit `undefined` asks the database for a row whose column *is* null —
	 * which is a different question from "do not narrow on this column". `isDefault` is the one member
	 * whose `false` is a question rather than an absence, so it is kept when it is stated.
	 *
	 * @param query The query as stated.
	 * @returns The narrowing to hand the read.
	 */
	private narrowing(query?: PaymentMethodTokenQueryDTO): Record<string, unknown> {
		const stated: Record<string, unknown> = {};

		for (const [member, value] of Object.entries({ ...((query?.filter ?? {}) as Record<string, unknown>) })) {
			if (value !== undefined && value !== null) {
				stated[member] = value;
			}
		}

		for (const member of ['contactId', 'accountHolderId', 'providerKey', 'type', 'status', 'isDefault'] as const) {
			const value = query?.[member];

			if (value !== undefined && value !== null) {
				stated[member] = value;
			}
		}

		return stated;
	}
}
