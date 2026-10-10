/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a publication service needs and none of which is
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
import { PublicationStatus } from '../catalog.types';
import { CollectionChannel } from './collection-channel.entity';
import { CollectionChannelService } from './collection-channel.service';

/**
 * Where each collection is shown.
 *
 * A collection's own lifecycle and its publication are two different statements (doc 05 §4.6), and a
 * collection is visible on a channel only when the publication row is `ACTIVE` **and** the
 * collection's own `status` is `ACTIVE` **and** its window contains the moment. This suite pins the
 * half of that conjunction the row owns:
 *
 * - one row per `(collection, channel)`, and the row is replaced as a **set**: the channels that are
 *   no longer named are removed and the ones that are keep their identity;
 * - `publishedAt` is stamped on the first transition to `ACTIVE` and **never cleared**, so the answer
 *   to "when did this shelf first go live here" survives a withdrawal and a republication — and a
 *   channel that has only ever been intended, never published, carries no instant at all;
 * - a channel named twice in one request is refused rather than written twice;
 * - the read is scoped to the collection and to the caller's organization, in a stated order.
 *
 * The service is constructed directly with an in-memory double of its repository, wired to the
 * manager it writes through.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const COLLECTION = '00000000-0000-4000-8000-000000000010';
const OTHER_COLLECTION = '00000000-0000-4000-8000-000000000011';
const CHANNEL_WEB = '00000000-0000-4000-8000-000000000020';
const CHANNEL_MARKETPLACE = '00000000-0000-4000-8000-000000000021';

/** The programme's frozen instants: nothing here may depend on the wall clock. */
const FIRST = new Date('2026-01-15T12:00:00.000Z');
const SECOND = new Date('2026-03-01T09:30:00.000Z');
const THIRD = new Date('2026-06-01T00:00:00.000Z');

/** The tables this suite drives, as plain arrays. */
interface ITables {
	collection_channel: any[];
}

/** One `collection_channel` row. */
const publicationRow = (id: string, channelId: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	collectionId: COLLECTION,
	channelId,
	status: PublicationStatus.DRAFT,
	createdAt: FIRST,
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
	const sorted = (found: any[], order?: Record<string, 'ASC' | 'DESC'>) => {
		const columns = Object.keys(order ?? {});

		if (!columns.length) {
			return found;
		}

		return [...found].sort((left, right) => {
			for (const column of columns) {
				const a = left[column] instanceof Date ? left[column].getTime() : left[column];
				const b = right[column] instanceof Date ? right[column].getTime() : right[column];

				if (a === b) {
					continue;
				}

				const direction = order?.[column] === 'DESC' ? -1 : 1;

				return (a > b ? 1 : -1) * direction;
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
 * Builds the collection-publication service over one in-memory `collection_channel` table.
 *
 * @param rows The publication rows the fixture starts with.
 */
function channelFixture(rows: any[] = []) {
	const tables: ITables = { collection_channel: [...rows] };
	const entityToTable = new Map<unknown, keyof ITables>([[CollectionChannel, 'collection_channel']]);
	const writeManager = manager(tables, entityToTable);
	const service = new CollectionChannelService(
		repository(tables, 'collection_channel', writeManager) as never,
		{} as never
	);
	const rowFor = (channelId: string, collectionId: string = COLLECTION) =>
		tables.collection_channel.find(
			(row) => row.channelId === channelId && row.collectionId === collectionId
		);

	return { service, tables, rowFor };
}

describe('CollectionChannelService — publishing a collection to channels (doc 05 §4.6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('publishes a collection to a channel and stamps the instant it first went live', async () => {
		const fixture = channelFixture();

		const publications = await fixture.service.replaceChannels(COLLECTION, [
			{ channelId: CHANNEL_WEB, status: PublicationStatus.ACTIVE, publishedAt: FIRST }
		]);

		expect(publications).toHaveLength(1);
		expect(fixture.rowFor(CHANNEL_WEB)).toMatchObject({
			collectionId: COLLECTION,
			channelId: CHANNEL_WEB,
			status: PublicationStatus.ACTIVE,
			publishedAt: FIRST,
			organizationId: ORG
		});
	});

	it('keeps one row per channel and the first instant when the same channel is published twice', async () => {
		const fixture = channelFixture();

		await fixture.service.replaceChannels(COLLECTION, [
			{ channelId: CHANNEL_WEB, status: PublicationStatus.ACTIVE, publishedAt: FIRST }
		]);
		await fixture.service.replaceChannels(COLLECTION, [
			{ channelId: CHANNEL_WEB, status: PublicationStatus.ACTIVE, publishedAt: SECOND }
		]);

		expect(fixture.tables.collection_channel).toHaveLength(1);
		expect(fixture.rowFor(CHANNEL_WEB)).toMatchObject({ publishedAt: FIRST });
	});

	it('withdraws a channel and keeps the instant the shelf first went live there', async () => {
		const fixture = channelFixture();

		await fixture.service.replaceChannels(COLLECTION, [
			{ channelId: CHANNEL_WEB, status: PublicationStatus.ACTIVE, publishedAt: FIRST }
		]);
		await fixture.service.replaceChannels(COLLECTION, [
			{ channelId: CHANNEL_WEB, status: PublicationStatus.ARCHIVED }
		]);

		// The row is retained and its history with it: "when was this shelf live on this channel" is a
		// question a merchandiser asks after pulling it.
		expect(fixture.tables.collection_channel).toHaveLength(1);
		expect(fixture.rowFor(CHANNEL_WEB)).toMatchObject({
			status: PublicationStatus.ARCHIVED,
			publishedAt: FIRST
		});
	});

	it('keeps the original instant when a withdrawn channel is published again', async () => {
		const fixture = channelFixture();

		await fixture.service.replaceChannels(COLLECTION, [
			{ channelId: CHANNEL_WEB, status: PublicationStatus.ACTIVE, publishedAt: FIRST }
		]);
		await fixture.service.replaceChannels(COLLECTION, [
			{ channelId: CHANNEL_WEB, status: PublicationStatus.ARCHIVED }
		]);
		await fixture.service.replaceChannels(COLLECTION, [
			{ channelId: CHANNEL_WEB, status: PublicationStatus.ACTIVE, publishedAt: THIRD }
		]);

		expect(fixture.rowFor(CHANNEL_WEB)).toMatchObject({
			status: PublicationStatus.ACTIVE,
			publishedAt: FIRST
		});
		expect(fixture.tables.collection_channel).toHaveLength(1);
	});

	it('carries no publication instant for a channel that has only been intended', async () => {
		// Control: the row exists so the *intended* publication is on record (doc 05 §4.6), and a row
		// that was never `ACTIVE` must not claim it went live — an implemented "stamp on every write"
		// would report a shelf as live on a channel it was only ever prepared for.
		const fixture = channelFixture();

		await fixture.service.replaceChannels(COLLECTION, [
			{ channelId: CHANNEL_WEB, status: PublicationStatus.DRAFT, publishedAt: FIRST }
		]);

		expect(fixture.rowFor(CHANNEL_WEB)).toMatchObject({ status: PublicationStatus.DRAFT });
		expect(fixture.rowFor(CHANNEL_WEB).publishedAt).toBeUndefined();
	});

	it('removes the publications of the channels that are no longer named', async () => {
		const fixture = channelFixture();

		await fixture.service.replaceChannels(COLLECTION, [
			{ channelId: CHANNEL_WEB, status: PublicationStatus.ACTIVE, publishedAt: FIRST },
			{ channelId: CHANNEL_MARKETPLACE, status: PublicationStatus.ACTIVE, publishedAt: FIRST }
		]);
		const remaining = await fixture.service.replaceChannels(COLLECTION, [
			{ channelId: CHANNEL_MARKETPLACE, status: PublicationStatus.ACTIVE }
		]);

		expect(remaining.map((row) => row.channelId)).toEqual([CHANNEL_MARKETPLACE]);
		expect(fixture.rowFor(CHANNEL_WEB)).toBeUndefined();
		// The channel that stayed keeps the row and the instant it already had.
		expect(fixture.rowFor(CHANNEL_MARKETPLACE)).toMatchObject({ publishedAt: FIRST });
	});

	it('refuses a channel listed twice in one request', async () => {
		const fixture = channelFixture();

		await expect(
			fixture.service.replaceChannels(COLLECTION, [
				{ channelId: CHANNEL_WEB, status: PublicationStatus.ACTIVE },
				{ channelId: CHANNEL_WEB, status: PublicationStatus.ARCHIVED }
			])
		).rejects.toBeInstanceOf(BadRequestException);
		expect(fixture.tables.collection_channel).toEqual([]);
	});

	it('reads the publications of one collection only, in the order they were first written', async () => {
		const fixture = channelFixture([
			publicationRow('later', CHANNEL_MARKETPLACE, { createdAt: SECOND }),
			publicationRow('earlier', CHANNEL_WEB, { createdAt: FIRST }),
			publicationRow('another-collection', CHANNEL_WEB, { collectionId: OTHER_COLLECTION }),
			publicationRow('another-org', CHANNEL_WEB, { organizationId: OTHER_ORG })
		]);

		const publications = await fixture.service.findByCollection(COLLECTION);

		expect(publications.map((row) => row.id)).toEqual(['earlier', 'later']);
	});
});
