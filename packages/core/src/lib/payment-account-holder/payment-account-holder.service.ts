import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, SaveOptions } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ID,
	IPaymentAccountHolder,
	IPaymentAccountHolderCreateInput,
	IPaymentAccountHolderFindInput,
	IPaymentAccountHolderMandateInput,
	IPaymentAccountHolderUpdateInput,
	PaymentAccountHolderStatus,
	PaymentAccountHolderType,
	PaymentAccountVerificationStatus
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { IFindOneOptions } from '../core/crud/icrud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { PaymentMethodTokenService } from '../payment-method-token/payment-method-token.service';
import { PaymentAccountHolder } from './payment-account-holder.entity';
import { TypeOrmPaymentAccountHolderRepository } from './repository/type-orm-payment-account-holder.repository';
import { MikroOrmPaymentAccountHolderRepository } from './repository/mikro-orm-payment-account-holder.repository';

/**
 * The party's standing relationship with one provider, and the machine that governs it.
 *
 * Read the rules of this service as one rule with five faces.
 *
 * 1. **The status machine is the only way the status moves.** `PENDING → ACTIVE | REJECTED | DISABLED`,
 *    `ACTIVE → RESTRICTED | DISABLED`, `RESTRICTED → ACTIVE | DISABLED`, and no other move.
 *    `REJECTED` and `DISABLED` are terminal, so an account a provider refused is never silently reused
 *    — a new application is a new row — and a status a caller cannot reach is refused rather than
 *    written. `RESTRICTED` exists precisely so that "the provider accepts no new charge while an
 *    existing mandate is still honoured" is one state rather than a pair of booleans.
 * 2. **The external account id is null exactly while the account is `PENDING`.** The account does not
 *    exist at the provider until onboarding completes, so a creation that presents one is refused, and
 *    an account that may be charged or paid out — `ACTIVE` or `RESTRICTED` — must name the provider's
 *    own reference. A `REJECTED` application never reached the provider and keeps the null it was
 *    created with; what the rule forbids is a chargeable account that names nothing.
 * 3. **The mandate is one fact in two halves.** `mandateAcceptedAt` is non-null exactly when
 *    `mandateReference` is non-null, because a debit without a dated mandate is a debit a dispute can
 *    unwind. The two are written together and cleared together, and a write that carries one and not
 *    the other is refused rather than completed with a guess.
 * 4. **At most one live account per party, provider and role.** A party may hold a buyer account and a
 *    payout account with the same provider, and may hold historical closed accounts beside the live
 *    one, but never two live accounts of the same kind. The rule is a statement about the party's other
 *    rows, so it is checked in the same transaction that moves the status.
 * 5. **A closing account takes its instruments with it, in the same transaction.** Disabling an account
 *    without revoking its instruments leaves a chargeable instrument under an account nobody may charge
 *    — exactly the state a caller holding a stale identifier would try to reach — so the revocation is
 *    part of the disabling rather than a step a caller has to remember. The rows are revoked, never
 *    deleted: a charge history that points at a missing instrument is unauditable.
 *
 * The row is never hard-deleted while anything references it. The supported path is the terminal status
 * followed by a soft delete, and this service refuses the soft delete of an account that is still live.
 */
@Injectable()
export class PaymentAccountHolderService extends TenantAwareCrudService<PaymentAccountHolder> {
	/**
	 * The transition graph, stated once. A status absent from a row's list cannot be reached from it,
	 * and a status whose list is empty is terminal.
	 */
	private static readonly TRANSITIONS: Record<PaymentAccountHolderStatus, PaymentAccountHolderStatus[]> = {
		[PaymentAccountHolderStatus.PENDING]: [
			PaymentAccountHolderStatus.ACTIVE,
			PaymentAccountHolderStatus.REJECTED,
			PaymentAccountHolderStatus.DISABLED
		],
		[PaymentAccountHolderStatus.ACTIVE]: [
			PaymentAccountHolderStatus.RESTRICTED,
			PaymentAccountHolderStatus.DISABLED
		],
		[PaymentAccountHolderStatus.RESTRICTED]: [
			PaymentAccountHolderStatus.ACTIVE,
			PaymentAccountHolderStatus.DISABLED
		],
		[PaymentAccountHolderStatus.REJECTED]: [],
		[PaymentAccountHolderStatus.DISABLED]: []
	};

	/** Statuses an account can never leave. */
	private static readonly TERMINAL: PaymentAccountHolderStatus[] = [
		PaymentAccountHolderStatus.REJECTED,
		PaymentAccountHolderStatus.DISABLED
	];

	/**
	 * Lifecycle members a descriptive update may not carry, each with the operation that owns it. A body
	 * that states one of them is refused rather than silently ignored, because a caller that believes it
	 * changed a status has a bug it would otherwise never see.
	 */
	private static readonly LIFECYCLE_MEMBERS = [
		'status',
		'externalAccountId',
		'mandateReference',
		'mandateAcceptedAt'
	];

	constructor(
		readonly typeOrmPaymentAccountHolderRepository: TypeOrmPaymentAccountHolderRepository,
		readonly mikroOrmPaymentAccountHolderRepository: MikroOrmPaymentAccountHolderRepository,
		/**
		 * The instrument service, for the one step a closing account performs: revoking everything
		 * beneath it. The dependency runs one way — instruments read the account table directly rather
		 * than through this service — so no cycle is created by closing an account revoking its
		 * instruments.
		 */
		private readonly paymentMethodTokenService: PaymentMethodTokenService
	) {
		super(typeOrmPaymentAccountHolderRepository, mikroOrmPaymentAccountHolderRepository);
	}

	/**
	 * The tenant and organization of the caller, which every query in this service is scoped to.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Records a party's account at a provider, in the state onboarding starts from.
	 *
	 * The account is created `PENDING` and with no external account id, because it does not exist at the
	 * provider yet: the provider's reference arrives when onboarding completes and is recorded by
	 * {@link recordProviderAccount}. A creation that presents one, or that presents a mandate, is
	 * refused — both are facts about a later moment, and accepting them here would let a caller invent
	 * the state the later operations exist to observe.
	 *
	 * @param input The account as the caller states it.
	 * @returns The stored account, `PENDING`.
	 * @throws BadRequestException when the provider key is missing, when the body carries a lifecycle
	 * member this operation does not own, or when it states an account kind the party cannot hold.
	 */
	async createHolder(input: IPaymentAccountHolderCreateInput): Promise<IPaymentAccountHolder> {
		if (!input?.providerKey || !String(input.providerKey).trim()) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED}: an account at a provider is stated with the provider's key, and none was presented.`
			);
		}

		const stated = input as unknown as Record<string, unknown>;

		for (const member of PaymentAccountHolderService.LIFECYCLE_MEMBERS) {
			if (stated[member] !== undefined && stated[member] !== null) {
				throw new BadRequestException(
					`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID}: '${member}' is not stated when an account is recorded; it is written by the operation that observes it.`
				);
			}
		}

		const type = input.type ?? PaymentAccountHolderType.CUSTOMER;

		return this.create({
			...input,
			providerKey: String(input.providerKey).trim(),
			type,
			status: PaymentAccountHolderStatus.PENDING,
			// Stated rather than left to the column's default: a row written through a path that ignores
			// defaults would otherwise carry no verification outcome at all, and "not yet attempted" is a
			// fact about the account rather than an absence.
			verificationStatus: PaymentAccountVerificationStatus.UNVERIFIED,
			...this.scope
		} as never);
	}

	/**
	 * Loads an account that belongs to the caller's organization.
	 *
	 * @param id The account id.
	 * @returns The account.
	 * @throws NotFoundException `PAYMENT_ACCOUNT_HOLDER_NOT_FOUND` when it does not exist inside the
	 * caller's scope.
	 */
	async findHolderOrFail(id: ID): Promise<IPaymentAccountHolder> {
		const holder = await this.findHolder(id);

		if (!holder) {
			throw new NotFoundException(
				`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_NOT_FOUND}: no such account at a provider.`
			);
		}

		return holder;
	}

	/**
	 * Lists the accounts of the caller's organization.
	 *
	 * @param filter Optional narrowing by party, provider, kind or status.
	 * @returns The accounts, newest first.
	 */
	async listHolders(filter: IPaymentAccountHolderFindInput = {}): Promise<IPaymentAccountHolder[]> {
		return this.find({
			where: {
				...(filter.contactId ? { contactId: filter.contactId } : {}),
				...(filter.providerKey ? { providerKey: filter.providerKey } : {}),
				...(filter.type ? { type: filter.type } : {}),
				...(filter.status ? { status: filter.status } : {}),
				...this.scope
			},
			order: { createdAt: 'DESC' }
		} as never);
	}

	/**
	 * The party's live account of one kind with one provider, when it holds one.
	 *
	 * @param contactId The party.
	 * @param providerKey The provider's key.
	 * @param type The kind of account.
	 * @returns The live account, or null.
	 */
	async findActiveHolder(
		contactId: ID,
		providerKey: string,
		type: PaymentAccountHolderType = PaymentAccountHolderType.CUSTOMER
	): Promise<IPaymentAccountHolder | null> {
		const holders: PaymentAccountHolder[] = await this.find({
			where: {
				contactId,
				providerKey,
				type,
				status: PaymentAccountHolderStatus.ACTIVE,
				...this.scope
			}
		} as never);

		return holders.length ? holders[0] : null;
	}

	/**
	 * Changes the descriptive facts of an account.
	 *
	 * Every lifecycle member is refused here, and each names the operation that owns it: the status
	 * moves through {@link transitionStatus}, the provider's reference is recorded by
	 * {@link recordProviderAccount}, and the mandate by {@link setMandate}. A single descriptive update
	 * that could also move a status is how a state machine stops being one.
	 *
	 * @param id The account to change.
	 * @param input The facts to change.
	 * @returns The stored account.
	 * @throws BadRequestException when the body carries a lifecycle member, when the account is terminal,
	 * or when the change contradicts the account's status.
	 * @throws NotFoundException when the account is not in the caller's scope.
	 */
	async updateHolder(id: ID, input: IPaymentAccountHolderUpdateInput): Promise<IPaymentAccountHolder> {
		const holder = await this.findHolderOrFail(id);

		if (PaymentAccountHolderService.TERMINAL.includes(holder.status)) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID}: a ${holder.status} account is closed and is never edited.`
			);
		}

		const stated = (input ?? {}) as unknown as Record<string, unknown>;

		for (const member of PaymentAccountHolderService.LIFECYCLE_MEMBERS) {
			if (stated[member] !== undefined && stated[member] !== null) {
				throw new BadRequestException(
					`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID}: '${member}' is not stated on a descriptive update; it is written by the operation that observes it.`
				);
			}
		}

		await this.update(id, {
			...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
			...(input.paymentProviderId !== undefined ? { paymentProviderId: input.paymentProviderId } : {}),
			...(input.providerKey !== undefined ? { providerKey: String(input.providerKey).trim() } : {}),
			...(input.verificationStatus !== undefined ? { verificationStatus: input.verificationStatus } : {}),
			...(input.country !== undefined ? { country: input.country } : {}),
			...(input.defaultCurrency !== undefined ? { defaultCurrency: input.defaultCurrency } : {}),
			...(input.metadata !== undefined ? { metadata: input.metadata } : {})
		} as never);

		return this.findHolderOrFail(id);
	}

	/**
	 * Records the reference the provider issued for the account.
	 *
	 * This is the moment onboarding completes, and it is the only write that may set
	 * `externalAccountId`, because it is the only write that observes the provider's answer. It is
	 * idempotent for the same reference — a provider that acknowledges twice changes nothing — and it
	 * refuses a different one, because an account whose provider reference can be rewritten is an
	 * account whose charges can be redirected.
	 *
	 * @param id The account being onboarded.
	 * @param externalAccountId The provider's own reference for the account.
	 * @returns The stored account.
	 * @throws BadRequestException when the reference is blank, when the account has left `PENDING`, when
	 * it already names a different reference, or when another account of this provider already does.
	 * @throws NotFoundException when the account is not in the caller's scope.
	 */
	async recordProviderAccount(id: ID, externalAccountId: string): Promise<IPaymentAccountHolder> {
		const holder = await this.findHolderOrFail(id);

		if (!externalAccountId || !String(externalAccountId).trim()) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED}: the provider's reference for the account is what is recorded here, and none was presented.`
			);
		}

		const reference = String(externalAccountId).trim();

		if (holder.externalAccountId === reference) {
			return holder;
		}

		if (holder.status !== PaymentAccountHolderStatus.PENDING || holder.externalAccountId) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID}: a ${holder.status} account holds the provider reference it was onboarded with, and it is never rewritten.`
			);
		}

		const taken = await this.findByProviderAccount(holder.providerKey, reference, holder.id);

		if (taken) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_ACTIVE_EXISTS}: provider '${holder.providerKey}' already has an account under this reference, and one account at the provider is one row.`
			);
		}

		await this.update(id, { externalAccountId: reference } as never);

		return this.findHolderOrFail(id);
	}

	/**
	 * Moves the account along its transition graph, and nowhere else.
	 *
	 * The graph is stated in {@link TRANSITIONS} and a move it does not contain is refused, which is what
	 * makes `REJECTED` and `DISABLED` terminal in fact rather than in prose. Two moves carry an extra
	 * requirement: reaching `ACTIVE` needs the provider's reference — an account that may be charged must
	 * name the account it is charged against — and needs the party to hold no other live account of the
	 * same kind with the same provider. Reaching `DISABLED` revokes the account's instruments in the
	 * same transaction.
	 *
	 * @param id The account to move.
	 * @param next The status to move it to.
	 * @returns The stored account.
	 * @throws BadRequestException `PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID` for a move the graph does not
	 * contain, an `ACTIVE` move without a provider reference, or an edit of a terminal account;
	 * `PAYMENT_ACCOUNT_HOLDER_ACTIVE_EXISTS` when the party already holds a live account of that kind.
	 * @throws NotFoundException when the account is not in the caller's scope.
	 */
	async transitionStatus(id: ID, next: PaymentAccountHolderStatus): Promise<IPaymentAccountHolder> {
		if (!next || !Object.values(PaymentAccountHolderStatus).includes(next)) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID}: '${String(next)}' is not a status an account can hold.`
			);
		}

		const saved = await this.typeOrmPaymentAccountHolderRepository.manager.transaction(async (manager) => {
			const holder = await this.lockHolder(manager, id);

			if (!holder) {
				throw new NotFoundException(
					`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_NOT_FOUND}: no such account at a provider.`
				);
			}

			this.assertTransitionAllowed(holder, next);
			await this.assertChargeableShape(holder, next);
			await this.assertNoLiveHolderOfKind(manager, holder, next);

			holder.status = next;

			const stored = await manager.save(PaymentAccountHolder, holder);

			if (next === PaymentAccountHolderStatus.DISABLED) {
				// In the same transaction, deliberately: see the class note.
				await this.paymentMethodTokenService.revokeTokensOfHolder(manager, stored.id);
			}

			return stored;
		});

		return this.findHolderOrFail(saved.id);
	}

	/**
	 * Closes an account and revokes its instruments with it.
	 *
	 * Idempotent, unlike a status move: closing an account that is already closed answers with the row
	 * the first close wrote and changes nothing, because a retried close is an ordinary client
	 * behaviour and failing it would make an operator retry by hand.
	 *
	 * @param id The account to close.
	 * @returns The stored account, `DISABLED`.
	 * @throws NotFoundException when the account is not in the caller's scope.
	 */
	async disableHolder(id: ID): Promise<IPaymentAccountHolder> {
		const holder = await this.findHolderOrFail(id);

		if (holder.status === PaymentAccountHolderStatus.DISABLED) {
			return holder;
		}

		return this.transitionStatus(id, PaymentAccountHolderStatus.DISABLED);
	}

	/**
	 * Records the mandate that backs a recurring debit against the account.
	 *
	 * Both halves are required and neither is inferred. The reference is the provider's own identifier
	 * for the mandate — never the mandate text and never an account number — and the instant is when the
	 * party accepted it, recorded because a debit without a dated mandate is a debit a dispute can
	 * unwind. A write that carries one half is refused rather than completed with a guess, which is what
	 * makes "non-null exactly when" true of the stored row rather than merely of the happy path.
	 *
	 * @param id The account the mandate is against.
	 * @param input The provider's reference and the instant the party accepted it.
	 * @returns The stored account.
	 * @throws BadRequestException `PAYMENT_ACCOUNT_HOLDER_MANDATE_INVALID` when either half is missing,
	 * and `PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID` when the account is closed.
	 * @throws NotFoundException when the account is not in the caller's scope.
	 */
	async setMandate(id: ID, input: IPaymentAccountHolderMandateInput): Promise<IPaymentAccountHolder> {
		const holder = await this.findHolderOrFail(id);

		if (PaymentAccountHolderService.TERMINAL.includes(holder.status)) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID}: a ${holder.status} account takes no mandate, because nothing may be charged against it.`
			);
		}

		const reference = (input ?? ({} as IPaymentAccountHolderMandateInput)).mandateReference;
		const acceptedAt = (input ?? ({} as IPaymentAccountHolderMandateInput)).mandateAcceptedAt;

		if (!reference || !String(reference).trim() || !acceptedAt) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_MANDATE_INVALID}: a mandate is the provider's reference and the instant the party accepted it, and both are required together.`
			);
		}

		await this.update(id, {
			mandateReference: String(reference).trim(),
			mandateAcceptedAt: new Date(acceptedAt)
		} as never);

		return this.findHolderOrFail(id);
	}

	/**
	 * Clears the mandate from the account.
	 *
	 * Both halves go together, for the same reason they arrive together: a reference without its instant
	 * is the state the invariant forbids, and clearing one of the two would manufacture it.
	 *
	 * @param id The account whose mandate is withdrawn.
	 * @returns The stored account.
	 * @throws NotFoundException when the account is not in the caller's scope.
	 */
	async clearMandate(id: ID): Promise<IPaymentAccountHolder> {
		await this.findHolderOrFail(id);
		await this.update(id, { mandateReference: null, mandateAcceptedAt: null } as never);

		return this.findHolderOrFail(id);
	}

	/**
	 * Whether the account carries the mandate a recurring debit needs.
	 *
	 * @param holder The account to test.
	 * @returns True when both halves of the mandate are present.
	 */
	hasMandate(holder: IPaymentAccountHolder): boolean {
		return Boolean(holder?.mandateReference) && Boolean(holder?.mandateAcceptedAt);
	}

	/**
	 * Refuses an account that may not be charged or paid out.
	 *
	 * `RESTRICTED` is refused here even though the provider still honours an existing mandate: this is
	 * the guard for a **new** charge, and a caller that is honouring an existing mandate is not asking
	 * this question.
	 *
	 * @param holder The account about to be charged or paid out to.
	 * @throws BadRequestException `PAYMENT_ACCOUNT_HOLDER_RESTRICTED` for every status but `ACTIVE`.
	 */
	assertChargeable(holder: IPaymentAccountHolder): void {
		if (holder?.status === PaymentAccountHolderStatus.ACTIVE) {
			return;
		}

		throw new BadRequestException(
			`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_RESTRICTED}: a ${holder?.status ?? 'missing'} account may not be charged, and only an active account may.`
		);
	}

	/**
	 * Soft-deletes an account, which is the only removal path there is.
	 *
	 * A hard delete is never offered: a saved instrument, a charge attempt, a subscription or a
	 * settlement may all reference this row, and two of those four live in capability packages whose
	 * tables are created later, so no portable constraint can carry the rule. The supported path is the
	 * terminal status followed by this call, and an account that is still live is refused here rather
	 * than removed while something may still be charging against it.
	 *
	 * @param id The account to soft-delete.
	 * @returns The stored account.
	 * @throws BadRequestException `PAYMENT_ACCOUNT_HOLDER_IN_USE` when the account is not `DISABLED`.
	 * @throws NotFoundException when the account is not in the caller's scope.
	 */
	async softRemoveHolder(id: ID): Promise<IPaymentAccountHolder> {
		const holder = await this.findHolderOrFail(id);

		if (holder.status !== PaymentAccountHolderStatus.DISABLED) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_IN_USE}: a ${holder.status} account is still in use; disable it first, which revokes its instruments, and then remove it.`
			);
		}

		await this.softDelete(id);

		// **Read back with the retired rows included.** The account was just soft-deleted, so the live
		// read `findHolderOrFail` performs cannot see it: TypeORM's `@DeleteDateColumn` and MikroORM's
		// soft-delete filter both hide it, and every successful removal used to end in
		// `PAYMENT_ACCOUNT_HOLDER_NOT_FOUND` after the delete had already committed — the caller was told
		// the removal failed when it had happened. The read keeps the caller's scope.
		const [removed] = (await this.find({
			where: { id, ...this.scope },
			withDeleted: true
		} as never)) as PaymentAccountHolder[];

		return removed ?? holder;
	}

	/**
	 * The inherited recoverable removal, held to the caller's tenant **and organization**.
	 *
	 * The tenant-aware base resolves the row through its own read, which adds the caller's tenant and nothing
	 * else — and adds not even that under `DB_ORM=mikro-orm`, where it learns the tenant column from TypeORM
	 * metadata that ORM does not carry. Every other read this service makes is scoped to the organization, so
	 * the inherited pair was the one way to retire or restore — and be handed back — an account of another
	 * organization of the same tenant, on both ORMs, and of another tenant on MikroORM. The scope is merged
	 * into the find options rather than checked beside them, because the kernel reads the row twice on the
	 * MikroORM branch — a guard read, then the repository read whose entity it removes — and both build their
	 * criterion from the same options, so one merge scopes both reads on both ORMs.
	 *
	 * The plugin's removal routes go through {@link softRemoveHolder}, which refuses a live account; this
	 * override does not add that refusal, it only keeps the inherited member from reaching past the caller.
	 *
	 * @param id The account to retire.
	 * @param options Find options to narrow the lookup with. The inherited route hands over its rest
	 * parameter, an array, which is read as "no options" exactly as the kernel reads it.
	 * @param saveOptions The kernel's save options, forwarded unchanged.
	 * @returns The retired account.
	 * @throws NotFoundException when the account does not exist inside the caller's scope.
	 */
	public async softRemove(
		id: ID,
		options?: IFindOneOptions<PaymentAccountHolder>,
		saveOptions?: SaveOptions
	): Promise<PaymentAccountHolder> {
		return super.softRemove(id, this.withinScope(options), saveOptions);
	}

	/**
	 * The inherited restore — `PUT /payment-account-holders/:id/recover` and `recoverPaymentAccountHolder` —
	 * held to the caller's tenant and organization, for the reasons {@link softRemove} gives. The kernel adds
	 * `withDeleted` to the options it is handed, after this merge, so the retired account stays visible to the
	 * read that restores it.
	 *
	 * @param id The account to restore.
	 * @param options Find options to narrow the lookup with, read as {@link softRemove} reads them.
	 * @param saveOptions The kernel's save options, forwarded unchanged.
	 * @returns The restored account.
	 * @throws NotFoundException when no retired account with that identifier exists inside the caller's scope.
	 */
	public async softRecover(
		id: ID,
		options?: IFindOneOptions<PaymentAccountHolder>,
		saveOptions?: SaveOptions
	): Promise<PaymentAccountHolder> {
		return super.softRecover(id, this.withinScope(options), saveOptions);
	}

	/**
	 * Reads one account of the caller's organization, answering null when there is none.
	 *
	 * The answering form exists because a caller deciding what to do about a missing account — a
	 * renewal resolving a remembered payer, an audit reconciling a register — treats the miss as an
	 * ordinary fact, while {@link findHolderOrFail} is for a caller handed an identifier it must honour.
	 *
	 * @param id The account id.
	 * @returns The account, or null.
	 */
	async findHolder(id: ID): Promise<IPaymentAccountHolder | null> {
		const holders: PaymentAccountHolder[] = await this.find({ where: { id, ...this.scope } } as never);

		return holders.length ? holders[0] : null;
	}

	/**
	 * The find options of an inherited soft-delete call, with the caller's scope merged into their criterion.
	 *
	 * The scope is spread last, so a caller's criterion can narrow it and never widen it: a `where` naming
	 * another organization is overwritten rather than honoured, and the read then finds nothing. It fails
	 * closed, as every read of this service does: with no caller both members are `null`, which is `IS NULL`
	 * on both ORMs, and every account carries both columns.
	 *
	 * @param options The options as received: an options object, nothing, or the inherited route's
	 * rest-parameter array.
	 * @returns Options whose `where` carries the caller's tenant and organization, stated last.
	 */
	private withinScope(options?: unknown): IFindOneOptions<PaymentAccountHolder> {
		// `CrudController` forwards its `...options` rest parameter, which Nest fills with an empty array:
		// that is no options at all, and spreading it would add index keys rather than find options.
		const stated = !options || typeof options !== 'object' || Array.isArray(options) ? {} : options;
		const where = (stated as { where?: object }).where ?? {};

		return { ...stated, where: { ...where, ...this.scope } } as unknown as IFindOneOptions<PaymentAccountHolder>;
	}

	/**
	 * Reads the account under a lock where the dialect supports one.
	 *
	 * The status machine and the "one live account per party, provider and role" rule are both decided
	 * from the row's current state, so the row is held for the decision rather than read and written
	 * around. The embedded dialect serializes writers on its own, so there the surrounding transaction
	 * is the lock and no statement is added.
	 *
	 * @param manager The transaction manager.
	 * @param id The account to lock.
	 * @returns The locked account, or null when it does not exist.
	 */
	private async lockHolder(manager: EntityManager, id: ID): Promise<PaymentAccountHolder | null> {
		const query = manager.createQueryBuilder(PaymentAccountHolder, 'holder').where({ id, ...this.scope });

		if (isPostgres() || isMySQL()) {
			// `pessimistic_write` maps to FOR UPDATE on both dialects.
			return query.setLock('pessimistic_write').getOne();
		}

		return query.getOne();
	}

	/**
	 * Refuses a status move the graph does not contain.
	 *
	 * @param holder The account as stored.
	 * @param next The status it would move to.
	 * @throws BadRequestException `PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID`.
	 */
	private assertTransitionAllowed(holder: PaymentAccountHolder, next: PaymentAccountHolderStatus): void {
		if (PaymentAccountHolderService.TERMINAL.includes(holder.status)) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID}: ${holder.status} is terminal, and a new application is a new account rather than a reopened one.`
			);
		}

		if (!PaymentAccountHolderService.TRANSITIONS[holder.status]?.includes(next)) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID}: ${holder.status} does not move to ${next}.`
			);
		}
	}

	/**
	 * Refuses an account shape its next status cannot hold.
	 *
	 * The rule is the external account id, read in the direction that is a statement about behaviour: an
	 * account that may be charged or paid out must name the account it is charged against at the
	 * provider. A `PENDING` account names none — it does not exist at the provider yet — and a `REJECTED`
	 * application never reached the provider, so it keeps the null it was created with. A terminal
	 * account that was once active keeps the reference it was onboarded with, deliberately: the row stays
	 * addressable for the charges and settlements that point at it.
	 *
	 * @param holder The account as stored.
	 * @param next The status it would move to.
	 * @throws BadRequestException `PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID`.
	 */
	private async assertChargeableShape(
		holder: PaymentAccountHolder,
		next: PaymentAccountHolderStatus
	): Promise<void> {
		const chargeable =
			next === PaymentAccountHolderStatus.ACTIVE || next === PaymentAccountHolderStatus.RESTRICTED;

		if (chargeable && !holder.externalAccountId) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID}: an account moves to ${next} only once the provider's reference for it has been recorded, because ${next} may be charged or paid out to.`
			);
		}
	}

	/**
	 * Refuses a move to `ACTIVE` when the party already holds a live account of that kind.
	 *
	 * A party may hold a buyer account and a payout account with the same provider, and any number of
	 * closed ones beside the live one, but never two live accounts of the same kind. The rule is a
	 * statement about the party's other rows, so it is decided inside the transaction that moves the
	 * status, against the same manager.
	 *
	 * @param manager The transaction manager.
	 * @param holder The account being activated.
	 * @param next The status it would move to.
	 * @throws BadRequestException `PAYMENT_ACCOUNT_HOLDER_ACTIVE_EXISTS`.
	 */
	private async assertNoLiveHolderOfKind(
		manager: EntityManager,
		holder: PaymentAccountHolder,
		next: PaymentAccountHolderStatus
	): Promise<void> {
		if (next !== PaymentAccountHolderStatus.ACTIVE || !holder.contactId) {
			// The rule is scoped to a party; a tenant-level account belongs to the organization itself and
			// carries no contact, which the index's own predicate excludes too.
			return;
		}

		const live: PaymentAccountHolder[] = await manager.find(PaymentAccountHolder, {
			where: {
				contactId: holder.contactId,
				providerKey: holder.providerKey,
				type: holder.type,
				status: PaymentAccountHolderStatus.ACTIVE,
				...this.scope
			}
		} as never);

		if (live.some((row) => row.id !== holder.id)) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_ACTIVE_EXISTS}: this party already has an active ${holder.type} account with provider '${holder.providerKey}', and one live account per party, provider and role is the rule.`
			);
		}
	}

	/**
	 * Finds another account of one provider already holding a provider reference.
	 *
	 * The reference is unique inside the provider's namespace rather than inside one tenant, which is why
	 * the lookup is not scoped by organization: the same provider reference under two organizations is a
	 * data defect rather than a second account, and it is refused here rather than tolerated.
	 *
	 * @param providerKey The provider's key.
	 * @param externalAccountId The provider's reference.
	 * @param exceptId The account being written, excluded from the probe.
	 * @returns The account already holding the reference, or null.
	 */
	private async findByProviderAccount(
		providerKey: string,
		externalAccountId: string,
		exceptId: ID
	): Promise<PaymentAccountHolder | null> {
		const holders = await this.typeOrmPaymentAccountHolderRepository.find({
			where: { providerKey, externalAccountId }
		} as never);
		const other = (holders ?? []).filter((row) => row.id !== exceptId);

		return other.length ? other[0] : null;
	}
}
