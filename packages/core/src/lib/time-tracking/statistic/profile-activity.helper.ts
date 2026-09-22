import { IGetProfileActivity, IProfileActivity } from '@gauzy/contracts';
import { moment } from '../../core/moment-extend';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_PATTERN = /(?:T|\s)\d{2}:\d{2}/i;
const TIME_ZONE_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;
const MAX_LOCAL_BOUNDARY_SEARCH_DAYS = 7;
const MAX_LOCAL_CALENDAR_SPAN_DAYS = 366;
const MAX_SAFE_DURATION_MILLISECONDS = BigInt(Number.MAX_SAFE_INTEGER);

export interface ProfileActivityPeriod {
	startDate: Date;
	endDate: Date;
	timeZone: string;
}

export interface ProfileActivityDayBucket {
	date: string;
	endDate: Date;
}

export type ProfileActivityRawRow =
	| { date: string; duration: unknown }
	| { startedAt: Date | string; stoppedAt: Date | string };

function resolveLocalDateBoundary(date: string, timeZone: string): Date {
	const requestedDate = moment.utc(date, 'YYYY-MM-DD', true);
	if (!requestedDate.isValid() || moment.tz.zone(timeZone) === null) {
		throw new RangeError('Profile activity period contains an invalid local date boundary');
	}

	for (let offset = 0; offset <= MAX_LOCAL_BOUNDARY_SEARCH_DAYS; offset++) {
		const candidateLabel = requestedDate.clone().add(offset, 'days').format('YYYY-MM-DD');
		const candidate = moment.tz(candidateLabel, 'YYYY-MM-DD', true, timeZone);

		if (candidate.isValid() && candidate.clone().tz(timeZone).format('YYYY-MM-DD') >= date) {
			return candidate.toDate();
		}
	}

	throw new RangeError('Profile activity local date boundary could not be resolved safely');
}

export function resolveProfileActivityPeriod(request: IGetProfileActivity): ProfileActivityPeriod {
	return {
		startDate: resolveLocalDateBoundary(request.startDate, request.timeZone),
		endDate: resolveLocalDateBoundary(request.endDate, request.timeZone),
		timeZone: request.timeZone
	};
}

/**
 * Builds ordered, half-open local-day boundaries for a bounded profile activity request.
 * A boundary-only representation keeps the generated aggregate below SQLite's parameter
 * limit while assigning every selected UTC instant to the same IANA local date as Node.
 */
export function buildProfileActivityDayBuckets(request: IGetProfileActivity): ProfileActivityDayBucket[] {
	const start = moment.utc(request.startDate, 'YYYY-MM-DD', true);
	const end = moment.utc(request.endDate, 'YYYY-MM-DD', true);
	const spanDays = end.diff(start, 'days');

	if (
		!start.isValid() ||
		!end.isValid() ||
		moment.tz.zone(request.timeZone) === null ||
		spanDays <= 0 ||
		spanDays > MAX_LOCAL_CALENDAR_SPAN_DAYS
	) {
		throw new RangeError('Profile activity day buckets require a valid range of at most 366 local days');
	}

	const buckets: ProfileActivityDayBucket[] = [];
	let cursor = start.clone();
	let intervalStart = resolveLocalDateBoundary(cursor.format('YYYY-MM-DD'), request.timeZone);

	while (cursor.isBefore(end)) {
		const date = cursor.format('YYYY-MM-DD');
		cursor = cursor.clone().add(1, 'day');
		const intervalEnd = resolveLocalDateBoundary(cursor.format('YYYY-MM-DD'), request.timeZone);

		if (intervalEnd.getTime() > intervalStart.getTime()) {
			buckets.push({ date, endDate: intervalEnd });
		}

		intervalStart = intervalEnd;
	}

	return buckets;
}

function isDateLabel(value: unknown): value is string {
	return typeof value === 'string' && DATE_ONLY_PATTERN.test(value) && moment(value, 'YYYY-MM-DD', true).isValid();
}

function normalizeAggregateMilliseconds(value: unknown): bigint | null {
	if (typeof value !== 'number' && typeof value !== 'string') {
		return null;
	}

	if (typeof value === 'string' && value.trim() === '') {
		return null;
	}

	const seconds = Number(value);
	if (!Number.isFinite(seconds) || seconds <= 0) {
		return null;
	}

	const milliseconds = Math.round(seconds * 1000);
	if (milliseconds <= 0) {
		return null;
	}

	if (!Number.isSafeInteger(milliseconds)) {
		throw new RangeError('Profile activity duration exceeds the safe integer range');
	}

	return BigInt(milliseconds);
}

function parseTimestampMilliseconds(value: unknown): number | null {
	if (value instanceof Date) {
		const milliseconds = value.getTime();
		return Number.isSafeInteger(milliseconds) ? milliseconds : null;
	}

	if (typeof value !== 'string' || value.trim() === '') {
		return null;
	}

	const timestamp = value.trim();
	const normalizedTimestamp =
		DATE_TIME_PATTERN.test(timestamp) && TIME_ZONE_SUFFIX_PATTERN.test(timestamp)
			? timestamp
			: `${timestamp.replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T')}Z`;
	const parsed = moment.parseZone(normalizedTimestamp, moment.ISO_8601, true);
	const milliseconds = parsed.valueOf();

	return parsed.isValid() && Number.isSafeInteger(milliseconds) ? milliseconds : null;
}

function addDuration(durations: Map<string, bigint>, date: string, milliseconds: bigint): void {
	durations.set(date, (durations.get(date) ?? 0n) + milliseconds);
}

function collectAggregateRow(durations: Map<string, bigint>, row: Record<string, unknown>): void {
	if (!isDateLabel(row.date)) {
		return;
	}

	const milliseconds = normalizeAggregateMilliseconds(row.duration);
	if (milliseconds === null) {
		return;
	}

	addDuration(durations, row.date, milliseconds);
}

function collectProjectionRow(durations: Map<string, bigint>, row: Record<string, unknown>, timeZone: string): void {
	const startedAt = parseTimestampMilliseconds(row.startedAt);
	const stoppedAt = parseTimestampMilliseconds(row.stoppedAt);

	if (startedAt === null || stoppedAt === null || stoppedAt <= startedAt) {
		return;
	}

	const milliseconds = BigInt(stoppedAt) - BigInt(startedAt);
	if (milliseconds <= 0n) {
		return;
	}

	const date = moment(startedAt).tz(timeZone).format('YYYY-MM-DD');
	addDuration(durations, date, milliseconds);
}

function toPublicDurationSeconds(milliseconds: bigint): number {
	if (milliseconds > MAX_SAFE_DURATION_MILLISECONDS) {
		throw new RangeError('Profile activity duration exceeds the safe integer range');
	}

	return Number(milliseconds) / 1000;
}

export function buildProfileActivityResponse(
	request: IGetProfileActivity,
	period: ProfileActivityPeriod,
	rows: ProfileActivityRawRow[]
): IProfileActivity {
	const durations = new Map<string, bigint>();

	for (const candidate of rows) {
		if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
			continue;
		}

		const row = candidate as unknown as Record<string, unknown>;
		if ('date' in row) {
			collectAggregateRow(durations, row);
		} else {
			collectProjectionRow(durations, row, period.timeZone);
		}
	}

	const dates = [...durations.keys()].sort((left, right) => left.localeCompare(right));
	const totalMilliseconds = dates.reduce((total, date) => total + (durations.get(date) ?? 0n), 0n);
	const response: IProfileActivity = {
		employeeId: request.employeeId,
		activeDays: dates.length,
		totalDuration: toPublicDurationSeconds(totalMilliseconds),
		firstActiveOn: dates[0] ?? null,
		lastActiveOn: dates.at(-1) ?? null,
		period: {
			startDate: request.startDate,
			endDate: request.endDate,
			timeZone: request.timeZone
		}
	};

	if (request.includeDaily === true) {
		response.daily = dates.map((date) => ({
			date,
			duration: toPublicDurationSeconds(durations.get(date) ?? 0n)
		}));
	}

	return response;
}
