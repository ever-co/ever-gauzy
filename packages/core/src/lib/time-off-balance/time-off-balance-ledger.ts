import { randomUUID } from 'node:crypto';
import { Between, EntityManager, In, IsNull, LessThan, MoreThanOrEqual, Not } from 'typeorm';
import { raw } from '@mikro-orm/core';
import type { EntityManager as MikroOrmEntityManager } from '@mikro-orm/core';
import type { SqlEntityManager } from '@mikro-orm/knex';
import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import { ID } from '@gauzy/contracts';
import {
	OfficialHoliday,
	Organization,
	TimeOffBalance,
	TimeOffPolicy,
	TimeOffRequest,
	User
} from '../core/entities/internal';
import { TimeOffBalanceDeduction } from './time-off-balance-deduction.entity';
import { assertDaysToMove, balanceRowById, moveTakenDays, TakenDaysMove, takenDaysStatement } from './time-off-balance-taken';
import { ITimeOffHolidayDates } from './working-days';

/** A tenant and an organization: the scope every balance row and holiday is read in. */
export interface ITimeOffBalanceScope {
	tenantId: ID;
	organizationId: ID;
}

/** What one approval took from one balance, as recorded. */
export interface ITimeOffBalanceDeductionRecord {
	id: ID;
	balanceId: ID;
	days: number;
}

/** A deduction to record. */
export interface ITimeOffBalanceDeductionInput extends ITimeOffBalanceScope {
	timeOffRequestId: ID;
	balanceId: ID;
	days: number;
}

/** Who a time-off request was filed by and is for, as far as reading its days goes. */
export interface ITimeOffBalanceRequestParties {
	/** The user who filed the request, whose date picker produced its dates. */
	createdByUserId?: ID | null;
	/** Its employees, each with the zone of their user. */
	employees: Array<{ id: ID; timeZone?: string | null }>;
}

/** A balance row, as far as taking days from it goes. */
export interface ITimeOffBalanceRow {
	id: ID;
	employeeId: ID;
	year: number;
}

/**
 * The reads and writes the balance side of a time-off decision makes, all on the caller's transaction: see
 * {@link TimeOffBalanceDeductionService}.
 *
 * The service holds the rules (which days, which balances, what a strict policy refuses); a ledger holds the
 * statements, once per ORM. The time-off routes run on TypeORM on either ORM the installation runs
 * ({@link typeOrmTimeOffBalanceLedger}); the request approval's answer runs on the ORM the installation runs, so
 * under `DB_ORM=mikro-orm` it hands over {@link mikroOrmTimeOffBalanceLedger}. A statement made on another
 * connection than the decision's would wait for the decision's own row lock on the leave (the deduction's foreign
 * key reads that row), so nothing here opens a connection of its own.
 *
 * Every read leaves out soft-deleted rows, as TypeORM's reads do: a deduction a withdrawal gave back is soft-deleted
 * (see {@link ITimeOffBalanceLedger.withdrawDeductions}), so it is neither given back again nor counted as a charge.
 */
export interface ITimeOffBalanceLedger {
	/** How many deductions are recorded for the request, inside the tenant. */
	countDeductions(timeOffRequestId: ID, tenantId: ID): Promise<number>;
	/** The deductions recorded for the request, inside the tenant. */
	deductionsOf(timeOffRequestId: ID, tenantId: ID): Promise<ITimeOffBalanceDeductionRecord[]>;
	/** Records deductions. */
	recordDeductions(deductions: ITimeOffBalanceDeductionInput[]): Promise<ITimeOffBalanceDeductionRecord[]>;
	/** Removes recorded deductions, inside the tenant. */
	removeDeductions(ids: ID[], tenantId: ID): Promise<void>;
	/**
	 * Marks recorded deductions as given back by a withdrawal of their request (soft-deletes them), inside the tenant:
	 * no read sees them any more, and a recovery of the request knows it has days to take again.
	 */
	withdrawDeductions(ids: ID[], tenantId: ID): Promise<void>;
	/**
	 * Removes the deductions a withdrawal of the request gave back (see {@link withdrawDeductions}), inside the tenant.
	 *
	 * @returns How many there were.
	 */
	purgeWithdrawnDeductions(timeOffRequestId: ID, tenantId: ID): Promise<number>;
	/** Who the request was filed by and is for, inside the tenant; null when it is not there. */
	partiesOf(timeOffRequestId: ID, tenantId: ID): Promise<ITimeOffBalanceRequestParties | null>;
	/** The zone of a user, inside the tenant, as stored. */
	userTimeZone(userId: ID, tenantId: ID): Promise<string | null>;
	/** The zone of an organization, inside the tenant, as stored. */
	organizationTimeZone(organizationId: ID, tenantId: ID): Promise<string | null>;
	/** Whether the policy refuses approvals its balances cannot cover (`requireSufficientBalance`). */
	requiresSufficientBalance(policyId: ID, tenantId: ID): Promise<boolean>;
	/** The balances the employees have for the policy, in the years named. */
	balancesOf(
		scope: ITimeOffBalanceScope,
		policyId: ID,
		employeeIds: ID[],
		years: number[]
	): Promise<ITimeOffBalanceRow[]>;
	/**
	 * The organization's official holidays that can fall between `first` and `last`: the recurring ones, and the
	 * one-off ones that start in the range or start before it and run into it.
	 */
	holidaysOf(scope: ITimeOffBalanceScope, first: string, last: string): Promise<ITimeOffHolidayDates[]>;
	/**
	 * Moves days on one live balance in one conditional statement (see `moveTakenDays`).
	 *
	 * @returns How many rows moved: 0 when the balance is gone or, for `spend`, does not have the days left.
	 */
	moveTakenDays(balanceId: ID, tenantId: ID, days: number, move: TakenDaysMove): Promise<number>;
	/** Whether the balance is still there, inside the tenant. */
	balanceExists(balanceId: ID, tenantId: ID): Promise<boolean>;
}

/**
 * The TypeORM ledger: every statement on the manager handed over (the decision's transaction).
 *
 * @param manager The transaction's manager.
 */
export function typeOrmTimeOffBalanceLedger(manager: EntityManager): ITimeOffBalanceLedger {
	return {
		countDeductions: async (timeOffRequestId, tenantId) =>
			await manager.count(TimeOffBalanceDeduction, { where: { timeOffRequestId, tenantId } }),
		deductionsOf: async (timeOffRequestId, tenantId) =>
			(await manager.find(TimeOffBalanceDeduction, { where: { timeOffRequestId, tenantId } })).map(
				({ id, balanceId, days }) => ({ id, balanceId, days: Number(days) })
			),
		recordDeductions: async (deductions) =>
			(
				await manager.save(
					TimeOffBalanceDeduction,
					deductions.map((deduction) => manager.create(TimeOffBalanceDeduction, deduction))
				)
			).map(({ id, balanceId, days }) => ({ id, balanceId, days: Number(days) })),
		removeDeductions: async (ids, tenantId) => {
			await manager.delete(TimeOffBalanceDeduction, { id: In(ids), tenantId });
		},
		withdrawDeductions: async (ids, tenantId) => {
			await manager.softDelete(TimeOffBalanceDeduction, { id: In(ids), tenantId });
		},
		purgeWithdrawnDeductions: async (timeOffRequestId, tenantId) =>
			(await manager.delete(TimeOffBalanceDeduction, { timeOffRequestId, tenantId, deletedAt: Not(IsNull()) }))
				.affected ?? 0,
		partiesOf: async (id, tenantId) => {
			// Read on its own: the decision's locked read joins nothing, since PostgreSQL refuses `FOR UPDATE` on the
			// nullable side of an outer join.
			const request = await manager.findOne(TimeOffRequest, {
				where: { id, tenantId },
				relations: { employees: { user: true } },
				loadEagerRelations: false
			});
			return request
				? {
						createdByUserId: request.createdByUserId,
						employees: (request.employees ?? []).map((employee) => ({
							id: employee.id,
							timeZone: employee.user?.timeZone ?? null
						}))
				  }
				: null;
		},
		userTimeZone: async (id, tenantId) =>
			(
				await manager.findOne(User, {
					where: { id, tenantId },
					select: { id: true, timeZone: true },
					loadEagerRelations: false
				})
			)?.timeZone ?? null,
		organizationTimeZone: async (id, tenantId) =>
			(
				await manager.findOne(Organization, {
					where: { id, tenantId },
					select: { id: true, timeZone: true },
					loadEagerRelations: false
				})
			)?.timeZone ?? null,
		requiresSufficientBalance: async (id, tenantId) =>
			Boolean(
				(
					await manager.findOne(TimeOffPolicy, {
						where: { id, tenantId },
						select: { id: true, requireSufficientBalance: true },
						loadEagerRelations: false
					})
				)?.requireSufficientBalance
			),
		balancesOf: async ({ tenantId, organizationId }, policyId, employeeIds, years) =>
			(
				await manager.find(TimeOffBalance, {
					where: { tenantId, organizationId, policyId, employeeId: In(employeeIds), year: In(years) }
				})
			).map(({ id, employeeId, year }) => ({ id, employeeId, year: Number(year) })),
		holidaysOf: async (scope, first, last) =>
			await manager.find(OfficialHoliday, {
				where: [
					{ ...scope, isRecurring: true },
					{ ...scope, date: Between(first, last) as any },
					{ ...scope, date: LessThan(first) as any, endDate: MoreThanOrEqual(first) as any }
				]
			}),
		moveTakenDays: async (balanceId, tenantId, days, move) =>
			await moveTakenDays(manager, balanceRowById(balanceId, tenantId), days, move),
		balanceExists: async (id, tenantId) => (await manager.count(TimeOffBalance, { where: { id, tenantId } })) > 0
	};
}

/**
 * The MikroORM ledger: every statement on the transaction's context, and every read from the table rather than the
 * identity map the context inherited.
 *
 * Two facts of the MikroORM mapping decide how it states its rows. `tenantId`, `organizationId` and the other
 * foreign-key members are relation mirrors (`persist: false`), so a deduction is inserted natively, which names the
 * columns by those members and writes them, and relations are matched by their relation members. And the row id has
 * no default outside PostgreSQL, so the writer states it, with the timestamps a native insert does not stamp.
 *
 * @param manager The transaction's entity manager.
 */
export function mikroOrmTimeOffBalanceLedger(manager: MikroOrmEntityManager): ITimeOffBalanceLedger {
	const em = manager.getContext(false) as SqlEntityManager;
	const fromTable = { disableIdentityMap: true } as any;
	const live = { deletedAt: null };
	const idOf = (relation: any, mirror: unknown): ID => (relation?.id ?? mirror) as ID;

	return {
		countDeductions: async (timeOffRequestId, tenantId) =>
			await em.count(TimeOffBalanceDeduction, { timeOffRequest: timeOffRequestId, tenantId, ...live } as any),
		deductionsOf: async (timeOffRequestId, tenantId) =>
			(
				(await em.find(
					TimeOffBalanceDeduction,
					{ timeOffRequest: timeOffRequestId, tenantId, ...live } as any,
					fromTable
				)) as any[]
			).map((row) => ({ id: row.id, balanceId: idOf(row.balance, row.balanceId), days: Number(row.days) })),
		recordDeductions: async (deductions) => {
			const now = new Date();
			const records: ITimeOffBalanceDeductionRecord[] = [];
			for (const { tenantId, organizationId, timeOffRequestId, balanceId, days } of deductions) {
				const id = randomUUID();
				await em.insert(TimeOffBalanceDeduction, {
					id,
					tenantId,
					organizationId,
					timeOffRequestId,
					balanceId,
					days,
					createdAt: now,
					updatedAt: now
				} as any);
				records.push({ id, balanceId, days });
			}
			return records;
		},
		removeDeductions: async (ids, tenantId) => {
			await em.nativeDelete(TimeOffBalanceDeduction, { id: { $in: ids }, tenantId } as any);
		},
		withdrawDeductions: async (ids, tenantId) => {
			await em.nativeUpdate(
				TimeOffBalanceDeduction,
				{ id: { $in: ids }, tenantId, ...live } as any,
				{ deletedAt: new Date() } as any
			);
		},
		purgeWithdrawnDeductions: async (timeOffRequestId, tenantId) =>
			await em.nativeDelete(
				TimeOffBalanceDeduction,
				{ timeOffRequest: timeOffRequestId, tenantId, deletedAt: { $ne: null } } as any,
				// The soft-delete filter would keep every statement to live rows, and these are withdrawn ones.
				{ filters: { [SOFT_DELETABLE_FILTER]: false } }
			),
		partiesOf: async (id, tenantId) => {
			const request = (await em.findOne(
				TimeOffRequest,
				{ id, tenantId, ...live } as any,
				{ ...fromTable, populate: ['employees', 'employees.user'] } as any
			)) as any;
			if (!request) {
				return null;
			}
			const employees: any[] = request.employees?.isInitialized?.() ? request.employees.getItems() : [];
			return {
				createdByUserId: request.createdByUserId ?? request.createdByUser?.id ?? null,
				employees: employees.map((employee) => ({ id: employee.id, timeZone: employee.user?.timeZone ?? null }))
			};
		},
		userTimeZone: async (id, tenantId) =>
			((await em.findOne(User, { id, tenantId } as any, fromTable)) as any)?.timeZone ?? null,
		organizationTimeZone: async (id, tenantId) =>
			((await em.findOne(Organization, { id, tenantId } as any, fromTable)) as any)?.timeZone ?? null,
		requiresSufficientBalance: async (id, tenantId) =>
			Boolean(((await em.findOne(TimeOffPolicy, { id, tenantId } as any, fromTable)) as any)?.requireSufficientBalance),
		balancesOf: async ({ tenantId, organizationId }, policyId, employeeIds, years) =>
			(
				(await em.find(
					TimeOffBalance,
					{
						tenantId,
						organizationId,
						policy: policyId,
						employee: { $in: employeeIds },
						year: { $in: years },
						...live
					} as any,
					fromTable
				)) as any[]
			).map((row) => ({ id: row.id, employeeId: idOf(row.employee, row.employeeId), year: Number(row.year) })),
		holidaysOf: async (scope, first, last) =>
			(await em.find(
				OfficialHoliday,
				{
					$or: [
						{ ...scope, isRecurring: true, ...live },
						{ ...scope, date: { $gte: first, $lte: last }, ...live },
						{ ...scope, date: { $lt: first }, endDate: { $gte: first }, ...live }
					]
				} as any,
				fromTable
			)) as any[],
		moveTakenDays: async (balanceId, tenantId, days, move) => {
			assertDaysToMove(days);
			// The statement TypeORM's ledger sends, with MikroORM's positional parameters: one `days` per placeholder.
			const statement = takenDaysStatement(move, '?');
			const params = (sql: string) => Array.from(sql.match(/\?/g) ?? [], () => days);
			const query = em
				.createQueryBuilder(TimeOffBalance)
				// `remaining` first, for MySQL (see `moveTakenDays`).
				.update({
					remaining: raw(statement.remaining, params(statement.remaining)),
					taken: raw(statement.taken, params(statement.taken))
				} as any)
				.where({ id: balanceId, tenantId, ...live } as any);
			if (statement.daysLeft) {
				query.andWhere(statement.daysLeft, params(statement.daysLeft));
			}
			const result = (await query.execute('run')) as { affectedRows?: number };
			return result?.affectedRows ?? 0;
		},
		balanceExists: async (id, tenantId) =>
			(await em.count(TimeOffBalance, { id, tenantId, ...live } as any)) > 0
	};
}
