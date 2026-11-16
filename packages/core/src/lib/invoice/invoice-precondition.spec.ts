import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { ApiException } from '../core/errors/api-exception';
import {
	expectedUpdatedAtOf,
	holdInvoiceUnchanged,
	INVOICE_CHANGED,
	InvoiceChangedError,
	invoiceChangedException,
	isUnchangedSince,
	touchInvoice
} from './invoice-precondition';

const INVOICE = '5243c0de-0000-4000-8000-000000000001';
const TENANT = '5243c0de-0000-4000-8000-0000000000a1';
const READ_AT = '2026-11-16T10:20:30.456Z';

/** A TypeORM transaction whose locking read answers `row`, and whose update statements are recorded. */
function typeOrmTransaction(row: Record<string, unknown> | null) {
	const statements: Array<{ set: unknown; where: string[]; listeners: boolean | undefined }> = [];
	const builder = () => {
		const statement = { set: undefined as unknown, where: [] as string[], listeners: undefined as boolean };
		statements.push(statement);
		const query: any = {
			update: () => query,
			set: (values: unknown) => {
				statement.set = values;
				return query;
			},
			where: (clause: string) => {
				statement.where.push(clause);
				return query;
			},
			andWhere: (clause: string) => {
				statement.where.push(clause);
				return query;
			},
			callListeners: (enabled: boolean) => {
				statement.listeners = enabled;
				return query;
			},
			execute: async () => ({ affected: 1 })
		};
		return query;
	};
	const findOne = jest.fn(async () => row);
	return { transaction: { typeOrm: { findOne, createQueryBuilder: builder } as any }, findOne, statements };
}

describe('Invoice preconditions (#5243)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('expectedUpdatedAtOf', () => {
		it.each([undefined, null, ''])('reads %p as no precondition', (value) => {
			expect(expectedUpdatedAtOf(value)).toBeNull();
		});

		it('reads an ISO 8601 date and time as the instant it names', () => {
			expect(expectedUpdatedAtOf(READ_AT)?.toISOString()).toBe(READ_AT);
		});

		it('takes a date as it is', () => {
			const date = new Date(READ_AT);
			expect(expectedUpdatedAtOf(date)).toBe(date);
		});

		it.each(['yesterday', '2026-13-40T99:00:00Z', [READ_AT, READ_AT], 1700000000000, {}])(
			'refuses %p rather than dropping it: the write would otherwise be unconditional',
			(value) => {
				expect(() => expectedUpdatedAtOf(value)).toThrow(BadRequestException);
			}
		);

		it('refuses an invalid date', () => {
			expect(() => expectedUpdatedAtOf(new Date('invalid'))).toThrow(BadRequestException);
		});
	});

	describe('isUnchangedSince', () => {
		const expected = new Date(READ_AT);

		it.each([
			['a date', new Date(READ_AT)],
			['the ISO text of it', READ_AT],
			['its milliseconds', Date.parse(READ_AT)]
		])('holds for the same instant, as %s', (_label, stored) => {
			expect(isUnchangedSince(stored, expected)).toBe(true);
		});

		it.each([
			['a millisecond later', new Date(Date.parse(READ_AT) + 1)],
			['earlier', new Date('2026-11-01T00:00:00.000Z')],
			['unknown', null],
			['absent', undefined],
			['unreadable', 'not a date']
		])('does not hold for a stored value %s', (_label, stored) => {
			expect(isUnchangedSince(stored as never, expected)).toBe(false);
		});
	});

	describe('holdInvoiceUnchanged', () => {
		it("locks the invoice of the caller's tenant and answers it while it holds the updatedAt read", async () => {
			const row = { id: INVOICE, status: 'DRAFT', updatedAt: new Date(READ_AT) };
			const { transaction, findOne } = typeOrmTransaction(row);

			await expect(holdInvoiceUnchanged(transaction, INVOICE, new Date(READ_AT))).resolves.toBe(row);

			const [, options] = findOne.mock.calls[0] as unknown as [unknown, any];
			expect(options.where).toEqual({ id: INVOICE, tenantId: TENANT });
			expect(options.select.updatedAt).toBe(true);
		});

		it('raises InvoiceChangedError, with both instants, once the invoice was written since', async () => {
			const later = new Date('2026-11-16T10:21:00.000Z');
			const { transaction } = typeOrmTransaction({ id: INVOICE, updatedAt: later });

			const refusal = holdInvoiceUnchanged(transaction, INVOICE, new Date(READ_AT));

			await expect(refusal).rejects.toBeInstanceOf(InvoiceChangedError);
			await expect(refusal).rejects.toMatchObject({
				invoiceId: INVOICE,
				expectedUpdatedAt: new Date(READ_AT),
				actualUpdatedAt: later,
				message: INVOICE_CHANGED
			});
		});

		it('checks nothing but the tenant without a precondition', async () => {
			const row = { id: INVOICE, updatedAt: new Date('2026-11-16T11:00:00.000Z') };
			const { transaction } = typeOrmTransaction(row);

			await expect(holdInvoiceUnchanged(transaction, INVOICE, null)).resolves.toBe(row);
		});

		it.each([new Date(READ_AT), null])(
			"answers 404 for an invoice the caller's tenant does not have (precondition %p)",
			async (expected) => {
				const { transaction } = typeOrmTransaction(null);

				await expect(holdInvoiceUnchanged(transaction, INVOICE, expected)).rejects.toMatchObject({
					status: 404
				});
			}
		);
	});

	describe('touchInvoice', () => {
		it("moves updatedAt past the value read, in the caller's tenant, without the update listeners", async () => {
			const stored = { updatedAt: new Date(Date.now() + 60_000) };
			const { transaction, statements } = typeOrmTransaction(null);

			const touched = await touchInvoice(transaction, INVOICE, stored);

			expect(touched.getTime()).toBe(stored.updatedAt.getTime() + 1);
			expect(statements[0].set).toEqual({ updatedAt: touched });
			expect(statements[0].where).toHaveLength(2);
			expect(statements[0].listeners).toBe(false);
		});

		it('takes the current time once it is past the value read', async () => {
			const before = Date.now();
			const { transaction } = typeOrmTransaction(null);

			const touched = await touchInvoice(transaction, INVOICE, { updatedAt: new Date('2026-01-01T00:00:00Z') });

			expect(touched.getTime()).toBeGreaterThanOrEqual(before);
		});

		it("writes through MikroORM natively, in the caller's tenant", async () => {
			const nativeUpdate = jest.fn(async () => 1);
			const transaction = { mikroOrm: { nativeUpdate } as any };

			const touched = await touchInvoice(transaction, INVOICE, { updatedAt: null });

			expect(nativeUpdate).toHaveBeenCalledWith(
				expect.anything(),
				{ id: INVOICE, tenantId: TENANT },
				{ updatedAt: touched }
			);
		});
	});

	describe('invoiceChangedException', () => {
		const changed = new InvoiceChangedError(INVOICE, new Date(READ_AT), new Date('2026-11-16T10:21:00.000Z'));

		it('answers 409 CONCURRENT_MODIFICATION with the invoice as it is now', async () => {
			const invoice = { id: INVOICE, terms: 'meanwhile', updatedAt: new Date('2026-11-16T10:22:00.000Z') };

			const exception = await invoiceChangedException(changed, async () => invoice as never);

			expect(exception).toBeInstanceOf(ApiException);
			expect(exception.getStatus()).toBe(409);
			expect(exception.code).toBe('CONCURRENT_MODIFICATION');
			expect(exception.details).toEqual({
				expectedUpdatedAt: READ_AT,
				actualUpdatedAt: '2026-11-16T10:22:00.000Z',
				invoice
			});
		});

		it('answers 404 when the caller may no longer read the invoice', async () => {
			const refusal = invoiceChangedException(changed, async () => {
				throw new NotFoundException();
			});

			await expect(refusal).rejects.toBeInstanceOf(NotFoundException);
		});

		it('still answers the 409 when the invoice cannot be read for another reason', async () => {
			const exception = await invoiceChangedException(changed, async () => {
				throw new Error('connection reset');
			});

			expect(exception.getStatus()).toBe(409);
			expect(exception.details).toEqual({
				expectedUpdatedAt: READ_AT,
				actualUpdatedAt: '2026-11-16T10:21:00.000Z'
			});
		});
	});
});
