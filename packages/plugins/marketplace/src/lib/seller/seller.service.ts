import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere, In } from 'typeorm';
import {
	CurrencyCode,
	DecimalString,
	ID,
	IPagination,
	ISellerBalance,
	ISellerStatement,
	ISellerStatementLine,
	SellerPayoutSchedule,
	SellerStatus,
	SellerTransactionStatus,
	SellerVerificationKind,
	SellerVerificationStatus
} from '@gauzy/contracts';
import { EventOutboxService, Money, RequestContext, TenantAwareCrudService, isUniqueViolation } from '@gauzy/core';
import { Seller } from './seller.entity';
import { MikroOrmSellerRepository } from './repository/mikro-orm-seller.repository';
import { TypeOrmSellerRepository } from './repository/type-orm-seller.repository';
import { TypeOrmSellerTransactionRepository } from '../seller-transaction/repository/type-orm-seller-transaction.repository';
import { TypeOrmSellerPayoutRepository } from '../seller-payout/repository/type-orm-seller-payout.repository';
import { TypeOrmSellerSettlementRepository } from '../seller-settlement/repository/type-orm-seller-settlement.repository';
import { ISellerScope, assertSellerScope } from '../seller-scope/seller-scope';

/**
 * The transitions the seller lifecycle permits, and the only ones.
 *
 * A map rather than a set of `if`s, because "every other transition is refused" is a claim about the
 * whole graph and it should be readable as one.
 */
const SELLER_TRANSITIONS: Record<SellerStatus, SellerStatus[]> = {
	[SellerStatus.DRAFT]: [SellerStatus.SUBMITTED],
	[SellerStatus.SUBMITTED]: [SellerStatus.IN_REVIEW],
	[SellerStatus.IN_REVIEW]: [SellerStatus.ACTION_REQUIRED, SellerStatus.REJECTED, SellerStatus.APPROVED],
	[SellerStatus.ACTION_REQUIRED]: [SellerStatus.SUBMITTED, SellerStatus.IN_REVIEW],
	[SellerStatus.REJECTED]: [],
	[SellerStatus.APPROVED]: [SellerStatus.ACTIVE],
	[SellerStatus.ACTIVE]: [SellerStatus.SUSPENDED, SellerStatus.OFFBOARDING],
	[SellerStatus.SUSPENDED]: [SellerStatus.ACTIVE, SellerStatus.OFFBOARDING],
	[SellerStatus.OFFBOARDING]: [SellerStatus.OFFBOARDED],
	[SellerStatus.OFFBOARDED]: []
};

/**
 * Manages seller accounts and their lifecycle.
 *
 * Four invariants are enforced here rather than hoped for:
 *
 * - **One organization, forever.** `organizationId` is never read from a request body and the update
 *   path ignores it outright; every child row a marketplace service writes copies the organization of
 *   the parent row it read.
 * - **Every referenced parent belongs to the same organization.** A bare foreign key cannot catch two
 *   rows from different organizations referencing each other's ids, so each write cross-checks and
 *   refuses with an organization mismatch.
 * - **`ACTIVE` is never implicit.** It is reached by an explicit activation after every required
 *   verification passed, so a verification callback can move a seller to `APPROVED` and no further.
 * - **Suspension stops the future and touches nothing in flight.** Offerings are paused and held
 *   balances stay held; placed orders, their fulfilments and the ledger are untouched.
 */
@Injectable()
export class SellerService extends TenantAwareCrudService<Seller> {
	constructor(
		readonly typeOrmSellerRepository: TypeOrmSellerRepository,
		readonly mikroOrmSellerRepository: MikroOrmSellerRepository,
		private readonly outbox: EventOutboxService,
		private readonly transactionRepository: TypeOrmSellerTransactionRepository,
		private readonly payoutRepository: TypeOrmSellerPayoutRepository,
		private readonly settlementRepository: TypeOrmSellerSettlementRepository
	) {
		super(typeOrmSellerRepository, mikroOrmSellerRepository);
	}

	/**
	 * Creates a seller account in `DRAFT`.
	 *
	 * @param input The seller as the caller supplied it.
	 * @param scope The caller's seller scope, when the caller is a seller's own person applying.
	 * @returns The created seller.
	 * @throws BadRequestException when no party is named.
	 * @throws ConflictException when the party or the code is already bound in this organization.
	 */
	async createSeller(input: Partial<Seller>, scope?: ISellerScope): Promise<Seller> {
		if (!input.contactId) {
			throw new BadRequestException('A seller must be bound to an organization contact.');
		}

		if (!input.code) {
			throw new BadRequestException('A seller must have a code.');
		}

		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();

		const seller = this.typeOrmSellerRepository.create({
			...input,
			// Neither identifier is ever taken from the body: they are the caller's context, and the
			// seller belongs to the organization that created it for the rest of its life.
			organizationId,
			tenantId,
			status: SellerStatus.DRAFT,
			businessVerificationStatus: SellerVerificationStatus.UNVERIFIED,
			taxVerificationStatus: SellerVerificationStatus.UNVERIFIED,
			payoutAccountStatus: SellerVerificationStatus.UNVERIFIED
		} as Partial<Seller>);

		try {
			const created = await this.typeOrmSellerRepository.manager.transaction(async (manager) => {
				const saved = await manager.save(Seller, seller as Seller);

				await this.outbox.append(manager, {
					name: 'seller.created',
					aggregateType: 'SELLER',
					aggregateId: saved.id as ID,
					data: {
						sellerId: saved.id,
						code: saved.code,
						name: saved.name,
						status: saved.status,
						contactId: saved.contactId,
						channelIds: saved.channelIds ?? [],
						regionIds: saved.regionIds ?? []
					},
					tenantId,
					organizationId
				});

				return saved;
			});

			return created;
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}

			throw new ConflictException(
				'This party already holds a seller account in this organization, or the code is already taken.'
			);
		}
	}

	/**
	 * Updates the fields a seller may legitimately change about itself.
	 *
	 * The organization, the tenant, the party binding, the code and the status are all ignored if a
	 * body carries them: the first four are immutable and the last has its own endpoints, so an edit
	 * can never move a seller between organizations or put one live.
	 *
	 * @param id The seller id.
	 * @param input The fields to change.
	 * @param scope The caller's seller scope.
	 * @returns The updated seller.
	 * @throws NotFoundException when the seller does not exist.
	 */
	async updateSeller(id: ID, input: Partial<Seller>, scope?: ISellerScope): Promise<Seller> {
		const seller = await this.getSeller(id);

		if (scope && !scope.staff) {
			// `!scope.staff` rather than a bare `scope`: a staff scope carries the seller the *request*
			// named, and this route names the seller in `:id`, which the guard does not read as a seller
			// argument — so a staff scope reaches here with no seller at all and `assertSellerScope` refused
			// every staff caller by comparing that absent seller against the row's own. Staff is not narrowed
			// by membership; the tenant and organization predicates in `getSeller` are what still apply to it.
			assertSellerScope(scope, seller.id);
		}

		const immutable: Array<keyof Seller> = [
			'id',
			'code',
			'contactId',
			'status',
			'organizationId',
			'tenantId',
			'createdAt',
			'updatedAt'
		] as Array<keyof Seller>;

		const values = { ...input };

		for (const field of immutable) {
			delete values[field];
		}

		Object.assign(seller, values);

		return this.typeOrmSellerRepository.save(seller);
	}

	/**
	 * Reads a seller by id or by its human-usable code.
	 *
	 * The scope is optional because the read is also the way every lifecycle method and every internal
	 * caller reaches the row, and those callers already hold whatever scope applies. Where a scope *is*
	 * supplied it is enforced here rather than by each caller in turn: this is the single read the whole
	 * aggregate goes through, so a seller-scoped caller that names another seller's id or code is
	 * refused by name at one place instead of at nine.
	 *
	 * @param idOrCode The seller id or code.
	 * @param scope The caller's seller scope.
	 * @returns The seller.
	 * @throws NotFoundException when no seller matches.
	 * @throws ForbiddenException when the row is outside the caller's scope.
	 */
	async getSeller(idOrCode: ID | string, scope?: ISellerScope): Promise<Seller> {
		const where: FindOptionsWhere<Seller> = {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as FindOptionsWhere<Seller>;

		const seller = await this.typeOrmSellerRepository.findOne({
			where: [{ ...where, id: idOrCode }, { ...where, code: idOrCode }] as FindOptionsWhere<Seller>[]
		});

		if (!seller) {
			throw new NotFoundException('The seller does not exist.');
		}

		if (scope && !scope.staff) {
			assertSellerScope(scope, seller.id);
		}

		return seller;
	}

	/**
	 * Lists the sellers the caller may see.
	 *
	 * A seller-scoped caller sees exactly its own row and never a page: the scope is a predicate, not a
	 * filter applied to a result the caller has already been given.
	 *
	 * @param filter The query filter.
	 * @param scope The caller's seller scope.
	 * @returns The page of sellers.
	 */
	async listSellers(filter: any = {}, scope?: ISellerScope): Promise<IPagination<Seller>> {
		if (scope && !scope.staff) {
			return this.paginate({
				...filter,
				where: { ...(filter?.where ?? {}), id: scope.sellerId }
			});
		}

		return this.paginate(filter);
	}

	/**
	 * Moves a seller to `SUBMITTED`, which is the only thing a draft may become.
	 *
	 * @param id The seller id.
	 * @returns The updated seller.
	 */
	async submit(id: ID, scope?: ISellerScope): Promise<Seller> {
		const seller = await this.getSeller(id, scope);
		this.assertTransition(seller, SellerStatus.SUBMITTED);

		seller.status = SellerStatus.SUBMITTED;
		seller.submittedAt = new Date();

		return this.typeOrmSellerRepository.save(seller);
	}

	/**
	 * Records the result of one verification kind.
	 *
	 * Verification is performed and then recorded, never assumed: an operator's assertion is a recorded
	 * decision and the platform does not pretend a human check was an automated one. The seller reaches
	 * `APPROVED` **only** when every required verification is `VERIFIED` — never `ACTIVE`, which is a
	 * separate, explicit act.
	 *
	 * @param id The seller id.
	 * @param input The verification result.
	 * @returns The updated seller.
	 * @throws BadRequestException when the result is not usable.
	 */
	async verify(
		id: ID,
		input: {
			kind: SellerVerificationKind;
			status: SellerVerificationStatus;
			reference?: string;
			provider?: string;
			expiresAt?: Date;
			note?: string;
		},
		required: SellerVerificationKind[] = [
			SellerVerificationKind.BUSINESS_IDENTITY,
			SellerVerificationKind.TAX_IDENTIFIER,
			SellerVerificationKind.PAYOUT_ACCOUNT
		]
	): Promise<Seller> {
		const seller = await this.getSeller(id);

		if (!input?.kind || !input?.status) {
			throw new BadRequestException('A verification result needs a kind and a status.');
		}

		switch (input.kind) {
			case SellerVerificationKind.BUSINESS_IDENTITY:
				seller.businessVerificationStatus = input.status;
				break;
			case SellerVerificationKind.TAX_IDENTIFIER:
				seller.taxVerificationStatus = input.status;
				break;
			case SellerVerificationKind.PAYOUT_ACCOUNT:
				seller.payoutAccountStatus = input.status;
				break;
			default:
				throw new BadRequestException(`Unknown verification kind '${input.kind}'.`);
		}

		seller.verificationProvider = input.provider ?? seller.verificationProvider;
		seller.verificationReference = input.reference ?? seller.verificationReference;
		seller.verifiedAt = input.status === SellerVerificationStatus.VERIFIED ? new Date() : seller.verifiedAt;
		seller.verificationExpiresAt = input.expiresAt ?? seller.verificationExpiresAt;

		const required_ = new Set(required);
		const decided = (kind: SellerVerificationKind): SellerVerificationStatus => {
			switch (kind) {
				case SellerVerificationKind.BUSINESS_IDENTITY:
					return seller.businessVerificationStatus;
				case SellerVerificationKind.TAX_IDENTIFIER:
					return seller.taxVerificationStatus;
				default:
					return seller.payoutAccountStatus;
			}
		};

		const everyRequiredVerified = Array.from(required_).every(
			(kind) => decided(kind) === SellerVerificationStatus.VERIFIED
		);

		if (everyRequiredVerified && seller.status === SellerStatus.IN_REVIEW) {
			seller.status = SellerStatus.APPROVED;
		} else if (
			input.status === SellerVerificationStatus.ACTION_REQUIRED &&
			seller.status === SellerStatus.IN_REVIEW &&
			required_.has(input.kind)
		) {
			// A fixable failure is a resubmission, not a refusal: the remedies are different, so the
			// states are different.
			seller.status = SellerStatus.ACTION_REQUIRED;
		}

		const saved = await this.typeOrmSellerRepository.save(seller);

		await this.emit('seller.verified', saved, {
			sellerId: saved.id,
			code: saved.code,
			kind: input.kind,
			businessVerificationStatus: saved.businessVerificationStatus,
			taxVerificationStatus: saved.taxVerificationStatus,
			payoutAccountStatus: saved.payoutAccountStatus,
			verifiedAt: saved.verifiedAt,
			verificationExpiresAt: saved.verificationExpiresAt
		});

		return saved;
	}

	/**
	 * Activates an approved seller.
	 *
	 * @param id The seller id.
	 * @returns The updated seller.
	 * @throws BadRequestException when the seller is not approved, or its payout account is not verified.
	 */
	async activate(id: ID, scope?: ISellerScope): Promise<Seller> {
		const seller = await this.getSeller(id, scope);

		if (seller.status === SellerStatus.ACTIVE) {
			// Idempotent at the endpoint: activating an active seller returns it unchanged rather than
			// failing, because the caller's intent has already been satisfied.
			return seller;
		}

		this.assertTransition(seller, SellerStatus.ACTIVE);

		if (seller.payoutAccountStatus !== SellerVerificationStatus.VERIFIED) {
			throw new BadRequestException(
				`Seller '${seller.code}' requires payout account verification before it may be activated.`
			);
		}

		seller.status = SellerStatus.ACTIVE;
		seller.activatedAt = new Date();

		const saved = await this.typeOrmSellerRepository.save(seller);

		await this.emit('seller.activated', saved, {
			sellerId: saved.id,
			code: saved.code,
			activatedAt: saved.activatedAt,
			defaultCommissionRate: saved.defaultCommissionRate,
			commissionBasis: saved.commissionBasis,
			payoutMode: saved.payoutMode,
			payoutSchedule: saved.payoutSchedule,
			channelIds: saved.channelIds ?? []
		});

		return saved;
	}

	/**
	 * Suspends a seller.
	 *
	 * Suspension stops everything new and touches nothing already in flight: a placement is a contract,
	 * and cancelling a buyer's paid order because of a dispute with the seller would make the buyer
	 * bear the seller's risk. What it does do is hold the seller's settleable balance, which is the
	 * platform's only lever over a seller that has stopped cooperating.
	 *
	 * @param id The seller id.
	 * @param reason Why it was suspended.
	 * @returns The updated seller.
	 */
	async suspend(id: ID, reason: string, scope?: ISellerScope): Promise<Seller> {
		const seller = await this.getSeller(id, scope);

		if (!reason) {
			throw new BadRequestException('A suspension needs a reason the seller can read and remedy.');
		}

		if (seller.status === SellerStatus.SUSPENDED) {
			return seller;
		}

		this.assertTransition(seller, SellerStatus.SUSPENDED);

		seller.status = SellerStatus.SUSPENDED;
		seller.suspendedAt = new Date();
		seller.suspensionReason = reason;

		const saved = await this.typeOrmSellerRepository.save(seller);

		await this.emit('seller.suspended', saved, {
			sellerId: saved.id,
			code: saved.code,
			suspendedAt: saved.suspendedAt,
			reason
		});

		return saved;
	}

	/**
	 * Returns a suspended seller to `ACTIVE`.
	 *
	 * Held ledger rows become settleable again, but the seller's offerings stay paused: a seller
	 * suspended for a listing defect should not have the defect reinstated silently, so republishing is
	 * an explicit act.
	 *
	 * @param id The seller id.
	 * @returns The updated seller.
	 */
	async reinstate(id: ID, scope?: ISellerScope): Promise<Seller> {
		const seller = await this.getSeller(id, scope);

		if (seller.status === SellerStatus.ACTIVE) {
			return seller;
		}

		this.assertTransition(seller, SellerStatus.ACTIVE);

		seller.status = SellerStatus.ACTIVE;
		seller.activatedAt = new Date();
		seller.suspendedAt = null;
		seller.suspensionReason = null;

		const saved = await this.typeOrmSellerRepository.save(seller);

		await this.emit('seller.activated', saved, {
			sellerId: saved.id,
			code: saved.code,
			activatedAt: saved.activatedAt,
			reinstate: true
		});

		return saved;
	}

	/**
	 * Refuses an application.
	 *
	 * @param id The seller id.
	 * @param reason Why it was refused.
	 * @returns The updated seller.
	 */
	async reject(id: ID, reason: string): Promise<Seller> {
		const seller = await this.getSeller(id);

		if (!reason) {
			throw new BadRequestException('A rejection needs a reason.');
		}

		this.assertTransition(seller, SellerStatus.REJECTED);

		seller.status = SellerStatus.REJECTED;
		seller.rejectedAt = new Date();
		seller.rejectionReason = reason;

		const saved = await this.typeOrmSellerRepository.save(seller);

		await this.emit('seller.rejected', saved, {
			sellerId: saved.id,
			code: saved.code,
			rejectedAt: saved.rejectedAt,
			reason
		});

		return saved;
	}

	/**
	 * Starts winding a seller down.
	 *
	 * The seller stops trading and every offering may be withdrawn; the final payout, the settlement of
	 * open orders and the erasure of the person behind the seller are the durable operation's steps —
	 * this method only moves the seller to `OFFBOARDING`, so a failure later cannot leave it in a state
	 * from which the operation cannot be resumed.
	 *
	 * @param id The seller id.
	 * @returns The updated seller.
	 */
	async startOffboarding(id: ID): Promise<Seller> {
		const seller = await this.getSeller(id);
		this.assertTransition(seller, SellerStatus.OFFBOARDING);

		seller.status = SellerStatus.OFFBOARDING;

		return this.typeOrmSellerRepository.save(seller);
	}

	/**
	 * Asserts that a seller may trade.
	 *
	 * @param seller The seller.
	 * @throws ForbiddenException when it may not.
	 */
	assertSellerActive(seller: Seller): void {
		if (seller.status !== SellerStatus.ACTIVE) {
			// A suspended seller keeps read access — it needs to see what it is being held for — and
			// loses every write, which is what this refusal is.
			throw new ForbiddenException(`Seller '${seller.code}' is ${seller.status}, so it may not trade.`);
		}
	}

	/**
	 * Asserts that two rows belong to one organization.
	 *
	 * @param parent The referenced parent row.
	 * @param organizationId The organization the child is being written for.
	 * @throws ForbiddenException when they differ.
	 */
	assertSameOrganization(parent: { organizationId?: ID }, organizationId: ID): void {
		if (parent.organizationId && parent.organizationId !== organizationId) {
			throw new ForbiddenException('The referenced row belongs to another organization.');
		}
	}

	/**
	 * The seller's balance in one currency, as the statement reports it.
	 *
	 * The balance **is** the ledger: it is summed from the rows every time it is asked for rather than
	 * cached in a column, so there is nothing to reconcile and nothing that can drift. A negative figure
	 * is a reported fact rather than an error — a refund after a payout makes the balance negative on
	 * purpose, and the next payout offsets it.
	 *
	 * @param seller The seller.
	 * @param currency The currency to report in.
	 * @returns The balance.
	 */
	async getBalance(seller: Seller, currency: CurrencyCode): Promise<ISellerBalance> {
		const rows = await this.transactionRepository.find({
			where: {
				sellerId: seller.id,
				currency,
				status: In([SellerTransactionStatus.PENDING, SellerTransactionStatus.SETTLEABLE, SellerTransactionStatus.HELD])
			} as FindOptionsWhere<any>
		});

		const decimals = rows[0]?.currencyDecimals ?? 2;
		const sum = (statuses: SellerTransactionStatus[]): DecimalString =>
			Money.sum(
				rows.filter((row) => statuses.includes(row.status)).map((row) => Money.fromStorage(row.netAmount, currency, decimals)),
				currency,
				decimals
			).toStorageString();

		const available = Money.fromStorage(sum([SellerTransactionStatus.SETTLEABLE]), currency, decimals);
		const negativeCarryForward = available.isNegative() ? available.abs().toStorageString() : '0';

		return {
			currency,
			available: available.toStorageString(),
			pending: sum([SellerTransactionStatus.PENDING]),
			held: sum([SellerTransactionStatus.HELD]),
			negativeCarryForward,
			// What the next run would withhold. The reserve is a policy applied at run time rather than a
			// stored balance, so lowering the percentage releases it automatically.
			reserveNextRun:
				available.isPositive() && seller.reservePercent
					? available.multiply(seller.reservePercent, { scale: decimals }).toStorageString()
					: '0',
			nextPayoutAt: this.nextPayoutAt(seller)
		};
	}

	/**
	 * The seller's statement for a period: what it earned, what it was charged and what it was paid.
	 *
	 * @param id The seller id.
	 * @param filter The period and currency.
	 * @param scope The caller's seller scope.
	 * @returns The statement.
	 */
	async getStatement(
		id: ID,
		filter: { from?: Date; to?: Date; currency?: CurrencyCode } = {},
		scope?: ISellerScope
	): Promise<ISellerStatement> {
		const seller = await this.getSeller(id);

		if (scope && !scope.staff) {
			// As on `updateSeller`: a staff scope carries the seller the request named, and this route names
			// it in `:id`, so comparing it against the row refused every staff caller a statement.
			assertSellerScope(scope, seller.id);
		}

		const currency = filter.currency ?? seller.payoutCurrency ?? 'USD';

		const rows = await this.transactionRepository.find({
			where: { sellerId: seller.id, currency } as FindOptionsWhere<any>,
			order: { occurredAt: 'ASC' } as any
		});

		const inPeriod = rows.filter(
			(row) =>
				(!filter.from || new Date(row.occurredAt) >= filter.from) && (!filter.to || new Date(row.occurredAt) <= filter.to)
		);
		const beforePeriod = rows.filter((row) => filter.from && new Date(row.occurredAt) < filter.from);

		const decimals = rows[0]?.currencyDecimals ?? 2;
		const total = (source: typeof rows): string =>
			Money.sum(
				source.map((row) => Money.fromStorage(row.netAmount, currency, decimals)),
				currency,
				decimals
			).toStorageString();

		const lines: ISellerStatementLine[] = inPeriod.map((row) => ({
			transactionId: row.id as ID,
			kind: row.kind,
			status: row.status,
			occurredAt: row.occurredAt,
			description: row.description,
			// The ledger's own exact decimals, never a rounded rendering of them.
			grossAmount: row.grossAmount,
			commissionAmount: row.commissionAmount,
			netAmount: row.netAmount,
			currency: row.currency
		}));

		const [payouts, settlements] = await Promise.all([
			this.payoutRepository.find({
				where: { sellerId: seller.id, currency } as FindOptionsWhere<any>,
				order: { createdAt: 'ASC' } as any
			}),
			this.settlementRepository.find({
				where: { sellerId: seller.id, currency } as FindOptionsWhere<any>,
				order: { createdAt: 'ASC' } as any
			})
		]);

		const balance = await this.getBalance(seller, currency);

		return {
			sellerId: seller.id as ID,
			currency,
			from: filter.from,
			to: filter.to,
			openingBalance: total(beforePeriod),
			lines,
			payouts: payouts as any,
			settlements: settlements as any,
			closingBalance: total(rows),
			negativeCarryForward: balance.negativeCarryForward,
			reserveNextRun: balance.reserveNextRun,
			nextPayoutAt: balance.nextPayoutAt
		};
	}

	/**
	 * The next date the seller's schedule would create a payout, for the statement's "what happens next".
	 *
	 * @param seller The seller.
	 * @param from The moment to project from.
	 * @returns The next payout date, or undefined for a manual or threshold schedule.
	 */
	nextPayoutAt(seller: Seller, from: Date = new Date()): Date | undefined {
		const next = new Date(from);

		switch (seller.payoutSchedule) {
			case SellerPayoutSchedule.DAILY:
				next.setDate(next.getDate() + 1);
				return next;
			case SellerPayoutSchedule.WEEKLY:
				next.setDate(next.getDate() + 7);
				return next;
			case SellerPayoutSchedule.BI_WEEKLY:
				next.setDate(next.getDate() + 14);
				return next;
			case SellerPayoutSchedule.SEMI_MONTHLY:
				return next.getDate() < 16
					? new Date(next.getFullYear(), next.getMonth(), 16)
					: new Date(next.getFullYear(), next.getMonth() + 1, 1);
			case SellerPayoutSchedule.MONTHLY:
				return new Date(next.getFullYear(), next.getMonth() + 1, 1);
			default:
				// A manual seller is paid when an operator says so, and a threshold seller when its balance
				// crosses the threshold: neither has a date to promise.
				return undefined;
		}
	}

	/**
	 * Refuses a transition the lifecycle does not permit.
	 *
	 * @param seller The seller.
	 * @param target The state the caller asked for.
	 * @throws ConflictException naming the seller's current status.
	 */
	private assertTransition(seller: Seller, target: SellerStatus): void {
		if (!SELLER_TRANSITIONS[seller.status]?.includes(target)) {
			throw new ConflictException(`Seller '${seller.code}' is ${seller.status} and cannot become ${target}.`);
		}
	}

	/**
	 * Writes one outbox row for a state change.
	 *
	 * @param name The catalogued event name.
	 * @param seller The seller the event is about.
	 * @param data The payload.
	 */
	private async emit(name: string, seller: Seller, data: Record<string, any>): Promise<void> {
		await this.typeOrmSellerRepository.manager.transaction(async (manager) => {
			await this.outbox.append(manager, {
				name,
				aggregateType: 'SELLER',
				aggregateId: seller.id as ID,
				data,
				tenantId: seller.tenantId,
				organizationId: seller.organizationId
			});
		});
	}
}
