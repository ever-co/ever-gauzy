import { ISyncedProjectsStore, openSyncedProjectsStore, SYNCED_IDS } from './testing/synced-projects.store';

/**
 * A plugin's relation-id custom field is written through the CRUD base on MikroORM, as on TypeORM.
 *
 * The GitHub integration links a repository to a project by writing `customFields: { repositoryId }` (its UI's
 * `PUT /organization-projects/setting/:id`, which `OrganizationProjectService.update` hands to `create()` with the
 * id). Under MikroORM `repositoryId` is the `persist: false` mirror of the `repository` relation inside the
 * `customFields` embeddable, and — measured — `create()`, `save()` and `em.assign()` all left
 * `organization_project.repositoryId` NULL: a project linked under `DB_ORM=mikro-orm` never became "synced". Only
 * `update()` (a `nativeUpdate`) wrote it. `stateRelationsFromMirrors` and `collapseRelationMirrors` now read embedded
 * objects against the embeddable's properties, and the `assign()` paths state an embedded mirror's relation.
 *
 * The store is the real one `testing/synced-projects.store.ts` opens: the platform's entities and the GitHub
 * plugin's custom fields registered before MikroORM discovers them, on one SQLite file whose tables TypeORM created.
 * The writes go through the real `CrudService` methods, on one MikroORM context.
 */

const TIMEOUT = 15 * 60 * 1000;

describe('the CRUD base writes a relation-id custom field under MikroORM', () => {
	let store: ISyncedProjectsStore;
	let crud: {
		create(payload: object): Promise<any>;
		save(payload: object): Promise<any>;
		update(id: string, payload: object): Promise<any>;
	};

	/** The column as stored. */
	const storedRepositoryId = async (projectId: string): Promise<string | null> => {
		const rows: any[] = await store
			.em()
			.getConnection()
			.execute('SELECT repositoryId FROM organization_project WHERE id = ?', [projectId]);
		return rows[0]?.repositoryId ?? null;
	};

	beforeAll(async () => {
		store = await openSyncedProjectsStore({ registerMikroOrmCustomFields: 'before-discovery' });

		// The CrudService of the registry the store imported under DB_ORM=mikro-orm (its `ormType` is MikroORM),
		// over one MikroORM context per call, as a request has.
		let crudPrototype = Object.getPrototypeOf(store.mikroOrm);
		while (crudPrototype && crudPrototype.constructor?.name !== 'CrudService') {
			crudPrototype = Object.getPrototypeOf(crudPrototype);
		}
		const serviceOver = () => {
			const service = Object.create(crudPrototype);
			Object.defineProperty(service, 'mikroOrmRepository', {
				value: store.em().getRepository(store.metadata.class)
			});
			Object.defineProperty(service, 'typeOrmRepository', { value: {} });
			return service;
		};
		crud = {
			create: (payload) => serviceOver().create(payload),
			save: (payload) => serviceOver().save(payload),
			update: (id, payload) => serviceOver().update(id, payload)
		};
	}, TIMEOUT);

	afterAll(async () => {
		await store?.close();
	});

	it('writes the column of a new project created with `customFields: { repositoryId }`', async () => {
		const created = await crud.create({
			name: 'written by create',
			tenantId: SYNCED_IDS.TENANT,
			customFields: { repositoryId: SYNCED_IDS.REPOSITORY.LIVE }
		});

		expect(await storedRepositoryId(created.id)).toBe(SYNCED_IDS.REPOSITORY.LIVE);
	});

	it('writes it onto a stored project through create() with its id, the route the GitHub UI links one through', async () => {
		const created = await crud.create({ name: 'linked later', tenantId: SYNCED_IDS.TENANT });
		expect(await storedRepositoryId(created.id)).toBeNull();

		await crud.create({ id: created.id, customFields: { repositoryId: SYNCED_IDS.REPOSITORY.LIVE } });

		expect(await storedRepositoryId(created.id)).toBe(SYNCED_IDS.REPOSITORY.LIVE);
	});

	it('writes it through save(), from a payload stating the mirror alone', async () => {
		const created = await crud.create({ name: 'saved', tenantId: SYNCED_IDS.TENANT });

		await crud.save({ id: created.id, customFields: { repositoryId: SYNCED_IDS.REPOSITORY.OTHER_ORGANIZATION } });

		expect(await storedRepositoryId(created.id)).toBe(SYNCED_IDS.REPOSITORY.OTHER_ORGANIZATION);
	});

	it('saves back a serialized project, whose custom fields name the relation beside its mirror', async () => {
		const created = await crud.create({
			name: 'round trip',
			tenantId: SYNCED_IDS.TENANT,
			customFields: { repositoryId: SYNCED_IDS.REPOSITORY.LIVE }
		});

		await crud.save({
			...created,
			name: 'round tripped',
			customFields: { repository: SYNCED_IDS.REPOSITORY.LIVE, repositoryId: SYNCED_IDS.REPOSITORY.LIVE }
		});

		expect(await storedRepositoryId(created.id)).toBe(SYNCED_IDS.REPOSITORY.LIVE);
	});

	it('clears it with a mirror stated as null', async () => {
		const created = await crud.create({
			name: 'unlinked',
			tenantId: SYNCED_IDS.TENANT,
			customFields: { repositoryId: SYNCED_IDS.REPOSITORY.LIVE }
		});

		await crud.save({ id: created.id, customFields: { repositoryId: null } });

		expect(await storedRepositoryId(created.id)).toBeNull();
	});

	it('updates it by a payload naming both keys, the relation winning a disagreement', async () => {
		const created = await crud.create({ name: 'updated', tenantId: SYNCED_IDS.TENANT });

		await crud.update(created.id, {
			customFields: {
				repository: { id: SYNCED_IDS.REPOSITORY.OTHER_ORGANIZATION },
				repositoryId: SYNCED_IDS.REPOSITORY.LIVE
			}
		});

		expect(await storedRepositoryId(created.id)).toBe(SYNCED_IDS.REPOSITORY.OTHER_ORGANIZATION);
	});
});
