/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a collection service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the order and cart packages' service specs do, and **the service under test is the real
 * one**: only the base CRUD class, the request context and the entity base classes are substituted.
 *
 * The base-class double mirrors `CrudService` / `TenantAwareCrudService` where the behaviour is
 * observable to a caller: a lookup by a missing id raises `NotFoundException`, `create` answers with
 * the saved row, and `update` answers with TypeORM's `UpdateResult` — which is what the platform's
 * own `update` returns for the TypeORM branch, and what the case at the bottom of this file pins.
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

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { CollectionType, PublicationStatus } from '../catalog.types';
import { Collection } from './collection.entity';
import { CollectionService } from './collection.service';

/**
 * Collections and their tree.
 *
 * A collection is the catalogue's curated shelf: it carries an explicit membership order, a
 * publication window, its own per-channel publication rows and (when it is rule-based) a rule set —
 * which is exactly why it exists beside `tag` rather than as another label (doc 05 §4.3).
 *
 * The suite pins the properties the schema specification fixes, and nothing else:
 *
 * - a collection is created `MANUAL`, `DRAFT`, at sort order zero and unfeatured, and the change is
 *   announced with the identity a cached listing is invalidated by (doc 05 §4.3, doc 12);
 * - a customer-owned collection is a *saved list*: it may not carry rules, and its slug is unique
 *   inside that customer rather than inside the organization — so two shoppers may each keep a list
 *   called `wishlist` while the merchandising team may not also own one;
 * - a slug is unique in the scope it is claimed to be unique in, and a row does not collide with
 *   itself when it is updated in place;
 * - `parentId` makes the collection a tree, and **a collection may not become its own ancestor**:
 *   the move is refused before the closure table is rewritten, so the tree the ORM maintains is
 *   never left describing a cycle (doc 05 §4.3, §23 I-30).
 *
 * The closure table is a derived artefact the ORM owns and is deliberately not declared as an
 * entity, so the assertions below read the *behaviour* that depends on it — the stored parent chain
 * and the refusal of a cyclic move — rather than the table itself.
 *
 * The service is constructed directly with an in-memory double of its repository. The double states
 * the `where` the service states (equality, `null`, and the `Not` operator the slug guard builds) and
 * the `order` it asks for, because a double that returned every row regardless would make the slug
 * and organization cases below vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const CUSTOMER = '00000000-0000-4000-8000-000000000004';

/** The tables this package owns that this suite drives, as plain arrays. */
interface ITables {
	collection: any[];
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
	const matches = (row: any, where: any): boolean =>
		Object.entries(where ?? {}).every(([field, expected]) => {
			if (expected instanceof FindOperator) {
				if (expected.type === 'not') {
					return String(row[field] ?? '') !== String(expected.value ?? '');
				}

				throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}

			// A missing column and a null column are the same thing to the database, and TypeORM drops
			// an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});
	const sorted = (found: any[], order?: Record<string, 'ASC' | 'DESC'>) => {
		const columns = Object.keys(order ?? {});

		if (!columns.length) {
			return found;
		}

		return [...found].sort((left, right) => {
			for (const column of columns) {
				if (left[column] === right[column]) {
					continue;
				}

				const direction = order?.[column] === 'DESC' ? -1 : 1;
				const comparison = String(left[column] ?? '') > String(right[column] ?? '') ? 1 : -1;

				return comparison * direction;
			}

			return 0;
		});
	};

	return {
		rows,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => sorted(rows().filter((row) => matches(row, options.where)), options.order),
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

			// Generated ids carry an infix, so one can never collide with an id a fixture seeded.
			const created = { id: `${String(tableName)}-new-${++sequence}`, ...entity };

			rows().push(created);

			return created;
		},
		// The platform's `update` reaches TypeORM's own, which answers an `UpdateResult` and not the row.
		update: async (criteria: any, partial: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				rows().splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/** One `collection` row, as the service reads it. */
const collectionRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	name: `Collection ${id}`,
	slug: id,
	type: CollectionType.MANUAL,
	status: PublicationStatus.DRAFT,
	sortOrder: 0,
	isFeatured: false,
	...overrides
});

/**
 * Builds the collection service over one in-memory `collection` table.
 *
 * @param rows The collections the fixture starts with.
 */
function collectionFixture(rows: any[] = []) {
	const tables: ITables = { collection: [...rows] };
	const published: any[] = [];
	const eventBus = {
		publish: async (event: any) => {
			published.push(event);

			return event;
		}
	};
	const service = new CollectionService(
		repository(tables, 'collection') as never,
		{} as never,
		eventBus as never
	);

	return { service, tables, published, store: (id: string) => tables.collection.find((row) => row.id === id) };
}

/** The tree the cycle cases walk: `root` → `child` → `grandchild`. */
function treeFixture() {
	return collectionFixture([
		collectionRow('root'),
		collectionRow('child', { parentId: 'root' }),
		collectionRow('grandchild', { parentId: 'child' })
	]);
}

describe('CollectionService — creation and the slug scope (doc 05 §4.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates a merchandising collection with the documented defaults and announces it', async () => {
		const fixture = collectionFixture();

		const created = await fixture.service.create({ name: 'Summer', slug: 'summer', organizationId: ORG } as never);

		expect(created).toMatchObject({
			name: 'Summer',
			slug: 'summer',
			type: CollectionType.MANUAL,
			status: PublicationStatus.DRAFT,
			sortOrder: 0,
			isFeatured: false
		});

		// The change is announced with the identity a cached listing is invalidated by: the id, the
		// slug and the organization (doc 12 — `collection.created` / `collection.updated`).
		expect(fixture.published).toHaveLength(1);
		expect(fixture.published[0]).toMatchObject({
			collectionId: created.id,
			slug: 'summer',
			organizationId: ORG
		});
	});

	it('refuses a collection owned by a customer that is not a manual saved list', async () => {
		// A saved list is `MANUAL` by definition: its membership is what the shopper put in it, and a
		// rule-based row owned by a contact would be a list nobody could edit (doc 05 §4.3).
		const fixture = collectionFixture();

		await expect(
			fixture.service.create({
				name: 'Wishlist',
				slug: 'wishlist',
				customerId: CUSTOMER,
				type: CollectionType.RULE_BASED
			} as never)
		).rejects.toBeInstanceOf(BadRequestException);
		expect(fixture.tables.collection).toEqual([]);
	});

	it('refuses a slug already taken by another merchandising collection in the organization', async () => {
		const fixture = collectionFixture([collectionRow('taken', { slug: 'summer' })]);

		await expect(fixture.service.create({ name: 'Summer', slug: 'summer' } as never)).rejects.toThrow(
			/already exists in this scope/
		);
		expect(fixture.tables.collection).toHaveLength(1);
	});

	it('refuses a second saved list of the same slug for the same customer', async () => {
		// A saved list is scoped to its owner: `UQ_collection_customer_slug` claims `(customerId, slug)`,
		// so one shopper may not hold two lists of the same name.
		const fixture = collectionFixture([collectionRow('shopper-one', { slug: 'wishlist', customerId: CUSTOMER })]);

		await expect(
			fixture.service.create({ name: 'Wishlist', slug: 'wishlist', customerId: CUSTOMER } as never)
		).rejects.toThrow(/already exists in this scope/);
		expect(fixture.tables.collection).toHaveLength(1);
	});

	it('accepts the same slug in another organization', async () => {
		// Control: the merchandising scope is the organization, not the installation, so `summer` is a
		// fresh slug for the second organization and the first one's row is untouched.
		const fixture = collectionFixture([collectionRow('mine', { slug: 'summer' })]);

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);

		const created = await fixture.service.create({
			name: 'Summer',
			slug: 'summer',
			organizationId: OTHER_ORG
		} as never);

		expect(created.organizationId).toBe(OTHER_ORG);
		expect(fixture.tables.collection).toHaveLength(2);
	});

	it('accepts an update that keeps a collection’s own slug', async () => {
		// The guard excludes the row being written, so renaming a collection and re-stating its slug in
		// the same request cannot collide with itself.
		const fixture = collectionFixture([collectionRow('summer', { slug: 'summer' })]);

		await fixture.service.update('summer', { name: 'Summer 2026', slug: 'summer' } as never);

		expect(fixture.store('summer')).toMatchObject({ name: 'Summer 2026', slug: 'summer' });
	});

	it('refuses an update that claims another collection’s slug', async () => {
		const fixture = collectionFixture([
			collectionRow('summer', { slug: 'summer' }),
			collectionRow('winter', { slug: 'winter' })
		]);

		await expect(fixture.service.update('summer', { slug: 'winter' } as never)).rejects.toThrow(
			/already exists in this scope/
		);
		expect(fixture.store('summer')).toMatchObject({ slug: 'summer' });
	});

	it('reads a collection by slug inside the caller’s organization and nowhere else', async () => {
		const fixture = collectionFixture([
			collectionRow('mine', { slug: 'summer' }),
			collectionRow('theirs', { slug: 'summer', organizationId: OTHER_ORG })
		]);

		expect((await fixture.service.findBySlug('summer')).id).toBe('mine');

		// The organization is part of the read, not a filter the caller may forget: with another
		// organization in context the row above is simply not there.
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);

		expect((await fixture.service.findBySlug('summer')).id).toBe('theirs');
	});

	it('refuses a slug read with no organization in context and reports an unknown slug as missing', async () => {
		const fixture = collectionFixture([collectionRow('summer', { slug: 'summer' })]);

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);

		await expect(fixture.service.findBySlug('summer')).rejects.toBeInstanceOf(BadRequestException);

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);

		await expect(fixture.service.findBySlug('nope')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('CollectionService — the tree and the cycle refusal (doc 05 §4.3, §23 I-30)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('re-parents a collection and stores the new parent', async () => {
		const fixture = treeFixture();

		expect(fixture.store('child')).toMatchObject({ parentId: 'root' });

		await fixture.service.move('grandchild', 'root');

		expect(fixture.store('grandchild')).toMatchObject({ parentId: 'root' });
		// The move is announced once, after it was written.
		expect(fixture.published).toHaveLength(1);
	});

	it('makes a collection a root when it is moved to no parent', async () => {
		const fixture = treeFixture();

		await fixture.service.move('child', null);

		expect(fixture.store('child').parentId).toBeNull();
		// The child keeps its own child: lifting a subtree does not disturb what hangs below it.
		expect(fixture.store('grandchild')).toMatchObject({ parentId: 'child' });
	});

	it('refuses to make a collection its own parent', async () => {
		const fixture = treeFixture();

		await expect(fixture.service.move('child', 'child')).rejects.toBeInstanceOf(BadRequestException);
		expect(fixture.store('child')).toMatchObject({ parentId: 'root' });
		expect(fixture.published).toEqual([]);
	});

	it('refuses to move a collection under one of its own descendants and rewrites nothing', async () => {
		// The property the closure table would otherwise be left describing: moving `root` under
		// `grandchild` makes the ancestor chain a cycle, and the tree the ORM maintains is rewritten
		// only after the walk up from the new parent has cleared it.
		const fixture = treeFixture();

		await expect(fixture.service.move('root', 'grandchild')).rejects.toThrow(/descendants/);

		expect(fixture.store('root').parentId).toBeUndefined();
		expect(fixture.store('child')).toMatchObject({ parentId: 'root' });
		expect(fixture.store('grandchild')).toMatchObject({ parentId: 'child' });
		expect(fixture.published).toEqual([]);
	});

	it('refuses a move under a direct child as well as under a deeper descendant', async () => {
		const fixture = treeFixture();

		await expect(fixture.service.move('root', 'child')).rejects.toThrow(/descendants/);
		await expect(fixture.service.move('child', 'grandchild')).rejects.toThrow(/descendants/);
		expect(fixture.published).toEqual([]);
	});

	it('accepts a move under a sibling, which the walk up from the new parent does not refuse', async () => {
		// Control for the refusals above: `sibling` shares the ancestor `root` with `child`, and a guard
		// that asked "is the new parent in the same subtree as me" instead of "is the new parent below
		// me" would refuse this legal move. Sharing an ancestor is not ancestry.
		const fixture = collectionFixture([
			collectionRow('root'),
			collectionRow('child', { parentId: 'root' }),
			collectionRow('sibling', { parentId: 'root' })
		]);

		await fixture.service.move('child', 'sibling');

		expect(fixture.store('child')).toMatchObject({ parentId: 'sibling' });
		expect(fixture.published).toHaveLength(1);
	});
});

/**
 * The third clause of the visibility rule.
 *
 * A collection is visible on a channel only when its publication row is `ACTIVE`, its own `status` is
 * `ACTIVE` and its window contains the moment (doc 05 §4.3, §4.6). The window is the one clause that
 * is neither a row nor a column comparison but a boundary, so its two edges are pinned here: the
 * instant the window is the moment it opens, and the instant it is the moment it closes — doc 05 §4.3
 * states the window as "open when `startsAt` is null or past and `endsAt` is null or future", which
 * is why a closing bound is read as inclusive and an opening bound is not.
 */
describe('Collection — the window a shelf is live in (doc 05 §4.3, §4.6)', () => {
	const AT = new Date('2026-01-15T12:00:00.000Z');
	const CLOSES = new Date('2026-06-01T00:00:00.000Z');

	it('is in its window at the instant it opens and at the instant it closes', () => {
		const collection = Object.assign(new Collection(), { startsAt: AT, endsAt: CLOSES });

		expect(collection.isWithinWindow(AT)).toBe(true);
		expect(collection.isWithinWindow(new Date(CLOSES.getTime()))).toBe(true);
	});

	it('is out of its window one millisecond before it opens and one after it closes', () => {
		const collection = Object.assign(new Collection(), { startsAt: AT, endsAt: CLOSES });

		expect(collection.isWithinWindow(new Date(AT.getTime() - 1))).toBe(false);
		expect(collection.isWithinWindow(new Date(CLOSES.getTime() + 1))).toBe(false);
	});

	it('is always in its window when neither bound is stated, and open on the unstated side only', () => {
		const open = Object.assign(new Collection(), {});
		const opening = Object.assign(new Collection(), { startsAt: AT });
		const closing = Object.assign(new Collection(), { endsAt: CLOSES });

		expect(open.isWithinWindow(AT)).toBe(true);
		expect(open.isWithinWindow(new Date('2030-01-01T00:00:00.000Z'))).toBe(true);
		// An unstated bound is open, the other one still decides.
		expect(opening.isWithinWindow(new Date('2030-01-01T00:00:00.000Z'))).toBe(true);
		expect(opening.isWithinWindow(new Date(AT.getTime() - 1))).toBe(false);
		expect(closing.isWithinWindow(new Date('2020-01-01T00:00:00.000Z'))).toBe(true);
		expect(closing.isWithinWindow(new Date(CLOSES.getTime() + 1))).toBe(false);
	});
});

/**
 * The platform's `update` answers with TypeORM's `UpdateResult` for the TypeORM branch, which names
 * no row at all: `{ affected, raw, generatedMaps }`. Both `update` and `move` therefore read the row
 * the write produced and announce *that*, which is what the two cases below pin — the change is
 * written, and what a subscriber is told about it is the change, with the identity a cached listing
 * is invalidated by.
 */
describe('CollectionService — what a change is announced with (doc 12)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('writes the update to the row, whatever the answer of the write is', async () => {
		const fixture = collectionFixture([collectionRow('summer', { slug: 'summer' })]);

		await fixture.service.update('summer', { status: PublicationStatus.ACTIVE } as never);

		expect(fixture.store('summer')).toMatchObject({ status: PublicationStatus.ACTIVE });
	});

	// The identity the event carries — `collectionId`, `slug`, `organizationId` — is read off the row
	// the write produced, not off the write's own result: a subscriber cannot invalidate a listing the
	// event does not name.
	it('announces the collection it changed, so a subscriber can act on the event', async () => {
		const fixture = collectionFixture([collectionRow('summer', { slug: 'summer', name: 'Summer' })]);

		await fixture.service.update('summer', { name: 'Summer 2026' } as never);

		expect(fixture.published[0]).toMatchObject({
			collectionId: 'summer',
			slug: 'summer',
			organizationId: ORG
		});
	});
});
