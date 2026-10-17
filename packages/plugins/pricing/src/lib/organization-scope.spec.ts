import { BadRequestException } from '@nestjs/common';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { ExchangeRateService } from './exchange-rate/exchange-rate.service';
import { assertOrganizationUnchanged, organizationForCreate } from './organization-scope';
import { PriceListService } from './price-list/price-list.service';
import { PricePreferenceService } from './price-preference/price-preference.service';
import { PricePreferenceAttribute } from './pricing.types';

/**
 * R2-G31 / R2-G34 (pricing): the organization a pricing row is written into, and a priority's floor.
 *
 * - A price preference or an exchange rate created over GraphQL — whose input states no organization —
 *   was stored with `organizationId = NULL`, where no organization-scoped lookup reads it. The services
 *   now stamp the caller's organization on both protocols.
 * - A REST update could move a row into another organization (the update DTOs inherit
 *   `organizationId`); restating the row's own is accepted, anything else is refused.
 * - The REST price-list DTO floors `priority` at 0; the GraphQL `Int` did not, so the service does.
 *
 * Persistence is stubbed at the inherited CRUD service: what is under test is what these services
 * hand it, or refuse before they get there.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';

function stubPersistence() {
	const created = jest
		.spyOn(TenantAwareCrudService.prototype, 'create')
		.mockImplementation(async (entity) => ({ id: 'new', ...entity }) as never);
	const updated = jest
		.spyOn(TenantAwareCrudService.prototype, 'update')
		.mockImplementation(async () => ({ affected: 1 }) as never);

	return { created, updated };
}

/** A repository double whose look-ups find nothing, so the uniqueness checks pass. */
const emptyRepository = { findOne: async () => null, find: async () => [] };

describe('pricing — the organization a row is written into (R2-G31, R2-G34)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('the helpers', () => {
		it('stamps the caller’s organization when the payload states none', () => {
			expect(organizationForCreate({}, ORG, 'A row')).toBe(ORG);
		});

		it('refuses a payload that states another organization, or a create with none at all', () => {
			expect(() => organizationForCreate({ organizationId: OTHER_ORG }, ORG, 'A row')).toThrow(
				/PRICE_ORGANIZATION_MISMATCH/
			);
			expect(() => organizationForCreate({}, null, 'A row')).toThrow(/PRICE_ORGANIZATION_REQUIRED/);
		});

		it('accepts an update that restates the row’s own organization or states none', () => {
			expect(() => assertOrganizationUnchanged({}, ORG, ORG, 'A row')).not.toThrow();
			expect(() => assertOrganizationUnchanged({ organizationId: ORG }, ORG, ORG, 'A row')).not.toThrow();
		});

		it('refuses an update that moves the row, or clears its organization', () => {
			expect(() => assertOrganizationUnchanged({ organizationId: OTHER_ORG }, ORG, ORG, 'A row')).toThrow(
				/PRICE_ORGANIZATION_IMMUTABLE/
			);
			expect(() => assertOrganizationUnchanged({ organizationId: null }, ORG, ORG, 'A row')).toThrow(
				/PRICE_ORGANIZATION_IMMUTABLE/
			);
		});

		it('reads the organization relation as well as the column, on create and on update', () => {
			// The ORM writes `organization: { id }` as readily as `organizationId`, so a payload that moves the row
			// through the relation alone is refused too.
			expect(() => assertOrganizationUnchanged({ organization: { id: OTHER_ORG } }, ORG, ORG, 'A row')).toThrow(
				/PRICE_ORGANIZATION_IMMUTABLE/
			);
			expect(() => assertOrganizationUnchanged({ organization: { id: ORG } }, ORG, ORG, 'A row')).not.toThrow();
			expect(() => organizationForCreate({ organization: { id: OTHER_ORG } }, ORG, 'A row')).toThrow(
				/PRICE_ORGANIZATION_MISMATCH/
			);
		});

		it('lets a row stored without an organization be given the caller’s, and only the caller’s', () => {
			expect(() => assertOrganizationUnchanged({ organizationId: ORG }, null, ORG, 'A row')).not.toThrow();
			expect(() => assertOrganizationUnchanged({ organizationId: OTHER_ORG }, null, ORG, 'A row')).toThrow(
				/PRICE_ORGANIZATION_IMMUTABLE/
			);
		});
	});

	describe('PricePreferenceService', () => {
		it('stamps the caller’s organization on a preference whose input states none (GraphQL)', async () => {
			const { created } = stubPersistence();
			const service = new PricePreferenceService(emptyRepository as never, {} as never);

			await service.createOne({
				attribute: PricePreferenceAttribute.CURRENCY,
				value: 'usd',
				isTaxInclusive: true
			});

			expect(created).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORG, value: 'USD' }));
		});

		it('refuses an update that moves a preference into another organization', async () => {
			const { updated } = stubPersistence();
			const service = new PricePreferenceService(emptyRepository as never, {} as never);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue({ id: 'pref', organizationId: ORG } as never);

			await expect(service.updateOne('pref', { organizationId: OTHER_ORG })).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(updated).not.toHaveBeenCalled();
		});
	});

	describe('ExchangeRateService', () => {
		it('stamps the caller’s organization on a rate whose input states none (GraphQL)', async () => {
			const { created } = stubPersistence();
			const service = new ExchangeRateService(emptyRepository as never, {} as never);

			await service.createOne({
				fromCurrency: 'usd',
				toCurrency: 'eur',
				rate: '0.900000',
				validFrom: new Date('2026-01-01T00:00:00.000Z')
			});

			expect(created).toHaveBeenCalledWith(
				expect.objectContaining({ organizationId: ORG, fromCurrency: 'USD', toCurrency: 'EUR' })
			);
		});

		it('refuses an update that moves a rate into another organization', async () => {
			const { updated } = stubPersistence();
			const service = new ExchangeRateService(emptyRepository as never, {} as never);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue({
				id: 'rate',
				organizationId: ORG,
				fromCurrency: 'USD'
			} as never);

			await expect(service.updateOne('rate', { organizationId: OTHER_ORG })).rejects.toThrow(
				/PRICE_ORGANIZATION_IMMUTABLE/
			);
			expect(updated).not.toHaveBeenCalled();
		});
	});

	describe('PriceListService', () => {
		it('refuses a negative priority, which the GraphQL Int let through', async () => {
			const { created } = stubPersistence();
			const service = new PriceListService(emptyRepository as never, {} as never, {} as never);

			await expect(service.createOne({ name: 'Wholesale', code: 'WHOLESALE', priority: -1 })).rejects.toThrow(
				/PRICE_LIST_PRIORITY_INVALID/
			);
			expect(created).not.toHaveBeenCalled();
		});

		it('keeps a list in its own organization when it is updated from another one', async () => {
			const { updated } = stubPersistence();
			const service = new PriceListService(emptyRepository as never, {} as never, {} as never);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue({
				id: 'list',
				organizationId: OTHER_ORG,
				name: 'Wholesale',
				code: 'WHOLESALE'
			} as never);

			await service.updateOne('list', { priority: 3 });

			// `prepare` stamps the caller's organization; the write keeps the list's own.
			expect(updated).toHaveBeenCalledWith(
				'list',
				expect.objectContaining({ organizationId: OTHER_ORG, priority: 3 })
			);
		});
	});
});
