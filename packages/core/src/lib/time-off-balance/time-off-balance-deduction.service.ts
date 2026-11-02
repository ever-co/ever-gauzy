import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ID, StatusTypesEnum } from '@gauzy/contracts';
import { TimeOffRequest } from '../core/entities/internal';
import {
	ITimeOffBalanceDeductionRecord,
	ITimeOffBalanceLedger,
	ITimeOffBalanceRequestParties,
	ITimeOffBalanceRow
} from './time-off-balance-ledger';
import { INSUFFICIENT_LEAVE_BALANCE, noLeaveBalanceAllocated } from './time-off-balance-taken';
import { calendarSpan, knownTimeZone, workingDaysByYear, yearsOf } from './working-days';

/**
 * The longest request, in calendar days, whose working days are taken from leave balances. A longer one (a mistyped
 * year, say) is approved without a deduction, and a warning is logged: the approval is never refused for it.
 */
export const MAX_DEDUCTIBLE_SPAN_DAYS = 3 * 366;

/** What a decision does to the balances of the time-off request it decides. */
export type TimeOffBalanceEffect = 'deduct' | 'restore' | null;

/**
 * The time-off request a decision is about, as the decision's locked read found it — its status is the one the
 * decision moves it FROM.
 */
export type TimeOffBalanceLeave = Pick<
	TimeOffRequest,
	'id' | 'tenantId' | 'organizationId' | 'policyId' | 'start' | 'end' | 'isHoliday' | 'status'
>;

/**
 * The balance effect of moving a time-off request from one status to another.
 *
 * Only a real move has one: into `APPROVED` takes the days, out of `APPROVED` gives them back. Deciding a request
 * the way it is already decided (approving an approved one) does nothing, so a repeated decision never deducts twice.
 *
 * @param previous The status the request has.
 * @param next The status the decision gives it.
 */
export function balanceEffectOf(
	previous: string | null | undefined,
	next: string | null | undefined
): TimeOffBalanceEffect {
	if (!next || previous === next) {
		return null;
	}
	if (next === StatusTypesEnum.APPROVED) {
		return 'deduct';
	}
	if (previous === StatusTypesEnum.APPROVED) {
		return 'restore';
	}
	return null;
}

/** Ids in one order, so two transactions touching the same balances lock them in the same order. */
const byId = <T extends { id?: ID }>(rows: T[], key: (row: T) => ID = (row) => row.id): T[] =>
	[...rows].sort((a, b) => String(key(a)).localeCompare(String(key(b))));

/** The ids of balance rows. */
const balanceIdsOf = (balances: ITimeOffBalanceRow[]): ID[] => balances.map(({ id }) => id);

/** What a request takes: see `TimeOffBalanceDeductionService.chargeOf`. */
interface ITimeOffCharge {
	/** Whether the policy requires sufficient balance. */
	strict: boolean;
	/** The balances of its employees, for its policy and the years it spans. */
	balances: ITimeOffBalanceRow[];
	/** The working days it takes, per calendar year. */
	daysOfYear: ReadonlyMap<number, number>;
}

/** One spelling of an id, so ids read from two tables compare equal whatever case either stored them in. */
const idKey = (id: ID): string => String(id).toLowerCase();

/**
 * Connects leave balances to the time-off approval flow (issue #10183): approving a request takes its working days
 * from the balances of its employees, and taking the approval back gives them back. The charge follows the request
 * after that: an edit of its dates, employees, policy or holiday flag moves it (see {@link recharge}), withdrawing or
 * deleting the request gives it back (see {@link restore}), and putting a withdrawn approved request back takes it
 * again (see {@link reinstate}).
 *
 * Every approval path decides through this one service: the time-off route (`TimeOffStatusHandler`) and the request
 * approval's answer (`RequestApprovalStatusHandler`, ever-co/ever-gauzy#11601 review), so they check and take the
 * same days.
 *
 * Everything runs on the caller's transaction, through the ledger it hands over (see
 * {@link ITimeOffBalanceLedger}), so the balances move in the same commit as the request, and a refusal rolls both
 * back.
 *
 * The rules that keep existing installations working as before:
 *
 *  - **No balance, no change.** Days are only taken from a balance row that exists for the employee, the request's
 *    policy and the year. An organization that never allocated balances approves exactly as before; nothing is
 *    created on the fly.
 *  - **Exact and idempotent.** What an approval took is recorded per balance ({@link TimeOffBalanceDeduction}); a
 *    reversal gives back those days and nothing else, and an approval that finds a record takes nothing again.
 *  - **Not enough days: overdrawn, by default.** A balance that cannot cover the request still lets the approval
 *    through and records the full deduction, so `remaining` goes below zero. A policy that requires sufficient
 *    balance (`requireSufficientBalance`, off by default) refuses the approval instead (400): when a balance does not
 *    have the days left — in one conditional UPDATE per balance, so two approvals landing together cannot both spend
 *    the same days — and when an employee has no balance at all for a year the request takes days of, since there is
 *    nothing to cover them.
 *  - **Never refused for the dates.** A request longer than {@link MAX_DEDUCTIBLE_SPAN_DAYS} is approved without a
 *    deduction, with a warning in the log.
 *
 * Holiday entries (`isHoliday`) and requests without a policy take nothing.
 */
@Injectable()
export class TimeOffBalanceDeductionService {
	private readonly logger = new Logger(TimeOffBalanceDeductionService.name);

	/**
	 * Applies the balance side of a decision that moves `leave` to `status`, on the decision's transaction.
	 *
	 * @param ledger The decision's transaction.
	 * @param leave The request, as the decision's locked read found it.
	 * @param status The status the decision gives it.
	 * @throws BadRequestException when the policy requires sufficient balance and an approval needs more days than a
	 * balance has left, or days of a year an employee has no balance for.
	 */
	async settle(ledger: ITimeOffBalanceLedger, leave: TimeOffBalanceLeave, status: string): Promise<void> {
		switch (balanceEffectOf(leave?.status, status)) {
			case 'deduct':
				await this.deduct(ledger, leave);
				return;
			case 'restore':
				await this.restore(ledger, leave);
				return;
			default:
				return;
		}
	}

	/**
	 * Whether an approval of the request took days that are still recorded — or a zero-day record that it is charged,
	 * kept when an edit left it taking nothing (see {@link recharge}): what an edit has to move and a removal has to
	 * give back.
	 *
	 * @param ledger The transaction to read on.
	 * @param leave The request.
	 */
	async hasCharge(ledger: ITimeOffBalanceLedger, leave: Pick<TimeOffBalanceLeave, 'id' | 'tenantId'>): Promise<boolean> {
		const { id, tenantId } = leave ?? ({} as TimeOffBalanceLeave);
		return !!id && !!tenantId && (await ledger.countDeductions(id, tenantId)) > 0;
	}

	/**
	 * Takes the request's working days from the balance of each of its employees, per calendar year, and records what
	 * was taken.
	 *
	 * @param ledger The transaction to run on.
	 * @param leave The approved request.
	 * @returns what was taken; none when the request had already taken its days, or no balance exists for it.
	 * @throws BadRequestException when the policy requires sufficient balance and a balance does not have the days left,
	 * or an employee has no balance for a year the request takes days of.
	 */
	async deduct(ledger: ITimeOffBalanceLedger, leave: TimeOffBalanceLeave): Promise<ITimeOffBalanceDeductionRecord[]> {
		const { id, tenantId } = leave ?? ({} as TimeOffBalanceLeave);
		if (!id || !tenantId) {
			return [];
		}

		// Taken already: an approval that already took its days takes nothing again.
		if ((await ledger.countDeductions(id, tenantId)) > 0) {
			return [];
		}

		const charge = await this.chargeOf(ledger, leave);
		if (!charge) {
			return [];
		}
		await ledger.lockBalances(balanceIdsOf(charge.balances), tenantId);
		return await this.take(ledger, leave, charge);
	}

	/**
	 * Gives back what an approval of the request took, and removes the record of it: a decision that takes the
	 * approval back, or the request being deleted.
	 *
	 * Only what was recorded is given back: a request approved before balances were connected to approvals, or
	 * while it had no balance, gives back nothing.
	 *
	 * @param ledger The transaction to run on.
	 * @param leave The request whose approval is taken back.
	 * @returns how many days were given back.
	 */
	async restore(ledger: ITimeOffBalanceLedger, leave: Pick<TimeOffBalanceLeave, 'id' | 'tenantId'>): Promise<number> {
		return await this.giveBackRecorded(ledger, leave, (ids, tenantId) => ledger.removeDeductions(ids, tenantId));
	}

	/**
	 * Gives back what an approval of the request took when the request is withdrawn (soft-deleted), as
	 * {@link restore} does, and keeps the record of it as withdrawn: a recovery of the request takes those days again
	 * ({@link reinstate}), and only a request whose withdrawal gave days back.
	 *
	 * @param ledger The withdrawal's transaction.
	 * @param leave The request being withdrawn.
	 * @returns how many days were given back.
	 */
	async withdraw(ledger: ITimeOffBalanceLedger, leave: Pick<TimeOffBalanceLeave, 'id' | 'tenantId'>): Promise<number> {
		return await this.giveBackRecorded(ledger, leave, (ids, tenantId) => ledger.withdrawDeductions(ids, tenantId));
	}

	/**
	 * Moves the charge of an approved request onto the request as an edit left it (its dates, employees, policy or
	 * holiday flag), on the edit's transaction: what its approval took is given back, then what the edited request
	 * takes is taken, by the rules an approval follows — so a strict policy refuses an edit its balances cannot cover,
	 * and the transaction leaves the edit unsaved.
	 *
	 * Only a request whose approval charged it is charged again. One approved before balances were connected to
	 * approvals, or while it had no balance, took nothing, and an edit of it takes nothing either. A charged request an
	 * edit leaves taking nothing (a weekend, a holiday entry, a policy it has no balance under) keeps a zero-day record
	 * of its charge, so an edit back takes its days again (#11608 review).
	 *
	 * @param ledger The edit's transaction.
	 * @param leave The request as edited, read on that transaction.
	 * @returns what the edited request took.
	 * @throws BadRequestException as {@link deduct} does.
	 */
	async recharge(ledger: ITimeOffBalanceLedger, leave: TimeOffBalanceLeave): Promise<ITimeOffBalanceDeductionRecord[]> {
		const { id, tenantId } = leave ?? ({} as TimeOffBalanceLeave);
		if (!id || !tenantId) {
			return [];
		}
		const recorded = await ledger.deductionsOf(id, tenantId);
		if (recorded.length === 0) {
			return [];
		}
		return await this.chargeAgain(ledger, leave, recorded, () =>
			this.giveBack(ledger, tenantId, recorded, (ids) => ledger.removeDeductions(ids, tenantId))
		);
	}

	/**
	 * Takes again the days a withdrawal of the request gave back ({@link withdraw}), when it is put back, on the
	 * recovery's transaction, by the rules an approval follows: a strict policy refuses a recovery its balances cannot
	 * cover. A request whose withdrawal gave nothing back — one withdrawn before withdrawals gave days back, or that
	 * was never charged — takes nothing.
	 *
	 * @param ledger The recovery's transaction.
	 * @param leave The request as recovered, read on that transaction.
	 * @returns what it took.
	 * @throws BadRequestException as {@link deduct} does.
	 */
	async reinstate(ledger: ITimeOffBalanceLedger, leave: TimeOffBalanceLeave): Promise<ITimeOffBalanceDeductionRecord[]> {
		const { id, tenantId } = leave ?? ({} as TimeOffBalanceLeave);
		if (!id || !tenantId) {
			return [];
		}
		// The withdrawn record goes first: a balance holds one deduction per request (the UNIQUE index counts it too).
		const withdrawn = await ledger.purgeWithdrawnDeductions(id, tenantId);
		if (withdrawn.length === 0 || leave.status !== StatusTypesEnum.APPROVED) {
			return [];
		}
		// Charged still (a record the withdrawal did not reach): nothing to take again.
		if ((await ledger.countDeductions(id, tenantId)) > 0) {
			return [];
		}
		return await this.chargeAgain(ledger, leave, withdrawn);
	}

	/**
	 * What the request takes, when it takes anything: its balances and the working days of each year it spans. Read
	 * before any day moves, so the balances a write gives back to and the ones it takes from can be locked together.
	 *
	 * @returns null when it takes nothing: no policy, a holiday entry, no employee, no working day, a span longer than
	 * {@link MAX_DEDUCTIBLE_SPAN_DAYS}, or no balance under a policy that does not require one.
	 * @throws BadRequestException when the policy requires sufficient balance and an employee has no balance for a year
	 * the request takes days of.
	 */
	private async chargeOf(ledger: ITimeOffBalanceLedger, leave: TimeOffBalanceLeave): Promise<ITimeOffCharge | null> {
		const { id, tenantId, organizationId, policyId } = leave ?? ({} as TimeOffBalanceLeave);
		if (!id || !tenantId || !organizationId || !policyId || leave.isHoliday) {
			return null;
		}

		const parties = await ledger.partiesOf(id, tenantId);
		const employeeIds = [...new Set((parties?.employees ?? []).map((employee) => employee.id).filter(Boolean))];
		if (employeeIds.length === 0) {
			return null;
		}

		const timeZone = await this.referenceTimeZoneOf(ledger, leave, parties);
		const span = calendarSpan(leave.start, leave.end, timeZone);
		if (!span) {
			return null;
		}
		if (span.days > MAX_DEDUCTIBLE_SPAN_DAYS) {
			this.logger.warn(
				`Time-off request ${id} runs ${span.days} days (${span.first} to ${span.last}), more than ` +
					`${MAX_DEDUCTIBLE_SPAN_DAYS}: approved without taking days from leave balances.`
			);
			return null;
		}

		const scope = { tenantId, organizationId };
		const balances = await ledger.balancesOf(scope, policyId, employeeIds, yearsOf(span));
		const strict = await ledger.requiresSufficientBalance(policyId, tenantId);
		if (balances.length === 0 && !strict) {
			// No balance, no change: approval works exactly as it did before balances were connected to it.
			return null;
		}

		const holidays = await ledger.holidaysOf(scope, span.first, span.last);
		const daysOfYear = new Map(
			workingDaysByYear(leave.start, leave.end, { timeZone, holidays }).map(({ year, days }) => [year, days])
		);
		if (strict) {
			this.assertEveryYearAllocated(employeeIds, daysOfYear, balances);
		}

		return { strict, balances, daysOfYear };
	}

	/**
	 * Takes what {@link chargeOf} found, from balances whose row locks the caller holds, and records it.
	 *
	 * Under a policy that requires sufficient balance, every balance must give its days: one that does not have them
	 * left, or that was removed since it was read (READ COMMITTED sees a delete committed meanwhile), refuses the
	 * approval and rolls the transaction back (#11608 review). Under any other policy a removed balance takes nothing,
	 * as one that never existed.
	 *
	 * @returns what was taken.
	 * @throws BadRequestException as {@link deduct} does.
	 */
	private async take(
		ledger: ITimeOffBalanceLedger,
		leave: TimeOffBalanceLeave,
		{ strict, balances, daysOfYear }: ITimeOffCharge
	): Promise<ITimeOffBalanceDeductionRecord[]> {
		const { id, tenantId, organizationId } = leave;
		const deductions = [];
		for (const balance of byId(balances)) {
			const taken = daysOfYear.get(Number(balance.year)) ?? 0;
			if (taken <= 0) {
				continue;
			}
			const move = strict ? 'spend' : 'overdraw';
			if ((await ledger.moveTakenDays(balance.id, tenantId, taken, move)) === 0) {
				if (strict) {
					throw new BadRequestException(
						(await ledger.balanceExists(balance.id, tenantId))
							? INSUFFICIENT_LEAVE_BALANCE
							: noLeaveBalanceAllocated([Number(balance.year)])
					);
				}
				continue;
			}
			deductions.push({ tenantId, organizationId, timeOffRequestId: id, balanceId: balance.id, days: taken });
		}

		return deductions.length > 0 ? await ledger.recordDeductions(deductions) : [];
	}

	/**
	 * Charges a request again that was charged with `previous`: an edit of it (which gives `previous` back first) or a
	 * recovery of it (whose withdrawal gave `previous` back).
	 *
	 * The balances given back to and the ones taken from are locked together, in the order of their ids, before any day
	 * moves (see `ITimeOffBalanceLedger.lockBalances`): giving back and then taking would otherwise lock them in two
	 * rounds, and two edits swapping employees or policies could each hold a balance the other waits for (#11608
	 * review). A request that takes nothing now keeps a zero-day record of its charge on the balances it took from, so
	 * the next edit or recovery charges it again — on those still there. A balance removed meanwhile took its
	 * deductions with it (they cascade on delete), and a record naming it would fail the write on its foreign key: with
	 * none left, the request is left uncharged, as one whose balances were removed just before the write (#11608
	 * review).
	 *
	 * @param ledger The write's transaction.
	 * @param leave The request as the write left it.
	 * @param previous What it was charged with.
	 * @param giveBackFirst Gives `previous` back, when the write has not.
	 * @returns what it took.
	 */
	private async chargeAgain(
		ledger: ITimeOffBalanceLedger,
		leave: TimeOffBalanceLeave,
		previous: ITimeOffBalanceDeductionRecord[],
		giveBackFirst?: () => Promise<unknown>
	): Promise<ITimeOffBalanceDeductionRecord[]> {
		const { id, tenantId, organizationId } = leave;
		const charge = await this.chargeOf(ledger, leave);
		const locked = new Set(
			(
				await ledger.lockBalances(
					[...previous.map(({ balanceId }) => balanceId), ...balanceIdsOf(charge?.balances ?? [])],
					tenantId
				)
			).map(idKey)
		);
		await giveBackFirst?.();

		const taken = charge ? await this.take(ledger, leave, charge) : [];
		if (taken.length > 0) {
			return taken;
		}
		const stillThere = [...new Set(previous.map(({ balanceId }) => balanceId))].filter((balanceId) =>
			locked.has(idKey(balanceId))
		);
		if (stillThere.length > 0) {
			await ledger.recordDeductions(
				stillThere.map((balanceId) => ({ tenantId, organizationId, timeOffRequestId: id, balanceId, days: 0 }))
			);
		}
		return [];
	}

	/**
	 * Gives back what the recorded deductions of the request took, then settles their record.
	 *
	 * @param ledger The transaction to run on.
	 * @param leave The request.
	 * @param settleRecord What becomes of the record once its days are given back.
	 * @returns how many days were given back.
	 */
	private async giveBackRecorded(
		ledger: ITimeOffBalanceLedger,
		leave: Pick<TimeOffBalanceLeave, 'id' | 'tenantId'>,
		settleRecord: (ids: ID[], tenantId: ID) => Promise<void>
	): Promise<number> {
		const { id, tenantId } = leave ?? ({} as TimeOffBalanceLeave);
		if (!id || !tenantId) {
			return 0;
		}
		const deductions = await ledger.deductionsOf(id, tenantId);
		if (deductions.length === 0) {
			return 0;
		}
		await ledger.lockBalances(
			deductions.map(({ balanceId }) => balanceId),
			tenantId
		);
		return await this.giveBack(ledger, tenantId, deductions, (ids) => settleRecord(ids, tenantId));
	}

	/**
	 * Gives back what `deductions` took, to balances whose row locks the caller holds, then settles their record. A
	 * zero-day record (see {@link recharge}) gives nothing back and is settled with the rest.
	 *
	 * @returns how many days were given back.
	 */
	private async giveBack(
		ledger: ITimeOffBalanceLedger,
		tenantId: ID,
		deductions: ITimeOffBalanceDeductionRecord[],
		settleRecord: (ids: ID[]) => Promise<void>
	): Promise<number> {
		let restored = 0;
		for (const deduction of byId(deductions, (row) => row.balanceId)) {
			const days = Number(deduction.days);
			if (days > 0) {
				// A balance removed since gives nothing back: there is nothing left to give it to.
				await ledger.moveTakenDays(deduction.balanceId, tenantId, days, 'giveBack');
				restored += days;
			}
		}
		await settleRecord(deductions.map(({ id }) => id));
		return restored;
	}

	/**
	 * Refuses, for a policy that requires sufficient balance, a request that takes days of a year for which one of its
	 * employees has no balance: nothing covers those days. A year the request takes no working day of needs none.
	 *
	 * @throws BadRequestException naming the years without a balance.
	 */
	private assertEveryYearAllocated(
		employeeIds: ID[],
		daysOfYear: ReadonlyMap<number, number>,
		balances: ITimeOffBalanceRow[]
	): void {
		const allocated = new Set(balances.map((balance) => `${idKey(balance.employeeId)}:${Number(balance.year)}`));
		const missing = new Set<number>();
		for (const [year, days] of daysOfYear) {
			if (days > 0 && employeeIds.some((employeeId) => !allocated.has(`${idKey(employeeId)}:${year}`))) {
				missing.add(year);
			}
		}
		if (missing.size > 0) {
			throw new BadRequestException(noLeaveBalanceAllocated([...missing].sort((a, b) => a - b)));
		}
	}

	/**
	 * The zone the request's days are read in: the one the dates were picked in, as far as the server knows it. That
	 * is the zone of the user who filed the request (whose date picker produced them), else of its employee's user
	 * when it is for one employee, else the organization's, else UTC. A zone moment does not know is passed over.
	 *
	 * The reading itself tolerates a picker up to twelve hours away from this zone (see `calendarDayOf`), so an
	 * employee travelling, or one without a zone of their own, still has the days they picked counted.
	 */
	private async referenceTimeZoneOf(
		ledger: ITimeOffBalanceLedger,
		leave: TimeOffBalanceLeave,
		parties: ITimeOffBalanceRequestParties | null
	): Promise<string> {
		const known = (zone?: string | null): string | null =>
			zone && knownTimeZone(zone) === zone.trim() ? zone.trim() : null;

		if (parties?.createdByUserId) {
			const zone = known(await ledger.userTimeZone(parties.createdByUserId, leave.tenantId));
			if (zone) {
				return zone;
			}
		}

		const employees = parties?.employees ?? [];
		const employeeZone = employees.length === 1 ? known(employees[0].timeZone) : null;
		if (employeeZone) {
			return employeeZone;
		}

		return known(await ledger.organizationTimeZone(leave.organizationId, leave.tenantId)) ?? 'UTC';
	}
}
