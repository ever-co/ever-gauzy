import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';
import { PromotionService } from './promotion.service';
import { PromotionStatus, PromotionType } from '../promotion.types';

/**
 * R2-G27: the counters of a promotion move with its usage ledger only, and a code is stored one way.
 *
 * `POST /promotions` and `PUT /promotions/:id` take the create shape as their body, so they accepted `usageCount` and
 * `budgetSpent`: a used-up limit or a spent inline budget was reset with `{"usageCount":0}`, and a promotion could be
 * created already "used". `updatePromotion` (both surfaces) also wrote a changed `code` as typed - lower-case, or
 * the code of another promotion of the organization - while `createPromotion` normalises it and checks it is free.
 *
 * The service is built over an in-memory table that honours the `where` it is handed; its other collaborators are
 * never reached by these writes.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const SIBLING_ORG = '00000000-0000-4000-8000-0000000000ff';

type Row = Record<string, any>;

function matches(row: Row, where: Row = {}): boolean {
	return Object.entries(where).every(
		([field, expected]) => expected === undefined || String(row[field] ?? '') === String(expected ?? '')
	);
}

function promotionsOver(rows: Row[]) {
	const repository = {
		findOneBy: async (where?: Row) => rows.find((row) => matches(row, where)) ?? null,
		create: (partial: Row) => ({ id: `promo-${rows.length + 1}`, ...partial }),
		save: async (entity: Row) => {
			rows.push(entity);

			return entity;
		},
		update: async (criteria: Row, partial: Row) => {
			const matched = rows.filter((row) => matches(row, criteria));

			matched.forEach((row) => Object.assign(row, partial));

			return { affected: matched.length, raw: [], generatedMaps: [] };
		}
	};
	const service = new PromotionService(
		repository as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{ publish: async () => undefined } as never
	);

	Object.defineProperty(service, 'ormType', { get: () => 'typeorm' });

	return { rows, service };
}

const stored = (overrides: Row = {}): Row => ({
	id: 'promo-1',
	tenantId: TENANT,
	organizationId: ORG,
	title: 'Spring',
	code: 'SPRING10',
	type: PromotionType.STANDARD,
	status: PromotionStatus.ACTIVE,
	usageLimit: 100,
	usageCount: 100,
	budgetAmount: '500.000000',
	budgetSpent: '500.000000',
	...overrides
});

describe('PromotionService — the counters are not written from a body (R2-G27)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses to reset a used-up limit or a spent budget, and writes nothing', async () => {
		const { service, rows } = promotionsOver([stored()]);

		await expect(service.updatePromotion('promo-1', { usageCount: 0 } as never)).rejects.toMatchObject({
			response: {
				code: 'PROMOTION_FIELD_NOT_WRITABLE',
				details: { promotionId: 'promo-1', fields: ['usageCount'] }
			}
		});
		await expect(
			service.updatePromotion('promo-1', { title: 'Reopened', budgetSpent: '0' } as never)
		).rejects.toMatchObject({
			response: { code: 'PROMOTION_FIELD_NOT_WRITABLE', details: { fields: ['budgetSpent'] } }
		});

		expect(rows[0]).toMatchObject({ title: 'Spring', usageCount: 100, budgetSpent: '500.000000' });
	});

	it('accepts a body that restates the counters, and writes the rest', async () => {
		const { service, rows } = promotionsOver([stored()]);

		await service.updatePromotion('promo-1', { title: 'Summer', usageCount: 100, budgetSpent: '500' } as never);

		expect(rows[0]).toMatchObject({ title: 'Summer', usageCount: 100, budgetSpent: '500.000000' });
	});

	it('refuses to create a promotion already used, and creates one whose body restates zero', async () => {
		const { service, rows } = promotionsOver([]);

		await expect(service.createPromotion({ title: 'Used', usageCount: 7 } as never)).rejects.toMatchObject({
			response: { code: 'PROMOTION_FIELD_NOT_WRITABLE', details: { fields: ['usageCount'] } }
		});
		await expect(
			service.createPromotion({ title: 'Spent', budgetAmount: '100', budgetSpent: '100' } as never)
		).rejects.toBeInstanceOf(BadRequestException);
		expect(rows).toHaveLength(0);

		// The REST create DTO defaults `usageCount` to 0, so every REST create restates it.
		await service.createPromotion({ title: 'Fresh', usageCount: 0, budgetSpent: '0.000000' } as never);

		expect(rows).toHaveLength(1);
		expect(rows[0].usageCount).toBeUndefined();
		expect(rows[0].budgetSpent).toBeUndefined();
	});
});

describe('PromotionService.updatePromotion — a changed code is stored as a create stores it (R2-G27)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('normalises the code, and refuses one another promotion of the organization holds', async () => {
		const { service, rows } = promotionsOver([
			stored(),
			stored({ id: 'promo-2', code: 'SUMMER10' }),
			stored({ id: 'promo-3', code: 'AUTUMN10', organizationId: SIBLING_ORG })
		]);

		await expect(service.updatePromotion('promo-1', { code: 'summer10' } as never)).rejects.toThrow(
			/PROMOTION_ALREADY_APPLIED/
		);
		expect(rows[0].code).toBe('SPRING10');

		// A code a sibling organization holds is free in this one, as it is on create.
		await service.updatePromotion('promo-1', { code: ' autumn10 ' } as never);
		expect(rows[0].code).toBe('AUTUMN10');

		// Its own code, restated in another case, is not a clash with itself.
		await service.updatePromotion('promo-1', { code: 'Autumn10' } as never);
		expect(rows[0].code).toBe('AUTUMN10');
	});

	it('clears the code on null or blank', async () => {
		const { service, rows } = promotionsOver([stored()]);

		await service.updatePromotion('promo-1', { code: '  ' } as never);

		expect(rows[0].code).toBeNull();
	});

	it('answers 404 for a promotion of a sibling organization', async () => {
		const { service, rows } = promotionsOver([stored({ organizationId: SIBLING_ORG })]);

		await expect(service.updatePromotion('promo-1', { code: 'NEW' } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(rows[0].code).toBe('SPRING10');
	});
});
