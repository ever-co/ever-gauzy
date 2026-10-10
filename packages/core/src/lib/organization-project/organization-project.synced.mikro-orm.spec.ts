import { ISyncedProjectsStore, openSyncedProjectsStore, SYNCED_IDS } from './testing/synced-projects.store';

/**
 * `OrganizationProjectService.findSyncedProjects` answers under MikroORM — the GraphQL field
 * `syncedOrganizationProjects` and `GET /organization-projects/synced`.
 *
 * **The defect.** The MikroORM branch filtered on `{ repositoryId: { $ne: null } }`, naming the GitHub plugin's
 * `repositoryId` as a property of `OrganizationProject`. TypeORM's branch reads that column with raw SQL and joins
 * the plugin's `customFields.repository`; under MikroORM both are members of the `customFields` embeddable, not
 * of the entity, and every call failed with "Trying to query by not existing property
 * OrganizationProject.repositoryId".
 *
 * **When MikroORM maps no `customFields.repository`.** Here the MikroORM custom fields are registered where
 * `bootstrap()` registers them today: after the Nest application — and so MikroORM, which discovers the entities
 * while it is created — exists, so MikroORM maps no plugin custom field at all (a platform without the GitHub
 * plugin maps none either). The branch then reads the column directly, which is what TypeORM does when there is
 * no `repository` custom field to join. `organization-project.synced.custom-fields.mikro-orm.spec.ts` covers the
 * store once the custom fields reach MikroORM first, where the answer is TypeORM's row for row.
 *
 * See `testing/synced-projects.store.ts` for what is real here.
 */

const TIMEOUT = 15 * 60 * 1000;

const names = (items: Array<{ name?: string }>): string[] => items.map((item) => item.name as string).sort();

describe('OrganizationProjectService.findSyncedProjects under MikroORM, custom fields registered after discovery', () => {
	let store: ISyncedProjectsStore;

	beforeAll(async () => {
		store = await openSyncedProjectsStore({ registerMikroOrmCustomFields: 'after-discovery' });
	}, TIMEOUT);

	afterAll(async () => {
		await store?.close();
	});

	it('refuses the criterion the branch used to build: `repositoryId` is not a property of the entity', async () => {
		await expect(
			store.em().findAndCount('OrganizationProject', {
				tenantId: SYNCED_IDS.TENANT,
				repositoryId: { $ne: null }
			} as never)
		).rejects.toThrow('Trying to query by not existing property OrganizationProject.repositoryId');
	});

	it('maps no custom field of the plugin, registered after MikroORM discovered the entities', () => {
		const customFields = store.metadata.properties['customFields' as never] as { embeddedProps?: object };

		expect(Object.keys(customFields.embeddedProps ?? {})).not.toContain('repository');
	});

	it("answers the tenant's projects whose repository column is set", async () => {
		const { items, total } = await store.mikroOrm.findSyncedProjects();

		expect(names(items)).toEqual([
			'a linked',
			'c linked to a deleted repository',
			'd linked, other organization',
			"e linked to the other organization's repository",
			"g linked to another tenant's repository"
		]);
		expect(total).toBe(5);
	});

	it('applies the keys of `where`', async () => {
		const { items } = await store.mikroOrm.findSyncedProjects({
			where: { organizationId: SYNCED_IDS.ORGANIZATION }
		});

		expect(names(items)).toEqual([
			'a linked',
			'c linked to a deleted repository',
			"e linked to the other organization's repository",
			"g linked to another tenant's repository"
		]);
	});

	it("reads the credential's tenant, whatever `where` states", async () => {
		const { items } = await store.mikroOrm.findSyncedProjects({ where: { tenantId: SYNCED_IDS.OTHER_TENANT } });

		expect(names(items)).not.toContain('f other tenant');
		expect(items.every((item: { tenantId?: string }) => item.tenantId === SYNCED_IDS.TENANT)).toBe(true);
	});

	it('refuses a `where` value MikroORM would read as operators', async () => {
		await expect(
			store.mikroOrm.findSyncedProjects({ where: { organizationId: { $ne: SYNCED_IDS.ORGANIZATION } } as never })
		).rejects.toMatchObject({ status: 400, message: 'Invalid value for where.organizationId' });
	});

	it('pages as the TypeORM branch does: `take` rows, `skip` a one-based page number', async () => {
		const first = await store.mikroOrm.findSyncedProjects({ take: 2, skip: 1 });
		const third = await store.mikroOrm.findSyncedProjects({ take: 2, skip: 3 });

		expect(first.items).toHaveLength(2);
		expect(third.items).toHaveLength(1);
		expect([first.total, third.total]).toEqual([5, 5]);
	});
});
