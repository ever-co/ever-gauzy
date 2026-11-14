import { EntityManager, In } from 'typeorm';
import { chunk } from 'underscore';
import { ID, ITimeLog, ITimeLogStoredRates } from '@gauzy/contracts';
import {
	Employee,
	Organization,
	OrganizationProject,
	OrganizationProjectEmployee,
	TimeLog
} from '../../core/entities/internal';
import { CURRENT_MEMBERSHIP } from '../../organization-project/organization-project-rate.service';

type Rate = number | string | null | undefined;

/** How many time logs one read of their stored rates names. */
const STORED_RATES_BATCH = 500;

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
	/** The organization whose currency a rate that states none is in. */
	organizationId?: ID | null;
	employeeId: ID;
	projectId?: ID | null;
}

/**
 * The organization's currency: what a rate that states none is in. It is stored with the rate, so a later change of
 * the organization's currency never relabels a price already recorded.
 */
export async function findOrganizationCurrency(
	manager: EntityManager,
	scope: Pick<TimeLogRatesScope, 'tenantId' | 'organizationId'>
): Promise<string | null> {
	if (!scope.organizationId) {
		return null;
	}
	const organization = await manager.findOne(Organization, {
		where: { id: scope.organizationId, tenantId: scope.tenantId },
		select: { id: true, currency: true }
	});
	return organization?.currency ?? null;
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
 * member's own on it while the membership is current, in the project's currency, else the organization's.
 */
export async function findClientRates(
	manager: EntityManager,
	scope: TimeLogRatesScope,
	organizationCurrency?: string | null
): Promise<
	Pick<
		TimeLogRatesToStore,
		| 'projectBillRateValue'
		| 'projectMemberBillRateValue'
		| 'projectBillRateCurrency'
		| 'projectMemberBillRateCurrency'
	>
> {
	const none = {
		projectBillRateValue: null,
		projectMemberBillRateValue: null,
		projectBillRateCurrency: null,
		projectMemberBillRateCurrency: null
	};
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
	// Both client rates are in the project's currency when they are recorded; each keeps its own afterwards
	const currency = project.currency || (await currencyOf(manager, scope, organizationCurrency));
	return {
		projectBillRateValue: rateOf(project.billRateValue),
		projectMemberBillRateValue: rateOf(membership?.billRateValue),
		projectBillRateCurrency: currency,
		projectMemberBillRateCurrency: currency
	};
}

/** The organization currency already read, else read now. */
async function currencyOf(
	manager: EntityManager,
	scope: TimeLogRatesScope,
	known: string | null | undefined
): Promise<string | null> {
	if (known !== undefined) {
		return known;
	}
	return await findOrganizationCurrency(manager, scope);
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
	const organizationCurrency = await findOrganizationCurrency(manager, scope);
	const clientRates = await findClientRates(manager, scope, organizationCurrency);
	return {
		billRateValue: rateOf(employee?.billRateValue),
		billRateCurrency: employee?.billRateCurrency || organizationCurrency,
		payRateValue: rateOf(employee?.payRateValue),
		payRateCurrency: employee?.payRateCurrency || organizationCurrency,
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
	const rows: TimeLog[] = [];
	// A month of a team's time is thousands of logs: read them in batches, under every driver's parameter limit
	for (const batch of chunk(timeLogIds, STORED_RATES_BATCH)) {
		const batchRows = await manager.find(TimeLog, {
			where: { id: In(batch), tenantId },
			select: {
				id: true,
				billRateValue: true,
				billRateCurrency: true,
				payRateValue: true,
				payRateCurrency: true,
				projectBillRateValue: true,
				projectMemberBillRateValue: true,
				projectBillRateCurrency: true,
				projectMemberBillRateCurrency: true,
				ratesStored: true
			},
			withDeleted: true
		});
		rows.push(...batchRows);
	}
	for (const row of rows) {
		stored.set(row.id, {
			billRateValue: rateOf(row.billRateValue),
			billRateCurrency: row.billRateCurrency ?? null,
			payRateValue: rateOf(row.payRateValue),
			payRateCurrency: row.payRateCurrency ?? null,
			projectBillRateValue: rateOf(row.projectBillRateValue),
			projectMemberBillRateValue: rateOf(row.projectMemberBillRateValue),
			projectBillRateCurrency: row.projectBillRateCurrency ?? null,
			projectMemberBillRateCurrency: row.projectMemberBillRateCurrency ?? null,
			ratesStored: row.ratesStored ?? null
		});
	}
	return stored;
}

// Which rate prices a log is a pricing rule, without the ORM: it lives beside the pricing
export { billingRateOfLog, storesRates } from './time-log-pricing';
