import { Injectable, Optional } from '@nestjs/common';
import { In } from 'typeorm';
import {
	ID,
	IPagination,
	IPaymentMethodToken,
	IPaymentMethodTokenCreateInput,
	IPaymentMethodTokenUpdateInput,
	PaymentMethodTokenStatus,
	PaymentMethodTokenType,
	PermissionsEnum
} from '@gauzy/contracts';
import { FieldVisibility, PaymentAccountHolderService, PaymentMethodTokenService } from '@gauzy/core';

/**
 * The narrowing the instrument list accepts, as the query DTO and the schema both state it.
 */
export interface IPaymentMethodTokenQuery {
	readonly id?: ID;
	readonly contactId?: ID;
	readonly accountHolderId?: ID;
	readonly providerKey?: string;
	readonly type?: PaymentMethodTokenType;
	readonly status?: PaymentMethodTokenStatus;
	readonly isDefault?: boolean;
}

/**
 * A page of instruments and the page's own size.
 */
export interface IPaymentMethodTokenPage {
	readonly take?: number;
	readonly skip?: number;
}

/**
 * What the default change answers with: the stored instrument, and the one it displaced beside it.
 *
 * The displaced identifier travels on the row for the same reason the disable count does: the endpoint
 * catalogue states the answer that way ("instrument row, `previousDefaultId`"), and one object serves
 * both the REST body and the GraphQL payload.
 */
export interface IPaymentMethodTokenDefaultResult extends IPaymentMethodToken {
	/** The instrument that held the default for this account and kind until this change, when one did. */
	readonly previousDefaultId?: ID;
}

/**
 * The saved instrument as this API exposes it.
 *
 * The kernel owns the rules — a row exists only because the provider issued and confirmed its
 * reference, one instrument is one row, one default per account and kind, revocation is the only
 * removal path — and this service owns none of them. What it owns is the **answer**: the three things
 * the REST routes and the GraphQL root fields need and the kernel deliberately exposes in parts.
 *
 * 1. **The list, and the party's instruments within it.** The kernel's read is per account, because
 *    that is the only scope an instrument's uniqueness and default rules are stated in; a caller
 *    asking for "this party's instruments" is answered by resolving the party's accounts first and
 *    then reading one page of the instruments under them, rather than by a scan the caller filters.
 * 2. **The default change, with the instrument it displaced.** The kernel clears the previous default
 *    inside the same transaction and under the same row lock that sets the new one — that is the rule
 *    — but it does not report which row it displaced, and the answer is part of the operation's
 *    contract. The displaced row is therefore read before the write and reported beside it.
 * 3. **The projection of the stored reference.** The raw value is what the platform holds in place of
 *    a card, so it leaves this service only where the contract allows it to: never in a list, for any
 *    caller, and on a single row only for a caller that may charge the instrument. The decision is
 *    the platform's own `FieldVisibility`, so the REST projection and the GraphQL field gate of
 *    `17-graphql-api-specification.md` §6.4 ask one question and cannot disagree.
 */
@Injectable()
export class PaymentMethodTokenLifecycleService {
	constructor(
		private readonly paymentMethodTokenService: PaymentMethodTokenService,
		private readonly paymentAccountHolderService: PaymentAccountHolderService,
		/**
		 * The platform's field-level visibility decision. Optional and defaulted rather than injected,
		 * exactly as the REST projection interceptor takes it: it is a pure decision over the caller's
		 * grants and owns no state, and a deployment that never registered it must still answer.
		 */
		@Optional() private readonly visibility: FieldVisibility = new FieldVisibility()
	) {}

	/**
	 * One page of instruments, defaults first.
	 *
	 * A party's instruments are its accounts' instruments, so a `contactId` narrowing resolves the
	 * accounts of that party inside the caller's own tenant and organization and then reads the page
	 * under them. A party that holds no account has no instruments, which is an empty page rather than
	 * an error: a miss here is an ordinary fact about a party that has not saved anything yet.
	 *
	 * @param query The narrowing the caller stated.
	 * @param page The page to read.
	 * @param order The ordering the caller asked for; the default is defaults-first.
	 * @returns The page, with every row projected.
	 */
	async list(
		query: IPaymentMethodTokenQuery = {},
		page: IPaymentMethodTokenPage = {},
		order?: Record<string, string>
	): Promise<IPagination<IPaymentMethodToken>> {
		const where: Record<string, unknown> = {};

		if (query.id) {
			where.id = query.id;
		}
		if (query.providerKey) {
			where.providerKey = query.providerKey;
		}
		if (query.type) {
			where.type = query.type;
		}
		if (query.status) {
			where.status = query.status;
		}
		if (query.isDefault !== undefined) {
			where.isDefault = query.isDefault;
		}

		if (query.accountHolderId) {
			where.accountHolderId = query.accountHolderId;
		} else if (query.contactId) {
			const holders = await this.paymentAccountHolderService.listHolders({ contactId: query.contactId });

			if (!holders.length) {
				return { items: [], total: 0 };
			}

			where.accountHolderId = In(holders.map((holder) => holder.id));
		}

		const result: IPagination<IPaymentMethodToken> = await this.paymentMethodTokenService.findAll({
			where,
			// Defaults first, then the most recently used, then newest: a stable order, because a page
			// that can be ordered two ways is a page that can repeat or skip a row between requests. A
			// caller that states an order is obeyed instead: "defaults first" is the default, not a rule.
			order: order ?? { isDefault: 'DESC', lastUsedAt: 'DESC', createdAt: 'DESC' },
			...(page.take !== undefined ? { take: page.take } : {}),
			...(page.skip !== undefined ? { skip: page.skip } : {})
		} as never);

		return {
			items: (result?.items ?? []).map((row) => this.mask(row)),
			total: result?.total ?? 0
		};
	}

	/**
	 * One instrument, as the single-row read carries it.
	 *
	 * @param id The instrument to read.
	 * @returns The stored instrument, with the reference projected for a caller that may charge it.
	 * @throws NotFoundException `PAYMENT_METHOD_TOKEN_NOT_FOUND` when it is not in the caller's scope.
	 */
	async read(id: ID): Promise<IPaymentMethodToken> {
		return this.project(await this.paymentMethodTokenService.findTokenOrFail(id));
	}

	/**
	 * Records an instrument from a reference the provider issued and confirmed.
	 *
	 * @param input The instrument, as the provider issued it and confirmed it.
	 * @returns The stored instrument.
	 */
	async register(input: IPaymentMethodTokenCreateInput): Promise<IPaymentMethodToken> {
		return this.project(await this.paymentMethodTokenService.recordProviderInstrument(input));
	}

	/**
	 * Changes the descriptive facts of an instrument.
	 *
	 * @param id The instrument to change.
	 * @param input The facts to change.
	 * @returns The stored instrument.
	 */
	async update(id: ID, input: IPaymentMethodTokenUpdateInput): Promise<IPaymentMethodToken> {
		return this.project(await this.paymentMethodTokenService.updateToken(id, input));
	}

	/**
	 * Makes an instrument the default of its account and kind, reporting the one it displaced.
	 *
	 * The displaced row is read before the write, and the read is the operation's own: the write clears
	 * the previous default of the same kind inside one transaction under a lock on the account, so the
	 * row this read sees is the row that write will clear unless another writer won the race — in which
	 * case the kernel refuses the change rather than overwriting it, and the answer here is never
	 * reached. An instrument that is already the default displaces nothing.
	 *
	 * @param id The instrument to make the default.
	 * @returns The stored instrument and the instrument it replaced, when there was one.
	 * @throws BadRequestException `PAYMENT_METHOD_TOKEN_REVOKED`, `PAYMENT_METHOD_TOKEN_EXPIRED` or
	 * `PAYMENT_METHOD_VALIDATION_FAILED` when the instrument is not `ACTIVE`.
	 * @throws NotFoundException when the instrument is not in the caller's scope.
	 */
	async makeDefault(id: ID): Promise<IPaymentMethodTokenDefaultResult> {
		const token = await this.paymentMethodTokenService.findTokenOrFail(id);
		const current = await this.paymentMethodTokenService.findDefaultToken(token.accountHolderId, token.type);
		const instrument = await this.paymentMethodTokenService.setDefaultToken(id);

		return {
			...this.project(instrument),
			previousDefaultId: current && current.id !== id ? current.id : undefined
		};
	}

	/**
	 * Revokes an instrument, keeping its row.
	 *
	 * @param id The instrument to revoke.
	 * @returns The stored instrument, revoked.
	 * @throws NotFoundException when the instrument is not in the caller's scope.
	 */
	async revoke(id: ID): Promise<IPaymentMethodToken> {
		return this.project(await this.paymentMethodTokenService.revokeToken(id));
	}

	/**
	 * How many instruments of one account are still live, which is what disabling the account revokes.
	 *
	 * Counting before the disable is deliberate: the disable performs the revocation inside its own
	 * transaction and does not report a count, so the number is read from the account's instruments as
	 * they stand. It is a report rather than a decision — the operation that closes the account is what
	 * revokes them — so a concurrent revocation making the count an over-count cannot make the disable
	 * wrong.
	 *
	 * @param accountHolderId The account being closed.
	 * @returns The number of instruments that are not already revoked.
	 */
	async countLive(accountHolderId: ID): Promise<number> {
		const instruments = await this.paymentMethodTokenService.listByHolder(accountHolderId);

		return instruments.filter((row) => row.status !== PaymentMethodTokenStatus.REVOKED).length;
	}

	/**
	 * The row as a **list** carries it: the masked summary, never the stored reference.
	 *
	 * No list carries the value for any caller, in any permission configuration. A page of instruments
	 * exists to let a party choose one, and choosing one needs the brand, the last four and the expiry;
	 * a value that is useless outside a call to the provider is not part of that answer, and a list is
	 * the one shape where it would be returned for rows the caller never named.
	 *
	 * @param row The stored instrument.
	 * @returns The instrument without its reference.
	 */
	mask(row: IPaymentMethodToken): IPaymentMethodToken {
		if (!row) {
			return row;
		}

		const masked = { ...row } as Record<string, unknown>;
		delete masked.token;

		return masked as unknown as IPaymentMethodToken;
	}

	/**
	 * The row as a **single read or a mutation answer** carries it.
	 *
	 * The reference is projected — removed, never nulled, so a caller cannot tell a withheld value from
	 * a field the resource does not have — unless the caller holds `PAYMENT_METHOD_TOKENS_CHARGE`, the
	 * permission the raw value is gated on. Holding it is necessary and not sufficient: the owning
	 * credential still bounds what a contact-scoped caller may read, and until that subject is carried
	 * by the request context the permission is the narrower of the two predicates this package can
	 * evaluate. What is asserted today is the direction that matters: without the charge permission no
	 * route and no root field returns the stored reference.
	 *
	 * @param row The stored instrument.
	 * @returns The instrument, with the reference present only for a caller that may charge it.
	 */
	project(row: IPaymentMethodToken): IPaymentMethodToken {
		if (!row || this.visibility.canSee(PermissionsEnum.PAYMENT_METHOD_TOKENS_CHARGE)) {
			return row;
		}

		return this.mask(row);
	}
}
