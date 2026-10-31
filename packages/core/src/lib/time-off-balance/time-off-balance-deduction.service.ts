import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Between, EntityManager, In, LessThan, MoreThanOrEqual } from 'typeorm';
import { ID, StatusTypesEnum } from '@gauzy/contracts';
import {
	OfficialHoliday,
	Organization,
	TimeOffBalance,
	TimeOffPolicy,
	TimeOffRequest,
	User
} from '../core/entities/internal';
import { TimeOffBalanceDeduction } from './time-off-balance-deduction.entity';
import { balanceRowById, INSUFFICIENT_LEAVE_BALANCE, moveTakenDays } from './time-off-balance-taken';
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

/**
 * Connects leave balances to the time-off approval flow (issue #10183): approving a request takes its working days
 * from the balances of its employees, and taking the approval back gives them back.
 *
 * Everything runs on the caller's transaction (the decision's), so the balances move in the same commit as the
 * request's status, and a refusal rolls both back.
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
 *    balance (`requireSufficientBalance`) refuses the approval instead (400), in one conditional UPDATE per balance,
 *    so two approvals landing together cannot both spend the same days.
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
	 * @param manager The decision's transaction.
	 * @param leave The request, as the decision's locked read found it.
	 * @param status The status the decision gives it.
	 * @throws BadRequestException when the policy requires sufficient balance and an approval needs more days than a
	 * balance has left.
	 */
	async settle(manager: EntityManager, leave: TimeOffBalanceLeave, status: string): Promise<void> {
		switch (balanceEffectOf(leave?.status, status)) {
			case 'deduct':
				await this.deduct(manager, leave);
				return;
			case 'restore':
				await this.restore(manager, leave);
				return;
			default:
				return;
		}
	}

	/**
	 * Takes the request's working days from the balance of each of its employees, per calendar year, and records what
	 * was taken.
	 *
	 * @param manager The transaction to run on.
	 * @param leave The approved request.
	 * @returns what was taken; none when the request had already taken its days, or no balance exists for it.
	 * @throws BadRequestException when the policy requires sufficient balance and a balance does not have the days left.
	 */
	async deduct(manager: EntityManager, leave: TimeOffBalanceLeave): Promise<TimeOffBalanceDeduction[]> {
		const { id, tenantId, organizationId, policyId } = leave ?? ({} as TimeOffBalanceLeave);
		if (!id || !tenantId || !organizationId || !policyId || leave.isHoliday) {
			return [];
		}

		// Taken already: an approval that already took its days takes nothing again.
		if ((await manager.count(TimeOffBalanceDeduction, { where: { timeOffRequestId: id, tenantId } })) > 0) {
			return [];
		}

		const request = await this.requestOf(manager, leave);
		const employeeIds = [...new Set((request?.employees ?? []).map((employee) => employee.id).filter(Boolean))];
		if (employeeIds.length === 0) {
			return [];
		}

		const timeZone = await this.referenceTimeZoneOf(manager, leave, request);
		const span = calendarSpan(leave.start, leave.end, timeZone);
		if (!span) {
			return [];
		}
		if (span.days > MAX_DEDUCTIBLE_SPAN_DAYS) {
			this.logger.warn(
				`Time-off request ${id} runs ${span.days} days (${span.first} to ${span.last}), more than ` +
					`${MAX_DEDUCTIBLE_SPAN_DAYS}: approved without taking days from leave balances.`
			);
			return [];
		}

		const balances = await manager.find(TimeOffBalance, {
			where: { tenantId, organizationId, policyId, employeeId: In(employeeIds), year: In(yearsOf(span)) }
		});
		if (balances.length === 0) {
			// No balance, no change: approval works exactly as it did before balances were connected to it.
			return [];
		}

		const holidays = await this.holidaysOf(manager, leave, span.first, span.last);
		const daysOfYear = new Map(
			workingDaysByYear(leave.start, leave.end, { timeZone, holidays }).map(({ year, days }) => [year, days])
		);
		const strict = await this.requiresSufficientBalance(manager, leave);

		const deductions: TimeOffBalanceDeduction[] = [];
		for (const balance of byId(balances)) {
			const taken = daysOfYear.get(Number(balance.year)) ?? 0;
			if (taken <= 0) {
				continue;
			}
			const move = strict ? 'spend' : 'overdraw';
			if ((await moveTakenDays(manager, balanceRowById(balance.id, tenantId), taken, move)) === 0) {
				// Not enough days left, which only a strict policy refuses. Otherwise the balance was removed since it was
				// read: there is nothing to take from, as when it never existed.
				if (strict && (await manager.count(TimeOffBalance, { where: { id: balance.id, tenantId } })) > 0) {
					throw new BadRequestException(INSUFFICIENT_LEAVE_BALANCE);
				}
				continue;
			}
			deductions.push(
				manager.create(TimeOffBalanceDeduction, {
					tenantId,
					organizationId,
					timeOffRequestId: id,
					balanceId: balance.id,
					days: taken
				})
			);
		}

		return deductions.length > 0 ? await manager.save(TimeOffBalanceDeduction, deductions) : [];
	}

	/**
	 * Gives back what an approval of the request took, and removes the record of it.
	 *
	 * Only what was recorded is given back: a request approved before balances were connected to approvals, or
	 * while it had no balance, gives back nothing.
	 *
	 * @param manager The transaction to run on.
	 * @param leave The request whose approval is taken back.
	 * @returns how many days were given back.
	 */
	async restore(manager: EntityManager, leave: Pick<TimeOffBalanceLeave, 'id' | 'tenantId'>): Promise<number> {
		const { id, tenantId } = leave ?? ({} as TimeOffBalanceLeave);
		if (!id || !tenantId) {
			return 0;
		}

		const deductions = await manager.find(TimeOffBalanceDeduction, { where: { timeOffRequestId: id, tenantId } });
		if (deductions.length === 0) {
			return 0;
		}

		let restored = 0;
		for (const deduction of byId(deductions, (row) => row.balanceId)) {
			const days = Number(deduction.days);
			if (days > 0) {
				// A balance removed since gives nothing back: there is nothing left to give it to.
				await moveTakenDays(manager, balanceRowById(deduction.balanceId, tenantId), days, 'giveBack');
				restored += days;
			}
		}

		await manager.delete(TimeOffBalanceDeduction, { id: In(deductions.map(({ id }) => id)), tenantId });

		return restored;
	}

	/**
	 * The request with its employees and their users, and who filed it. Read on its own: the decision's locked read
	 * joins nothing, since PostgreSQL refuses `FOR UPDATE` on the nullable side of an outer join.
	 */
	private async requestOf(manager: EntityManager, leave: TimeOffBalanceLeave): Promise<TimeOffRequest | null> {
		return await manager.findOne(TimeOffRequest, {
			where: { id: leave.id, tenantId: leave.tenantId },
			relations: { employees: { user: true } },
			loadEagerRelations: false
		});
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
		manager: EntityManager,
		leave: TimeOffBalanceLeave,
		request: TimeOffRequest | null
	): Promise<string> {
		const known = (zone?: string | null): string | null =>
			zone && knownTimeZone(zone) === zone.trim() ? zone.trim() : null;

		if (request?.createdByUserId) {
			const filer = await manager.findOne(User, {
				where: { id: request.createdByUserId, tenantId: leave.tenantId },
				select: { id: true, timeZone: true },
				loadEagerRelations: false
			});
			const zone = known(filer?.timeZone);
			if (zone) {
				return zone;
			}
		}

		const employees = request?.employees ?? [];
		const employeeZone = employees.length === 1 ? known(employees[0].user?.timeZone) : null;
		if (employeeZone) {
			return employeeZone;
		}

		const organization = await manager.findOne(Organization, {
			where: { id: leave.organizationId, tenantId: leave.tenantId },
			select: { id: true, timeZone: true },
			loadEagerRelations: false
		});
		return known(organization?.timeZone) ?? 'UTC';
	}

	/** Whether the request's policy refuses approvals its balances cannot cover (`requireSufficientBalance`). */
	private async requiresSufficientBalance(manager: EntityManager, leave: TimeOffBalanceLeave): Promise<boolean> {
		const policy = await manager.findOne(TimeOffPolicy, {
			where: { id: leave.policyId, tenantId: leave.tenantId },
			select: { id: true, requireSufficientBalance: true },
			loadEagerRelations: false
		});
		return Boolean(policy?.requireSufficientBalance);
	}

	/**
	 * The organization's official holidays that can fall between `first` and `last`: the recurring ones, and the
	 * one-off ones that start in the range or start before it and run into it.
	 */
	private async holidaysOf(
		manager: EntityManager,
		leave: TimeOffBalanceLeave,
		first: string,
		last: string
	): Promise<OfficialHoliday[]> {
		const scope = { tenantId: leave.tenantId, organizationId: leave.organizationId };
		return await manager.find(OfficialHoliday, {
			where: [
				{ ...scope, isRecurring: true },
				{ ...scope, date: Between(first, last) as any },
				{ ...scope, date: LessThan(first) as any, endDate: MoreThanOrEqual(first) as any }
			]
		});
	}
}
