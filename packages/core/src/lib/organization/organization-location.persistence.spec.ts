import { EntityCaseNamingStrategy, EntitySchema as MikroEntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { DataSource, EntitySchema as TypeOrmEntitySchema } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { MikroOrmBaseEntityRepository } from '../core/repository/mikro-orm-base-entity.repository';
import { MultiORM, MultiORMEnum } from '../core/utils';
import { IOrganizationContactChanges, savedContactLink } from './organization-location';

/**
 * What an organization save stores for its contact, under each ORM: the premise of `organizationLocations`, which
 * judges the EEA/UK location after an update from what the save stores (`savedContactLink`).
 *
 * The organization's `contact` relation does not cascade, and its `contactId` column is a TypeORM relation id that
 * MikroORM does not map. The tables here are mapped the same way and written through the CRUD base's upsert
 * (`CrudService.create` with the organization's id), on in-memory better-sqlite3.
 */

class SpecOrganization {
	id!: string;
	name?: string;
	contact?: unknown;
}

class SpecContact {
	id!: string;
	country?: string;
}

const ORGANIZATION = 'a0000000-0000-4000-8000-00000000000a';
const US = 'c0000000-0000-4000-8000-0000000000c1';
const UK = 'c0000000-0000-4000-8000-0000000000c2';

type Store = {
	upsert(payload: Record<string, unknown>): Promise<void>;
	linked(): Promise<{ contactId: string | null; country: string | null }>;
	countries(): Promise<string[]>;
};

/**
 * Each request, sent to an organization linked to the US contact, and the contact the organization is linked to
 * after the save under each ORM (`null`: no contact).
 */
const SAVES: {
	request: string;
	payload: IOrganizationContactChanges & Record<string, unknown>;
	typeorm: string | null;
	mikroorm: string | null;
	/** What the location check reads instead, where it takes the stricter reading. */
	mikroormCheck?: string;
}[] = [
	{
		request: 'a contact by contact.id, with a country',
		payload: { contact: { id: UK, country: 'DE' } },
		typeorm: UK,
		mikroorm: UK
	},
	{
		request: 'the current contact, with a country',
		payload: { contact: { id: US, country: 'DE' } },
		typeorm: US,
		mikroorm: US
	},
	{ request: 'a contact by its id alone', payload: { contact: UK }, typeorm: null, mikroorm: UK },
	{ request: 'contact: null', payload: { contact: null }, typeorm: null, mikroorm: null },
	{ request: 'a contact by the contactId column', payload: { contactId: UK }, typeorm: UK, mikroorm: US },
	{ request: 'contactId: null', payload: { contactId: null }, typeorm: null, mikroorm: US },
	{ request: 'contactId with contact: null', payload: { contactId: UK, contact: null }, typeorm: UK, mikroorm: null },
	{
		request: 'an id alone with the current contactId',
		payload: { contact: UK, contactId: US },
		typeorm: null,
		mikroorm: UK
	},
	{
		request: 'contact.id with contactId: null',
		payload: { contact: { id: UK }, contactId: null },
		typeorm: UK,
		mikroorm: UK
	},
	{
		request: 'a contact without an id',
		payload: { contact: { country: 'DE' } },
		typeorm: US,
		mikroorm: null,
		mikroormCheck: US
	},
	{ request: 'a top-level country', payload: { country: 'DE' }, typeorm: US, mikroorm: US }
];

/**
 * Runs the cases against one store, seeded with an organization linked to a US contact and a UK contact on the side.
 *
 * @param name the ORM
 * @param ormType the ORM the location check is told the save runs on
 * @param open opens the store
 */
function describeStore(
	name: string,
	ormType: MultiORM,
	open: () => Promise<{ store: Store; seed: () => Promise<void>; close: () => Promise<void> }>
) {
	describe(name, () => {
		let store: Store;
		let seed: () => Promise<void>;
		let close: () => Promise<void>;

		beforeAll(async () => ({ store, seed, close } = await open()));
		afterAll(async () => close?.());
		beforeEach(async () => {
			jest.spyOn(console, 'error').mockImplementation(() => undefined);
			await seed();
		});
		afterEach(() => jest.restoreAllMocks());

		it.each(SAVES)('$request', async ({ payload, typeorm, mikroorm, mikroormCheck }) => {
			const expected = ormType === MultiORMEnum.TypeORM ? typeorm : mikroorm;

			await store.upsert({ name: 'Renamed', ...payload });

			expect((await store.linked()).contactId).toBe(expected);
			// No contact is written: a linked contact keeps its own country, a carried country is not stored.
			expect(await store.countries()).toEqual(['GB', 'US']);
			// The location check reads the same contact (`undefined`: the current one is kept).
			const check = savedContactLink(payload, US, ormType);
			expect(check === undefined ? US : check).toBe(
				ormType === MultiORMEnum.MikroORM && mikroormCheck ? mikroormCheck : expected
			);
		});
	});
}

describeStore('under MikroORM', MultiORMEnum.MikroORM, async () => {
	const orm = await MikroORM.init<BetterSqliteDriver>({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [
			new MikroEntitySchema<SpecOrganization>({
				class: SpecOrganization,
				tableName: 'spec_organization',
				properties: {
					id: { type: 'uuid', primary: true },
					name: { type: 'string', nullable: true },
					contact: {
						kind: 'm:1',
						entity: () => SpecContact,
						nullable: true,
						joinColumn: 'contactId'
					} as never
				}
			}),
			new MikroEntitySchema<SpecContact>({
				class: SpecContact,
				tableName: 'spec_contact',
				properties: {
					id: {
						type: 'uuid',
						primary: true,
						onCreate: (row: SpecContact) => row.id ?? require('node:crypto').randomUUID()
					},
					country: { type: 'string', nullable: true }
				}
			})
		],
		namingStrategy: EntityCaseNamingStrategy,
		allowGlobalContext: true
	});
	await orm.schema.createSchema();
	// Rows as the queries below select them.
	const sql = (query: string) => orm.em.getConnection().execute(query) as Promise<never[]>;

	return {
		seed: async () => {
			await sql('DELETE FROM spec_organization');
			await sql('DELETE FROM spec_contact');
			await sql(`INSERT INTO spec_contact (id, country) VALUES ('${US}', 'US'), ('${UK}', 'GB')`);
			await sql(`INSERT INTO spec_organization (id, name, contactId) VALUES ('${ORGANIZATION}', 'Org', '${US}')`);
		},
		close: () => orm.close(true),
		store: {
			upsert: async (payload) => {
				jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
				const repository = new MikroOrmBaseEntityRepository<SpecOrganization>(
					orm.em.fork() as never,
					SpecOrganization
				);
				const service = new (class extends CrudService<SpecOrganization> {})(
					{ metadata: { findRelationWithPropertyPath: () => ({ isCascadeInsert: false }) } } as never,
					repository as never
				);
				await service.create({ id: ORGANIZATION, ...payload } as never);
			},
			linked: async () =>
				(
					await sql(
						'SELECT o.contactId, c.country FROM spec_organization o LEFT JOIN spec_contact c ON c.id = o.contactId'
					)
				)[0],
			countries: async () =>
				(await sql('SELECT country FROM spec_contact ORDER BY country')).map((row: SpecContact) => row.country)
		}
	};
});

describeStore('under TypeORM', MultiORMEnum.TypeORM, async () => {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		synchronize: true,
		entities: [
			new TypeOrmEntitySchema<SpecOrganization & { contactId?: string }>({
				name: 'SpecOrganization',
				tableName: 'spec_organization',
				columns: {
					id: { type: 'varchar', primary: true },
					name: { type: 'varchar', nullable: true },
					contactId: { type: 'varchar', nullable: true }
				},
				relations: {
					contact: {
						type: 'many-to-one',
						target: 'SpecContact',
						joinColumn: { name: 'contactId' },
						nullable: true
					}
				}
			}),
			new TypeOrmEntitySchema<SpecContact>({
				name: 'SpecContact',
				tableName: 'spec_contact',
				columns: {
					id: { type: 'varchar', primary: true, generated: 'uuid' },
					country: { type: 'varchar', nullable: true }
				}
			})
		]
	});
	await dataSource.initialize();
	const sql = (query: string) => dataSource.query(query);

	return {
		seed: async () => {
			await sql('DELETE FROM spec_organization');
			await sql('DELETE FROM spec_contact');
			await sql(`INSERT INTO spec_contact (id, country) VALUES ('${US}', 'US'), ('${UK}', 'GB')`);
			await sql(`INSERT INTO spec_organization (id, name, contactId) VALUES ('${ORGANIZATION}', 'Org', '${US}')`);
		},
		close: () => dataSource.destroy(),
		store: {
			upsert: async (payload) => {
				jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
				const service = new (class extends CrudService<SpecOrganization> {})(
					dataSource.getRepository('SpecOrganization') as never,
					undefined as never
				);
				await service.create({ id: ORGANIZATION, ...payload } as never);
			},
			linked: async () =>
				(
					await sql(
						'SELECT o.contactId, c.country FROM spec_organization o LEFT JOIN spec_contact c ON c.id = o.contactId'
					)
				)[0],
			countries: async () =>
				(await sql('SELECT country FROM spec_contact ORDER BY country')).map((row: SpecContact) => row.country)
		}
	};
});
