import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { isISO8601 } from 'class-validator';
import { EntityData, FilterQuery } from '@mikro-orm/core';
import { ID, IInvoice } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { Invoice } from '../core/entities/internal';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { prepareSQLQuery as p } from '../database/database.helper';
import { ILinesTransaction, ILockedInvoice, lockInvoice } from '../invoice-item/invoice-item-billed-time';

/**
 * A conditional write of an invoice: the `updatedAt` the caller last read it at.
 *
 * Optional on every route that takes it (`PUT /invoices/:id`, `POST /invoice-item/bulk/:invoiceId`,
 * `PUT /invoices/:id/with-items`, `PUT /invoices/:id/action`, `PUT /invoices/:id/estimate`, `DELETE /invoices/:id`, and
 * their GraphQL twins). Absent, the write is made exactly as it was before the precondition existed. Stated, the
 * invoice is locked, its `updatedAt` compared with it, and the write is made in the same transaction only when the two
 * are the same instant; otherwise nothing is written and the caller is answered 409 with the invoice as it is now.
 *
 * `updatedAt` rather than a version column: every write of an invoice moves it (a payment, a void, an edit, through
 * TypeORM's update date or MikroORM's `onUpdate`), so it tells a change made by any route, including the ones that
 * know nothing of preconditions. A version column would only move for the writes that bump it.
 */
export interface IInvoicePrecondition {
	expectedUpdatedAt?: string | Date | null;
}

/** The refusal of a write whose precondition no longer holds. Its code is `CONCURRENT_MODIFICATION`. */
export const INVOICE_CHANGED =
	'INVOICE_CHANGED: the invoice changed since it was read (its updatedAt is no longer expectedUpdatedAt). Nothing ' +
	'was saved: read it again, and make the change on what it holds now.';

/** The refusal of a save of an invoice's fields and lines that would move the invoice to another organization. */
export const INVOICE_ORGANIZATION_IS_KEPT =
	'INVOICE_ORGANIZATION_IS_KEPT: an invoice saved with its lines stays in its organization. Nothing was saved.';

/** The refusal of a line that names a line of another invoice. */
export const INVOICE_LINE_OF_ANOTHER_INVOICE =
	'INVOICE_LINE_OF_ANOTHER_INVOICE: a line names, by its id, a line this invoice does not hold (or names one twice). ' +
	'Nothing was saved: leave out the id of a new line.';

/** The refusal of a precondition that is no date and time. */
export const INVOICE_PRECONDITION_MALFORMED =
	'expectedUpdatedAt must be the updatedAt the invoice was read with, as an ISO 8601 date and time.';

/** A date and time in the extended format that states no offset: `2026-11-16T10:20:30.456`, or with a space. */
const ZONELESS_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

/**
 * The text of a precondition as it is read: the date and time separator in upper case (RFC 3339 allows `t`, which the
 * `DateTime` scalar passes on), and a date and time that states no offset read as UTC, the zone the API serves every
 * `updatedAt` in, rather than in the server's own zone, which `new Date` would otherwise apply to it.
 */
function utcTextOf(value: string): string {
	const text = value.replace(/^(\d{4}-\d{2}-\d{2})t/, '$1T');
	if (!ZONELESS_DATE_TIME.test(text)) {
		return text;
	}
	return `${text.replace(' ', 'T')}Z`;
}

/**
 * The precondition a request states, as an instant; null when it states none. A date and time stated without an
 * offset is read as UTC.
 *
 * @param value The `expectedUpdatedAt` of the body or of the query string, as it arrived.
 * @returns The instant, or null when the request states no precondition.
 * @throws BadRequestException when the value is no ISO 8601 date and time: a precondition that cannot be read is not
 * dropped, since the write would then be made unconditionally.
 */
export function expectedUpdatedAtOf(value: unknown): Date | null {
	if (value === undefined || value === null || value === '') {
		return null;
	}
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			throw new BadRequestException(INVOICE_PRECONDITION_MALFORMED);
		}
		return value;
	}
	if (typeof value !== 'string') {
		throw new BadRequestException(INVOICE_PRECONDITION_MALFORMED);
	}
	const text = utcTextOf(value);
	if (!isISO8601(text, { strict: true })) {
		throw new BadRequestException(INVOICE_PRECONDITION_MALFORMED);
	}
	const instant = new Date(text);
	if (Number.isNaN(instant.getTime())) {
		throw new BadRequestException(INVOICE_PRECONDITION_MALFORMED);
	}
	return instant;
}

/**
 * The precondition a GraphQL field states, as an instant; null when it states none. The `DateTime` scalar hands the
 * field what the caller sent once it checked that it names an instant: RFC 3339 text, or milliseconds since the epoch.
 * Text is then read as {@link expectedUpdatedAtOf} reads a route's, so both surfaces take the same text. Milliseconds
 * are taken here because the scalar takes them for every `DateTime`; the REST routes, whose DTOs and query strings
 * carry text, take ISO 8601 text only.
 *
 * @param value The `expectedUpdatedAt` argument or input member, as the scalar parsed it.
 * @returns The instant, or null when the field states no precondition.
 * @throws BadRequestException when the text is no strict ISO 8601 date and time.
 */
export function graphqlPreconditionOf(value: string | number | null | undefined): Date | null {
	if (typeof value === 'number') {
		return expectedUpdatedAtOf(new Date(value));
	}
	return expectedUpdatedAtOf(value);
}

/**
 * Whether an invoice stored at `stored` is still the one read at `expected`.
 *
 * Compared to the millisecond: the API serializes `updatedAt` to the millisecond, and the database driver hands the
 * locking read the stored value to the same millisecond, so an invoice nobody wrote since compares equal. A value the
 * ORM hands over as text or as a number of milliseconds (MikroORM on SQLite) is read as the instant it names.
 *
 * @param stored The `updatedAt` the invoice holds.
 * @param expected The `updatedAt` the caller read.
 */
export function isUnchangedSince(stored: Date | string | number | null | undefined, expected: Date): boolean {
	if (stored === undefined || stored === null) {
		return false;
	}
	const storedTime = new Date(stored).getTime();
	return !Number.isNaN(storedTime) && storedTime === expected.getTime();
}

/**
 * Raised inside the transaction when the precondition no longer holds, so the transaction rolls back; the route turns
 * it into the 409 that carries the invoice as it is now, read once the transaction is over (see
 * `InvoiceService.invoiceChangedAnswer`).
 */
export class InvoiceChangedError extends Error {
	constructor(
		readonly invoiceId: ID,
		readonly expectedUpdatedAt: Date,
		readonly actualUpdatedAt: Date | null
	) {
		super(INVOICE_CHANGED);
		this.name = 'InvoiceChangedError';
	}
}

/** The invoice is not one of the caller's tenant: nothing is written, whatever the precondition. */
function invoiceNotFound(invoiceId: ID): ApiException {
	return new ApiException(HttpStatus.NOT_FOUND, ApiErrorCode.RESOURCE_NOT_FOUND, 'The invoice was not found.', {
		id: invoiceId
	});
}

/**
 * Locks the invoice for the rest of the transaction and checks the precondition against what it holds now (see
 * `lockInvoice`): a write another request is making to it is waited for, and seen. The write that follows in the same
 * transaction therefore cannot be made over a change saved after the comparison.
 *
 * @param transaction The transaction the write runs in.
 * @param invoiceId The invoice.
 * @param expected The `updatedAt` the caller read; null checks nothing but that the invoice is the caller's tenant's.
 * @returns The invoice as the locking read answers it.
 * @throws ApiException 404 when the caller's tenant has no such invoice.
 * @throws InvoiceChangedError when the invoice was written since `expected`.
 */
export async function holdInvoiceUnchanged(
	transaction: ILinesTransaction,
	invoiceId: ID,
	expected: Date | null
): Promise<ILockedInvoice> {
	const stored = await lockInvoice(transaction, invoiceId, RequestContext.currentTenantId());
	if (!stored) {
		throw invoiceNotFound(invoiceId);
	}
	if (expected && !isUnchangedSince(stored.updatedAt, expected)) {
		const actual = stored.updatedAt ? new Date(stored.updatedAt) : null;
		throw new InvoiceChangedError(invoiceId, expected, actual);
	}
	return stored;
}

/**
 * The `updatedAt` a write moves an invoice to: now, or a millisecond past every value given when one of them is not in
 * the past yet, so the result differs from each of them, as `updatedAt` is compared to the millisecond.
 *
 * @param values The values the result must be later than: what the invoice holds, what a caller read. Missing or
 * unreadable ones are left out.
 */
export function laterThan(values: Array<Date | string | number | null | undefined>): Date {
	const times = values
		.filter((value) => value !== undefined && value !== null)
		.map((value) => new Date(value).getTime())
		.filter((time) => !Number.isNaN(time));
	return new Date(Math.max(Date.now(), ...times.map((time) => time + 1)));
}

/**
 * Moves the invoice's `updatedAt`, in the transaction that wrote its lines (or, for a conditional save, its fields): a
 * line is a row of its own, so writing a line leaves the invoice's row as it was, and the next precondition would not
 * see the change. The invoice is read again here, locked, in the same transaction, so the new value is later than the
 * one it holds by at least a millisecond, whatever this transaction wrote to it before: it differs from it even when
 * the clock has not moved since, as `updatedAt` is compared to the millisecond.
 *
 * `after` is a value the result must also be later than: the `updatedAt` a conditional save checked. A write earlier
 * in the transaction can leave the row behind it (TypeORM's update date is kept to the second on SQLite and MySQL),
 * and the read alone would then allow the very value the caller read.
 *
 * @param transaction The transaction the lines were written in.
 * @param invoiceId The invoice.
 * @param after A value the new `updatedAt` must be later than, besides the stored one.
 * @returns The `updatedAt` the invoice holds now; null, and nothing written, when the caller's tenant has no such
 * invoice.
 */
export async function touchInvoice(
	transaction: ILinesTransaction,
	invoiceId: ID,
	after?: Date | string | null
): Promise<Date | null> {
	const tenantId = RequestContext.currentTenantId();
	const stored = await lockInvoice(transaction, invoiceId, tenantId);
	if (!stored) {
		return null;
	}
	const updatedAt = laterThan([stored.updatedAt, after]);
	if (transaction.mikroOrm) {
		const where = (tenantId ? { id: invoiceId, tenantId } : { id: invoiceId }) as FilterQuery<Invoice>;
		await transaction.mikroOrm.nativeUpdate(Invoice, where, { updatedAt } as EntityData<Invoice>);
		return updatedAt;
	}
	const query = transaction.typeOrm
		.createQueryBuilder()
		.update(Invoice)
		.set({ updatedAt })
		.where(p(`"id" = :invoiceId`), { invoiceId })
		// Not a change of the invoice's own: the subscribers of an update have nothing to do with it
		.callListeners(false);
	if (tenantId) {
		query.andWhere(p(`"tenantId" = :tenantId`), { tenantId });
	}
	await query.execute();
	return updatedAt;
}

/**
 * The 409 of a write whose precondition no longer holds, with the invoice as it is now: the caller can show it, and
 * make its change again on it, without another read.
 *
 * @param error What the transaction found.
 * @param readCurrent Reads the invoice as the caller may read it; a `NotFoundException` is answered as the 404 it is.
 * @returns The exception to throw.
 * @throws NotFoundException when the caller may no longer read the invoice (it was deleted meanwhile, for one).
 */
export async function invoiceChangedException(
	error: InvoiceChangedError,
	readCurrent: (invoiceId: ID) => Promise<IInvoice>
): Promise<ApiException> {
	let invoice: IInvoice | null = null;
	try {
		invoice = await readCurrent(error.invoiceId);
	} catch (readError) {
		if (readError instanceof NotFoundException) {
			throw readError;
		}
		// The invoice only explains the conflict: one that cannot be read leaves the conflict to stand without it,
		// rather than reporting a refused write as a server error.
	}
	const actual = invoice?.updatedAt ?? error.actualUpdatedAt;
	return new ApiException(HttpStatus.CONFLICT, ApiErrorCode.CONCURRENT_MODIFICATION, INVOICE_CHANGED, {
		expectedUpdatedAt: error.expectedUpdatedAt.toISOString(),
		actualUpdatedAt: actual ? new Date(actual).toISOString() : null,
		...(invoice ? { invoice } : {})
	});
}
