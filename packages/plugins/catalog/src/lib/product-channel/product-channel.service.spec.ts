/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a publication service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the order and cart packages' service specs do, and **the service under test is the real
 * one**: only the base CRUD class, the request context, the event base class and the entity base
 * classes are substituted.
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
import { PublicationStatus } from '../catalog.types';
import { ProductChannel } from './product-channel.entity';
import { ProductChannelService } from './product-channel.service';

/**
 * Publication of products on channels.
 *
 * Publication is per channel and is the gate the catalogue listing query applies, so this suite pins
 * the four statements the schema specification makes about it (doc 05 §4.1, §23 I-24):
 *
 * - there is **one row per `(product, channel)`**: publishing the same pair twice is one row, not a
 *   second row the listing query would have to de-duplicate;
 * - `publishedAt` is stamped on the **first** transition to `ACTIVE` and never cleared — so the
 *   answer to "when did this listing first go live" survives a withdrawal and a republication;
 * - `unpublishedAt` is non-null exactly while the row is not `ACTIVE`, and a withdrawal **retains**
 *   the row: the publication history of a product is queryable after it was pulled;
 * - a change names at least one channel, and each named channel is stamped and announced on its own,
 *   because the pair is the identity of a publication and "the product changed" would not say which
 *   listing a subscriber has to refresh.
 *
 * The service is constructed directly with an in-memory double of its repository, wired to the
 * manager it writes through. The double states the `where` and the `order` the service states, so a
 * read that stopped narrowing or ordering is caught here rather than accommodated.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const PRODUCT = '00000000-0000-4000-8000-000000000010';
const CHANNEL_WEB = '00000000-0000-4000-8000-000000000020';
const CHANNEL_MARKETPLACE = '00000000-0000-4000-8000-000000000021';

/** The programme's frozen instants: nothing here may depend on the wall clock. */
const FIRST = new Date('2026-01-15T12:00:00.000Z');
const SECOND = new Date('2026-03-01T09:30:00.000Z');
const THIRD = new Date('2026-06-01T00:00:00.000Z');

/** The tables this suite drives, as plain arrays. */
interface ITables {
	product_channel: any[];
}

/** One `product_channel` row. */
const publicationRow = (id: string, channelId: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	productId: PRODUCT,
	channelId,
	status: PublicationStatus.DRAFT,
	sortOrder: 0,
	isFeatured: false,
	...overrides
});

/**
 * The manager double: the two statements the publication write issues, keyed by the entity they name.
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

				return (left[column] > right[column] ? 1 : -1) * direction;
			}

			return 0;
		});
	};

	return {
		rows,
		manager: writeManager,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => sorted(rows().filter((row) => matches(row, options.where)), options.order),
		findOne: async (options: any = {}) => {
			const [row] = sorted(rows().filter((candidate) => matches(candidate, options.where)), options.order);

			return row ?? null;
		},
		findOneBy: async (where: any) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async (options: any = {}) => rows().filter((row) => matches(row, options?.where)).length,
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

/**
 * Builds the publication service over one in-memory `product_channel` table.
 *
 * @param rows The publication rows the fixture starts with.
 */
function publicationFixture(rows: any[] = []) {
	const tables: ITables = { product_channel: [...rows] };
	const entityToTable = new Map<unknown, keyof ITables>([[ProductChannel, 'product_channel']]);
	const writeManager = manager(tables, entityToTable);
	const published: any[] = [];
	const eventBus = {
		publish: async (event: any) => {
			published.push(event);

			return event;
		}
	};
	const service = new ProductChannelService(
		repository(tables, 'product_channel', writeManager) as never,
		{} as never,
		eventBus as never
	);
	const rowFor = (channelId: string) =>
		tables.product_channel.find((row) => row.channelId === channelId && row.productId === PRODUCT);

	return { service, tables, published, rowFor };
}

describe('ProductChannelService — publishing and withdrawing (doc 05 §4.1, §23 I-24)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('publishes a product to a channel and stamps the instant it first went live', async () => {
		const fixture = publicationFixture();

		const publications = await fixture.service.setPublication(
			PRODUCT,
			[CHANNEL_WEB],
			PublicationStatus.ACTIVE,
			FIRST
		);

		expect(publications).toHaveLength(1);
		expect(fixture.rowFor(CHANNEL_WEB)).toMatchObject({
			productId: PRODUCT,
			channelId: CHANNEL_WEB,
			status: PublicationStatus.ACTIVE,
			publishedAt: FIRST,
			unpublishedAt: null,
			organizationId: ORG
		});
		expect(fixture.published).toHaveLength(1);
		expect(fixture.published[0]).toMatchObject({
			productId: PRODUCT,
			channelId: CHANNEL_WEB,
			organizationId: ORG
		});
	});

	it('keeps one row when the same pair is published twice, and the first instant', async () => {
		// The unique index is `(product, channel)`, and the listing query reads the row: a second row
		// would list the product twice on the same channel.
		const fixture = publicationFixture();

		await fixture.service.setPublication(PRODUCT, [CHANNEL_WEB], PublicationStatus.ACTIVE, FIRST);
		await fixture.service.setPublication(PRODUCT, [CHANNEL_WEB], PublicationStatus.ACTIVE, SECOND);

		expect(fixture.tables.product_channel).toHaveLength(1);
		// "First published" is a fact about the listing, not about the last request that touched it.
		expect(fixture.rowFor(CHANNEL_WEB)).toMatchObject({ publishedAt: FIRST, unpublishedAt: null });
	});

	it('withdraws a publication, keeping the row and the instant it first went live', async () => {
		const fixture = publicationFixture();

		await fixture.service.setPublication(PRODUCT, [CHANNEL_WEB], PublicationStatus.ACTIVE, FIRST);
		const withdrawn = await fixture.service.setPublication(
			PRODUCT,
			[CHANNEL_WEB],
			PublicationStatus.ARCHIVED,
			SECOND
		);

		expect(withdrawn).toHaveLength(1);
		expect(fixture.tables.product_channel).toHaveLength(1);
		expect(fixture.rowFor(CHANNEL_WEB)).toMatchObject({
			status: PublicationStatus.ARCHIVED,
			publishedAt: FIRST,
			unpublishedAt: SECOND
		});
		expect(fixture.published[1]).toMatchObject({ productId: PRODUCT, channelId: CHANNEL_WEB });
		expect(fixture.published[1].constructor.name).toBe('ProductUnpublishedEvent');
	});

	it('clears the withdrawal when the listing is published again', async () => {
		const fixture = publicationFixture();

		await fixture.service.setPublication(PRODUCT, [CHANNEL_WEB], PublicationStatus.ACTIVE, FIRST);
		await fixture.service.setPublication(PRODUCT, [CHANNEL_WEB], PublicationStatus.ARCHIVED, SECOND);
		await fixture.service.setPublication(PRODUCT, [CHANNEL_WEB], PublicationStatus.ACTIVE, THIRD);

		// A republished listing is not a new listing: the withdrawal is over and the original
		// publication instant is what "first published" still means.
		expect(fixture.rowFor(CHANNEL_WEB)).toMatchObject({
			status: PublicationStatus.ACTIVE,
			publishedAt: FIRST,
			unpublishedAt: null
		});
		expect(fixture.tables.product_channel).toHaveLength(1);
	});

	it('publishes to several channels in one call, one row and one announcement each', async () => {
		const fixture = publicationFixture();

		const publications = await fixture.service.setPublication(
			PRODUCT,
			[CHANNEL_WEB, CHANNEL_MARKETPLACE],
			PublicationStatus.ACTIVE,
			FIRST
		);

		expect(publications.map((row) => row.channelId).sort()).toEqual([CHANNEL_WEB, CHANNEL_MARKETPLACE].sort());
		expect(fixture.tables.product_channel).toHaveLength(2);
		expect(fixture.published.map((event) => event.channelId).sort()).toEqual(
			[CHANNEL_WEB, CHANNEL_MARKETPLACE].sort()
		);
	});

	it('withdraws one channel without touching the other', async () => {
		// Publication is per channel, which is the whole reason the row exists beside the product's own
		// status: the same product is a different proposition in each place it is sold.
		const fixture = publicationFixture();

		await fixture.service.setPublication(
			PRODUCT,
			[CHANNEL_WEB, CHANNEL_MARKETPLACE],
			PublicationStatus.ACTIVE,
			FIRST
		);
		await fixture.service.setPublication(PRODUCT, [CHANNEL_MARKETPLACE], PublicationStatus.ARCHIVED, SECOND);

		expect(fixture.rowFor(CHANNEL_WEB)).toMatchObject({
			status: PublicationStatus.ACTIVE,
			unpublishedAt: null
		});
		expect(fixture.rowFor(CHANNEL_MARKETPLACE)).toMatchObject({
			status: PublicationStatus.ARCHIVED,
			unpublishedAt: SECOND
		});
		expect(await fixture.service.isPublishedOn(PRODUCT, CHANNEL_WEB)).toBe(true);
		expect(await fixture.service.isPublishedOn(PRODUCT, CHANNEL_MARKETPLACE)).toBe(false);
	});

	it('refuses a publication change that names no channel', async () => {
		const fixture = publicationFixture();

		await expect(
			fixture.service.setPublication(PRODUCT, [], PublicationStatus.ACTIVE, FIRST)
		).rejects.toBeInstanceOf(BadRequestException);
		expect(fixture.tables.product_channel).toEqual([]);
		expect(fixture.published).toEqual([]);
	});

	it('answers publication from an ACTIVE row only, not from the row’s existence', async () => {
		// Control: a `DRAFT` row is an intention on record — doc 05 §4.1 says a product is served on a
		// channel only when the row is `ACTIVE` — so the presence of a row must not be the answer.
		const fixture = publicationFixture([
			publicationRow('draft-row', CHANNEL_WEB, { status: PublicationStatus.DRAFT }),
			publicationRow('archived-row', CHANNEL_MARKETPLACE, {
				status: PublicationStatus.ARCHIVED,
				publishedAt: FIRST,
				unpublishedAt: SECOND
			})
		]);

		expect(fixture.tables.product_channel).toHaveLength(2);
		expect(await fixture.service.isPublishedOn(PRODUCT, CHANNEL_WEB)).toBe(false);
		expect(await fixture.service.isPublishedOn(PRODUCT, CHANNEL_MARKETPLACE)).toBe(false);
		// And an ACTIVE row on a third channel answers for that channel alone.
		await fixture.service.setPublication(PRODUCT, [CHANNEL_WEB], PublicationStatus.ACTIVE, THIRD);

		expect(await fixture.service.isPublishedOn(PRODUCT, CHANNEL_WEB)).toBe(true);
		expect(await fixture.service.isPublishedOn(PRODUCT, CHANNEL_MARKETPLACE)).toBe(false);
	});
});

describe('ProductChannelService — reading the publications of one product', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('lists the publication rows of one product, ordered by their channel sort order', async () => {
		const fixture = publicationFixture([
			publicationRow('row-second', CHANNEL_MARKETPLACE, { sortOrder: 20 }),
			publicationRow('row-first', CHANNEL_WEB, { sortOrder: 10 })
		]);

		const listed = await fixture.service.findByProduct(PRODUCT);

		expect(listed.map((row) => row.id)).toEqual(['row-first', 'row-second']);
	});

	it('does not answer with a publication row of another product or another organization', async () => {
		// The organization is part of the read, not a filter the caller may forget: a listing query that
		// reached across organizations would publish one tenant's product on another tenant's channel.
		const fixture = publicationFixture([
			publicationRow('mine', CHANNEL_WEB, { status: PublicationStatus.ACTIVE, publishedAt: FIRST }),
			publicationRow('another-product', CHANNEL_WEB, { productId: 'other-product' }),
			publicationRow('another-org', CHANNEL_WEB, { organizationId: OTHER_ORG })
		]);

		const listed = await fixture.service.findByProduct(PRODUCT);

		expect(listed.map((row) => row.id)).toEqual(['mine']);
	});
});
