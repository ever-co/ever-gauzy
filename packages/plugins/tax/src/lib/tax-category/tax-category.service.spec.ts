import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { TaxCategoryService } from './tax-category.service';

/**
 * Tax categories: the two invariants the service owns, and the read that has to clear a free code.
 *
 * `tax_category` is a taxonomy an accountant extends without a release, so the ordinary case for a
 * creation is a code nobody holds yet. The uniqueness rule therefore asks whether a code is *taken*,
 * and the read behind that question has to answer "this organization holds none" rather than raise:
 * the platform's `findOneByWhereOptions` raises when nothing matches, which is the opposite of what a
 * uniqueness check means, and a service written against it refuses every free code — the very case it
 * exists to allow. The suite pins both directions of the rule, on both write paths, against a double of
 * the repository that raises from `findOneByOrFail` exactly as the platform read does:
 *
 * - a category whose code is free is created, and stored with the trimmed code (`05` §6.1, `14` CE-118);
 * - a category whose code is already held in the organization is refused, and nothing is stored;
 * - the update path allows a row to keep its own code, including when the dialect's collation answers
 *   the lookup with the row being updated;
 * - the update path refuses a code that belongs to a *different* row of the organization.
 *
 * The service is constructed directly with an in-memory double of its repository. Nothing here touches
 * a database, a network or the wall clock.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';

/** One `tax_category` row, as the service reads and writes it. */
interface ICategoryRow {
	id: string;
	tenantId?: string;
	organizationId?: string;
	code: string;
	name?: string;
	description?: string;
	isDefault?: boolean;
}

/** A stored category of the fixture organization. */
const category = (overrides: Partial<ICategoryRow> & { id: string; code: string }): ICategoryRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	name: overrides.id,
	isDefault: false,
	...overrides
});

/**
 * Identifier-aware equality.
 *
 * Codes are compared the way the dialect compares them: MySQL's default collation is
 * case-insensitive, so a row holding `STANDARD` answers a lookup for `standard`. That is precisely why
 * the update path compares the row it found against the row it is updating before it refuses, and this
 * double reproduces it so the guard is exercised rather than assumed.
 */
function same(left: unknown, right: unknown, field?: string): boolean {
	const [a, b] =
		field === 'code'
			? [String(left ?? '').toLowerCase(), String(right ?? '').toLowerCase()]
			: [String(left ?? ''), String(right ?? '')];

	return a === b;
}

/**
 * @param row A stored row.
 * @param where The condition the service stated.
 * @returns Whether the database would have returned the row.
 */
function matches(row: object, where: Record<string, unknown> | undefined): boolean {
	const fields = row as Record<string, unknown>;

	return Object.entries(where ?? {}).every(([field, expected]) => {
		const value = fields[field];

		if (expected instanceof FindOperator) {
			switch (expected.type) {
				case 'in':
					return (expected.value as unknown[]).some((one) => same(one, value, field));
				case 'isNull':
					return value === null || value === undefined;
				default:
					throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}
		}

		return expected === undefined || same(expected, value, field);
	});
}

/**
 * @param categories The `tax_category` rows.
 * @returns The service and the table it writes to.
 */
function serviceUnderTest(categories: ICategoryRow[]) {
	const repository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			categories.filter((row) => matches(row, options?.where)),
		findOne: async (options?: { where?: Record<string, unknown> }) =>
			categories.filter((row) => matches(row, options?.where))[0] ?? null,
		/**
		 * The read the platform pairs with the fail-soft one: it raises when nothing matches, which is
		 * what made a free code impossible to create before the service stopped taking it.
		 */
		findOneByOrFail: async (where?: Record<string, unknown>) => {
			const row = categories.filter((one) => matches(one, where))[0];

			if (!row) {
				throw new Error('the platform read raises when nothing matches');
			}

			return row;
		},
		create: (partial: ICategoryRow) => ({ id: `category-${categories.length + 1}`, ...partial }),
		save: async (entity: ICategoryRow) => {
			categories.push(entity);

			return entity;
		},
		update: async (id: string, partial: Partial<ICategoryRow>) => {
			const row = categories.find((one) => same(one.id, id));

			if (row) {
				Object.assign(row, partial);
			}

			return { affected: 1 };
		}
	};

	return {
		categories,
		service: new TaxCategoryService(repository as never, {} as never)
	};
}

describe('TaxCategoryService.create — a free code is a category (05 §6.1, 14 CE-118)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates the category when no row of the organization holds the code', async () => {
		// The defect this pins: the read that asks whether the code is taken raised on the answer
		// "nobody holds it", so the first category of every organization was refused with a 404.
		const { service, categories } = serviceUnderTest([]);

		const created = await service.create({ name: 'Standard rate', code: 'STANDARD' } as never);

		expect(created.code).toBe('STANDARD');
		expect(created.organizationId).toBe(ORG);
		expect(categories.map((row) => `${row.code}:${row.name}`)).toEqual(['STANDARD:Standard rate']);
	});

	it('creates the category when the code is held by another organization only', async () => {
		// The uniqueness rule is per organization (`UQ_tax_category_org_code`), so a code another
		// organization uses is free here.
		const { service, categories } = serviceUnderTest([
			category({ id: 'category-other', code: 'STANDARD', organizationId: OTHER_ORG })
		]);

		const created = await service.create({ name: 'Standard rate', code: 'STANDARD' } as never);

		expect(created.organizationId).toBe(ORG);
		expect(categories).toHaveLength(2);
	});

	it('refuses a code another category of the organization already holds, and stores nothing', async () => {
		const { service, categories } = serviceUnderTest([category({ id: 'category-1', code: 'STANDARD' })]);

		await expect(service.create({ name: 'Standard again', code: 'STANDARD' } as never)).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(categories).toHaveLength(1);
	});

	it('refuses a code held in another case, because the dialect collation matches it', async () => {
		// The partial unique index compares under the dialect's collation, so a second row differing
		// only in case would be refused by the database anyway; the service says so first, with a
		// message an operator can act on.
		const { service, categories } = serviceUnderTest([category({ id: 'category-1', code: 'STANDARD' })]);

		await expect(service.create({ name: 'Standard again', code: ' standard ' } as never)).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(categories).toHaveLength(1);
	});

	it('requires a code, because the taxonomy is quoted by it', async () => {
		const { service } = serviceUnderTest([]);

		await expect(service.create({ name: 'Nameless' } as never)).rejects.toBeInstanceOf(BadRequestException);
	});
});

describe('TaxCategoryService.update — a row may keep its own code (05 §6.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('allows a row to keep its own code', async () => {
		const { service, categories } = serviceUnderTest([
			category({ id: 'category-1', code: 'STANDARD', name: 'Standard rate' })
		]);

		const updated = await service.update('category-1', { code: 'STANDARD', name: 'Standard rated' } as never);

		expect(updated.code).toBe('STANDARD');
		expect(updated.name).toBe('Standard rated');
		expect(categories.filter((row) => row.code === 'STANDARD')).toHaveLength(1);
	});

	it('allows a row whose own code the collation matches, because the row found is itself', async () => {
		// The lookup can answer with the row being updated — the dialect matches `standard` for
		// `STANDARD` — and that is not a clash with another row, which is what the comparison against
		// the updated id is for.
		const { service, categories } = serviceUnderTest([category({ id: 'category-1', code: 'STANDARD' })]);

		const updated = await service.update('category-1', { code: 'standard' } as never);

		expect(updated.code).toBe('standard');
		expect(categories).toHaveLength(1);
	});

	it('refuses a code that belongs to a different row of the organization', async () => {
		const { service, categories } = serviceUnderTest([
			category({ id: 'category-1', code: 'STANDARD' }),
			category({ id: 'category-2', code: 'BOOKS' })
		]);

		await expect(service.update('category-1', { code: 'BOOKS' } as never)).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(categories.map((row) => row.code)).toEqual(['STANDARD', 'BOOKS']);
	});

	it('renames a category onto a code nobody holds', async () => {
		const { service, categories } = serviceUnderTest([category({ id: 'category-1', code: 'STANDARD' })]);

		const updated = await service.update('category-1', { code: 'REDUCED' } as never);

		expect(updated.code).toBe('REDUCED');
		expect(categories).toHaveLength(1);
	});
});
