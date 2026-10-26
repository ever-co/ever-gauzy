import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';
import { describeKind, scalarInputRefusal, scalarOutputFailure } from './scalar-errors';

/**
 * The name the kernel schema declares this scalar under.
 */
export const DATE_TIME_SCALAR_NAME = 'DateTime';

/**
 * An ISO 8601 date or date-time: the date, then optionally a time and a zone.
 *
 * Groups: year, month, day, hour, minute, second, fraction, zone. The separator may be `T` or a space,
 * because a SQLite column's text uses a space, and the zone may be absent, because the same text has
 * none.
 */
const ISO_INSTANT_PATTERN =
	/^(\d{4})-(\d{2})-(\d{2})(?:[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?([Zz]|[+-]\d{2}(?::?\d{2})?)?)?$/;

/** The widest instant a `Date` can hold, in milliseconds either side of the epoch. */
const MAX_EPOCH_MILLISECONDS = 8.64e15;

/**
 * An instant, on the wire exactly as the REST surface writes one.
 *
 * `scalar DateTime` was declared in `schema/common.type.gql` — "RFC 3339 with an offset, always UTC,
 * which is the format the REST surface emits" — and implemented nowhere, so graphql-js passed whatever
 * the resolver returned straight through. A `Date` happened to come out right, because the JSON encoder
 * calls `toISOString()`; a column's own text (`2026-09-21 10:15:30` from SQLite, `2026-09-21` from a
 * Postgres `date`) and a millisecond count did not, and on input a boolean, a list and an object were
 * accepted without a word.
 *
 * **Out**, every value is `toISOString()` — RFC 3339, milliseconds, `Z` — which is what the REST
 * surface's JSON encoder writes for the same `Date`, so a `Date` is served exactly as before. A text
 * with no zone is read as UTC, because the platform stores UTC and reading it in the server's own zone
 * would move the instant by that zone's offset.
 *
 * **In**, the value reaches the resolver as the caller sent it — a string stays a string, a millisecond
 * count stays a number — once it is known to be an instant: an ISO 8601 date or date-time on a real
 * calendar day, or a finite millisecond count. The services behind the `DateTime` inputs were written
 * against what an unimplemented scalar handed them, so this refuses what they could not use rather
 * than changing what they receive.
 */
@Scalar(DATE_TIME_SCALAR_NAME)
export class DateTimeScalar implements CustomScalar<string, string | number> {
	/**
	 * The description the SDL declares for the scalar, word for word: the driver copies a scalar class's
	 * description over the SDL's, so a different text here would be a schema the snapshot does not show.
	 */
	description =
		'An instant, served as RFC 3339 in UTC with milliseconds: "2026-09-21T10:15:30.000Z", the form the REST\n' +
		'surface writes for the same value. Send an RFC 3339 date-time, or a date.';

	/**
	 * Reads a value the client sent in a variable.
	 *
	 * @param value The variable's value.
	 * @returns The same value.
	 * @throws GraphQLError `VALIDATION_FAILED` when the value is not an instant.
	 */
	parseValue(value: unknown): string | number {
		if (typeof value === 'string') {
			assertInstantInput(value.trim());

			return value;
		}

		if (typeof value === 'number') {
			assertMillisecondsInput(value);

			return value;
		}

		throw scalarInputRefusal(`A ${describeKind(value)} is not an instant. Send it as an RFC 3339 string.`);
	}

	/**
	 * Reads a value the client wrote into the document.
	 *
	 * @param ast The literal node.
	 * @returns A string literal's text, or an `INT` literal's millisecond count.
	 * @throws GraphQLError `VALIDATION_FAILED` for any other literal kind, or an unreadable value.
	 */
	parseLiteral(ast: ValueNode): string | number {
		if (ast.kind === Kind.STRING) {
			assertInstantInput(ast.value.trim(), ast);

			return ast.value;
		}

		if (ast.kind === Kind.INT) {
			const milliseconds = Number(ast.value);
			assertMillisecondsInput(milliseconds, ast);

			return milliseconds;
		}

		throw scalarInputRefusal(`A ${ast.kind} literal is not an instant. Write it as an RFC 3339 string.`, ast);
	}

	/**
	 * Renders a value the server is about to send.
	 *
	 * @param value The resolved value: a `Date`, a column's text, or a millisecond count.
	 * @returns The instant in RFC 3339 form.
	 * @throws GraphQLError `INTERNAL_ERROR` when the server holds something that is not an instant.
	 */
	serialize(value: unknown): string {
		if (value === null || value === undefined) {
			return value as unknown as string;
		}

		const instant =
			value instanceof Date
				? value
				: typeof value === 'number' && Number.isFinite(value)
					? new Date(value)
					: typeof value === 'string'
						? instantOfStoredText(value.trim())
						: null;

		if (!instant || Number.isNaN(instant.getTime())) {
			throw scalarOutputFailure(`A ${describeKind(value)} that is not an instant cannot be served as a DateTime.`);
		}

		return instant.toISOString();
	}
}

/**
 * Reads an ISO 8601 text as an instant, a text with no zone as UTC.
 *
 * @param text The text, trimmed.
 * @param strict Whether the date has to be a real calendar day — true for a caller's value, which is
 * refused when it names 30 February; false for a stored one, which is served as the engine reads it.
 * @returns The instant, or null when the text is not ISO 8601 or names no real instant.
 */
function isoInstant(text: string, strict: boolean): Date | null {
	const match = ISO_INSTANT_PATTERN.exec(text);

	if (!match) {
		return null;
	}

	const [, year, month, day, hour, minute, second = '00', fraction, zone] = match;

	if (strict && !isCalendarDay(Number(year), Number(month), Number(day))) {
		return null;
	}

	if (hour === undefined) {
		return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	}

	const time = `${hour}:${minute}:${second}${fraction ? `.${fraction.slice(0, 3).padEnd(3, '0')}` : ''}`;
	const offset = normalizeZone(zone);
	const instant = new Date(`${year}-${month}-${day}T${time}${offset}`);

	return Number.isNaN(instant.getTime()) ? null : instant;
}

/**
 * The zone of an ISO text in the one form every engine reads: `Z`, or `±hh:mm`. No zone is UTC.
 *
 * @param zone The zone as written, when there was one.
 * @returns The normalised zone.
 */
function normalizeZone(zone?: string): string {
	if (!zone || zone === 'z' || zone === 'Z') {
		return 'Z';
	}

	const digits = zone.slice(1).replace(':', '');

	return `${zone[0]}${digits.slice(0, 2)}:${(digits.slice(2) || '00').padEnd(2, '0')}`;
}

/**
 * @param year The year.
 * @param month The month, 1 to 12.
 * @param day The day of the month.
 * @returns True when the three name a real day.
 */
function isCalendarDay(year: number, month: number, day: number): boolean {
	const date = new Date(Date.UTC(year, month - 1, day));

	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Reads a stored text as an instant.
 *
 * ISO 8601 is the ordinary case. Anything else a resolver produced — `Date.prototype.toString()`,
 * `toUTCString()` — is handed to the engine's own parser, but only when it names a four-digit year, so
 * a stray number is reported rather than served as the year it happens to parse as.
 *
 * @param text The text, trimmed.
 * @returns The instant, or null.
 */
function instantOfStoredText(text: string): Date | null {
	const iso = isoInstant(text, false);

	if (iso) {
		return iso;
	}

	if (!/\d{4}/.test(text)) {
		return null;
	}

	const parsed = new Date(text);

	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The text reaches the resolver unchanged, so it also has to be one the engine's own `Date` reads:
 * a service that does `new Date(value)` must not get an invalid date for a value this scalar accepted.
 *
 * @param text The caller's text, trimmed.
 * @param node The literal it came from, when it came from one.
 * @throws GraphQLError `VALIDATION_FAILED` when it is not an ISO 8601 instant on a real day.
 */
function assertInstantInput(text: string, node?: ValueNode): void {
	if (!isoInstant(text, true) || Number.isNaN(Date.parse(text))) {
		throw scalarInputRefusal(
			'The value is not a readable instant. Use RFC 3339, such as "2026-09-21T10:15:30Z", or a date such as "2026-09-21".',
			node
		);
	}
}

/**
 * @param milliseconds The caller's millisecond count.
 * @param node The literal it came from, when it came from one.
 * @throws GraphQLError `VALIDATION_FAILED` when it is not a count a `Date` can hold.
 */
function assertMillisecondsInput(milliseconds: number, node?: ValueNode): void {
	if (!Number.isFinite(milliseconds) || Math.abs(milliseconds) > MAX_EPOCH_MILLISECONDS) {
		throw scalarInputRefusal('The value is not a millisecond count an instant can have.', node);
	}
}
