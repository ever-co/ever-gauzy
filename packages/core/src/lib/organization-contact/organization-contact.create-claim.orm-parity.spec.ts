import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * A create-only contact claims its projects on both ORMs, over one database whose tables TypeORM created (#11601
 * review).
 *
 * A caller who may create contacts but not edit them may link only projects that have no contact
 * (`toCreateOnlyContactInput`). That is read before the save, and another request can give one of the projects a
 * contact in between; the contact's cascading `projects` relation then moved that project onto the new contact
 * anyway. `OrganizationContactService.createClaimingProjects` saves the contact without its projects and claims each
 * on the same transaction, with a statement that links it only while it has no contact, so a project claimed in
 * between rolls the whole create back.
 *
 * Each case runs the real service over the real entities on both ORMs, against one better-sqlite3 file, with the
 * project already taken (or removed) when the create runs: the state the race leaves.
 */

const TIMEOUT = 15 * 60 * 1000;

type Row = Record<string, any>;
type Orm = 'typeorm' | 'mikro-orm';

const ORMS: Orm[] = ['typeorm', 'mikro-orm'];

const TENANT = '0f7c1a2e-0000-4000-8000-00000000a001';
const ORG = '0f7c1a2e-0000-4000-8000-00000000b001';
const USER = '0f7c1a2e-0000-4000-8000-00000000c001';
/** The contact another request gave a project to. */
const OTHER_CONTACT = '0f7c1a2e-0000-4000-8000-00000000d001';

const scope = { tenantId: TENANT, organizationId: ORG };

describe('OrganizationContactService.createClaimingProjects on TypeORM and on MikroORM', () => {
	const file = path.join(os.tmpdir(), `gauzy-contact-claim-parity-${process.pid}-${Date.now()}.sqlite3`);

	let loaded: Row = {};
	let dataSource: any;
	let orm: any;

	/**
	 * A service over both ORMs' repositories, as the module builds it, answering on the ORM named. The MikroORM
	 * repository is on the ORM's own entity manager, as the module injects it: that one resolves the transaction's fork
	 * inside `transactional`, which a fork does not (`useContext` is off on forks).
	 */
	const service = (ormType: Orm): any => {
		const instance = new loaded.OrganizationContactService(
			new loaded.TypeOrmOrganizationContactRepository(dataSource.getRepository(loaded.OrganizationContact)),
			new loaded.MikroOrmOrganizationContactRepository(orm.em, loaded.OrganizationContact)
		);
		// The ORM is a module constant of the CRUD base, read when the registry loaded (MikroORM, here); each
		// instance states its own so one registry can run both halves over the same mapping.
		Object.defineProperty(instance, 'ormType', { get: () => ormType });
		return instance;
	};

	const insert = async (table: string, row: Row): Promise<void> => {
		const columns = Object.keys(row);
		await dataSource.query(
			`INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns
				.map(() => '?')
				.join(', ')})`,
			columns.map((column) => row[column])
		);
	};

	/** A project of the organization: unassigned unless a contact is named. */
	const project = async (row: Row = {}): Promise<string> => {
		const id = randomUUID();
		await insert('organization_project', { id, name: `project ${id.slice(0, 8)}`, ...scope, ...row });
		return id;
	};

	const contactOf = async (projectId: string): Promise<string | null> =>
		(
			await dataSource.query(`SELECT "organizationContactId" FROM "organization_project" WHERE "id" = ?`, [
				projectId
			])
		)[0].organizationContactId;

	const count = async (table: string, column: string, value: string): Promise<number> =>
		Number((await dataSource.query(`SELECT COUNT(*) AS "n" FROM "${table}" WHERE "${column}" = ?`, [value]))[0].n);

	/** The create the handler hands over: the contact, its new details and the projects, in the caller's scope. */
	const input = (name: string, projectIds: string[]): Row => ({
		name,
		...scope,
		organization: { id: ORG },
		tenant: { id: TENANT },
		contact: { city: name, ...scope, organization: { id: ORG }, tenant: { id: TENANT } },
		projects: projectIds.map((id) => ({ id }))
	});

	beforeAll(async () => {
		const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
		process.env.DB_ORM = 'mikro-orm';
		process.env.DB_TYPE = 'better-sqlite3';

		try {
			await jest.isolateModulesAsync(async () => {
				// MikroORM keeps decorator metadata in a process-wide store; this load's decorators write the
				// mapping under test into an empty one.
				require('@mikro-orm/core').MetadataStorage.clear();

				// Must be first: loads the entity graph before a service pulls an entity.
				const entities = require('../core/entities/internal');

				const { coreEntities } = require('../core/entities');
				const { DataSource } = require('typeorm');
				const { MikroORM, EntityCaseNamingStrategy } = require('@mikro-orm/core');
				const { BetterSqliteDriver } = require('@mikro-orm/better-sqlite');
				const { SoftDeleteHandler } = require('mikro-orm-soft-delete');
				const {
					MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
					TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
				} = require('@gauzy/config');

				loaded = {
					OrganizationContact: entities.OrganizationContact,
					RequestContext: require('../core/context/request-context').RequestContext,
					OrganizationContactService: require('./organization-contact.service').OrganizationContactService,
					TypeOrmOrganizationContactRepository:
						require('./repository/type-orm-organization-contact.repository')
							.TypeOrmOrganizationContactRepository,
					MikroOrmOrganizationContactRepository:
						require('./repository/mikro-orm-organization-contact.repository')
							.MikroOrmOrganizationContactRepository
				};

				// TypeORM creates the tables, as the migrations do in an installation; both ORMs then write them.
				dataSource = new DataSource({
					type: 'better-sqlite3',
					database: file,
					entities: coreEntities,
					synchronize: true,
					logging: false,
					invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
				});
				await dataSource.initialize();

				orm = await MikroORM.init({
					driver: BetterSqliteDriver,
					dbName: file,
					entities: coreEntities,
					namingStrategy: EntityCaseNamingStrategy,
					extensions: [SoftDeleteHandler],
					autoJoinRefsForFilters: MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
					allowGlobalContext: true,
					discovery: { warnWhenNoEntities: false }
				});
			});
		} finally {
			for (const [key, value] of Object.entries(previous)) {
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
			}
		}

		// The placeholder column of the project's custom-fields embeddable, which an installation has from the
		// custom-fields migrations and `synchronize` does not create (see `request-approval.orm-parity.spec.ts`).
		const columns: Row[] = await dataSource.query(`PRAGMA table_info("organization_project")`);
		if (!columns.some((column) => column.name === 'fix_relational_custom_fields')) {
			await dataSource.query(`ALTER TABLE "organization_project" ADD "fix_relational_custom_fields" boolean`);
		}

		// The users the base entity names are not filled in; nothing here follows those keys.
		await dataSource.query('PRAGMA foreign_keys = OFF');

		await insert('tenant', { id: TENANT, name: 'tenant' });
		await insert('organization', { id: ORG, name: 'organization', tenantId: TENANT, currency: 'EUR' });
		await insert('organization_contact', { id: OTHER_CONTACT, name: 'other contact', ...scope });
	}, TIMEOUT);

	afterAll(async () => {
		await orm?.close(true);
		await dataSource?.destroy();
		try {
			fs.unlinkSync(file);
		} catch {
			// The file is the operating system's temporary directory's to reclaim.
		}
	});

	beforeEach(() => {
		const context = loaded.RequestContext;
		jest.spyOn(context, 'currentUser').mockReturnValue({ id: USER, tenantId: TENANT, lastOrganizationId: ORG });
		jest.spyOn(context, 'currentUserId').mockReturnValue(USER);
		jest.spyOn(context, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(context, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(context, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(context, 'hasPermission').mockReturnValue(false);
		jest.spyOn(context, 'hasRoles').mockReturnValue(false);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each(ORMS)(
		'links the projects that have no contact, with the contact and its details, on %s',
		async (ormType) => {
			const name = `claimed on ${ormType}`;
			const [first, second] = [await project(), await project()];

			const created = await service(ormType).createClaimingProjects(input(name, [first, second, first]));

			expect(created.projects).toEqual([{ id: first }, { id: second }]);
			expect(await contactOf(first)).toBe(created.id);
			expect(await contactOf(second)).toBe(created.id);
			const [stored] = await dataSource.query(
				`SELECT "organization_contact"."tenantId", "contact"."city" FROM "organization_contact" ` +
					`JOIN "contact" ON "contact"."id" = "organization_contact"."contactId" WHERE "organization_contact"."id" = ?`,
				[created.id]
			);
			expect(stored).toEqual({ tenantId: TENANT, city: name });
		}
	);

	it.each(ORMS)(
		'answers 409 and creates nothing when another request gave a project a contact meanwhile, on %s',
		async (ormType) => {
			const name = `lost on ${ormType}`;
			const free = await project();
			const taken = await project({ organizationContactId: OTHER_CONTACT });

			await expect(service(ormType).createClaimingProjects(input(name, [free, taken]))).rejects.toMatchObject({
				status: 409
			});

			expect(await contactOf(taken)).toBe(OTHER_CONTACT);
			// The free project's claim, the contact and its details are rolled back with the lost claim.
			expect(await contactOf(free)).toBeNull();
			expect(await count('organization_contact', 'name', name)).toBe(0);
			expect(await count('contact', 'city', name)).toBe(0);
		}
	);

	it.each(ORMS)('answers 409 and creates nothing when a project was removed meanwhile, on %s', async (ormType) => {
		const name = `removed on ${ormType}`;
		const removed = await project({ deletedAt: '2026-01-02 00:00:00.000' });

		await expect(service(ormType).createClaimingProjects(input(name, [removed]))).rejects.toMatchObject({
			status: 409
		});

		expect(await contactOf(removed)).toBeNull();
		expect(await count('organization_contact', 'name', name)).toBe(0);
	});
});
