import {
	CurrencyCode,
	ID,
	IEmployee,
	IOrganizationProject,
	IPublicSavedReportAmount,
	IPublicSavedReportDay,
	IPublicSavedReportMember,
	IPublicSavedReportMemberLog,
	IPublicSavedReportNamed,
	IPublicSavedReportTask,
	IReportDayGroupByDate,
	IReportDayTaskRow,
	SAVED_REPORT_NO_CLIENT
} from '@gauzy/contracts';
import { currencyPrecision } from '../money/currency-precision';
import { calculateBillableAmount } from '../time-tracking/time-log/time-log.utils';

/** A member's billing rate, read when the link is opened, with the currency it is in. */
export interface ISavedReportRate {
	billRateValue: number | null;
	billRateCurrency: string | null;
}

/** The client of each project of the report, as the project states it now; null for a project without a client. */
export type ProjectClients = ReadonlyMap<ID, ID | null>;

/** A day of the daily report grouped by date, with the total time the handler states beside its logs. */
export type SavedReportDay = IReportDayGroupByDate & { sum?: number };

type ProjectLog = IReportDayGroupByDate['logs'][number];
type MemberLog = ProjectLog['employeeLogs'][number];

/** A count of seconds, 0 for anything that is not a finite number. */
function secondsOf(value: unknown): number {
	const seconds = Number(value);
	if (Number.isFinite(seconds)) {
		return seconds;
	}
	return 0;
}

/** A sum of amounts at the decimals of their currency, without the noise binary addition leaves. */
function roundedAmount(value: number, currency: string): number {
	return Number(value.toFixed(currencyPrecision.decimalsFor(currency)));
}

/** The client a day's project log counts for: the one its project names, none for time without a project. */
function clientOfProjectLog(projectLog: ProjectLog, projectClients: ProjectClients): ID | null {
	const projectId = projectLog.project?.id;
	if (!projectId) {
		return null;
	}
	return projectClients.get(projectId) ?? null;
}

/** Whether a client is among the picked ones; {@link SAVED_REPORT_NO_CLIENT} picks the time without a client. */
function isPickedClient(clientId: ID | null, picked: ReadonlyArray<string>): boolean {
	if (!clientId) {
		return picked.includes(SAVED_REPORT_NO_CLIENT);
	}
	return picked.includes(clientId);
}

/** The time of one day, from the members' sums of its project logs. */
function daySecondsOf(logs: ReadonlyArray<ProjectLog>): number {
	let seconds = 0;
	for (const projectLog of logs) {
		for (const memberLog of projectLog.employeeLogs ?? []) {
			seconds += secondsOf(memberLog.sum);
		}
	}
	return seconds;
}

/**
 * The days of the daily report with only the time of the picked clients, as the report page filters them: the client
 * of time is the one its project names, and time without a project or with a project without a client is the time
 * without a client. A day left with no time is left out; a kept day's total counts what it kept.
 *
 * @param days The daily report, grouped by date.
 * @param picked The picked clients; none keeps every day as it is.
 * @param projectClients The client of each project of the report.
 */
export function keepPickedClients(
	days: ReadonlyArray<SavedReportDay>,
	picked: ReadonlyArray<string>,
	projectClients: ProjectClients
): SavedReportDay[] {
	if (picked.length === 0) {
		return [...days];
	}
	const kept: SavedReportDay[] = [];
	for (const day of days) {
		const logs = (day.logs ?? []).filter((projectLog) =>
			isPickedClient(clientOfProjectLog(projectLog, projectClients), picked)
		);
		if (logs.length > 0) {
			kept.push({ ...day, logs, sum: daySecondsOf(logs) });
		}
	}
	return kept;
}

/** A name of the report: its id and name, nothing else. */
function namedOf(value: { id?: ID; name?: string | null } | null | undefined): IPublicSavedReportNamed | null {
	if (!value?.id) {
		return null;
	}
	return { id: value.id, name: value.name ?? '' };
}

/** A project as the public answer names it. */
function projectOf(project: IOrganizationProject | null | undefined): IPublicSavedReportDay['logs'][number]['project'] {
	if (!project?.id) {
		return null;
	}
	return {
		id: project.id,
		name: project.name ?? '',
		color: project.color ?? null,
		organizationContact: namedOf(project.organizationContact)
	};
}

/** A member as the public answer names them: no e-mail, no picture, the rate only when amounts are shared. */
function memberOf(employee: IEmployee | null | undefined, rate: ISavedReportRate | null): IPublicSavedReportMember {
	const user = employee?.user;
	const member: IPublicSavedReportMember = {
		id: employee?.id,
		fullName: employee?.fullName ?? user?.name ?? '',
		user: {
			firstName: user?.firstName ?? null,
			lastName: user?.lastName ?? null,
			name: user?.name ?? null
		}
	};
	if (rate) {
		member.billRateValue = rate.billRateValue;
		member.billRateCurrency = rate.billRateCurrency;
	}
	return member;
}

/** A task as the public answer names it: its title and its number. */
function taskNameOf(task: IReportDayTaskRow['task']): IPublicSavedReportTask['task'] {
	if (!task?.id) {
		return null;
	}
	return { id: task.id, title: task.title ?? '', number: task.number ?? null, prefix: task.prefix ?? null };
}

/** One entry as the public answer states it: its task's name, its client's name and its time. Never its notes. */
function taskOf(row: IReportDayTaskRow): IPublicSavedReportTask {
	const entry: IPublicSavedReportTask = {
		task: taskNameOf(row.task),
		duration: secondsOf(row.duration),
		client: namedOf(row.client)
	};
	if ('organizationTeamId' in row) {
		entry.organizationTeamId = row.organizationTeamId ?? null;
	}
	return entry;
}

/** What a member's time is worth at their rate, rounded once to its currency, as an invoice line is; null without a rate. */
function amountOf(seconds: number, rate: ISavedReportRate | null): number | null {
	const currency = rate?.billRateCurrency as CurrencyCode | null;
	return calculateBillableAmount(seconds, rate?.billRateValue, currency);
}

/** The rate a member is named with: theirs (or none stated) when amounts are shared, nothing otherwise. */
function sharedRateOf(
	rates: ReadonlyMap<ID, ISavedReportRate> | null,
	employeeId: ID | undefined
): ISavedReportRate | null {
	if (!rates) {
		return null;
	}
	const rate = rates.get(employeeId);
	if (rate) {
		return rate;
	}
	return { billRateValue: null, billRateCurrency: null };
}

/** One member's time on a project on a day. */
function memberLogOf(
	memberLog: MemberLog,
	rates: ReadonlyMap<ID, ISavedReportRate> | null
): IPublicSavedReportMemberLog {
	const rate = sharedRateOf(rates, memberLog.employee?.id);
	const sum = secondsOf(memberLog.sum);
	const publicLog: IPublicSavedReportMemberLog = {
		employee: memberOf(memberLog.employee, rate),
		sum,
		tasks: (memberLog.tasks ?? []).map(taskOf)
	};
	if (rate) {
		publicLog.amount = amountOf(sum, rate);
	}
	return publicLog;
}

/**
 * The daily report as a link shows it: dates, durations and the names of members, projects, clients and tasks. Rates
 * and amounts appear only when `rates` is given, that is when the author included amounts. Activity, notes, e-mails and
 * pictures never do.
 *
 * @param days The daily report, grouped by date.
 * @param rates Each member's rate, when the author included amounts; null otherwise.
 */
export function publicDaysOf(
	days: ReadonlyArray<IReportDayGroupByDate>,
	rates: ReadonlyMap<ID, ISavedReportRate> | null
): IPublicSavedReportDay[] {
	return days.map((day) => ({
		date: day.date,
		sum: daySecondsOf(day.logs ?? []),
		logs: (day.logs ?? []).map((projectLog) => ({
			project: projectOf(projectLog.project),
			employeeLogs: (projectLog.employeeLogs ?? []).map((memberLog) => memberLogOf(memberLog, rates))
		}))
	}));
}

/**
 * The report's total time and, when amounts are shared, what it is worth per currency: amounts in different currencies
 * are never added. A member without a rate adds time and no amount.
 *
 * @param days The days of the public answer.
 * @param includeAmounts Whether the author included amounts.
 */
export function publicTotalsOf(
	days: ReadonlyArray<IPublicSavedReportDay>,
	includeAmounts: boolean
): { duration: number; amounts?: IPublicSavedReportAmount[] } {
	let duration = 0;
	const byCurrency = new Map<string, number>();
	for (const day of days) {
		for (const projectLog of day.logs) {
			for (const memberLog of projectLog.employeeLogs) {
				duration += memberLog.sum;
				const amount = memberLog.amount;
				const currency = memberLog.employee.billRateCurrency;
				const hasAmount = typeof amount === 'number' && !!currency;
				if (hasAmount) {
					byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + amount);
				}
			}
		}
	}
	if (!includeAmounts) {
		return { duration };
	}
	const amounts = [...byCurrency.entries()].map(([currency, amount]) => ({
		currency,
		amount: roundedAmount(amount, currency)
	}));
	return { duration, amounts };
}

/**
 * The members whose rates a shared answer reads: every member the report names.
 *
 * @param days The daily report, grouped by date.
 */
export function memberIdsOf(days: ReadonlyArray<IReportDayGroupByDate>): ID[] {
	const ids = new Set<ID>();
	for (const day of days) {
		for (const projectLog of day.logs ?? []) {
			for (const memberLog of projectLog.employeeLogs ?? []) {
				const id = memberLog.employee?.id;
				if (id) {
					ids.add(id);
				}
			}
		}
	}
	return [...ids];
}

/**
 * The projects whose clients the clients filter reads: every project the report names.
 *
 * @param days The daily report, grouped by date.
 */
export function projectIdsOf(days: ReadonlyArray<IReportDayGroupByDate>): ID[] {
	const ids = new Set<ID>();
	for (const day of days) {
		for (const projectLog of day.logs ?? []) {
			const id = projectLog.project?.id;
			if (id) {
				ids.add(id);
			}
		}
	}
	return [...ids];
}
