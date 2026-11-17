import { BadRequestException, HttpStatus } from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import { isISO8601 } from 'class-validator';
import { EntityManager } from 'typeorm';
import { ITimeLog } from '@gauzy/contracts';
import { TimeLog } from '../../core/entities/internal';
import { ApiErrorCode } from '../../core/errors/api-error-codes';
import { ApiException } from '../../core/errors/api-exception';
import { prepareSQLQuery as p } from '../../database/database.helper';

/**
 * A conditional edit of a time entry (`PUT /timesheet/time-log/:id`, ever-co/ever-teams#5382): the `updatedAt` the
 * caller last read it at, as an invoice edit states it (see `invoice-precondition.ts`).
 *
 * Optional. Absent, the edit is made exactly as it was before the precondition existed. Stated, the entry is locked, its
 * `updatedAt` compared with it, and the edit is written in the same transaction only when the two are the same instant;
 * otherwise nothing is written and the caller is answered 409 with the entry as it is now.
 *
 * `updatedAt` rather than a version column: every write of an entry moves it (an edit, a stop of its timer, the invoice
 * line that bills it), through TypeORM's update date, MikroORM's `onUpdate`, or the writes that set it themselves.
 */
export interface ITimeLogPrecondition {
	expectedUpdatedAt?: string | Date | null;
}

/** The refusal of an edit whose precondition no longer holds. Its code is `CONCURRENT_MODIFICATION`. */
export const TIME_LOG_CHANGED =
	'TIME_LOG_CHANGED: the time entry changed since it was read (its updatedAt is no longer expectedUpdatedAt). ' +
	'Nothing was saved: read it again, and make the change on what it holds now.';

/** The refusal of a precondition that is no date and time. */
export const TIME_LOG_PRECONDITION_MALFORMED =
	'expectedUpdatedAt must be the updatedAt the time entry was read with, as an ISO 8601 date and time.';

/**
 * The precondition an edit states, as an instant; null when it states none.
 *
 * @param value The `expectedUpdatedAt` of the body, as it arrived.
 * @returns The instant, or null when the edit states no precondition.
 * @throws BadRequestException when the value is no ISO 8601 date and time: a precondition that cannot be read is not
 * dropped, since the edit would then be written unconditionally.
 */
export function timeLogExpectedUpdatedAtOf(value: unknown): Date | null {
	if (value === undefined || value === null || value === '') {
		return null;
	}
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			throw new BadRequestException(TIME_LOG_PRECONDITION_MALFORMED);
		}
		return value;
	}
	if (typeof value !== 'string' || !isISO8601(value, { strict: true })) {
		throw new BadRequestException(TIME_LOG_PRECONDITION_MALFORMED);
	}
	const instant = new Date(value);
	if (Number.isNaN(instant.getTime())) {
		throw new BadRequestException(TIME_LOG_PRECONDITION_MALFORMED);
	}
	return instant;
}

/**
 * Whether an entry stored at `stored` is still the one read at `expected`, to the millisecond: the API serializes
 * `updatedAt` to the millisecond, and the database driver hands a read the stored value to the same millisecond. A value
 * an ORM hands over as text or as a number of milliseconds (MikroORM on SQLite) is read as the instant it names.
 *
 * @param stored The `updatedAt` the entry holds.
 * @param expected The `updatedAt` the caller read.
 */
export function isTimeLogUnchangedSince(stored: Date | string | number | null | undefined, expected: Date): boolean {
	if (stored === undefined || stored === null) {
		return false;
	}
	const storedTime = new Date(stored).getTime();
	return !Number.isNaN(storedTime) && storedTime === expected.getTime();
}

/**
 * The `updatedAt` a write moves a time entry to: now, or a millisecond past every value given when one of them is not
 * in the past yet, so the result differs from each of them, as `updatedAt` is compared to the millisecond.
 *
 * @param values The values the result must be later than: what the entries hold, what a caller read. Missing or
 * unreadable ones are left out.
 */
export function updatedAtPast(values: ReadonlyArray<Date | string | number | null | undefined>): Date {
	const times = values
		.filter((value) => value !== undefined && value !== null)
		.map((value) => new Date(value).getTime())
		.filter((time) => !Number.isNaN(time));
	return new Date(Math.max(Date.now(), ...times.map((time) => time + 1)));
}

/**
 * Moves a changed entry's `updatedAt` a millisecond past both what it held when it was locked and the value the change
 * was checked against, in the change's transaction (ever-co/ever-teams#5382): an edit, and a change of its tags
 * (ever-co/ever-gauzy#12029). The write's own update date is the database's clock, kept to the second on SQLite and
 * MySQL and to the start of the transaction on PostgreSQL, and a change of the tags alone writes no column: a second
 * edit made on the same read could otherwise find the value it read.
 *
 * @param manager - The change's transaction.
 * @param current - The entry as read under lock in it.
 * @param expectedUpdatedAt - The value the change was checked against, if any.
 */
export async function moveUpdatedAtPast(
	manager: EntityManager,
	current: Pick<ITimeLog, 'id' | 'tenantId' | 'updatedAt'>,
	expectedUpdatedAt: Date | null
): Promise<void> {
	const updatedAt = updatedAtPast([current.updatedAt, expectedUpdatedAt]);
	await manager
		.createQueryBuilder()
		.update(TimeLog)
		.set({ updatedAt })
		.where(p(`"id" = :id`), { id: current.id })
		.andWhere(p(`"tenantId" = :tenantId`), { tenantId: current.tenantId })
		// Not a change of the entry's own: the subscribers of an update have nothing to do with it
		.callListeners(false)
		.execute();
}

/**
 * The 409 of an edit whose precondition no longer holds, with the entry as it is now: the caller can show it, and make
 * its change again on it, without another read. The entry goes out as an answer would send it: a column the API keeps
 * from its answers is left out.
 *
 * @param timeLog The entry as it is now, as the caller may read it.
 * @param expected The `updatedAt` the caller read.
 */
export function timeLogChangedException(timeLog: ITimeLog, expected: Date): ApiException {
	const actual = timeLog?.updatedAt ? new Date(timeLog.updatedAt) : null;
	const isActualReadable = actual !== null && !Number.isNaN(actual.getTime());
	return new ApiException(HttpStatus.CONFLICT, ApiErrorCode.CONCURRENT_MODIFICATION, TIME_LOG_CHANGED, {
		expectedUpdatedAt: expected.toISOString(),
		actualUpdatedAt: isActualReadable ? actual.toISOString() : null,
		timeLog: instanceToPlain(timeLog)
	});
}

/**
 * Refuses an edit made on a read the entry no longer holds.
 *
 * @param timeLog The entry as read: under the row's lock in the write's transaction, or before anything is written.
 * @param expected The `updatedAt` the caller read; null checks nothing.
 * @throws ApiException 409 `CONCURRENT_MODIFICATION` (`TIME_LOG_CHANGED`) when the entry was written since.
 */
export function assertTimeLogUnchangedSince(timeLog: ITimeLog, expected: Date | null): void {
	if (!expected) {
		return;
	}
	if (!isTimeLogUnchangedSince(timeLog?.updatedAt, expected)) {
		throw timeLogChangedException(timeLog, expected);
	}
}

/**
 * The changes of an edit without its precondition: it is checked, never written, as no column holds it.
 *
 * @param changes The changes as the edit states them.
 */
export function withoutPrecondition<T extends object>(changes: T): T {
	if (!Object.prototype.hasOwnProperty.call(changes, 'expectedUpdatedAt')) {
		return changes;
	}
	const written = { ...changes } as T & ITimeLogPrecondition;
	delete written.expectedUpdatedAt;
	return written;
}
