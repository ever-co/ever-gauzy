import { EntityManager } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { prepareSQLQuery as p } from '../../database/database.helper';
import { NOT_ON_LIVE_INVOICE_PARAMETERS, notOnLiveInvoice } from '../../invoice-item/invoice-item-billed-time';
import { Employee, TimeLog } from '../../core/entities/internal';

/** A time log's `invoiceItemId` as an update names it: by the table, which an update does not alias. */
const UPDATED_TIME_LOG_INVOICE_ITEM = '"time_log"."invoiceItemId"';

/** The time a rate change re-prices: an organization's time logs started on or after a day. */
export interface RepricedTime {
	tenantId: ID;
	organizationId: ID;
	from: Date;
}

/** Which of a member's own rates a change re-prices. */
export interface MemberRatesChanged {
	billing: boolean;
	pay: boolean;
}

/**
 * Gives the time logs of a rate change's scope, started on or after its day, the new rates, and returns how many it
 * changed. Only the logs that store their rates: one that stores none is priced at the current rates already. Time a
 * live invoice bills keeps the price it was invoiced at, and a removed log is left as it is.
 *
 * @param manager The TypeORM entity manager, which runs under both ORMs.
 * @param time The organization's time from the day.
 * @param where The logs among it the rate prices (an employee, a project, or both).
 * @param values The rates they take.
 */
async function reprice(
	manager: EntityManager,
	time: RepricedTime,
	where: Partial<Record<'employeeId' | 'projectId', ID>>,
	values: Partial<TimeLog>
): Promise<number> {
	const query = manager
		.createQueryBuilder()
		.update(TimeLog)
		.set(values)
		.where(p(`"tenantId" = :tenantId`), { tenantId: time.tenantId })
		.andWhere(p(`"organizationId" = :organizationId`), { organizationId: time.organizationId })
		.andWhere(p(`"startedAt" >= :from`), { from: time.from })
		.andWhere(p(`"ratesStored" = :ratesStored`), { ratesStored: true })
		.andWhere(p(`"deletedAt" IS NULL`))
		.andWhere(notOnLiveInvoice(UPDATED_TIME_LOG_INVOICE_ITEM), NOT_ON_LIVE_INVOICE_PARAMETERS);
	for (const [column, id] of Object.entries(where)) {
		query.andWhere(p(`"${column}" = :${column}`), { [column]: id });
	}
	const { affected } = await query.execute();
	return affected ?? 0;
}

/**
 * Re-prices a member's time from a day at the billing and pay rates they have now, for the rates their change set.
 *
 * @returns How many time logs took the new rates.
 */
export async function repriceMemberTime(
	manager: EntityManager,
	time: RepricedTime,
	employeeId: ID,
	changed: MemberRatesChanged
): Promise<number> {
	const changesNothing = !changed.billing && !changed.pay;
	if (changesNothing) {
		return 0;
	}
	const employee = await manager.findOne(Employee, {
		where: { id: employeeId, tenantId: time.tenantId },
		select: { id: true, billRateValue: true, billRateCurrency: true, payRateValue: true, payRateCurrency: true }
	});
	if (!employee) {
		return 0;
	}
	const values: Partial<TimeLog> = {};
	if (changed.billing) {
		values.billRateValue = employee.billRateValue ?? null;
		values.billRateCurrency = employee.billRateCurrency ?? null;
	}
	if (changed.pay) {
		values.payRateValue = employee.payRateValue ?? null;
		values.payRateCurrency = employee.payRateCurrency ?? null;
	}
	return await reprice(manager, time, { employeeId }, values);
}

/**
 * Re-prices a project's time from a day at its new client rate, in the project's currency.
 *
 * @returns How many time logs took the new rate.
 */
export async function repriceProjectTime(
	manager: EntityManager,
	time: RepricedTime,
	projectId: ID,
	rate: { billRateValue: number | null; currency: string | null }
): Promise<number> {
	const values: Partial<TimeLog> = {
		projectBillRateValue: rate.billRateValue,
		projectBillRateCurrency: rate.currency
	};
	return await reprice(manager, time, { projectId }, values);
}

/**
 * Re-prices a member's time on a project from a day at their new client rate on it.
 *
 * @returns How many time logs took the new rate.
 */
export async function repriceMemberProjectTime(
	manager: EntityManager,
	time: RepricedTime,
	projectId: ID,
	employeeId: ID,
	billRateValue: number | null
): Promise<number> {
	return await reprice(manager, time, { projectId, employeeId }, { projectMemberBillRateValue: billRateValue });
}
