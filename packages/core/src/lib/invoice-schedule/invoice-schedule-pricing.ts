import { DurationRoundingDirectionEnum, ID, InvoiceScheduleGroupingEnum } from '@gauzy/contracts';

/**
 * How a scheduled invoice turns a period's billable time into lines, priced as the manual invoice of Ever Teams prices
 * them (ever-co/ever-teams#5152), so a scheduled invoice and one made by hand for the same time state the same lines:
 *
 * - **The time.** Each stopped log counts its duration (else its start to its stop), rounded first by the
 *   organization's rounding rule, as Time & activity shows it; the rounded entries then add up. A timer still running
 *   is not billed: its time is not over.
 * - **The rate.** An hour of a member's time on a project is billed at their client rate on the project, else the
 *   project's, else their own billing rate, else the organization's default. Client rates are in the project's
 *   currency, a member's own rate in theirs, the default in its own; each falls back on the organization's. A log
 *   that keeps the rates it was worked at is billed at those, by the same chain; the default is never kept.
 * - **The lines.** By task (one line per project, member and task), by member (per project and member), or by project
 *   (per project and currency, each member's time priced at their own rate first, then stated at the average rate
 *   weighted by time, so the arithmetic on the document holds).
 * - **The numbers.** Hours to the hundredth; each line's amount is its hours times its rate, to the cent, half up.
 *   Time too short to make a hundredth of an hour states no quantity and makes no line.
 * - **One currency.** An invoice never adds two currencies: it is made in the currency that prices the most time, and
 *   the time priced in another, or not priced at all, is left out for a manual invoice.
 */

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const HUNDREDTHS = 100;

/** The rounding intervals the organization setting allows, in minutes. */
const ROUNDING_INTERVALS: ReadonlyArray<number> = [1, 5, 6, 10, 15, 30, 60];

/** A time log as the pricing reads it. */
export interface IScheduledTimeLog {
	id?: ID | null;
	projectId?: ID | null;
	employeeId?: ID | null;
	taskId?: ID | null;
	isBillable?: boolean | null;
	/** A timer still running: its time is not over, so it is not billed yet. */
	isRunning?: boolean | null;
	duration?: number | string | null;
	startedAt?: Date | string | null;
	stoppedAt?: Date | string | null;
}

/** The organization's rule for rounding each entry's duration. */
export interface IDurationRoundingRule {
	intervalMinutes: number;
	direction: DurationRoundingDirectionEnum;
}

/** Which rate priced the time. */
export type InvoiceRateSource = 'member' | 'project' | 'employee' | 'default';

/** What an hour of a member's time on a project is billed, and in which currency. */
export interface ILinePrice {
	rate: number | null;
	currency: string | null;
	source: InvoiceRateSource | null;
}

/** A member's time on a task of a project, and the logs it adds up. */
export interface IBillableEntry {
	projectId: ID;
	employeeId: ID;
	taskId: ID | null;
	seconds: number;
	timeLogIds: ID[];
	/** The price of each hour, when each log was priced on its own: the logs of one entry share it. */
	price?: ILinePrice;
}

/** The price of one log's time, when each log is priced at the rates it keeps. */
export type LogPriceOf = (log: IScheduledTimeLog) => ILinePrice;

/** A line of the invoice. */
export interface IScheduledInvoiceLine {
	key: string;
	projectId: ID;
	/** Null on a line that gathers every member of the project. */
	employeeId: ID | null;
	/** Null on a line that gathers a member's time on the project, whatever the task. */
	taskId: ID | null;
	seconds: number;
	/** The quantity the invoice states: decimal hours, to the hundredth. */
	hours: number;
	rate: number;
	currency: string | null;
	/** Hours times rate, to the cent. */
	amount: number;
	timeLogIds: ID[];
}

/** The lines an invoice can hold, and the time no rate prices. */
export interface IScheduledInvoiceTime {
	lines: IScheduledInvoiceLine[];
	/** Billable time without any rate, in seconds. */
	unpricedSeconds: number;
}

/** The rule of an organization, or null for no rounding: both fields are needed, and a value unknown rounds nothing. */
export function durationRoundingRuleOf(
	organization: { durationRoundingInterval?: unknown; durationRoundingDirection?: unknown } | null | undefined
): IDurationRoundingRule | null {
	const interval = Number(organization?.durationRoundingInterval);
	const direction = organization?.durationRoundingDirection;
	const isKnownInterval = ROUNDING_INTERVALS.includes(interval);
	const isKnownDirection = Object.values(DurationRoundingDirectionEnum).includes(
		direction as DurationRoundingDirectionEnum
	);
	if (!isKnownInterval || !isKnownDirection) {
		return null;
	}
	return { intervalMinutes: interval, direction: direction as DurationRoundingDirectionEnum };
}

/** One entry's duration in seconds, rounded by the rule; without a rule, the duration as tracked. */
export function roundedSecondsOf(seconds: number, rule: IDurationRoundingRule | null): number {
	const isEmpty = !Number.isFinite(seconds) || seconds <= 0;
	if (!rule || isEmpty) {
		return seconds;
	}
	const step = rule.intervalMinutes * SECONDS_PER_MINUTE;
	const steps = seconds / step;
	if (rule.direction === DurationRoundingDirectionEnum.UP) {
		return Math.ceil(steps) * step;
	}
	if (rule.direction === DurationRoundingDirectionEnum.DOWN) {
		return Math.floor(steps) * step;
	}
	return Math.round(steps) * step;
}

function timeOf(value: Date | string | null | undefined): number {
	if (!value) {
		return Number.NaN;
	}
	return new Date(value).getTime();
}

/** A log's seconds: its stated duration, else its start to its stop; never below zero. */
function secondsOfLog(log: IScheduledTimeLog): number {
	const duration = Number(log.duration);
	const hasDuration = log.duration !== null && log.duration !== undefined && Number.isFinite(duration);
	let seconds = Math.round((timeOf(log.stoppedAt) - timeOf(log.startedAt)) / MILLISECONDS_PER_SECOND);
	if (hasDuration) {
		seconds = duration;
	}
	if (!Number.isFinite(seconds)) {
		return 0;
	}
	return Math.max(seconds, 0);
}

function entryKeyOf(projectId: ID, employeeId: ID, taskId: ID | null): string {
	return [projectId, employeeId, taskId ?? ''].join('|');
}

function memberKeyOf(projectId: ID, employeeId: ID): string {
	return [projectId, employeeId].join('|');
}

/** The key time priced the same goes under: the same rate in the same currency. */
function priceKeyOf(price: ILinePrice): string {
	return [price.rate ?? 'none', price.currency ?? ''].join('|');
}

/** A key, followed by the entry's own price when each log was priced on its own, so two rates make two lines. */
function withPriceKey(key: string, entry: Pick<IBillableEntry, 'price'>): string {
	if (!entry.price) {
		return key;
	}
	return [key, priceKeyOf(entry.price)].join('|');
}

/**
 * The billable time of the given projects, per project, member and task, and per price when each log is priced on
 * its own. A log counts only when it is billable, has a project and a member, and makes time once rounded.
 *
 * @param logs The period's time logs.
 * @param projectIds The client's projects.
 * @param rule The organization's rounding rule, or null.
 * @param priceOfLog The price of each log's time, when each log is priced at the rates it keeps.
 */
export function billableEntriesOf(
	logs: ReadonlyArray<IScheduledTimeLog>,
	projectIds: ReadonlySet<ID>,
	rule: IDurationRoundingRule | null,
	priceOfLog?: LogPriceOf
): IBillableEntry[] {
	const byKey = new Map<string, IBillableEntry>();
	for (const log of logs) {
		const { projectId, employeeId } = log;
		const isOnClientProject = !!projectId && projectIds.has(projectId);
		const isOver = log.isRunning !== true && !!log.stoppedAt;
		if (log.isBillable !== true || !employeeId || !isOnClientProject || !isOver) {
			continue;
		}
		const seconds = roundedSecondsOf(secondsOfLog(log), rule);
		if (seconds <= 0) {
			continue;
		}
		const taskId = log.taskId ?? null;
		const priced: Pick<IBillableEntry, 'price'> = {};
		if (priceOfLog) {
			priced.price = priceOfLog(log);
		}
		const key = withPriceKey(entryKeyOf(projectId, employeeId, taskId), priced);
		const entry = byKey.get(key) ?? { projectId, employeeId, taskId, seconds: 0, timeLogIds: [], ...priced };
		entry.seconds += seconds;
		if (log.id) {
			entry.timeLogIds.push(log.id);
		}
		byKey.set(key, entry);
	}
	return [...byKey.values()];
}

/** A stored rate: a decimal column some databases answer as text. A missing, unreadable or negative value is none. */
export function rateValueOf(value: unknown): number | null {
	if (value === null || value === undefined || value === '') {
		return null;
	}
	const number = Number(value);
	if (!Number.isFinite(number) || number < 0) {
		return null;
	}
	return number;
}

/** A member's own billing rate: a cleared one is stored as 0, so 0 is no rate. Client rates keep their 0. */
function ownRateValueOf(value: unknown): number | null {
	const rate = rateValueOf(value);
	if (rate === 0) {
		return null;
	}
	return rate;
}

/** A currency, trimmed; null when it states none. */
function currencyOf(currency: string | null | undefined, fallback: string | null): string | null {
	const trimmed = currency?.trim();
	if (trimmed) {
		return trimmed;
	}
	return fallback?.trim() || null;
}

/** What prices a member's time on a project. */
export interface ILinePriceInput {
	/** The member's client rate on the project; undefined or null when none is set. */
	memberRate?: unknown;
	/** The project's client rate. */
	projectRate?: unknown;
	/** The currency of the project's client rates; null for the organization's. */
	projectCurrency?: string | null;
	/** The member's own billing rate and its currency. */
	employeeRate?: unknown;
	employeeCurrency?: string | null;
	organizationCurrency: string | null;
	/** The organization's default billing rate, which prices only time no other rate prices. */
	defaultRate?: { value: number; currency: string | null } | null;
}

/**
 * What an hour of a member's time on a project is billed: their client rate on the project, else the project's, else
 * their own billing rate, else the organization's default.
 */
export function linePriceOf(input: ILinePriceInput): ILinePrice {
	const memberRate = rateValueOf(input.memberRate);
	if (memberRate !== null) {
		return {
			rate: memberRate,
			source: 'member',
			currency: currencyOf(input.projectCurrency, input.organizationCurrency)
		};
	}
	const projectRate = rateValueOf(input.projectRate);
	if (projectRate !== null) {
		return {
			rate: projectRate,
			source: 'project',
			currency: currencyOf(input.projectCurrency, input.organizationCurrency)
		};
	}
	const employeeRate = ownRateValueOf(input.employeeRate);
	if (employeeRate !== null) {
		return {
			rate: employeeRate,
			source: 'employee',
			currency: currencyOf(input.employeeCurrency, input.organizationCurrency)
		};
	}
	if (input.defaultRate) {
		return {
			rate: input.defaultRate.value,
			source: 'default',
			currency: currencyOf(input.defaultRate.currency, input.organizationCurrency)
		};
	}
	return { rate: null, currency: null, source: null };
}

/** The rates a time log keeps, as the pricing reads them: each client rate in the currency it kept. */
export interface IKeptLogRates {
	projectMemberBillRateValue?: unknown;
	projectMemberBillRateCurrency?: string | null;
	projectBillRateValue?: unknown;
	projectBillRateCurrency?: string | null;
	billRateValue?: unknown;
	billRateCurrency?: string | null;
}

/**
 * What an hour of a log's time is billed at the rates it keeps, by the same chain as {@link linePriceOf}: the member's
 * client rate on the project it kept, else the project's, else the billing rate it kept, else the organization's
 * default, which no log keeps.
 */
export function keptLinePriceOf(
	kept: IKeptLogRates,
	organizationCurrency: string | null,
	defaultRate: ILinePriceInput['defaultRate'] = null
): ILinePrice {
	const keepsMemberRate = rateValueOf(kept.projectMemberBillRateValue) !== null;
	let clientCurrency = kept.projectBillRateCurrency ?? null;
	if (keepsMemberRate) {
		clientCurrency = kept.projectMemberBillRateCurrency ?? null;
	}
	return linePriceOf({
		memberRate: kept.projectMemberBillRateValue,
		projectRate: kept.projectBillRateValue,
		projectCurrency: clientCurrency,
		employeeRate: kept.billRateValue,
		employeeCurrency: kept.billRateCurrency ?? null,
		organizationCurrency,
		defaultRate
	});
}

/**
 * Hours to the hundredth, half up. The seconds are divided by the seconds of a hundredth of an hour (36) in one step:
 * a tie such as 3618 s (1.005 h) is then exactly a half, where hours times a hundred came out at 100.49999999999999
 * and lost the hundredth.
 */
export function decimalHoursOf(seconds: number): number {
	return Math.round(seconds / (SECONDS_PER_HOUR / HUNDREDTHS)) / HUNDREDTHS;
}

/** To the cent, half up: the binary error of the arithmetic behind the amount is cleared first (10.005 is 10.01). */
function halfUpAmountOf(amount: number): number {
	const cents = Number((amount * HUNDREDTHS).toPrecision(12));
	return Math.round(cents) / HUNDREDTHS;
}

/** Hours times rate to the cent, half up: 1.15 h at 12.50 is 14.38. */
export function lineAmountOf(hours: number, rate: number): number {
	return halfUpAmountOf(hours * rate);
}

/** The entries of a grouping: by task as they are, else gathered per project and member. */
function groupedEntriesOf(
	entries: ReadonlyArray<IBillableEntry>,
	grouping: InvoiceScheduleGroupingEnum
): IBillableEntry[] {
	if (grouping === InvoiceScheduleGroupingEnum.TASK) {
		return entries.map((entry) => ({ ...entry, timeLogIds: [...entry.timeLogIds] }));
	}
	const byMember = new Map<string, IBillableEntry>();
	for (const entry of entries) {
		const key = withPriceKey(memberKeyOf(entry.projectId, entry.employeeId), entry);
		const current = byMember.get(key) ?? { ...entry, taskId: null, seconds: 0, timeLogIds: [] };
		current.seconds += entry.seconds;
		current.timeLogIds.push(...entry.timeLogIds);
		byMember.set(key, current);
	}
	return [...byMember.values()];
}

type PriceOf = (projectId: ID, employeeId: ID) => ILinePrice;

/** An entry's price: its own when each log was priced on its own, else the member's on the project. */
function entryPriceOf(entry: IBillableEntry, priceOf: PriceOf): ILinePrice {
	if (entry.price) {
		return entry.price;
	}
	return priceOf(entry.projectId, entry.employeeId);
}

/** One project's time in one currency, each member's priced at their own rate. */
interface IProjectWorth {
	key: string;
	projectId: ID;
	currency: string | null;
	seconds: number;
	worth: number;
	timeLogIds: ID[];
}

/** By project: each member's time priced at their own rate, then one line per project and currency at the average. */
function projectLinesOf(entries: ReadonlyArray<IBillableEntry>, priceOf: PriceOf): IScheduledInvoiceTime {
	const byProject = new Map<string, IProjectWorth>();
	let unpricedSeconds = 0;
	for (const entry of groupedEntriesOf(entries, InvoiceScheduleGroupingEnum.MEMBER)) {
		const { rate, currency } = entryPriceOf(entry, priceOf);
		if (rate === null) {
			unpricedSeconds += entry.seconds;
			continue;
		}
		const key = [entry.projectId, currency ?? ''].join('|');
		const project = byProject.get(key) ?? {
			key,
			projectId: entry.projectId,
			currency,
			seconds: 0,
			worth: 0,
			timeLogIds: []
		};
		project.seconds += entry.seconds;
		project.worth += (entry.seconds / SECONDS_PER_HOUR) * rate;
		project.timeLogIds.push(...entry.timeLogIds);
		byProject.set(key, project);
	}
	const lines: IScheduledInvoiceLine[] = [];
	for (const project of byProject.values()) {
		const hours = decimalHoursOf(project.seconds);
		if (hours <= 0) {
			continue;
		}
		const rate = halfUpAmountOf(project.worth / (project.seconds / SECONDS_PER_HOUR));
		lines.push({
			key: project.key,
			projectId: project.projectId,
			employeeId: null,
			taskId: null,
			seconds: project.seconds,
			hours,
			rate,
			currency: project.currency,
			amount: lineAmountOf(hours, rate),
			timeLogIds: project.timeLogIds
		});
	}
	return { lines, unpricedSeconds };
}

/**
 * The lines an invoice can hold under a grouping, and the time no rate prices.
 *
 * @param entries The period's billable entries.
 * @param grouping By project, member or task.
 * @param priceOf The price of a member's time on a project.
 */
export function invoiceTimeOf(
	entries: ReadonlyArray<IBillableEntry>,
	grouping: InvoiceScheduleGroupingEnum,
	priceOf: PriceOf
): IScheduledInvoiceTime {
	if (grouping === InvoiceScheduleGroupingEnum.PROJECT) {
		return projectLinesOf(entries, priceOf);
	}
	const lines: IScheduledInvoiceLine[] = [];
	let unpricedSeconds = 0;
	for (const entry of groupedEntriesOf(entries, grouping)) {
		const { rate, currency } = entryPriceOf(entry, priceOf);
		if (rate === null) {
			unpricedSeconds += entry.seconds;
			continue;
		}
		const hours = decimalHoursOf(entry.seconds);
		if (hours <= 0) {
			continue;
		}
		let groupKey = memberKeyOf(entry.projectId, entry.employeeId);
		if (grouping === InvoiceScheduleGroupingEnum.TASK) {
			groupKey = entryKeyOf(entry.projectId, entry.employeeId, entry.taskId);
		}
		const key = withPriceKey(groupKey, entry);
		lines.push({
			key,
			projectId: entry.projectId,
			employeeId: entry.employeeId,
			taskId: entry.taskId,
			seconds: entry.seconds,
			hours,
			rate,
			currency,
			amount: lineAmountOf(hours, rate),
			timeLogIds: entry.timeLogIds
		});
	}
	return { lines, unpricedSeconds };
}

/** The lines of one currency, and the time the others price. */
export interface IOneCurrencyInvoice {
	currency: string | null;
	lines: IScheduledInvoiceLine[];
	/** The seconds of the lines priced in another currency. */
	otherCurrencySeconds: number;
}

/**
 * The invoice's currency: the one that prices the most time (a tie goes to the first in alphabetical order), and its
 * lines; the lines of the other currencies are left out.
 */
export function oneCurrencyInvoiceOf(lines: ReadonlyArray<IScheduledInvoiceLine>): IOneCurrencyInvoice {
	const secondsByCurrency = new Map<string, number>();
	for (const line of lines) {
		const key = line.currency ?? '';
		secondsByCurrency.set(key, (secondsByCurrency.get(key) ?? 0) + line.seconds);
	}
	const ranked = [...secondsByCurrency.entries()].sort(
		([firstKey, firstSeconds], [secondKey, secondSeconds]) =>
			secondSeconds - firstSeconds || firstKey.localeCompare(secondKey)
	);
	if (ranked.length === 0) {
		return { currency: null, lines: [], otherCurrencySeconds: 0 };
	}
	const [chosenKey] = ranked[0];
	const kept = lines.filter((line) => (line.currency ?? '') === chosenKey);
	const otherCurrencySeconds = lines
		.filter((line) => (line.currency ?? '') !== chosenKey)
		.reduce((total, line) => total + line.seconds, 0);
	return { currency: chosenKey || null, lines: kept, otherCurrencySeconds };
}

/** The total of the lines, to the cent. */
export function totalOfLines(lines: ReadonlyArray<IScheduledInvoiceLine>): number {
	const cents = lines.reduce((total, line) => total + Math.round(line.amount * HUNDREDTHS), 0);
	return cents / HUNDREDTHS;
}
