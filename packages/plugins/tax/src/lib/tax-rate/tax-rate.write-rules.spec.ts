import { BadRequestException, ConflictException } from '@nestjs/common';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { TaxDirection } from '../tax.types';
import { TaxRateService } from './tax-rate.service';

/**
 * R2-30 (tax): the write rules of a rate.
 *
 * - **A code means one rate at an instant on each path.** A `BOTH` rate applies to sales and purchases
 *   alike, so a `SALE` rate of the same code whose window overlaps it is the same code meaning two rates
 *   on the sales path. The check used to read only the neighbours of the very same direction, so it never
 *   saw the `BOTH` one.
 * - **A member the caller clears is validated as cleared.** An update that sets `startsAt` or `priority` to
 *   `null` writes the `null`, but the checks read `null` as "keep the stored value" and so validated a
 *   value the write was replacing: a valid window was refused, and a compound rate could lose its
 *   priority unchecked.
 *
 * The persistence of the inherited CRUD service is stubbed; what is under test is what this service
 * refuses before it gets there. The neighbour read honours the `where` the service states, so a check that
 * narrows its query too far reads too little here as well.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const CATEGORY = '00000000-0000-4000-8000-000000000050';

interface IRateRow {
	id: string;
	organizationId: string;
	taxCategoryId: string;
	code: string;
	name: string;
	rate: number;
	direction: TaxDirection;
	isCompound?: boolean;
	priority?: number | null;
	startsAt?: Date | null;
	endsAt?: Date | null;
}

const stored = (overrides: Partial<IRateRow> & { id: string }): IRateRow => ({
	organizationId: ORG,
	taxCategoryId: CATEGORY,
	code: 'VAT',
	name: 'VAT',
	rate: 0.2,
	direction: TaxDirection.SALE,
	...overrides
});

function serviceUnderTest(rows: IRateRow[]) {
	const service = new TaxRateService(
		{} as never,
		{} as never,
		{
			findOneByIdString: async (id: string) => (id === CATEGORY ? { id: CATEGORY, code: 'STANDARD' } : null)
		} as never,
		{ listForRate: async () => [] } as never,
		{} as never
	);

	jest.spyOn(service, 'find').mockImplementation(async (options) => {
		const where = ((options as { where?: Record<string, unknown> } | undefined)?.where ?? {}) as Record<
			string,
			unknown
		>;

		return rows.filter((row) =>
			Object.entries(where).every(
				([field, value]) =>
					value === undefined || String((row as unknown as Record<string, unknown>)[field]) === String(value)
			)
		) as never;
	});
	jest.spyOn(service, 'findOneByIdString').mockImplementation(
		async (id) => rows.find((row) => row.id === id) as never
	);
	const created = jest
		.spyOn(TenantAwareCrudService.prototype, 'create')
		.mockImplementation(async (entity) => entity as never);
	const updated = jest
		.spyOn(TenantAwareCrudService.prototype, 'update')
		.mockImplementation(async () => ({ affected: 1 }) as never);

	return { service, created, updated };
}

describe('TaxRateService — write rules (R2-30)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a SALE rate whose code and window overlap a BOTH rate of the same code', async () => {
		const { service, created } = serviceUnderTest([stored({ id: 'vat-both', direction: TaxDirection.BOTH })]);

		await expect(
			service.create({
				taxCategoryId: CATEGORY,
				code: 'VAT',
				name: 'VAT (sales)',
				rate: 0.21,
				direction: TaxDirection.SALE
			} as never)
		).rejects.toBeInstanceOf(ConflictException);
		expect(created).not.toHaveBeenCalled();
	});

	it('still lets a PURCHASE rate share the code of a SALE rate (control)', async () => {
		const { service, created } = serviceUnderTest([stored({ id: 'vat-sale', direction: TaxDirection.SALE })]);

		await service.create({
			taxCategoryId: CATEGORY,
			code: 'VAT',
			name: 'VAT (purchases)',
			rate: 0.2,
			direction: TaxDirection.PURCHASE
		} as never);

		expect(created).toHaveBeenCalledTimes(1);
	});

	it('validates a cleared start as cleared, not as the stored one', async () => {
		const { service, updated } = serviceUnderTest([
			stored({
				id: 'vat',
				startsAt: new Date('2026-03-01T00:00:00.000Z'),
				endsAt: new Date('2026-04-01T00:00:00.000Z')
			})
		]);

		// The rate becomes "in force until 1 February": a valid window, which used to be refused because the
		// stored 1 March start was compared with the new end.
		await service.update('vat', { startsAt: null, endsAt: new Date('2026-02-01T00:00:00.000Z') } as never);

		expect(updated).toHaveBeenCalledTimes(1);
	});

	it('refuses to clear the priority of a rate that compounds', async () => {
		const { service, updated } = serviceUnderTest([stored({ id: 'qst', isCompound: true, priority: 20 })]);

		await expect(service.update('qst', { priority: null } as never)).rejects.toBeInstanceOf(BadRequestException);
		expect(updated).not.toHaveBeenCalled();
	});

	it('lets a compound rate change to another priority (control)', async () => {
		const { service, updated } = serviceUnderTest([stored({ id: 'qst', isCompound: true, priority: 20 })]);

		await service.update('qst', { priority: 30 } as never);

		expect(updated).toHaveBeenCalledTimes(1);
	});
});
