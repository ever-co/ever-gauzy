/**
 * `@gauzy/core` boots the whole application graph from its barrel, none of which a membership service needs, so it
 * is doubled at the module boundary; **the service under test is the real one**, over an in-memory datastore that
 * honours the `where` it is given — a double that ignored the scope would make every case below vacuous.
 */
jest.mock('@gauzy/core', () => {
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

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
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
import { RequestContext } from '@gauzy/core';
import { Collection } from '../collection/collection.entity';
import { CollectionVariant } from './collection-variant.entity';
import { CollectionVariantService } from './collection-variant.service';

/**
 * Variant membership of a collection: the set write, and the addition and removal the schema declares on top of it.
 *
 * `addCollectionVariants` and `removeCollectionVariants` were declared and answered by nothing. They are now the set
 * write `replaceVariants` performs — the one `PUT /collection-variants/by-collection/:collectionId` and
 * `replaceCollectionVariants` reach — expressed as an addition and a removal, so they inherit its transaction and its
 * scope. And the scope is new: the set write read the existing rows by `collectionId` alone and deleted the ones
 * missing from the new set by id, so a caller naming another tenant's collection rewrote that tenant's shelf.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000003';
const COLLECTION = '00000000-0000-4000-8000-000000000010';
const FOREIGN_COLLECTION = '00000000-0000-4000-8000-000000000019';
const V1 = '00000000-0000-4000-8000-000000000031';
const V2 = '00000000-0000-4000-8000-000000000032';
const V3 = '00000000-0000-4000-8000-000000000033';
const V4 = '00000000-0000-4000-8000-000000000034';

type Row = Record<string, any>;

const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
const matches = (row: Row, where: Row = {}) =>
	Object.entries(where).every(([field, expected]) => expected === undefined || same(row[field], expected));

/** One membership row of the caller's collection unless stated otherwise. */
const member = (id: string, variantId: string, position: number, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	collectionId: COLLECTION,
	variantId,
	position,
	addedAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

/** Another tenant's shelf: two members of a collection the caller does not own. */
const foreignShelf = () => [
	member('foreign-1', V1, 0, { collectionId: FOREIGN_COLLECTION, tenantId: OTHER_TENANT, organizationId: 'org-x' }),
	member('foreign-2', V2, 1, { collectionId: FOREIGN_COLLECTION, tenantId: OTHER_TENANT, organizationId: 'org-x' })
];

/**
 * Builds the service over one in-memory datastore: the membership table and the collections a set write is checked
 * against.
 */
function fixture(rows: Row[] = []) {
	const tables: Record<string, Row[]> = {
		collection_variant: rows.map((row) => ({ ...row })),
		collection: [
			{ id: COLLECTION, tenantId: TENANT, organizationId: ORG },
			{ id: FOREIGN_COLLECTION, tenantId: OTHER_TENANT, organizationId: 'org-x' }
		]
	};
	const tableOf = (entity: unknown) => {
		if (entity === CollectionVariant) {
			return tables.collection_variant;
		}
		if (entity === Collection) {
			return tables.collection;
		}

		throw new Error('the in-memory double was handed an entity it does not know');
	};
	let sequence = 0;
	const manager: any = {
		findOne: async (entity: unknown, options: any = {}) =>
			tableOf(entity).find((row) => matches(row, options.where)) ?? null,
		transaction: async (run: (transactional: any) => Promise<any>) => run(manager),
		delete: async (entity: unknown, ids: unknown[]) => {
			const table = tableOf(entity);

			for (const id of ids) {
				table.splice(
					table.findIndex((row) => same(row.id, id)),
					1
				);
			}

			return { affected: ids.length };
		},
		update: async (entity: unknown, id: unknown, patch: Row) => {
			Object.assign(tableOf(entity).find((row) => same(row.id, id)) ?? {}, patch);

			return { affected: 1 };
		},
		insert: async (entity: unknown, partial: Row) => {
			tableOf(entity).push({ id: `inserted-${++sequence}`, addedAt: new Date(), ...partial });

			return partial;
		}
	};
	const repository = {
		manager,
		metadata: { tableName: 'collection_variant', hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) =>
			tables.collection_variant
				.filter((row) => matches(row, options.where))
				.sort((left, right) => left.position - right.position)
	};
	const service = new CollectionVariantService(repository as never, {} as never);
	const shelf = (collectionId: string = COLLECTION) =>
		tables.collection_variant
			.filter((row) => row.collectionId === collectionId)
			.sort((left, right) => left.position - right.position)
			.map((row) => row.variantId);

	return { service, tables, shelf };
}

describe('CollectionVariantService — the set expressed as an addition and a removal', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('appends the variants the collection does not hold, once each, after its current set in its order', async () => {
		const { service, shelf } = fixture([member('m-2', V2, 0), member('m-1', V1, 1)]);

		const rows = await service.addVariants(COLLECTION, [V3, V1, V4, V3]);

		// V1 is already a member and V3 is named twice: neither is an error, and neither is duplicated.
		expect(shelf()).toEqual([V2, V1, V3, V4]);
		expect(rows.map((row) => row.variantId)).toEqual([V2, V1, V3, V4]);
	});

	it('removes the named variants, keeps the order of the ones that stay, and ignores a variant that is not a member', async () => {
		const { service, shelf } = fixture([member('m-1', V1, 0), member('m-2', V2, 1), member('m-3', V3, 2)]);

		await service.removeVariants(COLLECTION, [V2, V4]);

		expect(shelf()).toEqual([V1, V3]);
	});

	it('writes both through the set write, so they share its refusal of a duplicated set', async () => {
		const { service } = fixture([member('m-1', V1, 0)]);
		const replace = jest.spyOn(service, 'replaceVariants');

		await service.addVariants(COLLECTION, [V2]);
		await service.removeVariants(COLLECTION, [V1]);

		expect(replace.mock.calls).toEqual([
			[COLLECTION, [V1, V2]],
			[COLLECTION, [V2]]
		]);
		await expect(service.replaceVariants(COLLECTION, [V1, V1])).rejects.toBeInstanceOf(BadRequestException);
	});
});

describe('CollectionVariantService — a set write reaches only the caller’s collection', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['the set write', (service: CollectionVariantService) => service.replaceVariants(FOREIGN_COLLECTION, [V3])],
		['the addition', (service: CollectionVariantService) => service.addVariants(FOREIGN_COLLECTION, [V3])],
		['the removal', (service: CollectionVariantService) => service.removeVariants(FOREIGN_COLLECTION, [V1])]
	])('refuses another tenant’s collection through %s, and leaves its shelf as it was', async (_label, write) => {
		const { service, shelf, tables } = fixture(foreignShelf());

		await expect(write(service)).rejects.toBeInstanceOf(NotFoundException);

		expect(shelf(FOREIGN_COLLECTION)).toEqual([V1, V2]);
		expect(tables.collection_variant).toHaveLength(2);
	});

	it('still writes the caller’s own collection, and only its rows', async () => {
		const { service, shelf } = fixture([...foreignShelf(), member('own-1', V1, 0)]);

		await service.addVariants(COLLECTION, [V2]);

		expect(shelf()).toEqual([V1, V2]);
		expect(shelf(FOREIGN_COLLECTION)).toEqual([V1, V2]);
	});
});
