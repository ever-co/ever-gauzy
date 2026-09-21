import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere, In, IsNull, Not } from 'typeorm';
import {
	CurrencyCode,
	DecimalString,
	ID,
	IPagination,
	ISellerPayoutRunResult,
	SellerPayoutMode,
	SellerPayoutSchedule,
	SellerPayoutStatus,
	SellerStatus,
	SellerTransactionStatus,
	SellerVerificationStatus
} from '@gauzy/contracts';
import { EventOutboxService, Money, RequestContext, SequenceService, TenantAwareCrudService } from '@gauzy/core';
import { SellerPayout } from './seller-payout.entity';
import { MikroOrmSellerPayoutRepository } from './repository/mikro-orm-seller-payout.repository';
import { TypeOrmSellerPayoutRepository } from './repository/type-orm-seller-payout.repository';
import { SellerPayoutLine } from '../seller-payout-line/seller-payout-line.entity';
import { TypeOrmSellerPayoutLineRepository } from '../seller-payout-line/repository/type-orm-seller-payout-line.repository';
import { SellerTransaction } from '../seller-transaction/seller-transaction.entity';
import { TypeOrmSellerTransactionRepository } from '../seller-transaction/repository/type-orm-seller-transaction.repository';
import { Seller } from '../seller/seller.entity';
import { TypeOrmSellerRepository } from '../seller/repository/type-orm-seller.repository';
import { ISellerScope, assertSellerScope } from '../seller-scope/seller-scope';

/** The sequence key payout numbers are drawn from. */
const SELLER_PAYOUT_SEQUENCE = 'SELLER_PAYOUT';

/**
 * Builds, approves and executes payouts.
 *
 * A payout is derived from the ledger and never independent of it. It is built from settleable
 * transactions of **one seller in one currency and by nothing else**; its amount is the sum of its
 * lines; its reserve is computed at each run rather than stored; and once it is paid it is never
 * edited, because a refund afterwards is a reversal row on the ledger and the payout record of what
 * the provider was instructed to do must stay exactly as it was instructed.
 *
 * The platform holds no funds, so executing a payout is an instruction to a regulated payment provider
 * — the money is in the seller's own provider account and the platform is recording that it asked for
 * it to be moved.
 */
@Injectable()
export class SellerPayoutService extends TenantAwareCrudService<SellerPayout> {
	constructor(
		readonly typeOrmSellerPayoutRepository: TypeOrmSellerPayoutRepository,
		readonly mikroOrmSellerPayoutRepository: MikroOrmSellerPayoutRepository,
		private readonly sellerRepository: TypeOrmSellerRepository,
		private readonly transactionRepository: TypeOrmSellerTransactionRepository,
		private readonly lineRepository: TypeOrmSellerPayoutLineRepository,
		private readonly sequenceService: SequenceService,
		private readonly outbox: EventOutboxService
	) {
		super(typeOrmSellerPayoutRepository, mikroOrmSellerPayoutRepository);
	}

	/**
	 * Lists payouts.
	 *
	 * @param filter The query filter.
	 * @param scope The caller's seller scope.
	 * @returns The page of payouts.
	 */
	async listPayouts(filter: any = {}, scope?: ISellerScope): Promise<IPagination<SellerPayout>> {
		const where = { ...(filter?.where ?? {}) };

		if (scope && !scope.staff) {
			assertSellerScope(scope, where.sellerId);
			where.sellerId = scope.sellerId;
		}

		return this.paginate({ ...filter, where });
	}

	/**
	 * Reads one payout with its lines.
	 *
	 * @param id The payout id.
	 * @param scope The caller's seller scope.
	 * @returns The payout.
	 * @throws NotFoundException when it does not exist in the caller's scope.
	 */
	async getPayout(id: ID, scope?: ISellerScope): Promise<SellerPayout> {
		const payout = await this.typeOrmSellerPayoutRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as FindOptionsWhere<SellerPayout>,
			relations: ['lines'] as any
		});

		if (!payout) {
			throw new NotFoundException('The seller payout does not exist.');
		}

		if (scope && !scope.staff) {
			assertSellerScope(scope, payout.sellerId);
		}

		return payout;
	}

	/**
	 * Creates a payout from named transactions, or from the settleable rows of a period.
	 *
	 * An operator may create a payout below the seller's threshold, but only with a note: the threshold
	 * is a policy, and overriding a policy is a decision somebody signs.
	 *
	 * @param input What to pay.
	 * @param scope The caller's seller scope.
	 * @returns The created payout with its lines.
	 */
	async createPayout(
		input: {
			sellerId: ID;
			currency: CurrencyCode;
			transactionIds?: ID[];
			periodStart?: Date;
			periodEnd?: Date;
			note?: string;
			isFinal?: boolean;
		},
		scope?: ISellerScope
	): Promise<SellerPayout> {
		if (scope) {
			assertSellerScope(scope, input.sellerId);
		}

		if (!input.sellerId || !input.currency) {
			throw new BadRequestException('A payout needs a seller and a currency.');
		}

		const seller = await this.requireSeller(input.sellerId);
		this.assertPayable(seller);

		const candidates = await this.settleableRows(seller, input.currency, input.transactionIds, {
			periodStart: input.periodStart,
			periodEnd: input.periodEnd
		});

		if (candidates.length === 0) {
			throw new BadRequestException('There is nothing settleable to pay for this seller and currency.');
		}

		const balance = this.total(candidates, input.currency);
		const reserve = this.reserveFor(seller, balance, input.currency, input.isFinal === true);
		const payable = balance.subtract(reserve);

		this.assertThreshold(seller, payable, {
			isFinal: input.isFinal === true,
			operatorNote: input.note
		});

		return this.writePayout(
			seller,
			input.currency,
			candidates,
			{ reserve, payable, periodStart: input.periodStart, periodEnd: input.periodEnd, isFinal: input.isFinal === true },
			input.note
		);
	}

	/**
	 * Runs the payout pass for the sellers whose schedule is due.
	 *
	 * The run decides, per seller and currency, and it is idempotent by construction rather than by
	 * memory: a transaction can sit in at most one live payout line, one period cannot produce two
	 * payouts for the same seller and currency — `hasPayoutForPeriod` is what makes that second claim
	 * true rather than only stated — and a seller is only considered at all when its own schedule says
	 * this pass is its moment. A scheduler that fires twice therefore pays nobody twice, and a pass that
	 * runs more often than a seller's schedule does not silently replace that schedule with its own.
	 *
	 * @param input The period, the optional sellers and currency, and whether to only report.
	 * @returns What the run decided for each seller, whether or not it created a payout.
	 */
	async run(
		input: {
			periodStart?: Date;
			periodEnd?: Date;
			sellerIds?: ID[];
			currency?: CurrencyCode;
			dryRun?: boolean;
		} = {}
	): Promise<ISellerPayoutRunResult[]> {
		const sellers = await this.dueSellers(input.sellerIds);
		const results: ISellerPayoutRunResult[] = [];

		for (const seller of sellers) {
			const currency = input.currency ?? seller.payoutCurrency;

			if (!currency) {
				results.push({
					sellerId: seller.id as ID,
					currency: '',
					balance: '0',
					reserveAmount: '0',
					payable: '0',
					skippedReason: 'NO_PAYOUT_CURRENCY'
				} as ISellerPayoutRunResult);
				continue;
			}

			const rows = await this.settleableRows(seller, currency, undefined, {
				periodStart: input.periodStart,
				periodEnd: input.periodEnd
			});
			const balance = this.total(rows, currency);
			const reserve = this.reserveFor(seller, balance, currency, false);
			const payable = balance.subtract(reserve);

			const belowThreshold = this.isBelowThreshold(seller, payable);

			if (rows.length === 0 || belowThreshold || !payable.isPositive()) {
				// Nothing is paid and nothing is lost: the amount carries forward and the run records why,
				// because a seller that is not paid is entitled to know which rule held it back.
				results.push({
					sellerId: seller.id as ID,
					currency,
					balance: balance.toStorageString(),
					reserveAmount: reserve.toStorageString(),
					payable: payable.toStorageString(),
					skippedReason: rows.length === 0 ? 'NOTHING_SETTLEABLE' : belowThreshold ? 'BELOW_THRESHOLD' : 'NOTHING_PAYABLE'
				} as ISellerPayoutRunResult);
				continue;
			}

			if (await this.hasPayoutForPeriod(seller, currency, { periodStart: input.periodStart, periodEnd: input.periodEnd })) {
				// The pass already covered this window for this seller and currency. Reporting it is what
				// makes a double-fired scheduler visible instead of silent — and it is reported before the
				// dry-run branch, because "what this pass would pay" for a window already covered is nothing.
				results.push({
					sellerId: seller.id as ID,
					currency,
					balance: balance.toStorageString(),
					reserveAmount: reserve.toStorageString(),
					payable: payable.toStorageString(),
					skippedReason: 'PERIOD_ALREADY_PAID'
				} as ISellerPayoutRunResult);
				continue;
			}

			if (input.dryRun) {
				results.push({
					sellerId: seller.id as ID,
					currency,
					balance: balance.toStorageString(),
					reserveAmount: reserve.toStorageString(),
					payable: payable.toStorageString()
				} as ISellerPayoutRunResult);
				continue;
			}

			const payout = await this.writePayout(
				seller,
				currency,
				rows,
				{ reserve, payable, periodStart: input.periodStart, periodEnd: input.periodEnd, isFinal: false },
				undefined
			);

			results.push({
				sellerId: seller.id as ID,
				currency,
				balance: balance.toStorageString(),
				reserveAmount: reserve.toStorageString(),
				payable: payable.toStorageString(),
				payoutId: payout.id as ID
			} as ISellerPayoutRunResult);
		}

		return results;
	}

	/**
	 * Approves a payout.
	 *
	 * @param id The payout id.
	 * @param scope The caller's seller scope.
	 * @returns The payout, in `APPROVED`.
	 * @throws ConflictException when the payout is not awaiting approval.
	 */
	async approve(id: ID, scope?: ISellerScope): Promise<SellerPayout> {
		const payout = await this.getPayout(id, scope);

		if (payout.status === SellerPayoutStatus.APPROVED) {
			return payout;
		}

		if (payout.status !== SellerPayoutStatus.DRAFT && payout.status !== SellerPayoutStatus.PENDING) {
			throw new ConflictException(`A payout in ${payout.status} cannot be approved.`);
		}

		payout.status = SellerPayoutStatus.APPROVED;
		payout.approvedAt = new Date();
		payout.approvedByUserId = RequestContext.currentUserId();

		return this.typeOrmSellerPayoutRepository.save(payout);
	}

	/**
	 * Records the provider's execution of a payout.
	 *
	 * The payout and the transactions it covers move together: the payout becomes `PAID` and its rows
	 * become `PAID`. A payout the provider refused becomes `FAILED` and its rows return to settleable,
	 * because money that did not move must be payable again.
	 *
	 * @param id The payout id.
	 * @param result What the provider reported.
	 * @param scope The caller's seller scope.
	 * @returns The updated payout.
	 * @throws ConflictException when the payout is already paid or canceled.
	 */
	async recordExecution(
		id: ID,
		result: {
			paid: boolean;
			providerKey?: string;
			providerTransferId?: string;
			feeAmount?: DecimalString;
			failureCode?: string;
			failureReason?: string;
		},
		scope?: ISellerScope
	): Promise<SellerPayout> {
		const payout = await this.getPayout(id, scope);

		if (payout.status === SellerPayoutStatus.PAID || payout.status === SellerPayoutStatus.CANCELED) {
			// A paid payout is a fact. The honest representation of a mistake is a compensating entry,
			// never a rewrite of what was executed.
			throw new ConflictException(`A payout in ${payout.status} is final and is never edited.`);
		}

		const lines = await this.lineRepository.find({ where: { sellerPayoutId: payout.id } as FindOptionsWhere<SellerPayoutLine> });
		const transactions = await this.transactionRepository.find({
			where: { id: In(lines.map((line) => line.sellerTransactionId)) } as FindOptionsWhere<SellerTransaction>
		});

		if (!result.paid) {
			payout.status = SellerPayoutStatus.FAILED;
			payout.failedAt = new Date();
			payout.failureCode = result.failureCode;
			payout.failureReason = result.failureReason;

			const saved = await this.typeOrmSellerPayoutRepository.save(payout);

			// The money did not move, so the rows are payable again: nothing about them changed except
			// that they are once more available, and the release is what makes another attempt possible.
			for (const transaction of transactions) {
				transaction.status = SellerTransactionStatus.SETTLEABLE;
				transaction.settledAt = null;
			}

			await this.transactionRepository.save(transactions);

			await this.emit(saved, 'seller-payout.failed', {
				failureCode: result.failureCode,
				failureReason: result.failureReason,
				retryable: true
			});

			return saved;
		}

		const currency = payout.currency as CurrencyCode;
		const decimals = payout.currencyDecimals;
		const fee = Money.fromStorage(result.feeAmount ?? payout.feeAmount, currency, decimals);
		const paidAt = new Date();

		payout.status = SellerPayoutStatus.PAID;
		payout.paidAt = paidAt;
		payout.providerKey = result.providerKey ?? payout.providerKey;
		payout.providerTransferId = result.providerTransferId ?? payout.providerTransferId;
		payout.feeAmount = fee.toStorageString();
		payout.paidAmount = Money.fromStorage(payout.netAmount, currency, decimals)
			.subtract(fee)
			.subtract(Money.fromStorage(payout.reserveAmount, currency, decimals))
			.toStorageString();

		for (const transaction of transactions) {
			transaction.status = SellerTransactionStatus.PAID;
			transaction.paidAt = paidAt;
		}

		const saved = await this.typeOrmSellerPayoutRepository.manager.transaction(async (manager) => {
			await manager.save(SellerTransaction, transactions);
			const persisted = await manager.save(SellerPayout, payout);

			await this.outbox.append(manager, {
				name: 'seller-payout.paid',
				aggregateType: 'SELLER_PAYOUT',
				aggregateId: persisted.id as ID,
				data: {
					payoutId: persisted.id,
					number: persisted.number,
					sellerId: persisted.sellerId,
					currency: persisted.currency,
					paidAmount: persisted.paidAmount,
					providerKey: persisted.providerKey,
					providerTransferId: persisted.providerTransferId,
					paidAt
				},
				tenantId: persisted.tenantId,
				organizationId: persisted.organizationId
			});

			return persisted;
		});

		return saved;
	}

	/**
	 * Cancels an unpaid payout and releases its transactions.
	 *
	 * The lines are soft-deleted in the same transaction that returns the rows to settleable, which is
	 * what releases the "one live payout per transaction" guarantee for the next run. A paid payout is
	 * never canceled.
	 *
	 * @param id The payout id.
	 * @param reason Why it was canceled.
	 * @param scope The caller's seller scope.
	 * @returns The payout and how many rows were released.
	 * @throws ConflictException when the payout has been paid.
	 */
	async cancel(
		id: ID,
		reason: string,
		scope?: ISellerScope
	): Promise<{ payout: SellerPayout; releasedTransactionCount: number }> {
		const payout = await this.getPayout(id, scope);

		if (payout.status === SellerPayoutStatus.PAID) {
			throw new ConflictException('A paid payout is not canceled; a refund is written as a reversal row instead.');
		}

		if (payout.status === SellerPayoutStatus.CANCELED) {
			return { payout, releasedTransactionCount: 0 };
		}

		const lines = await this.lineRepository.find({ where: { sellerPayoutId: payout.id } as FindOptionsWhere<SellerPayoutLine> });
		const transactions = await this.transactionRepository.find({
			where: { id: In(lines.map((line) => line.sellerTransactionId)) } as FindOptionsWhere<SellerTransaction>
		});

		payout.status = SellerPayoutStatus.CANCELED;
		payout.canceledAt = new Date();
		payout.note = reason ?? payout.note;

		const saved = await this.typeOrmSellerPayoutRepository.manager.transaction(async (manager) => {
			for (const transaction of transactions) {
				transaction.status = SellerTransactionStatus.SETTLEABLE;
				transaction.settledAt = null;
			}

			await manager.save(SellerTransaction, transactions);
			await manager.softRemove(SellerPayoutLine, lines);

			const persisted = await manager.save(SellerPayout, payout);

			await this.outbox.append(manager, {
				name: 'seller-payout.canceled',
				aggregateType: 'SELLER_PAYOUT',
				aggregateId: persisted.id as ID,
				data: {
					payoutId: persisted.id,
					number: persisted.number,
					sellerId: persisted.sellerId,
					currency: persisted.currency,
					netAmount: persisted.netAmount,
					releasedTransactionCount: lines.length,
					reason
				},
				tenantId: persisted.tenantId,
				organizationId: persisted.organizationId
			});

			return persisted;
		});

		return { payout: saved, releasedTransactionCount: lines.length };
	}

	/**
	 * Re-drives a failed payout by returning it to the approved state it can be executed from.
	 *
	 * @param id The payout id.
	 * @param scope The caller's seller scope.
	 * @returns The payout, in `APPROVED`.
	 * @throws ConflictException when the payout did not fail.
	 */
	async retry(id: ID, scope?: ISellerScope): Promise<SellerPayout> {
		const payout = await this.getPayout(id, scope);

		if (payout.status !== SellerPayoutStatus.FAILED) {
			throw new ConflictException(`A payout in ${payout.status} is not retryable.`);
		}

		payout.status = SellerPayoutStatus.APPROVED;
		payout.failedAt = null;
		payout.failureCode = null;
		payout.failureReason = null;

		return this.typeOrmSellerPayoutRepository.save(payout);
	}

	/**
	 * The settleable rows a payout would cover.
	 *
	 * A row is excluded when it is already in a live payout line — which is a database guarantee rather
	 * than a check — and when it is still inside the seller's payout hold window, which exists so a
	 * tenant can hold funds through the provider's own chargeback window without touching its
	 * commission policy.
	 *
	 * @param seller The seller.
	 * @param currency The payout currency.
	 * @param transactionIds The rows a caller named, when it named any.
	 * @param period The period to restrict to, when one was given.
	 * @returns The rows to include.
	 */
	private async settleableRows(
		seller: Seller,
		currency: CurrencyCode,
		transactionIds?: ID[],
		period: { periodStart?: Date; periodEnd?: Date } = {}
	): Promise<SellerTransaction[]> {
		const where: FindOptionsWhere<SellerTransaction> = {
			sellerId: seller.id,
			currency,
			status: SellerTransactionStatus.SETTLEABLE,
			tenantId: seller.tenantId,
			organizationId: seller.organizationId
		} as FindOptionsWhere<SellerTransaction>;

		if (transactionIds?.length) {
			where.id = In(transactionIds);
		}

		const rows = await this.transactionRepository.find({ where, order: { occurredAt: 'ASC' } as any });

		if (rows.length === 0) {
			return [];
		}

		// The exclusion is computed from the lines of *these* rows, in *this* organization. It used to read
		// the whole `seller_payout_line` table with no predicate at all — no tenant, no organization, no
		// seller, no restriction to the transactions under consideration — and `run()` calls this method
		// once per due seller, so a pass over five hundred sellers performed five hundred full-table reads
		// and built a Set of every payout line the installation had ever written, five hundred times. It
		// also pulled other tenants' payout lines into the process, which is the one thing every other read
		// in this class is careful not to do.
		const live = await this.lineRepository.find({
			where: {
				deletedAt: IsNull(),
				sellerTransactionId: In(rows.map((row) => row.id)),
				tenantId: seller.tenantId,
				organizationId: seller.organizationId
			} as FindOptionsWhere<SellerPayoutLine>,
			select: ['sellerTransactionId'] as any
		});
		const alreadyPaidIn = new Set(live.map((line) => String(line.sellerTransactionId)));

		const holdBoundary = seller.payoutHoldDays
			? new Date(Date.now() - seller.payoutHoldDays * 24 * 60 * 60 * 1000)
			: undefined;

		return rows.filter((row) => {
			if (alreadyPaidIn.has(String(row.id))) {
				return false;
			}

			if (holdBoundary && row.settleableAt && new Date(row.settleableAt) > holdBoundary) {
				return false;
			}

			if (period.periodStart && new Date(row.occurredAt) < period.periodStart) {
				return false;
			}

			if (period.periodEnd && new Date(row.occurredAt) > period.periodEnd) {
				return false;
			}

			return true;
		});
	}

	/**
	 * The sellers whose schedule is due.
	 *
	 * Only an `ACTIVE` or `OFFBOARDING` seller is paid: a suspended seller's balance is held rather than
	 * forfeited, which is the platform's only lever over a seller that has stopped cooperating.
	 *
	 * @param sellerIds The sellers a caller named, when it named any.
	 * @returns The due sellers.
	 */
	private async dueSellers(sellerIds?: ID[]): Promise<Seller[]> {
		const where: FindOptionsWhere<Seller> = {
			status: In([SellerStatus.ACTIVE, SellerStatus.OFFBOARDING]),
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as FindOptionsWhere<Seller>;

		if (sellerIds?.length) {
			where.id = In(sellerIds);
		}

		const sellers = await this.sellerRepository.find({ where });
		const due: Seller[] = [];

		for (const seller of sellers) {
			// Sequential rather than concurrent: the lookup is one indexed read per seller and a pass is a
			// background job, so the predictable load is worth more here than the wall time.
			if (await this.isDue(seller)) {
				due.push(seller);
			}
		}

		return due;
	}

	/**
	 * Whether a seller's schedule makes this pass a payout moment.
	 *
	 * This used to answer `true` for every schedule but `MANUAL`, on the argument that "the balance and
	 * threshold checks below are what actually hold a payout back, so a pass that runs too often pays
	 * nothing extra". That argument does not survive `writePayout`, which marks the transactions it covers
	 * `SETTLED`: each pass therefore pays whatever accrued since the previous one, so a `MONTHLY` seller
	 * on a daily pass received roughly thirty payouts a month instead of one. Each is a separate provider
	 * transfer with its own fee, which `recordExecution` subtracts from the seller's own paid amount — so
	 * the seller's configured schedule was silently replaced by the pass frequency and the seller absorbed
	 * the difference in transfer fees.
	 *
	 * The predicate is therefore stated against the seller's own last payout: a seller that has never been
	 * paid is due, and a seller that has is due once its schedule's period has elapsed since that payout
	 * was scheduled. `THRESHOLD` is the one schedule with no period — it is due at every pass and
	 * `isBelowThreshold` is what holds it back, which is what the schedule means.
	 *
	 * @param seller The seller.
	 * @param now The moment the pass is running at.
	 * @returns True when the schedule is due.
	 */
	private async isDue(seller: Seller, now: Date = new Date()): Promise<boolean> {
		switch (seller.payoutSchedule) {
			case SellerPayoutSchedule.MANUAL:
				// A manual seller is paid when an operator asks, and never by a pass.
				return false;
			case SellerPayoutSchedule.THRESHOLD:
				// A threshold seller has no period: it is paid when its balance crosses the threshold, which
				// is the check the run already applies to every seller.
				return true;
			default:
				break;
		}

		const last = await this.lastScheduledPayout(seller);

		if (!last?.scheduledAt) {
			// A seller with no payout behind it is due on the first pass that sees it, whatever its period.
			return true;
		}

		return now.getTime() >= this.nextDueAt(new Date(last.scheduledAt), seller.payoutSchedule).getTime();
	}

	/**
	 * The seller's most recent payout that still counts as one.
	 *
	 * A canceled payout is excluded because cancelling releases its lines back to settleable: the money it
	 * covered was never paid, so it cannot hold the next pass back.
	 *
	 * @param seller The seller.
	 * @returns The payout, or null when the seller has never been paid.
	 */
	private async lastScheduledPayout(seller: Seller): Promise<SellerPayout | null> {
		return this.typeOrmSellerPayoutRepository.findOne({
			where: {
				sellerId: seller.id,
				tenantId: seller.tenantId,
				organizationId: seller.organizationId,
				status: Not(SellerPayoutStatus.CANCELED)
			} as FindOptionsWhere<SellerPayout>,
			order: { scheduledAt: 'DESC' } as any
		});
	}

	/**
	 * The moment a schedule next falls due after a payout was scheduled.
	 *
	 * The periods are the ones `SellerService.nextPayoutAt` promises a seller in its statement, so the
	 * date the platform tells a seller to expect and the date the pass acts on are the same arithmetic
	 * rather than two independent readings of one policy.
	 *
	 * @param from The moment the previous payout was scheduled at.
	 * @param schedule The seller's schedule.
	 * @returns The next due moment.
	 */
	private nextDueAt(from: Date, schedule: SellerPayoutSchedule): Date {
		const next = new Date(from.getTime());

		switch (schedule) {
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
				// The 1st and the 16th, which is what "twice a month" means to a finance function.
				return next.getDate() < 16
					? new Date(next.getFullYear(), next.getMonth(), 16)
					: new Date(next.getFullYear(), next.getMonth() + 1, 1);
			case SellerPayoutSchedule.MONTHLY:
				return new Date(next.getFullYear(), next.getMonth() + 1, 1);
			default:
				// A schedule this method does not know is due immediately rather than never: a seller is not
				// left unpaid by a value nobody taught the pass about.
				return next;
		}
	}

	/**
	 * Whether the seller already has a live payout covering exactly this period and currency.
	 *
	 * `run()`'s own docstring claims "one period cannot produce two payouts for the same seller and
	 * currency", and nothing enforced it: the "at most one live payout line per transaction" constraint
	 * stops the same *rows* being paid twice, but a scheduler that double-fires between two settlements
	 * would still open a second payout over the same window. The check is only applied where the caller
	 * states a window, because a pass without one is not claiming to cover a period at all.
	 *
	 * @param seller The seller.
	 * @param currency The payout currency.
	 * @param period The window the pass is covering.
	 * @returns True when a payout for that window already exists.
	 */
	private async hasPayoutForPeriod(
		seller: Seller,
		currency: CurrencyCode,
		period: { periodStart?: Date; periodEnd?: Date }
	): Promise<boolean> {
		if (!period.periodStart || !period.periodEnd) {
			return false;
		}

		const existing = await this.typeOrmSellerPayoutRepository.findOne({
			where: {
				sellerId: seller.id,
				currency,
				periodStart: period.periodStart,
				periodEnd: period.periodEnd,
				tenantId: seller.tenantId,
				organizationId: seller.organizationId,
				status: Not(SellerPayoutStatus.CANCELED)
			} as FindOptionsWhere<SellerPayout>
		});

		return Boolean(existing);
	}

	/**
	 * Asserts that a seller may be paid at all.
	 *
	 * @param seller The seller.
	 * @throws ForbiddenException when it may not.
	 */
	private assertPayable(seller: Seller): void {
		if (seller.status !== SellerStatus.ACTIVE && seller.status !== SellerStatus.OFFBOARDING) {
			throw new ForbiddenException(`Seller '${seller.code}' is ${seller.status}, so it is not paid.`);
		}

		if (seller.payoutAccountStatus !== SellerVerificationStatus.VERIFIED) {
			// Money must never be sent to an account the platform has not verified: a payout requires a
			// verified destination, and an expired verification holds payouts rather than forfeiting them.
			throw new ForbiddenException(
				`Seller '${seller.code}' requires payout account verification before it can be paid.`
			);
		}
	}

	/**
	 * The sum of the rows a payout would cover.
	 *
	 * @param rows The rows.
	 * @param currency The currency.
	 * @returns The balance.
	 */
	private total(rows: SellerTransaction[], currency: CurrencyCode): Money {
		const decimals = rows[0]?.currencyDecimals ?? 2;

		return Money.sum(
			rows.map((row) => Money.fromStorage(row.netAmount, currency, decimals)),
			currency,
			decimals
		);
	}

	/**
	 * The reserve withheld at this run.
	 *
	 * It is computed, not stored: lowering the percentage releases the reserve on the next run with
	 * nothing to reconcile, and a final offboarding payout applies no reserve at all because no future
	 * run will release one.
	 *
	 * @param seller The seller.
	 * @param balance The settleable balance.
	 * @param currency The currency.
	 * @param isFinal Whether this is the offboarding payout.
	 * @returns The reserve.
	 */
	private reserveFor(seller: Seller, balance: Money, currency: CurrencyCode, isFinal: boolean): Money {
		if (isFinal || !seller.reservePercent || !balance.isPositive()) {
			return Money.zero(currency, balance.decimals);
		}

		return balance.multiply(seller.reservePercent, { scale: balance.decimals });
	}

	/**
	 * Whether a payable amount is below the seller's threshold.
	 *
	 * @param seller The seller.
	 * @param payable The amount after the reserve.
	 * @returns True when the threshold holds it back.
	 */
	private isBelowThreshold(seller: Seller, payable: Money): boolean {
		const threshold = Money.fromStorage(seller.payoutThreshold, payable.currency, payable.decimals);

		return payable.lessThan(threshold);
	}

	/**
	 * Refuses a below-threshold payout that no rule permits.
	 *
	 * Exactly three things create one: the final offboarding payout, an operator-created payout with a
	 * note, and a negative balance, which is never a payout at all.
	 *
	 * @param seller The seller.
	 * @param payable The amount after the reserve.
	 * @param options Whether this is final, and whether an operator signed for it.
	 * @throws BadRequestException when the threshold holds and nothing exempts it.
	 */
	private assertThreshold(seller: Seller, payable: Money, options: { isFinal: boolean; operatorNote?: string }): void {
		if (options.isFinal || options.operatorNote) {
			return;
		}

		if (this.isBelowThreshold(seller, payable)) {
			throw new BadRequestException(
				`The payable balance of ${payable.toString()} is below seller '${seller.code}'s threshold; a below-threshold payout needs a note.`
			);
		}
	}

	/**
	 * Writes a payout and its lines, and marks the rows it covers as settled.
	 *
	 * The amount is the sum of the lines and the paid amount is derived from it, so a payout's figures
	 * are computed from the ledger rather than asserted beside it.
	 *
	 * @param seller The seller.
	 * @param currency The currency.
	 * @param rows The rows to cover.
	 * @param amounts The reserve, the payable amount and the period.
	 * @param note The operator's note, when there is one.
	 * @returns The created payout with its lines.
	 */
	private async writePayout(
		seller: Seller,
		currency: CurrencyCode,
		rows: SellerTransaction[],
		amounts: { reserve: Money; payable: Money; periodStart?: Date; periodEnd?: Date; isFinal: boolean },
		note?: string
	): Promise<SellerPayout> {
		const decimals = rows[0]?.currencyDecimals ?? 2;
		const net = this.total(rows, currency);
		const allocated = await this.allocateNumber();
		const providerKey = seller.metadata && (seller.metadata as any).payoutProviderKey;

		const payout = this.typeOrmSellerPayoutRepository.create({
			sellerId: seller.id,
			number: allocated,
			status: SellerPayoutStatus.PENDING,
			payoutMode: seller.payoutMode ?? SellerPayoutMode.PROVIDER_TRANSFER,
			currency,
			currencyDecimals: decimals,
			netAmount: net.toStorageString(),
			feeAmount: Money.zero(currency, decimals).toStorageString(),
			reserveAmount: amounts.reserve.toStorageString(),
			paidAmount: amounts.payable.toStorageString(),
			periodStart: amounts.periodStart,
			periodEnd: amounts.periodEnd,
			scheduledAt: new Date(),
			isFinal: amounts.isFinal,
			providerKey,
			payoutAccountReference: seller.payoutAccountReference,
			note,
			tenantId: seller.tenantId,
			organizationId: seller.organizationId
		} as Partial<SellerPayout>);

		return this.typeOrmSellerPayoutRepository.manager.transaction(async (manager) => {
			const persisted = await manager.save(SellerPayout, payout as SellerPayout);

			const lines = rows.map((row) =>
				manager.create(SellerPayoutLine, {
					sellerPayoutId: persisted.id,
					sellerTransactionId: row.id,
					amount: row.netAmount,
					currency,
					tenantId: seller.tenantId,
					organizationId: seller.organizationId
				} as Partial<SellerPayoutLine>)
			);

			await manager.save(SellerPayoutLine, lines as SellerPayoutLine[]);

			for (const row of rows) {
				row.status = SellerTransactionStatus.SETTLED;
				row.settledAt = new Date();
			}

			await manager.save(SellerTransaction, rows);

			await this.outbox.append(manager, {
				name: 'seller-payout.created',
				aggregateType: 'SELLER_PAYOUT',
				aggregateId: persisted.id as ID,
				data: {
					payoutId: persisted.id,
					number: persisted.number,
					sellerId: persisted.sellerId,
					currency: persisted.currency,
					netAmount: persisted.netAmount,
					reserveAmount: persisted.reserveAmount,
					feeAmount: persisted.feeAmount,
					paidAmount: persisted.paidAmount,
					periodStart: persisted.periodStart,
					periodEnd: persisted.periodEnd,
					scheduledAt: persisted.scheduledAt,
					transactionCount: rows.length
				},
				tenantId: persisted.tenantId,
				organizationId: persisted.organizationId
			});

			return persisted;
		});
	}

	/**
	 * Draws the next payout number from the platform's sequence.
	 *
	 * @returns The formatted number.
	 */
	private async allocateNumber(): Promise<string> {
		const allocated = (await this.sequenceService.allocate(SELLER_PAYOUT_SEQUENCE)) as any;

		return allocated?.formatted ?? allocated?.number ?? String(allocated?.value ?? Date.now());
	}

	/**
	 * @param sellerId The seller.
	 * @returns The seller row for the resolved tenant and organization.
	 * @throws NotFoundException when it does not exist.
	 */
	private async requireSeller(sellerId: ID): Promise<Seller> {
		const seller = await this.sellerRepository.findOne({
			where: {
				id: sellerId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as FindOptionsWhere<Seller>
		});

		if (!seller) {
			throw new NotFoundException('The seller does not exist.');
		}

		return seller;
	}

	/**
	 * Writes one outbox row for a payout state change.
	 *
	 * @param payout The payout.
	 * @param name The catalogued event name.
	 * @param data The payload.
	 */
	private async emit(payout: SellerPayout, name: string, data: Record<string, any>): Promise<void> {
		await this.typeOrmSellerPayoutRepository.manager.transaction(async (manager) => {
			await this.outbox.append(manager, {
				name,
				aggregateType: 'SELLER_PAYOUT',
				aggregateId: payout.id as ID,
				data: { payoutId: payout.id, number: payout.number, sellerId: payout.sellerId, ...data },
				tenantId: payout.tenantId,
				organizationId: payout.organizationId
			});
		});
	}
}
