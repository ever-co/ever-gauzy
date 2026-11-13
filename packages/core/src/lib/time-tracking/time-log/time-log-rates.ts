import { EntityManager, In } from 'typeorm';
import { ID, IEmployee, ITimeLog, ITimeLogStoredRates } from '@gauzy/contracts';
import { Employee, OrganizationProject, OrganizationProjectEmployee, TimeLog } from '../../core/entities/internal';
import { CURRENT_MEMBERSHIP } from '../../organization-project/organization-project-rate.service';

type Rate = number | string | null | undefined;

/**
 * The rates a time log is recorded with: the member's billing and pay rates, the project's client rate and the
 * member's client rate on the project, each with its currency (empty: the organization's), and the marker that the
 * log stores them.
 */
export interface TimeLogRatesToStore extends ITimeLogStoredRates {
	billRateValue: number | null;
	billRateCurrency: string | null;
	ratesStored: true;
}

/** The members of a time log that say whose time it is and on which project. */
export interface TimeLogRatesScope {
	tenantId: ID;
	employeeId: ID;
	projectId?: ID | null;
}

/** A rate as a column holds it: a number, or null for none. */
function rateOf(value: Rate): number | null {
	const isMissing = value === null || value === undefined || value === '';
	if (isMissing) {
		return null;
	}
	return Number(value);
}

/**
 * The client rates of a project for one member, as the project rates read gives them: the project's, and the
 * member's own on it while the membership is current.
 */
export async function findClientRates(
	manager: EntityManager,
	scope: TimeLogRatesScope
): Promise<
	Pick<TimeLogRatesToStore, 'projectBillRateValue' | 'projectMemberBillRateValue' | 'projectBillRateCurrency'>
> {
	const none = { projectBillRateValue: null, projectMemberBillRateValue: null, projectBillRateCurrency: null };
	if (!scope.projectId) {
		return none;
	}
	const project = await manager.findOne(OrganizationProject, {
		where: { id: scope.projectId, tenantId: scope.tenantId },
		select: { id: true, billRateValue: true, currency: true }
	});
	if (!project) {
		return none;
	}
	const membership = await manager.findOne(OrganizationProjectEmployee, {
		where: {
			organizationProjectId: scope.projectId,
			employeeId: scope.employeeId,
			tenantId: scope.tenantId,
			...CURRENT_MEMBERSHIP
		},
		select: { id: true, billRateValue: true }
	});
	return {
		projectBillRateValue: rateOf(project.billRateValue),
		projectMemberBillRateValue: rateOf(membership?.billRateValue),
		projectBillRateCurrency: project.currency ?? null
	};
}

/**
 * The rates of the moment for a time log about to be recorded, or moved to another member or project: read by
 * name, since the pay rate and the client rates are left out of every generic read.
 *
 * @param manager The TypeORM entity manager, which runs under both ORMs.
 * @param scope Whose time it is, and on which project.
 */
export async function findRatesToStore(manager: EntityManager, scope: TimeLogRatesScope): Promise<TimeLogRatesToStore> {
	const employee = await manager.findOne(Employee, {
		where: { id: scope.employeeId, tenantId: scope.tenantId },
		select: { id: true, billRateValue: true, billRateCurrency: true, payRateValue: true, payRateCurrency: true }
	});
	const clientRates = await findClientRates(manager, scope);
	return {
		billRateValue: rateOf(employee?.billRateValue),
		billRateCurrency: employee?.billRateCurrency ?? null,
		payRateValue: rateOf(employee?.payRateValue),
		payRateCurrency: employee?.payRateCurrency ?? null,
		...clientRates,
		ratesStored: true
	};
}

/** The rates the given time logs store, the hidden ones included, by log id. */
export async function findStoredRatesOf(
	manager: EntityManager,
	timeLogIds: ID[],
	tenantId: ID
): Promise<Map<ID, ITimeLogStoredRates & Pick<ITimeLog, 'billRateValue' | 'billRateCurrency' | 'ratesStored'>>> {
	const stored = new Map<
		ID,
		ITimeLogStoredRates & Pick<ITimeLog, 'billRateValue' | 'billRateCurrency' | 'ratesStored'>
	>();
	if (timeLogIds.length === 0) {
		return stored;
	}
	const rows = await manager.find(TimeLog, {
		where: { id: In(timeLogIds), tenantId },
		select: {
			id: true,
			billRateValue: true,
			billRateCurrency: true,
			payRateValue: true,
			payRateCurrency: true,
			projectBillRateValue: true,
			projectMemberBillRateValue: true,
			projectBillRateCurrency: true,
			ratesStored: true
		},
		withDeleted: true
	});
	for (const row of rows) {
		stored.set(row.id, {
			billRateValue: rateOf(row.billRateValue),
			billRateCurrency: row.billRateCurrency ?? null,
			payRateValue: rateOf(row.payRateValue),
			payRateCurrency: row.payRateCurrency ?? null,
			projectBillRateValue: rateOf(row.projectBillRateValue),
			projectMemberBillRateValue: rateOf(row.projectMemberBillRateValue),
			projectBillRateCurrency: row.projectBillRateCurrency ?? null,
			ratesStored: row.ratesStored ?? null
		});
	}
	return stored;
}

/** Whether a time log stores the rates that price it (a boolean column some drivers return as 0 or 1). */
export function storesRates(log: Pick<ITimeLog, 'ratesStored'> | null | undefined): boolean {
	const marker: unknown = log?.ratesStored;
	return marker === true || marker === 1 || marker === '1' || marker === 'true';
}

/** A billing rate and its currency (empty: the organization's). */
export interface BillingRate {
	rate: number | string | null | undefined;
	currency: string | null;
}

/**
 * The billing rate that prices a log's time: the one it stores, else, for a log recorded around the API, the
 * member's current rate, as all time was priced before rates were stored.
 *
 * @param log The log, with its employee when it may store no rate.
 */
export function billingRateOfLog(
	log: Pick<ITimeLog, 'billRateValue' | 'billRateCurrency' | 'ratesStored'> & {
		employee?: Pick<IEmployee, 'billRateValue' | 'billRateCurrency'> | null;
	}
): BillingRate {
	if (storesRates(log)) {
		return { rate: log.billRateValue, currency: log.billRateCurrency ?? null };
	}
	return { rate: log.employee?.billRateValue, currency: log.employee?.billRateCurrency ?? null };
}
