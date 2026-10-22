import { NotFoundException } from '@nestjs/common';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { ExchangeRateService } from './exchange-rate/exchange-rate.service';
import { inCallerOrganization } from './organization-scope';
import { PriceListService } from './price-list/price-list.service';
import { PricePreferenceService } from './price-preference/price-preference.service';
import { ProductPriceService } from './product-price/product-price.service';

/**
 * A pricing row of a sibling organization of the caller's tenant is not the caller's to read or write.
 *
 * The read by id the services inherit was narrowed to the tenant only, and every route that reads or writes one row
 * by id resolves it there first, so `PUT /product-prices/:id`, `PUT /price-lists/:id`, `POST /price-lists/:id/activate`,
 * the deletes and the withdraw/restore pair reached another organization's row by its id.
 *
 * The inherited read is stubbed to answer the row as the tenant-scoped read would; what is under test is what each
 * service does with it.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';

/** The inherited tenant-scoped read, answering a row of the given organization. */
function storedIn(organizationId: string | null, fields: Record<string, unknown> = {}) {
	return jest
		.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString')
		.mockImplementation(async (id) => ({ id, tenantId: TENANT, organizationId, ...fields }) as never);
}

function stubWrites() {
	return jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({ affected: 1 } as never);
}

const emptyRepository = { findOne: async () => null, find: async () => [] };

const services = () => ({
	ProductPriceService: new ProductPriceService(emptyRepository as never, {} as never, {} as never, {} as never),
	PriceListService: new PriceListService(emptyRepository as never, {} as never, {} as never),
	ExchangeRateService: new ExchangeRateService(emptyRepository as never, {} as never),
	PricePreferenceService: new PricePreferenceService(emptyRepository as never, {} as never)
});

describe('pricing — a row of another organization of the tenant', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('the read by id', () => {
		it.each(Object.keys(services()))('%s answers it as a miss', async (name) => {
			storedIn(OTHER_ORG);
			const service = (services() as Record<string, TenantAwareCrudService<any>>)[name];

			await expect(service.findOneByIdString('row')).rejects.toBeInstanceOf(NotFoundException);
		});

		it.each(Object.keys(services()))('%s still reads the caller’s own row', async (name) => {
			storedIn(ORG);
			const service = (services() as Record<string, TenantAwareCrudService<any>>)[name];

			await expect(service.findOneByIdString('row')).resolves.toMatchObject({ id: 'row', organizationId: ORG });
		});
	});

	describe('the writes that resolve the row first', () => {
		it('does not update another organization’s price', async () => {
			storedIn(OTHER_ORG, { productVariantId: 'variant', currency: 'USD', amount: '10.00' });
			const updated = stubWrites();

			await expect(
				services().ProductPriceService.updateOne('price', { amount: '1.00' } as never)
			).rejects.toBeInstanceOf(NotFoundException);
			expect(updated).not.toHaveBeenCalled();
		});

		it('does not update, activate or expire another organization’s price list', async () => {
			storedIn(OTHER_ORG, { name: 'Wholesale', code: 'WHOLESALE' });
			const updated = stubWrites();
			const lists = services().PriceListService;

			await expect(lists.updateOne('list', { priority: 3 })).rejects.toBeInstanceOf(NotFoundException);
			await expect(lists.activate('list')).rejects.toBeInstanceOf(NotFoundException);
			await expect(lists.expire('list')).rejects.toBeInstanceOf(NotFoundException);
			expect(updated).not.toHaveBeenCalled();
		});

		it('does not update another organization’s exchange rate or price preference', async () => {
			storedIn(OTHER_ORG, { fromCurrency: 'USD', toCurrency: 'EUR' });
			const updated = stubWrites();

			await expect(
				services().ExchangeRateService.updateOne('rate', { rate: '2' } as never)
			).rejects.toBeInstanceOf(NotFoundException);
			await expect(
				services().PricePreferenceService.updateOne('pref', { isTaxInclusive: true } as never)
			).rejects.toBeInstanceOf(NotFoundException);
			expect(updated).not.toHaveBeenCalled();
		});
	});

	describe('inCallerOrganization', () => {
		it('lets a row stored without an organization through, so an update can still repair it', () => {
			expect(inCallerOrganization({ organizationId: null }, ORG)).toEqual({ organizationId: null });
		});

		it('does not narrow a read with no organization in context', () => {
			expect(inCallerOrganization({ organizationId: OTHER_ORG }, null)).toEqual({ organizationId: OTHER_ORG });
		});

		it('answers another organization’s row with the inherited read’s own miss', () => {
			expect(() => inCallerOrganization({ organizationId: OTHER_ORG }, ORG)).toThrow(NotFoundException);
		});
	});
});
