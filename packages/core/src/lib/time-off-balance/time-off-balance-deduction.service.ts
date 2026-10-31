import { BadRequestException, Injectable } from '@nestjs/common';
import { Between, EntityManager, In, LessThan, MoreThanOrEqual } from 'typeorm';
import { ID, StatusTypesEnum } from '@gauzy/contracts';
import { OfficialHoliday, Organization, TimeOffBalance, TimeOffRequest } from '../core/entities/internal';
import { TimeOffBalanceDeduction } from './time-off-balance-deduction.entity';
import { balanceRowById, INSUFFICIENT_LEAVE_BALANCE, moveTakenDays } from './time-off-balance-taken';
import { calendarDaysBetween, workingDaysByYear } from './working-days';

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
export function balanceEffectOf(previous: string | null | undefined, next: string | null | undefined): TimeOffBalanceEffect {
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
 *  - **Not enough days, no approval.** A balance that exists but cannot cover the request refuses the approval
 *    (400), in one conditional UPDATE per balance, so two approvals landing together cannot both spend the same days.
 *
 * Holiday entries (`isHoliday`) and requests without a policy take nothing.
 */
@Injectable()
export class TimeOffBalanceDeductionService {
	/**
	 * Applies the balance side of a decision that moves `leave` to `status`, on the decision's transaction.
	 *
	 * @param manager The decision's transaction.
	 * @param leave The request, as the decision's locked read found it.
	 * @param status The status the decision gives it.
	 * @throws BadRequestException when an approval needs more days than a balance has left.
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
	 * @throws BadRequestException when a balance does not have the days left.
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

		const employeeIds = await this.employeeIdsOf(manager, leave);
		if (employeeIds.length === 0) {
			return [];
		}

		const timeZone = await this.timeZoneOf(manager, leave);
		const days = calendarDaysBetween(leave.start, leave.end, timeZone);
		if (days.length === 0) {
			return [];
		}
		const years = [...new Set(days.map((day) => Number(day.slice(0, 4))))];

		const balances = await manager.find(TimeOffBalance, {
			where: { tenantId, organizationId, policyId, employeeId: In(employeeIds), year: In(years) }
		});
		if (balances.length === 0) {
			// No balance, no change: approval works exactly as it did before balances were connected to it.
			return [];
		}

		const holidays = await this.holidaysOf(manager, leave, days[0], days[days.length - 1]);
		const daysOfYear = new Map(
			workingDaysByYear(leave.start, leave.end, { timeZone, holidays }).map(({ year, days }) => [year, days])
		);

		const deductions: TimeOffBalanceDeduction[] = [];
		for (const balance of byId(balances)) {
			const taken = daysOfYear.get(Number(balance.year)) ?? 0;
			if (taken <= 0) {
				continue;
			}
			if ((await moveTakenDays(manager, balanceRowById(balance.id, tenantId), taken, true)) === 0) {
				// Removed since it was read: there is nothing to take from, as when it never existed.
				if ((await manager.count(TimeOffBalance, { where: { id: balance.id, tenantId } })) === 0) {
					continue;
				}
				throw new BadRequestException(INSUFFICIENT_LEAVE_BALANCE);
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
				await moveTakenDays(manager, balanceRowById(deduction.balanceId, tenantId), days, false);
				restored += days;
			}
		}

		await manager.delete(TimeOffBalanceDeduction, { id: In(deductions.map(({ id }) => id)), tenantId });

		return restored;
	}

	/**
	 * The employees the request is for. Read on its own: the decision's locked read joins nothing, since PostgreSQL
	 * refuses `FOR UPDATE` on the nullable side of an outer join.
	 */
	private async employeeIdsOf(manager: EntityManager, leave: TimeOffBalanceLeave): Promise<ID[]> {
		const request = await manager.findOne(TimeOffRequest, {
			where: { id: leave.id, tenantId: leave.tenantId },
			relations: { employees: true },
			loadEagerRelations: false
		});
		return [...new Set((request?.employees ?? []).map((employee) => employee.id).filter(Boolean))];
	}

	/** The organization's time zone: the closest the server knows to the zone the request's days were picked in. */
	private async timeZoneOf(manager: EntityManager, leave: TimeOffBalanceLeave): Promise<string | undefined> {
		const organization = await manager.findOne(Organization, {
			where: { id: leave.organizationId, tenantId: leave.tenantId },
			select: { id: true, timeZone: true },
			loadEagerRelations: false
		});
		return organization?.timeZone ?? undefined;
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
