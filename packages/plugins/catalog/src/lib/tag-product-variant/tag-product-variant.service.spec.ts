/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a facet service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the order and cart packages' service specs do, and **the service under test is the real
 * one**: only the base CRUD class, the request context and the entity base classes are substituted.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async findOneByIdString(id: any, options: any = {}): Promise<any> {
			if (!id) {
				throw new NotFoundException('The requested record was not found');
			}

			const record = await this.typeOrmRepository.findOne({
				...options,
				where: { ...(options.where ?? {}), id }
			});

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async findOneByWhereOptions(where: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(where);

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			if (typeof id === 'string') {
				await this.findOneByIdString(id);
			}

			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}
	}

	return {
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		BaseEvent: class {},
		EventBus: class {},
		Product: class {},
		ProductVariant: class {},
		Tag: class {},
		ImageAsset: class {},
		OrganizationContact: class {},
		Warehouse: class {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { TagProductVariant } from './tag-product-variant.entity';
import { TagProductVariantService } from './tag-product-variant.service';

/**
 * Variant-level facets.
 *
 * A facet value is an ordinary `tag`; this pivot is what lets a *variant* carry one, which is what
 * makes "colour = red AND size = M" resolve to the M/red variant rather than to the product
 * (doc 05 §4.7). The suite pins the properties the schema fixes:
 *
 * - the pair is unique and the pivot has **no soft-delete column**, so removal is a hard delete: a
 *   soft-deleted join row would keep the facet attached as far as every existing tag query on the
 *   platform is concerned, and those queries do not know this table exists;
 * - replacing a variant's facets is a statement of the whole set: the pairs that are no longer
 *   requested are deleted and the new ones inserted inside one transaction, and a pair that is still
 *   requested keeps its row rather than being churned;
 * - a facet value listed twice in one request is refused, because two rows for one pair would make
 *   the intersection query below count it twice and drop the variant from its own answer;
 * - the intersection is an **AND**: a facet filter returns the variants that carry every requested
 *   value, not the union of them, and an empty request returns nothing rather than everything.
 *
 * The service is constructed directly with an in-memory double of its repository, wired to the
 * manager it writes through.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const VARIANT = '00000000-0000-4000-8000-000000000010';
const OTHER_VARIANT = '00000000-0000-4000-8000-000000000011';
const THIRD_VARIANT = '00000000-0000-4000-8000-000000000012';
const RED = '00000000-0000-4000-8000-000000000021';
const BLUE = '00000000-0000-4000-8000-000000000022';
const GREEN = '00000000-0000-4000-8000-000000000023';

/** The tables this suite drives, as plain arrays. */
interface ITables {
	tag_product_variant: any[];
}

/** One `tag_product_variant` row: a pair, and nothing else. */
const facetRow = (id: string, tagId: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	productVariantId: VARIANT,
	tagId,
	...overrides
});

/**
 * The manager double: the two statements the facet write issues, keyed by the entity they name.
 *
 * @param tables The whole datastore.
 * @param entityToTable The table each entity class writes.
 */
function manager(tables: ITables, entityToTable: Map<unknown, keyof ITables>) {
	let sequence = 0;
	const rows = (entity: unknown) => {
		const table = entityToTable.get(entity);

		if (!table) {
			throw new Error('the in-memory double was handed an entity it does not know');
		}

		return tables[table];
	};
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	/** The whole datastore, copied row by row, so a failed transaction can put it back. */
	const snapshot = () =>
		Object.fromEntries(
			Object.entries(tables).map(([table, tableRows]) => [table, tableRows.map((row) => ({ ...row }))])
		);
	const restore = (copy: Record<string, any[]>) => {
		for (const [table, tableRows] of Object.entries(copy)) {
			(tables as unknown as Record<string, any[]>)[table] = tableRows;
		}
	};

	const writeManager: any = {
		rows,
		/**
		 * The transaction the write path asks for: the callback sees the same datastore, and a throw
		 * from anywhere inside it leaves the datastore exactly as it was — which is the property every
		 * "nothing was written" assertion below depends on.
		 */
		transaction: async (run: (manager: any) => Promise<any>) => {
			const copy = snapshot();

			try {
				return await run(writeManager);
			} catch (error) {
				restore(copy);
				throw error;
			}
		},
		create: (entity: unknown, partial: any) => ({ ...partial }),
		save: async (entity: unknown, row: any) => {
			const table = rows(entity);
			const index = table.findIndex((candidate) => same(candidate.id, row.id));

			if (index >= 0) {
				table[index] = { ...table[index], ...row };

				return table[index];
			}

			table.push(row);

			return row;
		},
		insert: async (entity: unknown, partial: any) => {
			rows(entity).push({ id: `inserted-${++sequence}`, ...partial });

			return partial;
		},
		update: async (entity: unknown, id: unknown, patch: any) => {
			const row = rows(entity).find((candidate: any) => same(candidate.id, id));

			if (row) {
				Object.assign(row, patch);
			}

			return { affected: row ? 1 : 0 };
		},
		delete: async (entity: unknown, criteria: unknown) => {
			const ids = Array.isArray(criteria) ? criteria : [criteria];
			const table = rows(entity);
			let affected = 0;

			for (const id of ids) {
				const index = table.findIndex((candidate: any) => same(candidate.id, id));

				if (index >= 0) {
					table.splice(index, 1);
					affected += 1;
				}
			}

			return { affected };
		}
	};

	return writeManager;
}

/**
 * An in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 * @param writeManager The manager the service reaches through `repository.manager`.
 */
function repository(tables: ITables, tableName: keyof ITables, writeManager: any) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const matches = (row: any, where: any): boolean =>
		Object.entries(where ?? {}).every(([field, expected]) => {
			if (expected instanceof FindOperator) {
				if (expected.type === 'not') {
					return String(row[field] ?? '') !== String(expected.value ?? '');
				}

				throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}

			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});

	return {
		rows,
		manager: writeManager,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => rows().filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) => rows().find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: any) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => rows().length,
		create: (partial: any) => ({ ...partial }),
		save: async (entity: any) => {
			if (entity.id) {
				const index = rows().findIndex((row) => row.id === entity.id);

				if (index >= 0) {
					rows()[index] = { ...rows()[index], ...entity };

					return rows()[index];
				}
			}

			const created = { id: `${String(tableName)}-new-${++sequence}`, ...entity };

			rows().push(created);

			return created;
		},
		update: async (criteria: any, partial: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		// TypeORM's `delete` takes an id or a `where` object, and the facet pivot is removed by its
		// pair rather than by its surrogate id.
		delete: async (criteria: any) => {
			const isCriteriaObject = criteria && typeof criteria === 'object' && !Array.isArray(criteria);
			const byId =
				typeof criteria === 'string' || (isCriteriaObject && criteria.id !== undefined)
					? [typeof criteria === 'string' ? criteria : criteria.id]
					: null;
			let affected = 0;

			for (let index = rows().length - 1; index >= 0; index--) {
				const row = rows()[index];
				const doomed = byId ? byId.some((id) => String(row.id) === String(id)) : matches(row, criteria);

				if (doomed) {
					rows().splice(index, 1);
					affected += 1;
				}
			}

			return { affected };
		}
	};
}

/**
 * Builds the facet service over one in-memory `tag_product_variant` table.
 *
 * @param rows The facet rows the fixture starts with.
 */
function facetFixture(rows: any[] = []) {
	const tables: ITables = { tag_product_variant: [...rows] };
	const entityToTable = new Map<unknown, keyof ITables>([[TagProductVariant, 'tag_product_variant']]);
	const writeManager = manager(tables, entityToTable);
	const service = new TagProductVariantService(
		repository(tables, 'tag_product_variant', writeManager) as never,
		{} as never
	);
	/** The facet values of one variant, as the service answers them. */
	const facetsOf = (variantId: string = VARIANT) =>
		tables.tag_product_variant.filter((row) => row.productVariantId === variantId).map((row) => row.tagId);

	return { service, tables, facetsOf };
}

describe('TagProductVariantService — variant facets (doc 05 §4.7)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('attaches a facet value to a variant and reports it', async () => {
		const fixture = facetFixture();

		const facets = await fixture.service.replaceTags(VARIANT, [RED]);

		expect(facets.map((row) => row.tagId)).toEqual([RED]);
		expect(facets[0]).toMatchObject({ productVariantId: VARIANT, organizationId: ORG });
	});

	it('attaches a facet that is already attached as the one pair it is', async () => {
		const fixture = facetFixture();

		await fixture.service.replaceTags(VARIANT, [RED, BLUE]);
		const again = await fixture.service.replaceTags(VARIANT, [RED, BLUE]);

		expect(fixture.tables.tag_product_variant).toHaveLength(2);
		expect(again.map((row) => row.tagId).sort()).toEqual([RED, BLUE].sort());
	});

	it('keeps the rows of the facets that are still requested, so a repeated write does not churn them', async () => {
		// Stability: replacing a variant's facets with the set it already carries is not a delete and a
		// re-insert, so a row that already recorded the attachment keeps its identity.
		const fixture = facetFixture();

		const first = await fixture.service.replaceTags(VARIANT, [RED, BLUE]);
		const second = await fixture.service.replaceTags(VARIANT, [BLUE, RED]);

		expect(second.map((row) => row.id).sort()).toEqual(first.map((row) => row.id).sort());
		expect(fixture.tables.tag_product_variant).toHaveLength(2);
	});

	it('refuses the same facet value twice in one request', async () => {
		// Two rows for one pair would be counted twice by the intersection query below, and a variant
		// would then fail to match the very filter it satisfies.
		const fixture = facetFixture();

		await expect(fixture.service.replaceTags(VARIANT, [RED, BLUE, RED])).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(fixture.tables.tag_product_variant).toEqual([]);
	});

	it('replaces the set, removing the facet values that are no longer requested', async () => {
		const fixture = facetFixture();

		await fixture.service.replaceTags(VARIANT, [RED, BLUE, GREEN]);
		const replaced = await fixture.service.replaceTags(VARIANT, [GREEN, RED]);

		expect(replaced.map((row) => row.tagId).sort()).toEqual([RED, GREEN].sort());
		expect(fixture.facetsOf()).not.toContain(BLUE);
		expect(fixture.tables.tag_product_variant).toHaveLength(2);
	});

	it('detaches one facet value as a hard delete of the pair', async () => {
		// The pivot has no soft-delete column of its own: a soft-deleted join row would keep the facet
		// attached as far as every existing tag query is concerned, and those queries do not know this
		// table exists (doc 05 §4.7).
		const fixture = facetFixture();

		await fixture.service.replaceTags(VARIANT, [RED, BLUE]);
		await fixture.service.detach(VARIANT, RED);

		expect(fixture.facetsOf()).toEqual([BLUE]);
		expect(fixture.tables.tag_product_variant).toHaveLength(1);
		expect(fixture.tables.tag_product_variant[0].deletedAt).toBeUndefined();
	});

	it('detaches a facet value the variant does not carry without disturbing the ones it does', async () => {
		// The delete names a pair, so it is idempotent: asking for a pair that is not there is not a
		// miss to report — it is the state the caller asked for — but it must not take anything else
		// with it, which is what addressing the pair rather than the variant is for.
		const fixture = facetFixture();

		await fixture.service.replaceTags(VARIANT, [RED, BLUE]);
		await fixture.service.detach(VARIANT, GREEN);
		await fixture.service.detach(OTHER_VARIANT, RED);

		expect(fixture.facetsOf()).toEqual([RED, BLUE]);
		expect(fixture.facetsOf(OTHER_VARIANT)).toEqual([]);
	});

	it('lists the variants carrying every requested facet value, not the union of them', async () => {
		// The AND is what a buyer means by "red and M": a union would offer a blue variant to somebody
		// who asked for red, which is a facet filter that does not filter.
		const fixture = facetFixture([
			facetRow('v1-red', RED, { productVariantId: VARIANT }),
			facetRow('v1-blue', BLUE, { productVariantId: VARIANT }),
			facetRow('v2-red', RED, { productVariantId: OTHER_VARIANT }),
			facetRow('v3-blue', BLUE, { productVariantId: THIRD_VARIANT }),
			facetRow('v3-green', GREEN, { productVariantId: THIRD_VARIANT })
		]);

		expect(await fixture.service.findVariantsWithAllTags([RED, BLUE])).toEqual([VARIANT]);
		// Control: the union of the two values would be all three variants, and a single value is not
		// narrowed into an intersection either.
		expect(await fixture.service.findVariantsWithAllTags([RED])).toEqual(
			expect.arrayContaining([VARIANT, OTHER_VARIANT])
		);
		expect(await fixture.service.findVariantsWithAllTags([RED, GREEN])).toEqual([]);
	});

	it('answers an empty facet request with nothing rather than with every variant', async () => {
		const fixture = facetFixture([facetRow('v1-red', RED), facetRow('v1-blue', BLUE)]);

		expect(await fixture.service.findVariantsWithAllTags([])).toEqual([]);
	});

	it('scopes the facets it reads and intersects to the caller’s organization', async () => {
		const fixture = facetFixture([
			facetRow('mine-red', RED),
			facetRow('mine-blue', BLUE),
			facetRow('theirs-red', RED, { organizationId: OTHER_ORG }),
			facetRow('theirs-blue', BLUE, { organizationId: OTHER_ORG }),
			facetRow('another-variant', RED, { productVariantId: OTHER_VARIANT })
		]);

		const facets = await fixture.service.findByVariant(VARIANT);

		expect(facets.map((row) => row.id)).toEqual(['mine-red', 'mine-blue']);
		// The intersecting read is organization-scoped too: the other organization's complete pair must
		// not make its variant answer a filter asked inside this one.
		expect(await fixture.service.findVariantsWithAllTags([RED, BLUE])).toEqual([VARIANT]);
	});
});
