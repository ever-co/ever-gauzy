import { BadRequestException } from '@nestjs/common';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud';
import { InvoiceService } from './invoice.service';

/**
 * #10694: the Total Value filter of Invoices Received and Estimates Received compared its bounds as
 * the text the query string carries ('50' > '100'), so a range of 50 to 100 answered 400, and a bound
 * left empty (sent as null, read as `false`) reached the query. Both bounds are now read as numbers
 * and an empty one is ignored. A scalar `totalValue` is the exact amount the Invoices search sends.
 */
describe('InvoiceService.pagination — Total Value range', () => {
	let paginate: jest.SpyInstance;
	let service: InvoiceService;

	beforeEach(() => {
		paginate = jest.spyOn(TenantAwareCrudService.prototype, 'paginate').mockResolvedValue({ items: [], total: 0 });
		service = new InvoiceService(
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never
		);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The `totalValue` condition the read is handed for a given filter value. */
	async function condition(totalValue: unknown) {
		await service.pagination({ where: { isEstimate: false, totalValue } } as any);
		expect(paginate).toHaveBeenCalledTimes(1);
		return paginate.mock.calls[0][0].where;
	}

	it('reads bounds sent as text as numbers', async () => {
		expect((await condition({ min: '50', max: '100' })).totalValue).toEqual(Between(50, 100));
	});

	it('keeps a min-only range when the max was left empty', async () => {
		expect((await condition({ min: '50', max: false })).totalValue).toEqual(MoreThanOrEqual(50));
	});

	it('keeps a max-only range when the min was left empty', async () => {
		expect((await condition({ min: false, max: '100' })).totalValue).toEqual(LessThanOrEqual(100));
	});

	it('accepts zero as a bound', async () => {
		expect((await condition({ min: '0', max: 0 })).totalValue).toEqual(Between(0, 0));
	});

	it('drops the condition when both bounds are empty or not numbers', async () => {
		const where = await condition({ min: false, max: 'abc' });

		expect(where).not.toHaveProperty('totalValue');
		expect(where.isEstimate).toBe(false);
	});

	it('leaves an exact amount as it is', async () => {
		expect((await condition(108)).totalValue).toBe(108);
	});

	it('still refuses a min above the max', async () => {
		// `pagination` throws before it reaches the read, synchronously: the async wrapper turns that into a rejection.
		await expect(async () =>
			service.pagination({ where: { totalValue: { min: '100', max: '50' } } } as any)
		).rejects.toBeInstanceOf(BadRequestException);
		expect(paginate).not.toHaveBeenCalled();
	});
});
