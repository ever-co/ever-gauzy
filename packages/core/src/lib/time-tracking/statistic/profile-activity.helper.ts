import { IGetProfileActivity, IProfileActivity } from '@gauzy/contracts';
import { moment } from '../../core/moment-extend';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_WITH_OFFSET_PATTERN = /(?:T|\s)\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

export interface ProfileActivityPeriod {
	startDate: Date;
	endDate: Date;
	timeZone: string;
}

export type ProfileActivityRawRow =
	| { date: string; duration: unknown }
	| { startedAt: Date | string; stoppedAt: Date | string };

export function resolveProfileActivityPeriod(request: IGetProfileActivity): ProfileActivityPeriod {
	return {
		startDate: moment.tz(request.startDate, 'YYYY-MM-DD', true, request.timeZone).toDate(),
		endDate: moment.tz(request.endDate, 'YYYY-MM-DD', true, request.timeZone).toDate(),
		timeZone: request.timeZone
	};
}

function isDateLabel(value: unknown): value is string {
	return typeof value === 'string' && DATE_ONLY_PATTERN.test(value) && moment(value, 'YYYY-MM-DD', true).isValid();
}

function normalizeAggregateMilliseconds(value: unknown): number | null {
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
	return Number.isSafeInteger(milliseconds) && milliseconds > 0 ? milliseconds : null;
}

function parseTimestampMilliseconds(value: unknown): number | null {
	if (value instanceof Date) {
		const milliseconds = value.getTime();
		return Number.isFinite(milliseconds) ? milliseconds : null;
	}

	if (typeof value !== 'string' || value.trim() === '') {
		return null;
	}

	const timestamp = value.trim();
	const normalizedTimestamp = DATE_TIME_WITH_OFFSET_PATTERN.test(timestamp)
		? timestamp
		: `${timestamp.replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T')}Z`;
	const parsed = moment.parseZone(normalizedTimestamp, moment.ISO_8601, true);

	return parsed.isValid() ? parsed.valueOf() : null;
}

function addDuration(durations: Map<string, number>, date: string, milliseconds: number): void {
	const nextDuration = (durations.get(date) ?? 0) + milliseconds;

	if (Number.isSafeInteger(nextDuration)) {
		durations.set(date, nextDuration);
	}
}

function collectAggregateRow(durations: Map<string, number>, row: Record<string, unknown>): void {
	if (!isDateLabel(row.date)) {
		return;
	}

	const milliseconds = normalizeAggregateMilliseconds(row.duration);
	if (milliseconds === null) {
		return;
	}

	addDuration(durations, row.date, milliseconds);
}

function collectProjectionRow(durations: Map<string, number>, row: Record<string, unknown>, timeZone: string): void {
	const startedAt = parseTimestampMilliseconds(row.startedAt);
	const stoppedAt = parseTimestampMilliseconds(row.stoppedAt);

	if (startedAt === null || stoppedAt === null || stoppedAt <= startedAt) {
		return;
	}

	const milliseconds = stoppedAt - startedAt;
	if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) {
		return;
	}

	const date = moment(startedAt).tz(timeZone).format('YYYY-MM-DD');
	addDuration(durations, date, milliseconds);
}

export function buildProfileActivityResponse(
	request: IGetProfileActivity,
	period: ProfileActivityPeriod,
	rows: ProfileActivityRawRow[]
): IProfileActivity {
	const durations = new Map<string, number>();

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

	const dates = [...durations.keys()].sort();
	const totalMilliseconds = dates.reduce((total, date) => total + (durations.get(date) ?? 0), 0);
	const response: IProfileActivity = {
		employeeId: request.employeeId,
		activeDays: dates.length,
		totalDuration: totalMilliseconds / 1000,
		firstActiveOn: dates[0] ?? null,
		lastActiveOn: dates.at(-1) ?? null,
		period: {
			startDate: request.startDate,
			endDate: request.endDate,
			timeZone: request.timeZone
		}
	};

	if (request.includeDaily === true) {
		response.daily = dates.map((date) => ({ date, duration: (durations.get(date) ?? 0) / 1000 }));
	}

	return response;
}
