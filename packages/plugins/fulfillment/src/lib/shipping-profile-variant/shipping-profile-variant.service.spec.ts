/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which an attachment row needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary, exactly as the
 * sibling packages' service specs do, and **the service under test is the real one**: only the CRUD
 * base class, the request context and the entity base classes are substituted.
 *
 * The base-class double mirrors `CrudService` / `TenantAwareCrudService` where the behaviour is
 * observable to a caller: `findAll` answers `{ items, total }`, `find` answers the rows the `where`
 * selects, `update` answers TypeORM's `UpdateResult` after loading the row, `delete` answers the
 * number of rows it removed, and a lookup by an id that matches nothing raises `NotFoundException`
 * rather than answering `null` (`packages/core/src/lib/core/crud/crud.service.ts`, line 409).
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

import { NotFoundException } from '@nestjs/common';
import { ShippingProfileVariantService } from './shipping-profile-variant.service';

/**
 * The variant-to-profile attachments.
 *
 * This service overrides nothing: it is the declared pivot's CRUD surface, and saying so is the point
 * of the suite. The pivot is a declared entity rather than an ORM-managed join table, because it is a
 * real row with its own tenancy and audit columns and because a reassignment is an auditable event
 * (doc 09 §12.1). What that means for a test is that the behaviour worth pinning is not a rule this
 * class holds but the **storage contract its two callers depend on**:
 *
 * - a row is one `(profileId, variantId)` pair, and it is written as it was given — the pivot carries
 *   no shipping behaviour of its own, so nothing about how a variant ships is copied into it;
 * - the pair is what the profile service reads back when it answers with the attachments a profile
 *   holds, and the variant is what it reads back when it resolves which profile a variant ships under;
 * - **a variant belongs to at most one profile** — the rule the migration expresses twice
 *   (`UQ_shipping_profile_variant` on the pair and `UQ_shipping_profile_variant_one` on `variantId`
 *   alone) and which `ShippingProfileService.assignVariants` holds by *moving* an attachment rather
 *   than inserting a second one. This class deliberately adds no guard of its own, so the suite pins
 *   what it does store and where the rule actually lives, rather than a refusal that does not exist;
 * - a detach is a delete by id, and deleting a row that is already gone is not an error — which is what
 *   makes a reassignment safe to submit twice.
 *
 * The service is constructed directly with an in-memory double of its repository, which states the
 * `where` the service states (the profile, the variant, the id) because a double that matched every
 * row regardless would make the reads below vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const COLD = '00000000-0000-4000-8000-0000000000f1';
const BULK = '00000000-0000-4000-8000-0000000000f2';
const VARIANT_A = '00000000-0000-4000-8000-0000000000a1';
const VARIANT_B = '00000000-0000-4000-8000-0000000000b1';
const VARIANT_C = '00000000-0000-4000-8000-0000000000c1';
const UNKNOWN = '00000000-0000-4000-8000-0000000000ff';

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	shipping_profile_variant: Row[];
}

/**
 * An in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 */
function repository(tables: ITables, tableName: keyof ITables) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			// TypeORM drops an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return same(row[field], expected);
		});

	return {
		rows,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: Row = {}) => rows().filter((row) => matches(row, options.where)),
		findOne: async (options: Row = {}) => rows().find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: Row) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: Row = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => rows().length,
		create: (partial: Row) => ({ ...partial }),
		save: async (entity: Row) => {
			if (entity.id) {
				const index = rows().findIndex((row) => same(row.id, entity.id));

				if (index >= 0) {
					rows()[index] = { ...rows()[index], ...entity };

					return rows()[index];
				}
			}

			const created = { id: `${String(tableName)}-new-${++sequence}`, ...entity };

			rows().push(created);

			return created;
		},
		// The platform's `update` reaches TypeORM's own, which answers an `UpdateResult` and not the row.
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => same(row.id, id));

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => same(row.id, id));

			if (index >= 0) {
				rows().splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/** One `shipping_profile_variant` row, as a settled part of the fixture. */
const attachment = (id: string, profileId: string, variantId: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	profileId,
	variantId,
	...overrides
});

/**
 * Builds the pivot service over one in-memory `shipping_profile_variant` table.
 *
 * @param rows The attachments the fixture starts with.
 */
function pivotFixture(rows: Row[] = []) {
	const tables: ITables = { shipping_profile_variant: [...rows] };
	const service = new ShippingProfileVariantService(repository(tables, 'shipping_profile_variant') as never, {} as never);

	return {
		service,
		tables,
		rows: () => tables.shipping_profile_variant,
		row: (id: string) => tables.shipping_profile_variant.find((row) => row.id === id),
		attachmentsOf: (profileId: string) =>
			tables.shipping_profile_variant.filter((row) => row.profileId === profileId),
		profileOf: (variantId: string) =>
			tables.shipping_profile_variant.filter((row) => row.variantId === variantId)
	};
}

describe('ShippingProfileVariantService — what an attachment stores (doc 09 §12.1)', () => {
	it('writes the pair it was handed and answers with the row it wrote', async () => {
		const fixture = pivotFixture();

		const created = await fixture.service.create({ profileId: COLD, variantId: VARIANT_A } as never);

		expect(created).toMatchObject({ profileId: COLD, variantId: VARIANT_A });
		expect(created.id).toBeDefined();
		expect(fixture.row(created.id)).toMatchObject({ profileId: COLD, variantId: VARIANT_A });
	});

	it('stores an attachment and not a copy of the profile it points at', async () => {
		// The pivot is two identifiers and a payload. How a variant ships — its options, its weight
		// rules, its handling time — is read through the profile, so a pivot that copied any of it would
		// be a second answer that could drift from the first.
		const fixture = pivotFixture();

		const created = await fixture.service.create({ profileId: COLD, variantId: VARIANT_A } as never);

		expect(Object.keys(fixture.row(created.id)).sort()).toEqual(['id', 'profileId', 'variantId']);
	});

	it('keeps the per-attachment payload a caller wrote on it', async () => {
		// The row is where a per-attachment exception lives, which is why it is a declared entity with a
		// payload rather than a bare join table.
		const fixture = pivotFixture();

		const created = await fixture.service.create({
			profileId: COLD,
			variantId: VARIANT_A,
			metadata: { handlingDays: 2, note: 'ships from the cold room' }
		} as never);

		expect(created.metadata).toEqual({ handlingDays: 2, note: 'ships from the cold room' });
	});

	it('reads back every attachment of one profile, which is what an assignment answers with', async () => {
		const fixture = pivotFixture([
			attachment('link-a', COLD, VARIANT_A),
			attachment('link-b', COLD, VARIANT_B),
			attachment('link-c', BULK, VARIANT_C)
		]);

		const page = await fixture.service.findAll({ where: { profileId: COLD } } as never);

		expect(page.items.map((row: Row) => row.variantId).sort()).toEqual([VARIANT_A, VARIANT_B].sort());
		expect(page.total).toBe(2);
	});

	it('reads back the attachment of one variant, which is what resolution is decided by', async () => {
		const fixture = pivotFixture([
			attachment('link-a', COLD, VARIANT_A),
			attachment('link-c', BULK, VARIANT_C)
		]);

		const page = await fixture.service.findAll({ where: { variantId: VARIANT_C } } as never);

		expect(page.items).toHaveLength(1);
		expect(page.items[0]).toMatchObject({ profileId: BULK, variantId: VARIANT_C });
	});

	it('answers an empty page for a variant that is attached to nothing', async () => {
		// A variant with no attachment falls back to the organization's default profile, so "no rows"
		// has to be an answer the caller can read rather than an error.
		const fixture = pivotFixture([attachment('link-a', COLD, VARIANT_A)]);

		const page = await fixture.service.findAll({ where: { variantId: VARIANT_B } } as never);

		expect(page).toEqual({ items: [], total: 0 });
	});

	it('answers the attachments in the order they were written', async () => {
		// Row order is what decides which attachment a resolution reads first, which is exactly why the
		// table carries the index that makes a second attachment for one variant impossible.
		const fixture = pivotFixture([
			attachment('link-one', COLD, VARIANT_B),
			attachment('link-two', BULK, VARIANT_B)
		]);

		const page = await fixture.service.findAll({ where: { variantId: VARIANT_B } } as never);

		expect(page.items.map((row: Row) => row.id)).toEqual(['link-one', 'link-two']);
	});

	it('writes what it is asked for, because the one-profile rule is the caller’s and the indexes’', async () => {
		// Stated rather than assumed: this class adds no uniqueness guard. Two rows for one variant are
		// what a direct call stores, and the invariant is held by the partial unique index on
		// `variantId` alone in the migration plus the profile service's decision to *move* an attachment
		// instead of inserting one. A caller that went around the profile service would be caught by the
		// index and by the nightly schema audit, not here.
		const fixture = pivotFixture([attachment('link-cold', COLD, VARIANT_A)]);

		await fixture.service.create({ profileId: BULK, variantId: VARIANT_A } as never);

		expect(fixture.profileOf(VARIANT_A)).toHaveLength(2);
		expect(fixture.profileOf(VARIANT_A).map((row) => row.profileId)).toEqual([COLD, BULK]);
	});
});

describe('ShippingProfileVariantService — the surface a reassignment is written through', () => {
	it('writes an update and answers with the update result, not with the row', async () => {
		const fixture = pivotFixture([attachment('link-a', COLD, VARIANT_A)]);

		const answered = await fixture.service.update('link-a', { metadata: { handlingDays: 3 } } as never);

		expect(answered).toMatchObject({ affected: 1 });
		expect(fixture.row('link-a').metadata).toEqual({ handlingDays: 3 });
	});

	it('refuses an update on an attachment that is not there', async () => {
		const fixture = pivotFixture();

		await expect(fixture.service.update(UNKNOWN, { profileId: COLD } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
	});

	it('deletes exactly the attachment it names, which is how a variant is moved', async () => {
		const fixture = pivotFixture([
			attachment('link-a', COLD, VARIANT_A),
			attachment('link-b', COLD, VARIANT_B)
		]);

		await fixture.service.delete('link-a');

		expect(fixture.row('link-a')).toBeUndefined();
		expect(fixture.attachmentsOf(COLD)).toHaveLength(1);
		expect(fixture.row('link-b')).toBeDefined();
	});

	it('answers a delete of an attachment that is already gone with nothing affected', async () => {
		// What makes a reassignment safe to submit twice: the second detach finds nothing, says so, and
		// the caller's next step is the insert that is already there.
		const fixture = pivotFixture([attachment('link-a', COLD, VARIANT_A)]);

		await expect(fixture.service.delete('link-a')).resolves.toMatchObject({ affected: 1 });
		await expect(fixture.service.delete('link-a')).resolves.toMatchObject({ affected: 0 });
		expect(fixture.rows()).toEqual([]);
	});

	it('answers a page with its total for the read its caller unwraps', async () => {
		const fixture = pivotFixture([
			attachment('link-a', COLD, VARIANT_A),
			attachment('link-b', COLD, VARIANT_B)
		]);

		const page = await fixture.service.findAll({ where: { profileId: COLD } } as never);

		expect(Object.keys(page).sort()).toEqual(['items', 'total']);
		expect(page.total).toBe(2);
	});
});
