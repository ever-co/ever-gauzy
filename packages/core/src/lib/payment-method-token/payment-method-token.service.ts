import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ID,
	IPaymentMethodToken,
	IPaymentMethodTokenCreateInput,
	IPaymentMethodTokenUpdateInput,
	JsonData,
	PaymentAccountHolderStatus,
	PaymentMethodTokenStatus,
	PaymentMethodTokenType
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { PaymentAccountHolder } from '../payment-account-holder/payment-account-holder.entity';
import { TypeOrmPaymentAccountHolderRepository } from '../payment-account-holder/repository/type-orm-payment-account-holder.repository';
import { PaymentMethodToken } from './payment-method-token.entity';
import { TypeOrmPaymentMethodTokenRepository } from './repository/type-orm-payment-method-token.repository';
import { MikroOrmPaymentMethodTokenRepository } from './repository/mikro-orm-payment-method-token.repository';

/**
 * The lifetime of a saved instrument: recorded from a provider reference, defaulted, used, revoked.
 *
 * Read the rules of this service as one rule with six faces.
 *
 * 1. **A row exists only because the provider issued its reference.** The creation path takes the
 *    provider's own answer as a required argument and refuses a reference the provider did not return.
 *    Nothing here — and no column behind it — can hold a primary account number, a verification value
 *    or a bank account number, so the platform cannot store one even by mistake.
 * 2. **One instrument is one row.** The provider reference is unique per provider key among live and
 *    non-revoked rows, so the same instrument cannot be saved twice and defaulted twice. Re-adding an
 *    instrument that was *removed* legitimately writes a new row, which is why the uniqueness rule
 *    excludes revoked rows rather than deleted ones only.
 * 3. **At most one default per account and instrument type.** One default card beside one default bank
 *    account is a legitimate configuration, and a new default clears the previous one **in the same
 *    transaction, under a row lock on the account**, so two concurrent writes cannot both believe they
 *    are the default. Only an `ACTIVE` instrument may hold the default, and the refusal names the
 *    state it found: `PAYMENT_METHOD_TOKEN_REVOKED`, `PAYMENT_METHOD_TOKEN_EXPIRED` or
 *    `PAYMENT_METHOD_VALIDATION_FAILED`.
 * 4. **Only an `ACTIVE` instrument may be charged.** `REVOKED` and `EXPIRED` are terminal and are
 *    never reactivated; `FAILED` is recoverable, and a successful charge is what recovers it.
 * 5. **Revocation is the only removal path, and it is idempotent.** The row is kept and `revokedAt` is
 *    stamped, because a charge history that points at a missing instrument is unauditable. Disabling
 *    an account revokes every instrument beneath it in the same transaction, and this service exposes
 *    that step for the account-holder service to call with its own transaction manager rather than
 *    opening a second one.
 * 6. **Every attempt that reached the provider is stamped.** `lastUsedAt` moves on success and on
 *    refusal alike, so "which instrument was tried" is answerable from the row; the decline
 *    bookkeeping it carries alongside is a cache, never a source of truth.
 */
@Injectable()
export class PaymentMethodTokenService extends TenantAwareCrudService<PaymentMethodToken> {
	/** Kinds that do not expire, and therefore never carry a card expiry. */
	private static readonly NON_EXPIRING: PaymentMethodTokenType[] = [
		PaymentMethodTokenType.BANK_ACCOUNT,
		PaymentMethodTokenType.DIRECT_DEBIT
	];

	constructor(
		readonly typeOrmPaymentMethodTokenRepository: TypeOrmPaymentMethodTokenRepository,
		readonly mikroOrmPaymentMethodTokenRepository: MikroOrmPaymentMethodTokenRepository,
		/**
		 * The account table, read directly rather than through the account-holder service: the account
		 * service revokes this service's rows when an account is disabled, so a dependency back from here
		 * to it would be a cycle. What is needed from an account is two columns and its id, and stating
		 * that as a repository read is honest about the size of the dependency.
		 */
		readonly typeOrmPaymentAccountHolderRepository: TypeOrmPaymentAccountHolderRepository
	) {
		super(typeOrmPaymentMethodTokenRepository, mikroOrmPaymentMethodTokenRepository);
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
	 * Records a saved instrument from a reference the provider issued.
	 *
	 * **This is the only creation path, and it takes the provider's confirmation.** The reference alone
	 * proves nothing — any request body can carry a string — so the caller must also present what the
	 * provider itself answered when the platform re-read the instrument at the provider, and the two
	 * must be the same reference. A row that no provider ever returned therefore cannot be written,
	 * which is the machine-enforceable half of "the platform holds a token that is meaningless outside
	 * a call to that provider".
	 *
	 * The account is read and then locked before the write, because everything else about the row is
	 * derived from it: its provider registration, its provider key, and — when the caller asks for the
	 * default — the previous default that has to be cleared in the same transaction.
	 *
	 * @param input The instrument, as the provider issued it and confirmed it.
	 * @returns The stored instrument.
	 * @throws BadRequestException `PAYMENT_METHOD_VALIDATION_FAILED` when the reference is blank, was not
	 * confirmed, disagrees with the confirmation, carries facts its kind cannot carry, or is claimed
	 * against another provider; `PAYMENT_METHOD_TOKEN_ALREADY_SAVED` when the provider reference is
	 * already saved and still reusable; `PAYMENT_ACCOUNT_HOLDER_RESTRICTED` when the account may not take
	 * new instruments.
	 * @throws NotFoundException `PAYMENT_ACCOUNT_HOLDER_NOT_FOUND` when the account is not in the
	 * caller's scope.
	 */
	async recordProviderInstrument(input: IPaymentMethodTokenCreateInput): Promise<IPaymentMethodToken> {
		const fields = this.assertProviderIssued(input);
		const holder = await this.findHolderRecord(input.accountHolderId);

		if (String(holder.providerKey) !== fields.providerKey) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED}: the instrument names provider '${fields.providerKey}' while its account belongs to '${holder.providerKey}', and an instrument can never be moved to another provider than its account's.`
			);
		}

		const duplicate = await this.findReusableToken(fields.providerKey, fields.token);

		if (duplicate) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_METHOD_TOKEN_ALREADY_SAVED}: this provider reference is already saved as instrument '${duplicate.id}', and one instrument is one row.`
			);
		}

		return this.typeOrmPaymentMethodTokenRepository.manager.transaction(async (manager) => {
			// The lock is taken on the account rather than on the instrument, because the row being
			// written does not exist yet and the rule it could break — one default per account and type —
			// is a rule about the account's other instruments.
			await this.lockHolder(manager, holder.id);

			const created = manager.create(PaymentMethodToken, {
				...fields,
				accountHolderId: holder.id,
				paymentProviderId: holder.paymentProviderId,
				status: PaymentMethodTokenStatus.ACTIVE,
				isDefault: false,
				...this.scope
			} as Partial<PaymentMethodToken>);
			const saved = await manager.save(PaymentMethodToken, created);

			if (input.isDefault) {
				return this.applyDefault(manager, saved);
			}

			return saved;
		});
	}

	/**
	 * Loads an instrument that belongs to the caller's organization.
	 *
	 * @param id The instrument id.
	 * @returns The instrument.
	 * @throws NotFoundException `PAYMENT_METHOD_TOKEN_NOT_FOUND` when it does not exist inside the
	 * caller's scope.
	 */
	async findTokenOrFail(id: ID): Promise<IPaymentMethodToken> {
		const token = await this.findToken(id);

		if (!token) {
			throw new NotFoundException(`${ApiErrorCode.PAYMENT_METHOD_TOKEN_NOT_FOUND}: no such saved instrument.`);
		}

		return token;
	}

	/**
	 * Lists the instruments of one account, newest use last.
	 *
	 * @param accountHolderId The account at the provider.
	 * @param filter Optional narrowing by kind or lifecycle status.
	 * @returns The instruments, default first, then most recently used.
	 */
	async listByHolder(
		accountHolderId: ID,
		filter: { type?: PaymentMethodTokenType; status?: PaymentMethodTokenStatus } = {}
	): Promise<IPaymentMethodToken[]> {
		const tokens: IPaymentMethodToken[] = await this.find({
			where: {
				accountHolderId,
				...(filter.type ? { type: filter.type } : {}),
				...(filter.status ? { status: filter.status } : {}),
				...this.scope
			},
			order: { isDefault: 'DESC', lastUsedAt: 'DESC' }
		} as never);

		return tokens;
	}

	/**
	 * The account's default instrument of one kind.
	 *
	 * @param accountHolderId The account at the provider.
	 * @param type The kind asked for; absent means any kind.
	 * @returns The default instrument, or null when the account holds none of that kind.
	 */
	async findDefaultToken(accountHolderId: ID, type?: PaymentMethodTokenType): Promise<IPaymentMethodToken | null> {
		const defaults = await this.find({
			where: {
				accountHolderId,
				isDefault: true,
				...(type ? { type } : {}),
				...this.scope
			}
		} as never);

		return defaults.length ? defaults[0] : null;
	}

	/**
	 * Every default instrument of one account, so a caller can tell "none" from "more than one".
	 *
	 * @param accountHolderId The account at the provider.
	 * @param type The kind asked for; absent means any kind.
	 * @returns The default instruments.
	 */
	async findDefaultTokens(accountHolderId: ID, type?: PaymentMethodTokenType): Promise<IPaymentMethodToken[]> {
		return this.find({
			where: {
				accountHolderId,
				isDefault: true,
				...(type ? { type } : {}),
				...this.scope
			}
		} as never);
	}

	/**
	 * Changes the descriptive facts of an instrument.
	 *
	 * The reference, the account, the provider key and the kind are not among them: a reference is what
	 * the provider issued, an instrument never moves between accounts, and the kind decides both the
	 * default rule and whether a mandate is required. A body that changes one of those is refused rather
	 * than silently ignored, because a caller that believes it renamed an instrument has a bug it would
	 * otherwise never see.
	 *
	 * @param id The instrument to change.
	 * @param input The facts to change.
	 * @returns The stored instrument.
	 * @throws BadRequestException when the instrument is terminal, or when the change would give an
	 * instrument an expiry its kind cannot carry.
	 * @throws NotFoundException when the instrument is not in the caller's scope.
	 */
	async updateToken(id: ID, input: IPaymentMethodTokenUpdateInput): Promise<IPaymentMethodToken> {
		const token = await this.findTokenOrFail(id);

		if (token.status === PaymentMethodTokenStatus.REVOKED) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_METHOD_TOKEN_REVOKED}: a removed instrument is never edited, and re-adding one writes a new row.`
			);
		}

		const expiry = {
			expiryMonth: input.expiryMonth ?? token.expiryMonth,
			expiryYear: input.expiryYear ?? token.expiryYear
		};

		this.assertExpiryFitsKind(token.type, expiry.expiryMonth, expiry.expiryYear);

		await this.update(id, {
			...(input.brand !== undefined ? { brand: input.brand } : {}),
			...(input.last4 !== undefined ? { last4: input.last4 } : {}),
			...(input.expiryMonth !== undefined ? { expiryMonth: input.expiryMonth } : {}),
			...(input.expiryYear !== undefined ? { expiryYear: input.expiryYear } : {}),
			...(input.holderName !== undefined ? { holderName: input.holderName } : {}),
			...(input.billingAddressId !== undefined ? { billingAddressId: input.billingAddressId } : {}),
			// Merged rather than replaced, because the fragment carries the provider's own confirmation of
			// this reference alongside the tenant's extras: a descriptive update that dropped it would
			// erase the record of where the reference came from.
			...(input.metadata !== undefined
				? {
						metadata:
							input.metadata && typeof input.metadata === 'object'
								? this.mergeMetadata(token.metadata, input.metadata as Record<string, unknown>)
								: input.metadata
					}
				: {})
		} as never);

		return this.findTokenOrFail(id);
	}

	/**
	 * Makes an instrument the default of its account for its kind, clearing the previous default.
	 *
	 * **One transaction, and a row lock on the account.** The rule is "at most one default per account
	 * and instrument type", which is a statement about the account's other rows rather than about this
	 * one; a check outside a transaction would let two concurrent writes both find no default and both
	 * become one. The account row is therefore locked first, the instrument is re-read under that lock,
	 * and the previous default of the same kind is cleared in the same unit of work.
	 *
	 * @param id The instrument to make the default.
	 * @returns The stored instrument.
	 * @throws BadRequestException `PAYMENT_METHOD_TOKEN_REVOKED`, `PAYMENT_METHOD_TOKEN_EXPIRED` or
	 * `PAYMENT_METHOD_VALIDATION_FAILED` when the instrument is not `ACTIVE` — a default instrument is
	 * the one a renewal charges, so a default that cannot be charged is worse than no default at all.
	 * @throws NotFoundException when the instrument is not in the caller's scope.
	 */
	async setDefaultToken(id: ID): Promise<IPaymentMethodToken> {
		const token = await this.findTokenOrFail(id);

		this.assertDefaultable(token);

		const saved = await this.typeOrmPaymentMethodTokenRepository.manager.transaction(async (manager) => {
			await this.lockHolder(manager, token.accountHolderId);

			// Re-read under the lock: the status may have moved between the read above and the lock, and
			// the decision this method makes is exactly the one the lock exists to protect.
			const stored = await manager.findOne(PaymentMethodToken, {
				where: { id, ...this.scope }
			} as never);

			if (!stored) {
				throw new NotFoundException(
					`${ApiErrorCode.PAYMENT_METHOD_TOKEN_NOT_FOUND}: no such saved instrument.`
				);
			}

			this.assertDefaultable(stored);

			return this.applyDefault(manager, stored);
		});

		return this.findTokenOrFail(saved.id);
	}

	/**
	 * Clears the default from an instrument, naming no replacement.
	 *
	 * An account may legitimately hold no default — a party that has just removed the instrument it
	 * used — so this is an operation of its own rather than a consequence of revocation.
	 *
	 * @param id The instrument to clear.
	 * @returns The stored instrument.
	 * @throws NotFoundException when the instrument is not in the caller's scope.
	 */
	async clearDefaultToken(id: ID): Promise<IPaymentMethodToken> {
		await this.findTokenOrFail(id);
		await this.update(id, { isDefault: false } as never);

		return this.findTokenOrFail(id);
	}

	/**
	 * Removes an instrument, keeping its row.
	 *
	 * **Idempotent, and terminal.** A second revocation answers with the row the first one wrote and
	 * changes nothing, so a retried removal — which a client performs routinely — cannot stamp a second
	 * instant or fail. The row is kept and `revokedAt` is stamped, because the charges that used the
	 * instrument have to keep resolving; re-adding the same instrument writes a new row, which is
	 * exactly what the uniqueness rule's `REVOKED` predicate permits.
	 *
	 * @param id The instrument to remove.
	 * @returns The stored instrument, revoked.
	 * @throws NotFoundException when the instrument is not in the caller's scope.
	 */
	async revokeToken(id: ID): Promise<IPaymentMethodToken> {
		const token = await this.findTokenOrFail(id);

		if (token.status === PaymentMethodTokenStatus.REVOKED) {
			return token;
		}

		await this.update(id, {
			status: PaymentMethodTokenStatus.REVOKED,
			revokedAt: new Date(),
			isDefault: false
		} as never);

		return this.findTokenOrFail(id);
	}

	/**
	 * Revokes every instrument of one account, inside a transaction the caller already opened.
	 *
	 * This is the step an account's disabling performs, and it is deliberately shaped to be called with
	 * somebody else's manager: the rule is that disabling an account revokes its instruments **in the
	 * same transaction**, so opening a second transaction here would be the defect the rule exists to
	 * prevent. A live instrument under a closed account is exactly the state a caller holding a stale
	 * identifier would try to reach.
	 *
	 * @param manager The transaction manager the caller is writing through.
	 * @param accountHolderId The account being closed.
	 * @returns How many rows were revoked.
	 */
	async revokeTokensOfHolder(manager: EntityManager, accountHolderId: ID): Promise<number> {
		const rows: PaymentMethodToken[] = await manager.find(PaymentMethodToken, {
			where: { accountHolderId, ...this.scope }
		} as never);
		const live = rows.filter((row) => row.status !== PaymentMethodTokenStatus.REVOKED);

		if (!live.length) {
			return 0;
		}

		const now = new Date();

		for (const row of live) {
			row.status = PaymentMethodTokenStatus.REVOKED;
			row.revokedAt = now;
			row.isDefault = false;
		}

		await manager.save(PaymentMethodToken, live);

		return live.length;
	}

	/**
	 * Moves an instrument whose expiry has passed to `EXPIRED`.
	 *
	 * Terminal, and it clears the default with it: a default instrument is the one a renewal charges,
	 * and leaving an expired instrument as the default would make every renewal fail on the same row.
	 * The sweep that calls this passes the instruments it read; this method writes one.
	 *
	 * @param id The instrument to expire.
	 * @returns The stored instrument.
	 * @throws NotFoundException when the instrument is not in the caller's scope.
	 */
	async expireToken(id: ID): Promise<IPaymentMethodToken> {
		const token = await this.findTokenOrFail(id);

		if (token.status === PaymentMethodTokenStatus.REVOKED) {
			// Removed outranks expired: revocation is a decision somebody made, and overwriting it would
			// lose the only record of why the instrument went away.
			return token;
		}

		await this.update(id, {
			status: PaymentMethodTokenStatus.EXPIRED,
			isDefault: false
		} as never);

		return this.findTokenOrFail(id);
	}

	/**
	 * Records that an authorisation attempt reached the provider.
	 *
	 * `lastUsedAt` moves on every attempt that got an answer, successful or not, so "which instrument
	 * was tried" is answerable from the token row rather than reconstructed from another table. A
	 * successful attempt also clears the decline bookkeeping and recovers a `FAILED` instrument, which
	 * is the one way back from that state: the provider accepted it, so the earlier refusal no longer
	 * describes it.
	 *
	 * @param id The instrument that was attempted.
	 * @param outcome What the provider answered. `terminal` is the caller's judgement that the refusal
	 * is one no retry can change; the decline threshold that also produces a terminal refusal is the
	 * payment capability's policy, and it states the verdict here rather than this service guessing it.
	 * @returns The stored instrument.
	 * @throws NotFoundException when the instrument is not in the caller's scope.
	 */
	async recordProviderAttempt(
		id: ID,
		outcome: { succeeded: boolean; declineCode?: string; terminal?: boolean }
	): Promise<IPaymentMethodToken> {
		const token = await this.findTokenOrFail(id);
		const now = new Date();

		if (outcome.succeeded) {
			await this.update(id, {
				lastUsedAt: now,
				status: PaymentMethodTokenStatus.ACTIVE,
				metadata: this.mergeMetadata(token.metadata, {
					consecutiveDeclines: 0,
					lastDeclineCode: null,
					lastDeclineAt: null
				})
			} as never);

			return this.findTokenOrFail(id);
		}

		const declines = Number((token.metadata as Record<string, unknown>)?.consecutiveDeclines ?? 0) + 1;

		await this.update(id, {
			lastUsedAt: now,
			...(outcome.terminal ? { status: PaymentMethodTokenStatus.FAILED, isDefault: false } : {}),
			metadata: this.mergeMetadata(token.metadata, {
				consecutiveDeclines: declines,
				lastDeclineCode: outcome.declineCode ?? null,
				lastDeclineAt: now
			})
		} as never);

		return this.findTokenOrFail(id);
	}

	/**
	 * Refuses an instrument that may not be charged.
	 *
	 * The three terminal and non-chargeable states are named separately, because a caller's next step
	 * differs: a removed instrument has to be re-added by the party, an expired one replaced, and a
	 * refused one re-saved. This is the guard a charge path calls before it names an instrument to the
	 * provider, and it is a statement about the row rather than a lookup, so it costs nothing.
	 *
	 * @param token The instrument about to be charged.
	 * @throws BadRequestException with the code that names the state.
	 */
	assertChargeable(token: IPaymentMethodToken): void {
		if (token.status === PaymentMethodTokenStatus.ACTIVE) {
			return;
		}

		if (token.status === PaymentMethodTokenStatus.REVOKED) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_METHOD_TOKEN_REVOKED}: the instrument was removed and is never charged again.`
			);
		}

		if (token.status === PaymentMethodTokenStatus.EXPIRED) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_METHOD_TOKEN_EXPIRED}: the instrument's expiry has passed and it is never charged again.`
			);
		}

		throw new BadRequestException(
			`${ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED}: the instrument was refused by the provider and is not chargeable until it is saved again.`
		);
	}

	/**
	 * Reads one instrument of the caller's organization, answering null when there is none.
	 *
	 * The answering form exists because a caller that has to decide what to do about a missing
	 * instrument — a renewal resolving a remembered payer, an audit reconciling a register — treats the
	 * miss as an ordinary fact, while {@link findTokenOrFail} is for a caller that was handed an
	 * identifier it must honour.
	 *
	 * @param id The instrument id.
	 * @returns The instrument, or null.
	 */
	async findToken(id: ID): Promise<IPaymentMethodToken | null> {
		const tokens: PaymentMethodToken[] = await this.find({ where: { id, ...this.scope } } as never);

		return tokens.length ? tokens[0] : null;
	}

	/**
	 * Reads the account an instrument is being saved against.
	 *
	 * @param accountHolderId The account id.
	 * @returns The account record.
	 * @throws NotFoundException `PAYMENT_ACCOUNT_HOLDER_NOT_FOUND` when there is no such account.
	 * @throws BadRequestException `PAYMENT_ACCOUNT_HOLDER_RESTRICTED` when the account is closed.
	 */
	private async findHolderRecord(accountHolderId: ID): Promise<PaymentAccountHolder> {
		const holder = await this.typeOrmPaymentAccountHolderRepository.findOne({
			where: { id: accountHolderId, ...this.scope }
		} as never);

		if (!holder) {
			throw new NotFoundException(
				`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_NOT_FOUND}: the instrument names an account this organization does not have.`
			);
		}

		if (
			holder.status === PaymentAccountHolderStatus.DISABLED ||
			holder.status === PaymentAccountHolderStatus.REJECTED
		) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_RESTRICTED}: a closed account takes no new instruments.`
			);
		}

		return holder;
	}

	/**
	 * Finds a live, reusable instrument already saved under one provider reference.
	 *
	 * @param providerKey The provider's key.
	 * @param token The provider's reference.
	 * @returns The existing instrument, or null.
	 */
	private async findReusableToken(providerKey: string, token: string): Promise<IPaymentMethodToken | null> {
		const rows: PaymentMethodToken[] = await this.find({
			where: { providerKey, token, ...this.scope }
		} as never);
		const reusable = rows.filter((row) => row.status !== PaymentMethodTokenStatus.REVOKED);

		return reusable.length ? reusable[0] : null;
	}

	/**
	 * Validates the shape of a creation, and returns the columns it may write.
	 *
	 * Everything the caller could get wrong is refused here rather than stored and discovered later: a
	 * blank or unconfirmed reference, a confirmation that names another reference, a kind that cannot
	 * carry an expiry given one, and half an expiry given on its own.
	 *
	 * @param input The creation as the caller stated it.
	 * @returns The columns the row is written from.
	 * @throws BadRequestException `PAYMENT_METHOD_VALIDATION_FAILED` for every one of those shapes.
	 */
	private assertProviderIssued(input: IPaymentMethodTokenCreateInput): Partial<PaymentMethodToken> {
		if (!input.token || !String(input.token).trim()) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED}: a saved instrument is written from a reference the provider issued, and none was presented.`
			);
		}

		if (!input.providerKey || !String(input.providerKey).trim()) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED}: the instrument names no provider, and a reference without a provider is meaningless.`
			);
		}

		const confirmation = input.providerConfirmation;

		if (!confirmation || !confirmation.token || !confirmation.confirmedAt) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED}: the instrument was not confirmed against the provider, and a value a caller composed is never saved.`
			);
		}

		if (String(confirmation.token).trim() !== String(input.token).trim()) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED}: the provider confirmed a different reference than the one presented, so the presented reference is not the provider's.`
			);
		}

		const type = input.type ?? PaymentMethodTokenType.CARD;

		this.assertExpiryFitsKind(type, input.expiryMonth, input.expiryYear);

		return {
			providerKey: String(input.providerKey).trim(),
			token: String(input.token).trim(),
			type,
			brand: input.brand,
			last4: input.last4,
			expiryMonth: input.expiryMonth,
			expiryYear: input.expiryYear,
			holderName: input.holderName,
			billingAddressId: input.billingAddressId,
			metadata: this.mergeMetadata(input.metadata, {
				providerConfirmedAt: confirmation.confirmedAt
			})
		};
	}

	/**
	 * Refuses an expiry on an instrument whose kind does not expire.
	 *
	 * A bank account does not expire and a recurring debit is bounded by its mandate, so an expiry on
	 * either is a provider-integration defect: storing it would make the expiry sweep expire an
	 * instrument that was never expiring, and the party would lose an instrument that still works.
	 *
	 * @param type The instrument's kind.
	 * @param expiryMonth The month stated, when one was.
	 * @param expiryYear The year stated, when one was.
	 * @throws BadRequestException `PAYMENT_METHOD_VALIDATION_FAILED` when the pairing is impossible.
	 */
	private assertExpiryFitsKind(
		type: PaymentMethodTokenType,
		expiryMonth?: number,
		expiryYear?: number
	): void {
		const hasMonth = expiryMonth !== undefined && expiryMonth !== null;
		const hasYear = expiryYear !== undefined && expiryYear !== null;

		if (hasMonth !== hasYear) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED}: an expiry is a month and a year together, and half of one names no instant.`
			);
		}

		if (hasMonth && PaymentMethodTokenService.NON_EXPIRING.includes(type)) {
			throw new BadRequestException(
				`${ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED}: a ${type} instrument does not expire, so an expiry on it is an integration defect rather than a fact.`
			);
		}
	}

	/**
	 * Refuses a default on an instrument that is not `ACTIVE`.
	 *
	 * @param token The instrument that would become the default.
	 * @throws BadRequestException with the code that names the state it found.
	 */
	private assertDefaultable(token: IPaymentMethodToken): void {
		if (token.status === PaymentMethodTokenStatus.ACTIVE) {
			return;
		}

		this.assertChargeable(token);
	}

	/**
	 * Makes one instrument the default of its account and kind, clearing the one it replaces.
	 *
	 * The caller has already locked the account, so the read of the previous default and the write of
	 * the new one cannot interleave with another writer's.
	 *
	 * @param manager The transaction manager.
	 * @param token The instrument that becomes the default.
	 * @returns The stored instrument.
	 */
	private async applyDefault(manager: EntityManager, token: PaymentMethodToken): Promise<PaymentMethodToken> {
		const previous: PaymentMethodToken[] = await manager.find(PaymentMethodToken, {
			where: {
				accountHolderId: token.accountHolderId,
				type: token.type,
				isDefault: true,
				...this.scope
			}
		} as never);
		const displaced = previous.filter((row) => row.id !== token.id);

		for (const row of displaced) {
			row.isDefault = false;
		}

		if (displaced.length) {
			await manager.save(PaymentMethodToken, displaced);
		}

		token.isDefault = true;

		return manager.save(PaymentMethodToken, token);
	}

	/**
	 * Reads the account row under a lock where the dialect supports one.
	 *
	 * The lock is what makes "at most one default per account and kind" hold under concurrency: the
	 * rule is a statement about the account's other rows, so the account is the row that has to be held.
	 * The embedded dialect serializes writers on its own, so there the surrounding transaction is the
	 * lock and no statement is added.
	 *
	 * @param manager The transaction manager.
	 * @param accountHolderId The account to lock.
	 * @returns The locked account row, or null when it disappeared.
	 */
	private async lockHolder(manager: EntityManager, accountHolderId: ID): Promise<PaymentAccountHolder | null> {
		const query = manager
			.createQueryBuilder(PaymentAccountHolder, 'holder')
			.where({ id: accountHolderId, ...this.scope });

		if (isPostgres() || isMySQL()) {
			// `pessimistic_write` maps to FOR UPDATE on both dialects.
			return query.setLock('pessimistic_write').getOne();
		}

		return query.getOne();
	}

	/**
	 * Merges changes into a row's provider fragment.
	 *
	 * A metadata column may hold a plain string on a row written through a legacy path, and merging into
	 * a string would throw; such a value is kept under a key of its own rather than discarded, so no
	 * write loses what an earlier one stored.
	 *
	 * @param current The fragment as stored.
	 * @param changes The keys to set.
	 * @returns The merged fragment.
	 */
	private mergeMetadata(current: JsonData | undefined, changes: Record<string, unknown>): JsonData {
		const base: Record<string, unknown> =
			current && typeof current === 'object' ? { ...(current as Record<string, unknown>) } : {};

		if (typeof current === 'string' && current.length) {
			base.legacyMetadata = current;
		}

		return { ...base, ...changes };
	}
}
