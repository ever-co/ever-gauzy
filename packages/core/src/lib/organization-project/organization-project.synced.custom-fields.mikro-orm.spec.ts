import { ISyncedProjectsStore, openSyncedProjectsStore, SYNCED_IDS } from './testing/synced-projects.store';

/**
 * The GitHub plugin's custom fields on `OrganizationProject` reach MikroORM, and `findSyncedProjects` then answers
 * on MikroORM exactly what it answers on TypeORM — the projects, and each one's `customFields.repository`.
 *
 * **Why the custom fields never reached MikroORM.** `bootstrap()` calls `registerMikroOrmCustomFields` after
 * `NestFactory.create`, and MikroORM discovers the entities — copying the decorators' metadata — while the Nest
 * application is created. The custom fields were therefore registered into metadata MikroORM never read again,
 * and any criterion or `populate` naming one was refused ("property 'repository' does not exist in embeddable
 * 'MikroOrmOrganizationProjectEntityCustomFields'").
 *
 * **Why they could not simply be registered first.** Registered before discovery, as this spec does (the order the
 * proposed `bootstrap()` change gives `DB_ORM=mikro-orm`), two mappings MikroORM refuses surfaced in
 * `register-custom-entity-fields.ts`, both measured here before the change:
 *
 * - the relation-id custom field `repositoryId` was mapped as a second persisted property of the column the
 *   `repository` relation writes: "Duplicate fieldNames are not allowed: OrganizationProject.customFields.repository
 *   (fieldName: 'repositoryId'), OrganizationProject.customFields.repositoryId (fieldName: 'repositoryId')". It is
 *   now the `persist: false` mirror `MultiORMColumn({ relationId: true })` makes of such a column;
 * - a many-to-many custom field (the job plugins' `Tag.proposals`, `Employee.jobPresets`) cannot live in a MikroORM
 *   embeddable: "MikroOrmEmployeeEntityCustomFields.jobPresets has wrong 'mappedBy' reference type: Employee instead
 *   of MikroOrmEmployeeEntityCustomFields". It stays unmapped under MikroORM, as it always was.
 *
 * Until that change to `register-custom-entity-fields.ts` is applied, this spec fails in `beforeAll` with the first
 * of those two errors.
 *
 * See `testing/synced-projects.store.ts` for what is real here.
 */

const TIMEOUT = 15 * 60 * 1000;

type Row = { name?: string; customFields?: { repository?: { id?: string } | null; repositoryId?: string | null } };

/** Each project by name, with the repository the read loaded for it. */
const linked = (items: Row[]): string[] =>
	items.map((item) => `${item.name} -> ${item.customFields?.repository?.id ?? 'no repository'}`).sort();

describe('OrganizationProjectService.findSyncedProjects under MikroORM, custom fields registered before discovery', () => {
	let store: ISyncedProjectsStore;

	beforeAll(async () => {
		store = await openSyncedProjectsStore({
			registerMikroOrmCustomFields: 'before-discovery',
			withManyToManyCustomFields: true
		});
	}, TIMEOUT);

	afterAll(async () => {
		await store?.close();
	});

	it("maps the plugin's relation, and `repositoryId` as the mirror of the column that relation writes", () => {
		const customFields = store.metadata.properties['customFields' as never] as {
			embeddedProps: Record<string, { kind: string; persist?: boolean; fieldNames: string[] }>;
		};
		const { repository, repositoryId } = customFields.embeddedProps;

		expect([repository.kind, repository.fieldNames]).toEqual(['m:1', ['repositoryId']]);
		expect([repositoryId.kind, repositoryId.persist, repositoryId.fieldNames]).toEqual([
			'scalar',
			false,
			['repositoryId']
		]);
	});

	it('answers the projects the TypeORM branch answers, each with its repository', async () => {
		const typeOrm = await store.typeOrm.findSyncedProjects();
		const mikroOrm = await store.mikroOrm.findSyncedProjects();

		// Left out on both: a project with no repository, one whose repository is soft-deleted or another tenant's,
		// another tenant's project, and a soft-deleted project.
		expect(linked(typeOrm.items)).toEqual([
			`a linked -> ${SYNCED_IDS.REPOSITORY.LIVE}`,
			`d linked, other organization -> ${SYNCED_IDS.REPOSITORY.OTHER_ORGANIZATION}`,
			`e linked to the other organization's repository -> ${SYNCED_IDS.REPOSITORY.OTHER_ORGANIZATION}`
		]);
		expect(linked(mikroOrm.items)).toEqual(linked(typeOrm.items));
		expect(mikroOrm.total).toBe(typeOrm.total);
	});

	it('serializes the repository the page reads (`customFields.repository.hasSyncEnabled`) and the mirror', async () => {
		const { items } = await store.mikroOrm.findSyncedProjects({
			where: { organizationId: SYNCED_IDS.ORGANIZATION }
		});

		expect(items).toHaveLength(1);
		expect(items[0].customFields).toEqual(
			expect.objectContaining({
				repositoryId: SYNCED_IDS.REPOSITORY.LIVE,
				repository: expect.objectContaining({ id: SYNCED_IDS.REPOSITORY.LIVE, hasSyncEnabled: true })
			})
		);
	});

	it('applies the keys of `where` to the project and to its repository, as the TypeORM branch does', async () => {
		const where = { organizationId: SYNCED_IDS.ORGANIZATION };
		const typeOrm = await store.typeOrm.findSyncedProjects({ where });
		const mikroOrm = await store.mikroOrm.findSyncedProjects({ where });

		expect(linked(typeOrm.items)).toEqual([`a linked -> ${SYNCED_IDS.REPOSITORY.LIVE}`]);
		expect(linked(mikroOrm.items)).toEqual(linked(typeOrm.items));
	});

	it('pages as the TypeORM branch does', async () => {
		for (const page of [
			{ take: 2, skip: 1 },
			{ take: 2, skip: 2 }
		]) {
			const typeOrm = await store.typeOrm.findSyncedProjects(page);
			const mikroOrm = await store.mikroOrm.findSyncedProjects(page);

			expect([mikroOrm.items.length, mikroOrm.total]).toEqual([typeOrm.items.length, typeOrm.total]);
		}
	});
});
