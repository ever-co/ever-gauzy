import { Brackets, EntityManager } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { prepareSQLQuery as p } from '../../database/database.helper';
import { NOT_ON_LIVE_INVOICE_PARAMETERS, notOnLiveInvoice } from '../../invoice-item/invoice-item-billed-time';
import { Employee, Organization, TimeLog } from '../../core/entities/internal';
import { findOrganizationCurrency } from './time-log-rates';

/** A time log's `invoiceItemId` as an update names it: by the table, which an update does not alias. */
const UPDATED_TIME_LOG_INVOICE_ITEM = '"time_log"."invoiceItemId"';

/** The time a rate change re-prices: an organization's time logs started on or after a day, or all of them. */
export interface RepricedTime {
	tenantId: ID;
	organizationId: ID;
	/**
	 * The day the change applies from. Null for all the time already tracked: a change without a day prices it where
	 * the organization's time logs do not keep their rates (see {@link keepsTimeLogRates}).
	 */
	from: Date | null;
}

/**
 * Whether an organization's time logs keep the rates they were recorded at (`organization.timeLogsKeepTheirRates`).
 * Not unless the organization turned it on: a rate change without a day then prices all the time already tracked, as
 * every report priced it before time logs stored their rates.
 *
 * @param manager The TypeORM entity manager, which runs under both ORMs.
 * @param scope The organization, in its tenant.
 */
export async function keepsTimeLogRates(
	manager: EntityManager,
	scope: { tenantId: ID; organizationId: ID }
): Promise<boolean> {
	const organization = await manager.findOne(Organization, {
		where: { id: scope.organizationId, tenantId: scope.tenantId },
		select: { id: true, timeLogsKeepTheirRates: true }
	});
	return organization?.timeLogsKeepTheirRates === true;
}

/** The member's own rates a change sent; a rate it leaves out keeps its stored value. */
export interface MemberRatesSent {
	billRateValue?: number | null;
	billRateCurrency?: string | null;
	payRateValue?: number | null;
	payRateCurrency?: string | null;
}

/**
 * Gives the time logs of a rate change's scope the new rates, and returns how many it changed. Only the logs that store
 * their rates: one that stores none is priced at the current rates already; and a removed log is left as it is.
 *
 * With a day, the logs started on or after it, but time a live invoice bills keeps the price it was invoiced at.
 * Without one, all of them, invoiced time too: every report priced each hour at the current rate before time logs
 * stored their rates, and an organization whose time logs do not keep their rates reads its reports as it did.
 *
 * Only the logs whose stored rates differ from the new ones are written: a change sent again completes a re-pricing
 * that failed half-way, and a change that changes nothing writes nothing.
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
		.andWhere(p(`"ratesStored" = :ratesStored`), { ratesStored: true })
		.andWhere(p(`"deletedAt" IS NULL`));
	if (time.from) {
		query
			.andWhere(p(`"startedAt" >= :from`), { from: time.from })
			.andWhere(notOnLiveInvoice(UPDATED_TIME_LOG_INVOICE_ITEM), NOT_ON_LIVE_INVOICE_PARAMETERS);
	}
	for (const [column, id] of Object.entries(where)) {
		query.andWhere(p(`"${column}" = :${column}`), { [column]: id });
	}
	query.andWhere(differsFrom(values));
	const { affected } = await query.execute();
	return affected ?? 0;
}

/**
 * The logs whose stored rates differ from the given ones, a null stored or given value counting as a value: written
 * per column, `IS DISTINCT FROM` being Postgres's alone.
 */
function differsFrom(values: Partial<TimeLog>): Brackets {
	return new Brackets((query) => {
		Object.entries(values).forEach(([column, value], index) => {
			if (value === null || value === undefined) {
				query.orWhere(p(`"${column}" IS NOT NULL`));
				return;
			}
			const parameter = `differs${index}`;
			query.orWhere(p(`("${column}" IS NULL OR "${column}" <> :${parameter})`), { [parameter]: value });
		});
	});
}

/**
 * Re-prices a member's time at the billing or pay rate a change sent: from its day, or all of it without one (see
 * {@link reprice}). The rate sent prices the time, not
 * a rate read back after the save: another save between the two must not decide the price of this change. A value
 * the change left out (the currency of a rate it sent alone) is read as stored.
 *
 * @returns How many time logs took the new rates.
 */
export async function repriceMemberTime(
	manager: EntityManager,
	time: RepricedTime,
	employeeId: ID,
	sent: MemberRatesSent
): Promise<number> {
	const sendsBilling = sent.billRateValue !== undefined || sent.billRateCurrency !== undefined;
	const sendsPay = sent.payRateValue !== undefined || sent.payRateCurrency !== undefined;
	const sendsNothing = !sendsBilling && !sendsPay;
	if (sendsNothing) {
		return 0;
	}
	const employee = await manager.findOne(Employee, {
		where: { id: employeeId, tenantId: time.tenantId },
		select: { id: true, billRateValue: true, billRateCurrency: true, payRateValue: true, payRateCurrency: true }
	});
	if (!employee) {
		return 0;
	}
	// A rate that states no currency is stored in the organization's, as a new log stores it
	const organizationCurrency = await findOrganizationCurrency(manager, time);
	const values: Partial<TimeLog> = {};
	if (sendsBilling) {
		values.billRateValue = sentOrStored(sent.billRateValue, employee.billRateValue);
		values.billRateCurrency =
			sentOrStored(sent.billRateCurrency, employee.billRateCurrency) || organizationCurrency;
	}
	if (sendsPay) {
		values.payRateValue = sentOrStored(sent.payRateValue, employee.payRateValue);
		values.payRateCurrency = sentOrStored(sent.payRateCurrency, employee.payRateCurrency) || organizationCurrency;
	}
	return await reprice(manager, time, { employeeId }, values);
}

/** The value a change sent, else the stored one. */
function sentOrStored<T>(sent: T | undefined, stored: T | null | undefined): T | null {
	if (sent !== undefined) {
		return sent;
	}
	return stored ?? null;
}

/**
 * Re-prices a project's time at its new client rate, in the project's currency: from a day, or all of it without one.
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
 * Re-prices a member's time on a project at their new client rate on it (from a day, or all of it without one), in the
 * project's currency of the moment, stored with it apart from the project's client rate and its currency.
 *
 * @returns How many time logs took the new rate.
 */
export async function repriceMemberProjectTime(
	manager: EntityManager,
	time: RepricedTime,
	projectId: ID,
	employeeId: ID,
	rate: { billRateValue: number | null; currency: string | null }
): Promise<number> {
	const values: Partial<TimeLog> = {
		projectMemberBillRateValue: rate.billRateValue,
		projectMemberBillRateCurrency: rate.currency
	};
	return await reprice(manager, time, { projectId, employeeId }, values);
}
