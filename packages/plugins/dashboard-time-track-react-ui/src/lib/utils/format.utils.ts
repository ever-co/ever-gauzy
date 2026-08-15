import moment from 'moment-timezone';
import { TimeFormatEnum } from '@gauzy/contracts';
import { toTimezone } from '@gauzy/ui-core/common';

/**
 * `durationFormat` pipe: seconds → `HH:mm:ss` with truncation (not rounding) and negatives
 * clamped to zero.
 *
 * @param seconds Duration in seconds.
 */
export function durationFormat(seconds: number | null | undefined): string {
	let duration = !seconds || seconds < 0 ? 0 : seconds;
	const hours = parseInt(`${duration / 3600}`, 10);
	duration = duration % 3600;
	const min = parseInt(`${duration / 60}`, 10);
	duration = duration % 60;
	const sec = parseInt(`${duration}`, 10);
	const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
	return `${pad(hours)}:${pad(min)}:${pad(sec)}`;
}

/** Locale/format inputs the `dateFormat` pipe reads from the store. */
export interface DateFormatOptions {
	/** Organization `dateFormat`; the pipe's default is `'d MMMM, y'`. */
	dateFormat?: string | null;
	/** Preferred language, falling back to the organization `regionCode`, then `en`. */
	locale?: string | null;
}

/**
 * `dateFormat` pipe: parses like the pipe (`moment(new Date(value))`, then `moment.utc(value)`)
 * and formats with the organization's date format in the preferred locale.
 *
 * @param value Date-ish value.
 * @param options Format/locale.
 */
export function dateFormat(value: Date | string | number | null | undefined, options: DateFormatOptions = {}): string {
	if (!value) return '';
	let date = moment(new Date(value));
	if (!date.isValid()) date = moment.utc(value);
	if (!date.isValid()) return '';
	const locale = options.locale || 'en';
	const format = options.dateFormat || 'd MMMM, y';
	return date.locale(locale).format(format);
}

/**
 * `utcToTimezone` pipe: renders a UTC instant in the given zone as `YYYY-MM-DD HH:mm:ss`
 * (the string the `timeFormat` / `dateFormat` pipes then re-parse).
 *
 * @param value UTC date-ish value.
 * @param timezone IANA zone.
 * @param format Output format.
 */
export function utcToTimezone(value: Date | string, timezone: string, format = 'YYYY-MM-DD HH:mm:ss'): string {
	let date = moment(value);
	if (!date.isValid()) date = moment.utc(value, format);
	return timezone ? toTimezone(date, timezone).format(format) : date.format(format);
}

/**
 * `utcToLocal` pipe: a UTC instant as a local `Date`.
 *
 * @param value UTC date-ish value.
 */
export function utcToLocal(value: Date | string): Date {
	let date = moment(value);
	if (!date.isValid()) date = moment.utc(value, 'HH:mm');
	return moment.utc(date).local().toDate();
}

/**
 * `timeFormat` pipe: `hh:mm:ss A` for the 12-hour format, `HH:mm:ss` for 24-hour.
 *
 * @param value Date-ish value (typically the `utcToTimezone` string).
 * @param timeFormat 12 or 24.
 * @param seconds Include seconds (default true, like the pipe).
 */
export function timeFormat(value: Date | string, timeFormat: TimeFormatEnum, seconds = true): string {
	let format = 'HH:mm' + (seconds ? ':ss' : '');
	if (timeFormat === TimeFormatEnum.FORMAT_12_HOURS) format = 'hh:mm' + (seconds ? ':ss' : '') + ' A';
	let date = moment(value);
	if (!date.isValid()) date = moment.utc(value, 'HH:mm');
	return date.format(format);
}

/**
 * `amFromUnix | amFromUtc | amDateFormat:'mm'` — the minute figure of a slot duration.
 *
 * @param durationSeconds Slot duration in seconds.
 */
export function durationMinutesLabel(durationSeconds: number | null | undefined): string {
	return moment.unix(durationSeconds || 0).utc().format('mm');
}

/**
 * The `MM-DD-YYYY` query-param date the report pages expect.
 *
 * @param value Date-ish value.
 */
export function reportDateParam(value: Date | string): string {
	return moment(value).format('MM-DD-YYYY');
}
