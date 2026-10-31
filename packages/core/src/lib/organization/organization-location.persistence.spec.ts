import { EntityCaseNamingStrategy, EntitySchema as MikroEntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { DataSource, EntitySchema as TypeOrmEntitySchema } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { MikroOrmBaseEntityRepository } from '../core/repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../core/utils';

/**
 * What an organization save stores for its contact, under each ORM: the premise of `organizationLocations`, which
 * judges the EEA/UK location after an update from what the save stores.
 *
 * The organization's \`contact\` relation does not cascade, and its \`contactId\` column is a TypeORM relation id that
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
 * Runs the cases against one store, seeded with an organization linked to a US contact and a UK contact on the side.
 *
 * @param name the ORM
 * @param storesContactIdColumn whether the save stores the `contactId` column
 * @param open opens the store
 */
function describeStore(
	name: string,
	storesContactIdColumn: boolean,
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

		it('stores a contact linked by contact.id, with the country that contact has, not the one sent with it', async () => {
			await store.upsert({ name: 'Renamed', contact: { id: UK, country: 'DE' } });

			expect(await store.linked()).toEqual({ contactId: UK, country: 'GB' });
		});

		it('never stores the country of a contact the request carries, with or without an id', async () => {
			await store.upsert({ name: 'Renamed', contact: { id: US, country: 'DE' } });
			await store.upsert({ name: 'Renamed again', contact: { country: 'DE' } });

			expect(await store.countries()).toEqual(['GB', 'US']);
			expect((await store.linked()).country).not.toBe('DE');
		});

		it(`${storesContactIdColumn ? 'stores' : 'does not store'} a contact linked by the contactId column`, async () => {
			await store.upsert({ name: 'Renamed', contactId: UK });

			expect((await store.linked()).contactId).toBe(storesContactIdColumn ? UK : US);
		});

		it('stores no top-level country', async () => {
			await store.upsert({ name: 'Renamed', country: 'DE' });

			expect(await store.linked()).toEqual({ contactId: US, country: 'US' });
			expect(await store.countries()).toEqual(['GB', 'US']);
		});
	});
}

describeStore('under MikroORM', false, async () => {
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

describeStore('under TypeORM', true, async () => {
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
