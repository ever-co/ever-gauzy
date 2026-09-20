import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, IPaymentAccountHolder, PermissionsEnum } from '@gauzy/contracts';
import {
	CrudController,
	Idempotent,
	PaymentAccountHolder,
	PaymentAccountHolderService,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import {
	CreatePaymentAccountHolderDTO,
	PaymentAccountHolderQueryDTO,
	UpdatePaymentAccountHolderDTO,
	VerifyPaymentAccountHolderDTO
} from './dto';
import {
	IPaymentAccountHolderDisableResult,
	PaymentAccountHolderLifecycleService
} from './payment-account-holder-lifecycle.service';
import { PaymentPermission } from '../payment.permissions';
import { UseCardDataRefusal } from '../payment.card-data.pipe';

/**
 * The remembered payer: a party's account at one provider, and the instruments saved under it.
 *
 * Three properties shape this file, and each of them is a decision rather than a convention.
 *
 * **No route accepts card data.** A saved instrument is written from a reference the provider issued,
 * so the two write routes that carry a body refuse a card-shaped member before the contract is
 * applied, with `PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED` and the offending member named — see
 * `RejectCardDataPipe`.
 *
 * **Deleting is disabling.** `DELETE /:id` closes the account and revokes every instrument beneath it
 * in the same transaction, and answers with the account and how many instruments went with it. There
 * is no hard delete: a charge history that points at a missing account is unauditable. The generic
 * soft-delete route the base class maps is still there, and the service refuses it while the account
 * is not `DISABLED`.
 *
 * **A verification is not a status move.** `POST /:id/verify` records the verdict the provider or a
 * reviewer reached, records the provider's reference when onboarding completed with it, and moves the
 * status only where the verdict says it belongs — the account and the verification are two facts, and
 * an account can be verified while `RESTRICTED` or active while unverified.
 *
 * Every route below restates the permission it is reached with, including the ones whose route the
 * CRUD base already maps: a route that inherits a decorator inherits it from this class, and an
 * override without one is an endpoint that silently disappears.
 */
@ApiTags('PaymentAccountHolder')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_VIEW as PermissionsEnum)
@Controller('/payment-account-holders')
export class PaymentAccountHolderController extends CrudController<PaymentAccountHolder> {
	constructor(
		private readonly paymentAccountHolderService: PaymentAccountHolderService,
		private readonly accountHolders: PaymentAccountHolderLifecycleService
	) {
		super(paymentAccountHolderService);
	}

	/**
	 * Lists the accounts of the caller's organization.
	 *
	 * Both filter spellings are accepted — the flat one and the `filter[...]` one the endpoint
	 * catalogue names — and the page is read from the accounts the caller's own tenant and
	 * organization own, so a filter can never widen the scope.
	 *
	 * @param query The narrowing and the page to read.
	 * @returns One page of accounts.
	 */
	@ApiOperation({ summary: 'List provider accounts' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Accounts retrieved' })
	@Permissions(PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_VIEW as PermissionsEnum)
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query?: PaymentAccountHolderQueryDTO): Promise<IPagination<IPaymentAccountHolder>> {
		return this.paymentAccountHolderService.findAll({
			where: this.narrowing(query),
			order: { createdAt: 'DESC' },
			...(query?.take !== undefined ? { take: query.take } : {}),
			...(query?.skip !== undefined ? { skip: query.skip } : {})
		} as never);
	}

	/**
	 * Reads one account with the instruments saved under it.
	 *
	 * The instruments travel as their masked summary — brand, last four, expiry — and never as the
	 * stored reference, which no expanded list carries for any caller.
	 *
	 * @param id The account to read.
	 * @returns The account, with its instruments.
	 */
	@ApiOperation({ summary: 'Find a provider account by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Account retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Account not found' })
	@Permissions(PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_VIEW as PermissionsEnum)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IPaymentAccountHolder> {
		return this.accountHolders.read(id);
	}

	/**
	 * Records a party's account at a provider, in the state onboarding starts from.
	 *
	 * The account is created `PENDING` and with no provider reference, because it does not exist at the
	 * provider yet; the reference arrives on the verify route when onboarding completes. A body that
	 * states a status, a provider reference or a mandate is refused rather than trimmed: those are
	 * facts a later operation observes.
	 *
	 * @param entity The account to record.
	 * @returns The stored account, `PENDING`.
	 */
	@ApiOperation({ summary: 'Record a provider account' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Account recorded' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid account, or card data in the body' })
	@Permissions(PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_EDIT as PermissionsEnum)
	// An account is created at the platform and then onboarded at the provider, so a second row for the
	// same retry would mean two onboardings for one party. The key is therefore mandatory here.
	@Idempotent({ scope: 'payment.account.create', required: true, resourceType: 'payment_account_holder' })
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	@UseCardDataRefusal()
	async create(@Body() entity: CreatePaymentAccountHolderDTO): Promise<IPaymentAccountHolder> {
		return this.paymentAccountHolderService.createHolder(entity as never);
	}

	/**
	 * Changes the non-secret attributes of an account, and its mandate with them.
	 *
	 * The route is declared here rather than inherited: a body is validated from the type the handler
	 * names, and the base class names the entity's shape as a generic, whose reflected type is
	 * `Object` — a parameter the validation pipe cannot name a class for is skipped, so an inherited
	 * route accepts any body at all and writes it.
	 *
	 * @param id The account to change.
	 * @param entity The facts to change.
	 * @returns The stored account, with its instruments.
	 */
	@ApiOperation({ summary: 'Update a provider account' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Account updated' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Half a mandate, or card data in the body' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Account not found' })
	@Permissions(PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_EDIT as PermissionsEnum)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	@UseCardDataRefusal()
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdatePaymentAccountHolderDTO
	): Promise<IPaymentAccountHolder> {
		return this.accountHolders.update(id, entity as never);
	}

	/**
	 * Records a verification verdict and moves the account where the verdict says it belongs.
	 *
	 * @param id The account being verified.
	 * @param entity The verdict and the evidence around it.
	 * @returns The stored account, with its instruments.
	 */
	@ApiOperation({ summary: 'Record the verification of a provider account' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Verification recorded' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'A move the account cannot make' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Account not found' })
	@Permissions(PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_EDIT as PermissionsEnum)
	// A verification is a verdict with evidence around it, so a retry that lost its answer must be given
	// the recorded verdict back rather than append a second one. The key is therefore mandatory here.
	@Idempotent({ scope: 'payment.account.verify', required: true, resourceType: 'payment_account_holder' })
	@Post(':id/verify')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	@UseCardDataRefusal()
	async verify(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: VerifyPaymentAccountHolderDTO
	): Promise<IPaymentAccountHolder> {
		return this.accountHolders.verify(id, entity as never);
	}

	/**
	 * Disables the account and revokes its instruments in the same transaction.
	 *
	 * @param id The account to disable.
	 * @returns The stored account, `DISABLED`, and how many instruments were revoked with it.
	 */
	@ApiOperation({ summary: 'Disable a provider account and revoke its instruments' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Account disabled and instruments revoked' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Account not found' })
	@Permissions(PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_EDIT as PermissionsEnum)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<IPaymentAccountHolderDisableResult> {
		return this.accountHolders.disable(id);
	}

	/**
	 * The equality members of the list query, from whichever spelling stated them.
	 *
	 * Members that were not stated are left out rather than written as `undefined`, because a
	 * repository handed an explicit `undefined` asks the database for a row whose column *is* null —
	 * which is a different question from "do not narrow on this column".
	 *
	 * @param query The query as stated.
	 * @returns The narrowing to hand the read.
	 */
	private narrowing(query?: PaymentAccountHolderQueryDTO): Record<string, unknown> {
		const stated: Record<string, unknown> = {};

		for (const [member, value] of Object.entries({ ...((query?.filter ?? {}) as Record<string, unknown>) })) {
			if (value !== undefined && value !== null) {
				stated[member] = value;
			}
		}

		for (const member of ['contactId', 'paymentProviderId', 'providerKey', 'type', 'status', 'defaultCurrency'] as const) {
			const value = query?.[member];

			if (value !== undefined && value !== null) {
				stated[member] = value;
			}
		}

		return stated;
	}
}
