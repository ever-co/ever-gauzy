import { chain, pluck } from 'underscore';
import { ID, IEmployee, ITimeLog } from '@gauzy/contracts';
import { addDecimalStrings } from '../../money/decimal';
import {
	effectiveBillRate,
	effectiveBillRateCurrency,
	effectiveBillRateSource
} from '../../organization-project/project-rates';
import { calculateAverage, calculateBillableAmount } from './time-log.utils';

type Rate = number | string | null | undefined;

interface ProjectRateRow {
	id?: ID;
	billRateValue?: Rate;
	currency?: string | null;
}

interface MemberRateRow {
	organizationProjectId: ID;
	employeeId?: ID;
	billRateValue?: Rate;
}

/** The rates a report prices its logs' projects at: each project's own rate, and its members' own rates on it. */
export interface ProjectRateLookup {
	projects: Map<ID, ProjectRateRow>;
	memberRates: Map<string, Rate>;
}

function memberRateKey(projectId: ID, employeeId: ID | undefined): string {
	return `${projectId}:${employeeId}`;
}

function isRateSet(rate: Rate): boolean {
	const isMissing = rate === null || rate === undefined;
	return !isMissing;
}

export function uniqueProjectIds(logs: ITimeLog[]): ID[] {
	const projectIds = logs.map((log) => log.projectId).filter(Boolean);
	return Array.from(new Set(projectIds));
}

/**
 * The lookup of the projects' and members' rates, or `null` when none is set: every amount is then the employee's
 * rate times the time, exactly as before project rates existed.
 */
export function buildProjectRateLookup(
	projects: ProjectRateRow[],
	memberships: MemberRateRow[]
): ProjectRateLookup | null {
	const pricedProjects = projects.filter((project) => isRateSet(project.billRateValue));
	const pricedMemberships = memberships.filter((membership) => isRateSet(membership.billRateValue));
	const hasProjectRates = pricedProjects.length > 0;
	const hasMemberRates = pricedMemberships.length > 0;
	if (!hasProjectRates && !hasMemberRates) {
		return null;
	}
	const projectMap = new Map<ID, ProjectRateRow>(projects.map((project) => [project.id, project]));
	const memberRates = new Map<string, Rate>();
	for (const membership of pricedMemberships) {
		const key = memberRateKey(membership.organizationProjectId, membership.employeeId);
		memberRates.set(key, membership.billRateValue);
	}
	return { projects: projectMap, memberRates };
}

/** Whether a project the report prices at its own rate states no currency, which is then the organization's. */
export function needsOrganizationCurrency(lookup: ProjectRateLookup | null): boolean {
	if (!lookup) {
		return false;
	}
	const projects = Array.from(lookup.projects.values());
	return projects.some((project) => !project.currency);
}

function meetsProjectRate(log: ITimeLog, employeeId: ID | undefined, lookup: ProjectRateLookup): boolean {
	if (!log.projectId) {
		return false;
	}
	const project = lookup.projects.get(log.projectId);
	const hasProjectRate = isRateSet(project?.billRateValue);
	const hasMemberRate = lookup.memberRates.has(memberRateKey(log.projectId, employeeId));
	return hasProjectRate || hasMemberRate;
}

function owedOnProject(
	duration: number,
	projectId: ID,
	employee: IEmployee | null | undefined,
	organizationCurrency: string | null,
	lookup: ProjectRateLookup
): number {
	const project = lookup.projects.get(projectId);
	const rates = {
		memberRate: lookup.memberRates.get(memberRateKey(projectId, employee?.id)),
		projectRate: project?.billRateValue,
		employeeRate: employee?.billRateValue
	};
	const source = effectiveBillRateSource(rates);
	const currency = effectiveBillRateCurrency(source, {
		projectCurrency: project?.currency,
		employeeCurrency: employee?.billRateCurrency,
		organizationCurrency
	});
	return calculateBillableAmount(duration, effectiveBillRate(rates), currency) ?? 0;
}

/**
 * What an employee's logs of a day are owed when some of them are on a project with its own rate, or with a rate of
 * the employee's own on it: each project's time priced at the most specific rate (member, else project, else the
 * employee's), the amounts added exactly.
 *
 * @returns The amount, or `null` when no log meets a project or member rate: the caller then prices the day at the
 *   employee's rate, as before.
 */
export function owedAtProjectRates(
	logs: ITimeLog[],
	employee: IEmployee | null | undefined,
	organizationCurrency: string | null,
	lookup: ProjectRateLookup | null
): number | null {
	if (!lookup) {
		return null;
	}
	const meetsAnyRate = logs.some((log) => meetsProjectRate(log, employee?.id, lookup));
	if (!meetsAnyRate) {
		return null;
	}
	const byProject = chain(logs)
		.groupBy((log: ITimeLog) => log.projectId ?? '')
		.value() as Record<string, ITimeLog[]>;
	let total = 0;
	for (const [projectId, projectLogs] of Object.entries(byProject)) {
		const duration = calculateAverage(pluck(projectLogs, 'duration'));
		const amount = owedOnProject(duration, projectId, employee, organizationCurrency, lookup);
		total = Number(addDecimalStrings(total, amount));
	}
	return total;
}
