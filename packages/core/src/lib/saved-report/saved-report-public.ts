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
	ITimeLogTag,
	SAVED_REPORT_NO_CLIENT
} from '@gauzy/contracts';
import { currencyPrecision } from '../money/currency-precision';
import { DefaultBillRate } from '../time-tracking/time-log/default-bill-rate';
import { amountsOf, billedRateOf, PricedRate, totalsByCurrencyOf } from '../time-tracking/time-log/time-log-pricing';
import { calculateBillableAmount } from '../time-tracking/time-log/time-log.utils';

/** A member's billing rate, read when the link is opened, with the currency it is in. */
export interface ISavedReportRate {
	billRateValue: number | null;
	billRateCurrency: string | null;
}

/**
 * What an entry's rate is completed with, as the report page and the budgets complete it: the organization's currency
 * for a rate stated without one, and its default billing rate for an entry without a rate.
 */
export interface SavedReportEntryPricing {
	organizationCurrency: string | null;
	defaultRate: DefaultBillRate | null;
}

const NO_ENTRY_PRICING: SavedReportEntryPricing = { organizationCurrency: null, defaultRate: null };

/** The client of each project of the report, as the project states it now; null for a project without a client. */
export type ProjectClients = ReadonlyMap<ID, ID | null>;

/**
 * The labels the entries of a report grouped by label may state, by their id in lowercase (see `savedReportLabelKeyOf`):
 * null when the report does not group by label, so its entries state none.
 */
export type ShownLabels = ReadonlySet<string> | null;

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

/**
 * A label's id as {@link ShownLabels} holds it: in lowercase, as PostgreSQL answers a uuid whatever case it was written
 * in.
 *
 * @param id The label's id.
 */
export function savedReportLabelKeyOf(id: ID): string {
	return String(id).toLowerCase();
}

/** A label of a row that has an id. */
function hasLabelId(tag: ITimeLogTag | null | undefined): tag is ITimeLogTag {
	return !!tag?.id;
}

/** An entry's labels as the public answer states them: what a chip shows, of the labels the report may show only. */
function labelsOfRow(row: IReportDayTaskRow, shownLabels: ReadonlySet<string>): ITimeLogTag[] {
	const tags = Array.isArray(row.tags) ? row.tags : [];
	return tags
		.filter(hasLabelId)
		.filter((tag) => shownLabels.has(savedReportLabelKeyOf(tag.id)))
		.map(({ id, name, color }) => ({ id, name, color }));
}

/**
 * One entry as the public answer states it: its task's name, its client's name and its time, and its labels when the
 * report groups by label. Never its notes.
 */
function taskOf(row: IReportDayTaskRow, shownLabels: ShownLabels): IPublicSavedReportTask {
	const entry: IPublicSavedReportTask = {
		task: taskNameOf(row.task),
		duration: secondsOf(row.duration),
		client: namedOf(row.client)
	};
	if ('organizationTeamId' in row) {
		entry.organizationTeamId = row.organizationTeamId ?? null;
	}
	if (shownLabels) {
		entry.tags = labelsOfRow(row, shownLabels);
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

/** Whether a row of the daily report states the rate that prices its entry (every row of this API does). */
function statesEntryRate(row: IReportDayTaskRow): boolean {
	return 'billRateValue' in row;
}

/** A rate as the answer states it: a number, or null for none. */
function stateRate(rate: PricedRate['rate']): number | null {
	const isMissing = rate === null || rate === undefined || rate === '';
	if (isMissing) {
		return null;
	}
	return Number(rate);
}

/**
 * The rate that prices an entry, as the report page prices its row: the rate the row states (the one its log stores,
 * else the member's current rate, see `rateOfReportRow`), completed as `billedRateOf` completes it for the budgets.
 * A row that states none is priced at the member's rate, as all time was before rates were stored.
 */
function entryRateOf(
	row: IReportDayTaskRow,
	memberRate: ISavedReportRate,
	pricing: SavedReportEntryPricing
): PricedRate {
	if (!statesEntryRate(row)) {
		return { rate: memberRate.billRateValue, currency: memberRate.billRateCurrency };
	}
	const statedLog = { ratesStored: true, billRateValue: row.billRateValue, billRateCurrency: row.billRateCurrency };
	return billedRateOf(statedLog, pricing.organizationCurrency, pricing.defaultRate);
}

/** Amounts with a currency, as the answer states them. */
function statedAmountsOf(
	amounts: ReadonlyArray<{ currency: string | null; amount: number }>
): IPublicSavedReportAmount[] {
	return amounts
		.filter((line): line is IPublicSavedReportAmount => !!line.currency)
		.map(({ currency, amount }) => ({ currency, amount }));
}

/**
 * What a member's time is worth when amounts are shared: each entry at the rate that prices it, summed per rate and
 * currency and priced once per sum (`amountsOf`), as the API's other reports price time. Rows that state no rate are
 * priced at the member's rate, rounded once to its currency, as an invoice line is.
 */
function pricedMemberLogOf(
	publicLog: IPublicSavedReportMemberLog,
	rows: ReadonlyArray<IReportDayTaskRow>,
	memberRate: ISavedReportRate,
	pricing: SavedReportEntryPricing
): IPublicSavedReportMemberLog {
	if (!rows.some(statesEntryRate)) {
		const amount = amountOf(publicLog.sum, memberRate);
		const amounts = statedAmountsOf(amount === null ? [] : [{ currency: memberRate.billRateCurrency, amount }]);
		return { ...publicLog, amounts, amount };
	}
	const entries = rows.map((row) => ({
		duration: secondsOf(row.duration),
		...entryRateOf(row, memberRate, pricing)
	}));
	const tasks = publicLog.tasks.map((task, index) => ({
		...task,
		billRateValue: stateRate(entries[index].rate),
		billRateCurrency: entries[index].currency
	}));
	const amounts = statedAmountsOf(amountsOf(entries, (entry) => entry));
	const amount = amounts.length === 1 ? amounts[0].amount : null;
	return { ...publicLog, tasks, amounts, amount };
}

/** One member's time on a project on a day. */
function memberLogOf(
	memberLog: MemberLog,
	rates: ReadonlyMap<ID, ISavedReportRate> | null,
	pricing: SavedReportEntryPricing,
	shownLabels: ShownLabels
): IPublicSavedReportMemberLog {
	const rate = sharedRateOf(rates, memberLog.employee?.id);
	const rows = memberLog.tasks ?? [];
	const publicLog: IPublicSavedReportMemberLog = {
		employee: memberOf(memberLog.employee, rate),
		sum: secondsOf(memberLog.sum),
		tasks: rows.map((row) => taskOf(row, shownLabels))
	};
	if (!rate) {
		return publicLog;
	}
	return pricedMemberLogOf(publicLog, rows, rate, pricing);
}

/**
 * The daily report as a link shows it: dates, durations and the names of members, projects, clients and tasks. Rates
 * and amounts appear only when `rates` is given, that is when the author included amounts; the labels of entries only
 * when `shownLabels` is given, that is when the report groups by label. Activity, notes, e-mails and pictures never do.
 *
 * Each entry is then priced at the rate that prices its row on the report page (see `entryRateOf`), so a member whose
 * rate changed since shows the amount the report page shows.
 *
 * @param days The daily report, grouped by date.
 * @param rates Each member's rate, when the author included amounts; null otherwise.
 * @param pricing The organization's currency and default billing rate, which complete an entry's rate.
 * @param shownLabels The labels the entries may state, when the report groups by label; null otherwise.
 */
export function publicDaysOf(
	days: ReadonlyArray<IReportDayGroupByDate>,
	rates: ReadonlyMap<ID, ISavedReportRate> | null,
	pricing: SavedReportEntryPricing = NO_ENTRY_PRICING,
	shownLabels: ShownLabels = null
): IPublicSavedReportDay[] {
	return days.map((day) => ({
		date: day.date,
		sum: daySecondsOf(day.logs ?? []),
		logs: (day.logs ?? []).map((projectLog) => ({
			project: projectOf(projectLog.project),
			employeeLogs: (projectLog.employeeLogs ?? []).map((memberLog) =>
				memberLogOf(memberLog, rates, pricing, shownLabels)
			)
		}))
	}));
}

/**
 * The report's total time and, when amounts are shared, what it is worth per currency: the amounts of its members,
 * added exactly within a currency, and amounts in different currencies never added. Time without a rate adds time
 * and no amount.
 *
 * @param days The days of the public answer.
 * @param includeAmounts Whether the author included amounts.
 */
export function publicTotalsOf(
	days: ReadonlyArray<IPublicSavedReportDay>,
	includeAmounts: boolean
): { duration: number; amounts?: IPublicSavedReportAmount[] } {
	let duration = 0;
	const lines: IPublicSavedReportAmount[] = [];
	for (const day of days) {
		for (const projectLog of day.logs) {
			for (const memberLog of projectLog.employeeLogs) {
				duration += memberLog.sum;
				lines.push(...(memberLog.amounts ?? []));
			}
		}
	}
	if (!includeAmounts) {
		return { duration };
	}
	const amounts = statedAmountsOf(totalsByCurrencyOf(lines)).map(({ currency, amount }) => ({
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

/** Every entry of the daily report, whatever its day, project and member. */
function entryRowsOf(days: ReadonlyArray<IReportDayGroupByDate>): IReportDayTaskRow[] {
	return days.flatMap((day) =>
		(day.logs ?? []).flatMap((projectLog) =>
			(projectLog.employeeLogs ?? []).flatMap((memberLog) => memberLog.tasks ?? [])
		)
	);
}

/**
 * The labels the entries of the report carry, each once: the labels a report grouped by label checks before it shows
 * them. Two spellings of one id (its case) are one label, keyed by `savedReportLabelKeyOf` as {@link ShownLabels} is;
 * the spelling met last is the one asked for. Every id here is one the database answered (`loadTimeLogTags`).
 *
 * @param days The daily report, grouped by date.
 */
export function labelIdsOf(days: ReadonlyArray<IReportDayGroupByDate>): ID[] {
	const ids = new Map<string, ID>();
	for (const row of entryRowsOf(days)) {
		const tags = Array.isArray(row.tags) ? row.tags : [];
		for (const tag of tags.filter(hasLabelId)) {
			ids.set(savedReportLabelKeyOf(tag.id), tag.id);
		}
	}
	return [...ids.values()];
}
