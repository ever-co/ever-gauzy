import type { BaseQueryDTO } from '../core/crud';
import type { OrganizationProject } from './organization-project.entity';
import type { OrganizationProjectService } from './organization-project.service';
import { ISyncedProjectsStore, openSyncedProjectsStore, SYNCED_IDS } from './testing/synced-projects.store';

/**
 * The client rates of a project and of its members are read through the project rate routes only. The generic
 * project reads, open to any employee who views projects, hand the caller's `select` and `relations` to the ORM, so a
 * caller can name either column. Whatever the read loads, the API's answer leaves both out, on both ORMs.
 */

const TIMEOUT = 15 * 60 * 1000;
const PROJECT_NAME = 'a linked';
const MEMBER_EMPLOYEE = '6e000000-0000-4000-8000-000000000001';
const MEMBERSHIP = '6f000000-0000-4000-8000-000000000001';
const SCOPE = { tenantId: SYNCED_IDS.TENANT, organizationId: SYNCED_IDS.ORGANIZATION };

type ProjectQuery = BaseQueryDTO<OrganizationProject>;

interface AnsweredProject {
	id: string;
	members?: Array<Record<string, unknown>>;
}

interface AnsweredPage {
	items: AnsweredProject[];
}

const selectingProjectRate = (): ProjectQuery =>
	({
		where: { ...SCOPE },
		select: { id: true, name: true, billRateValue: true }
	}) as ProjectQuery;

const selectingMemberRate = (): ProjectQuery =>
	({
		where: { ...SCOPE },
		relations: { members: true },
		select: { id: true, name: true, members: { id: true, employeeId: true, billRateValue: true } }
	}) as ProjectQuery;

describe('generic project reads with a caller select naming a client rate', () => {
	let store: ISyncedProjectsStore;
	let projectId: string;

	beforeAll(async () => {
		store = await openSyncedProjectsStore({ registerMikroOrmCustomFields: 'after-discovery' });

		const connection = store.em().getConnection();
		await connection.execute('UPDATE organization_project SET billRateValue = 80 WHERE name = ?', [PROJECT_NAME]);
		await connection.execute(
			`INSERT INTO organization_project_employee
				(id, tenantId, organizationId, organizationProjectId, employeeId, isManager, isActive, isArchived, billRateValue)
			SELECT ?, tenantId, organizationId, id, ?, 0, 1, 0, 30 FROM organization_project WHERE name = ?`,
			[MEMBERSHIP, MEMBER_EMPLOYEE, PROJECT_NAME]
		);
		const [project] = await connection.execute('SELECT id FROM organization_project WHERE name = ?', [
			PROJECT_NAME
		]);
		projectId = project.id;

		const workingEmployees = { find: async () => [{ id: MEMBER_EMPLOYEE }] };
		const recentVisits = { emitSaveEmployeeRecentVisitEvent: async () => undefined };
		Object.defineProperty(store.mikroOrm, '_employeeService', { value: workingEmployees });
		Object.defineProperty(store.mikroOrm, '_employeeRecentVisitService', { value: recentVisits });
	}, TIMEOUT);

	afterAll(async () => {
		await store?.close();
	});

	/** The project as `GET /organization-projects`, `/pagination` and `/:id` answer it for the same query. */
	async function answeredProjects(
		orm: 'typeOrm' | 'mikroOrm',
		query: () => ProjectQuery
	): Promise<AnsweredProject[]> {
		const service = store[orm] as unknown as OrganizationProjectService;
		const listed = await store.respond<AnsweredPage>(await service.findAll(query()));
		const paged = await store.respond<AnsweredPage>(await service.pagination(query()));
		const byId = await store.respond<AnsweredProject>(await service.findById(projectId, query() as never));

		const isProject = (item: AnsweredProject) => item.id === projectId;
		const listedProject = listed.items.find(isProject);
		const pagedProject = paged.items.find(isProject);
		return [listedProject, pagedProject, byId];
	}

	describe.each(['typeOrm', 'mikroOrm'] as const)('on %s', (orm) => {
		it("leaves the project's client rate out", async () => {
			const projects = await answeredProjects(orm, selectingProjectRate);

			for (const project of projects) {
				expect(project).toEqual(expect.objectContaining({ id: projectId, name: PROJECT_NAME }));
				expect(project).not.toHaveProperty('billRateValue');
			}
		});

		it("leaves a member's client rate out of the members it loads", async () => {
			const projects = await answeredProjects(orm, selectingMemberRate);

			for (const project of projects) {
				expect(project.members).toEqual([expect.objectContaining({ id: MEMBERSHIP })]);
				expect(project.members[0]).not.toHaveProperty('billRateValue');
			}
		});
	});
});
