/**
 * G-P2-5 "Create in Ever Works" for a Gauzy project: the create body (a repo-less `project` work,
 * D11 scope, `externalRef`), and the Projects-tab flow against the mock Ever Works API through the
 * real client (opt-in per project, teams first, act-as, Ever Works' switch off, no second work).
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const entity = (name: string) => ({ [name]: class {} })[name];
	return {
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		ExportRedacted: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		OrganizationProjectCreateCommand: class {
			constructor(readonly input: Record<string, unknown>) {}
		},
		...Object.fromEntries(
			[
				'Tenant',
				'Organization',
				'Employee',
				'User',
				'IntegrationTenant',
				'IntegrationSetting',
				'OrganizationProject',
				'OrganizationProjectEmployee'
			].map((name) => [name, entity(name)])
		),
		RequestContext: {
			currentTenantId: () => null,
			currentUserId: jest.fn(() => null),
			currentOrganizationId: () => null
		}
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import { Employee, OrganizationProject, RequestContext } from '@gauzy/core';
import { EverWorksClient } from '../client/ever-works-client';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { MockEverWorksServer } from '../testing/mock-ever-works.server';
import { MockEverWorksWorks } from '../testing/mock-ever-works.works';
import {
	EVER_WORKS_PROJECT_WORK_KIND,
	isProjectWorksDisabled,
	projectWorkCreateBody,
	projectWorkIdempotencyKey
} from './ever-works-project-work.mapper';
import { EverWorksProjectsService } from './ever-works-projects.service';

describe('project → work create body', () => {
	const scope = { visibility: 'organization' as const, teamIds: [] };

	it('is a repo-less `project` work with the shared fields and an externalRef to the project', () => {
		expect(
			projectWorkCreateBody(
				{
					id: 'p1',
					name: '  Portal  ',
					description: ' Customer portal ',
					projectUrl: 'https://portal.example.test'
				},
				scope,
				'c1'
			)
		).toEqual({
			kind: EVER_WORKS_PROJECT_WORK_KIND,
			name: 'Portal',
			description: 'Customer portal',
			website: 'https://portal.example.test',
			teamIds: [],
			visibility: 'organization',
			externalRef: { source: 'gauzy', installationId: 'c1', externalId: 'p1' }
		});
	});

	it('carries the team scope (D11), leaves out a website Ever Works would refuse and caps the name', () => {
		const body = projectWorkCreateBody(
			{ id: 'p1', name: 'x'.repeat(300), description: '', projectUrl: 'portal.example.test' },
			{ visibility: 'team', teamIds: ['ew-t1'] },
			'c1'
		);
		expect(body).toMatchObject({ teamIds: ['ew-t1'], visibility: 'team', description: null });
		expect(body).not.toHaveProperty('website');
		expect((body['name'] as string).length).toBe(255);
	});

	it('the Idempotency-Key is stable per request, and differs for another body or the integration retry', () => {
		const body = projectWorkCreateBody({ id: 'p1', name: 'Portal' }, scope, 'c1');
		const key = projectWorkIdempotencyKey('c1', 'p1', body);
		expect(key).toMatch(/^[0-9a-f]{64}$/);
		expect(projectWorkIdempotencyKey('c1', 'p1', { ...body })).toBe(key);
		expect(projectWorkIdempotencyKey('c1', 'p1', { ...body, name: 'Renamed' })).not.toBe(key);
		expect(projectWorkIdempotencyKey('c1', 'p1', body, 'integration')).not.toBe(key);
		expect(projectWorkIdempotencyKey('c2', 'p1', body)).not.toBe(key);
	});

	it('recognises Ever Works switching project works off, by code, reason or message', () => {
		expect(isProjectWorksDisabled({ code: 'project_works_disabled' })).toBe(true);
		expect(isProjectWorksDisabled({ code: 'domain_rule', details: { reason: 'project_works_disabled' } })).toBe(
			true
		);
		expect(
			isProjectWorksDisabled({ code: 'domain_rule', message: 'Set EVER_WORKS_PROJECT_WORKS_ENABLED=true' })
		).toBe(true);
		expect(isProjectWorksDisabled({ code: 'domain_rule', message: 'Something else' })).toBe(false);
		expect(isProjectWorksDisabled(null)).toBe(false);
	});
});

function setup(options: { enabled?: boolean; works?: string; projectWorksEnabled?: boolean } = {}) {
	const mock = new MockEverWorksServer();
	const ewOrg = { id: 'ew-org-1', slug: 'acme', displayName: 'Acme' };
	const key = mock.addKey({ organizations: [ewOrg] });
	const works = new MockEverWorksWorks(mock);
	works.projectWorksEnabled = options.projectWorksEnabled ?? true;
	const client = new EverWorksClient({
		apiBaseUrl: 'https://api.example.test/api',
		apiKey: key,
		transport: mock.transport(),
		connectionId: 'c1',
		scopeSlug: 'acme',
		retry: { maxAttempts: 1 },
		sleep: async () => undefined
	});
	const context = {
		tenantId: 't1',
		organizationId: 'o1',
		integrationTenantId: 'm1',
		connection: { id: 'c1' },
		everWorksOrganizationSlug: 'acme',
		directions: { works: options.works ?? 'link_only' },
		isEnabled: options.enabled ?? true
	};
	const links: Array<Record<string, any>> = [];
	const linkService = {
		byEw: async (m: string, type: string, ewId: string) =>
			links.find((l) => l['integrationTenantId'] === m && l['entityType'] === type && l['ewId'] === ewId) ?? null,
		byGauzy: async (m: string, type: string, gauzyId: string) =>
			links.find((l) => l['integrationTenantId'] === m && l['entityType'] === type && l['gauzyId'] === gauzyId) ??
			null,
		list: async (m: string, type: string) =>
			links.filter((l) => l['integrationTenantId'] === m && l['entityType'] === type),
		snapshot: (link: Record<string, any> | null) => (link?.['snapshot'] ? JSON.parse(link['snapshot']) : {}),
		record: async (input: Record<string, any>) => {
			const existing = links.find(
				(l) =>
					l['entityType'] === input['entityType'] &&
					(l['ewId'] === input['ewId'] || l['gauzyId'] === input['gauzyId'])
			);
			const values = {
				gauzyId: input['gauzyId'],
				ewId: input['ewId'],
				ewVersion: input['ewVersion'] ?? null,
				snapshot: JSON.stringify(input['snapshot']),
				ewOnly: JSON.stringify(input['ewOnly']),
				lastDirection: input['direction'],
				state: 'ok'
			};
			if (existing) Object.assign(existing, values);
			else
				links.push({
					id: `l${links.length + 1}`,
					integrationTenantId: input['integrationTenantId'],
					entityType: input['entityType'],
					...values
				});
		},
		remove: async (link: Record<string, any>) => void links.splice(links.indexOf(link), 1),
		unlink: async (link: Record<string, any>) => void (link['state'] = EverWorksLinkState.UNLINKED)
	};
	const addLink = (entityType: EverWorksLinkType, gauzyId: string, ewId: string) =>
		links.push({
			id: `x-${ewId}`,
			integrationTenantId: 'm1',
			entityType,
			gauzyId,
			ewId,
			ewVersion: null,
			snapshot: null,
			ewOnly: null,
			state: 'ok'
		});
	const projects: Array<Record<string, any>> = [];
	const projectTeams = new Map<string, string[]>();
	const employees: Array<Record<string, any>> = [];
	const dataSource = {
		getRepository: (target: unknown) =>
			target === OrganizationProject
				? {
						find: async ({ where }: { where: Record<string, any> }) =>
							projects.filter((p) => !p['isArchived'] && p['organizationId'] === where['organizationId'])
					}
				: target === Employee
					? {
							findOne: async ({ where }: { where: Record<string, any> }) =>
								employees.find(
									(e) =>
										e['userId'] === where['userId'] &&
										e['organizationId'] === where['organizationId']
								) ?? null
						}
					: null,
		createQueryBuilder: () => ({
			relation: () => ({
				of: (projectId: string) => ({
					loadMany: async () => (projectTeams.get(projectId) ?? []).map((id) => ({ id }))
				})
			})
		})
	};
	const contexts = {
		forRequest: async () => context,
		forOrganization: async () => context,
		forEverWorksOrganization: async () => context
	};
	const service = new EverWorksProjectsService(
		dataSource as never,
		contexts as never,
		{ client: () => client } as never,
		linkService as never,
		{ execute: jest.fn() } as never
	);
	return { service, mock, works, ewOrg, links, addLink, projects, projectTeams, employees };
}

const postsOf = (mock: MockEverWorksServer) => mock.requests.filter((r) => r.method === 'POST' && r.path === '/works');

describe('EverWorksProjectsService — create in Ever Works (G-P2-5)', () => {
	afterEach(() => (RequestContext.currentUserId as unknown as jest.Mock).mockReturnValue(null));

	it('creates a repo-less project work, links the pair, and a second request creates nothing', async () => {
		const { service, mock, works, links, projects } = setup();
		projects.push({
			id: 'p1',
			organizationId: 'o1',
			name: 'Portal',
			description: 'Customer portal',
			projectUrl: 'https://portal.example.test'
		});
		const view = await service.decide('m1' as never, { createInEverWorks: ['p1' as never] });
		expect(view.failures).toBeUndefined();
		const [post] = postsOf(mock);
		expect(post.body).toMatchObject({
			kind: 'project',
			name: 'Portal',
			visibility: 'organization',
			teamIds: [],
			externalRef: { source: 'gauzy', externalId: 'p1' }
		});
		expect(post.headers['idempotency-key']).toMatch(/^[0-9a-f]{64}$/);
		expect(post.headers['x-sync-origin']).toBe('gauzy:c1');
		expect(post.headers['x-act-as-user']).toBeUndefined();
		const link = links.find((l) => l['entityType'] === EverWorksLinkType.PROJECT_WORK);
		expect(link).toMatchObject({ gauzyId: 'p1', lastDirection: 'outbound', ewVersion: 1 });
		expect(works.works.get(link?.['ewId'])?.['kind']).toBe('project');
		expect(view.works.find((row) => row.ewWorkId === link?.['ewId'])?.linkedProjectId).toBe('p1');
		await expect(service.decide('m1' as never, { createInEverWorks: ['p1' as never] })).rejects.toThrow(
			'already paired'
		);
		expect(postsOf(mock)).toHaveLength(1);
	});

	it('a project on a team goes out team-scoped; one on a team not paired yet is refused before anything is sent', async () => {
		const { service, mock, addLink, projects, projectTeams } = setup();
		projects.push(
			{ id: 'p1', organizationId: 'o1', name: 'Portal' },
			{ id: 'p2', organizationId: 'o1', name: 'Billing' }
		);
		projectTeams.set('p1', ['g-team-1']);
		projectTeams.set('p2', ['g-team-2']);
		addLink(EverWorksLinkType.TEAM, 'g-team-1', 'ew-team-1');
		await expect(service.decide('m1' as never, { createInEverWorks: ['p1', 'p2'] as never })).rejects.toThrow(
			'not paired with an Ever Works team yet'
		);
		expect(postsOf(mock)).toHaveLength(0);
		await service.decide('m1' as never, { createInEverWorks: ['p1'] as never });
		expect(postsOf(mock)[0].body).toMatchObject({ teamIds: ['ew-team-1'], visibility: 'team' });
	});

	it("is created as the admin's paired Ever Works user (act-as)", async () => {
		const { service, mock, addLink, projects, employees } = setup();
		projects.push({ id: 'p1', organizationId: 'o1', name: 'Portal' });
		employees.push({ id: 'e-ann', userId: 'u-ann', organizationId: 'o1' });
		addLink(EverWorksLinkType.MEMBER, 'e-ann', 'ew-ann');
		(RequestContext.currentUserId as unknown as jest.Mock).mockReturnValue('u-ann');
		await service.decide('m1' as never, { createInEverWorks: ['p1'] as never });
		expect(postsOf(mock)[0].headers['x-act-as-user']).toBe('ew-ann');
	});

	it("when Ever Works refuses the admin's user (403 act_as_forbidden), the work is created as the integration under its own key", async () => {
		const { service, mock, addLink, links, projects, employees } = setup();
		projects.push({ id: 'p1', organizationId: 'o1', name: 'Portal' });
		employees.push({ id: 'e-ann', userId: 'u-ann', organizationId: 'o1' });
		addLink(EverWorksLinkType.MEMBER, 'e-ann', 'ew-ann');
		(RequestContext.currentUserId as unknown as jest.Mock).mockReturnValue('u-ann');
		mock.fail({
			method: 'POST',
			path: '/works',
			status: 403,
			body: MockEverWorksServer.error(403, 'act_as_forbidden', 'Not a member.').data
		});
		const view = await service.decide('m1' as never, { createInEverWorks: ['p1'] as never });
		expect(view.failures).toBeUndefined();
		const [refused, fallback] = postsOf(mock);
		expect(refused.headers['x-act-as-user']).toBe('ew-ann');
		expect(fallback.headers['x-act-as-user']).toBeUndefined();
		expect(fallback.headers['idempotency-key']).not.toBe(refused.headers['idempotency-key']);
		const workLinks = links.filter((l) => l['entityType'] === EverWorksLinkType.PROJECT_WORK);
		expect(workLinks).toHaveLength(1);
		expect(workLinks[0]['gauzyId']).toBe('p1');
	});

	it('an Ever Works outage after the creates still returns their results (the view falls back to the first list)', async () => {
		const { service, mock, links, projects } = setup();
		projects.push({ id: 'p1', organizationId: 'o1', name: 'Portal' });
		let lists = 0;
		const handle = mock.handle.bind(mock);
		jest.spyOn(mock, 'handle').mockImplementation(async (request) => {
			if (request.method === 'GET' && request.url.includes('/works') && ++lists === 2)
				throw new Error('connect ECONNREFUSED');
			return handle(request);
		});
		const view = await service.decide('m1' as never, { createInEverWorks: ['p1'] as never });
		const link = links.find((l) => l['entityType'] === EverWorksLinkType.PROJECT_WORK);
		expect(link?.['gauzyId']).toBe('p1');
		expect(view.works.find((row) => row.ewWorkId === link?.['ewId'])?.linkedProjectId).toBe('p1');
		expect(view.unmatchedProjects.map((p) => p.projectId)).not.toContain('p1');
	});

	it('Ever Works with project works switched off: the reason is reported, nothing is linked, and a retry works once it is on', async () => {
		const { service, mock, works, links, projects } = setup({ projectWorksEnabled: false });
		projects.push({ id: 'p1', organizationId: 'o1', name: 'Portal' });
		const view = await service.decide('m1' as never, { createInEverWorks: ['p1'] as never });
		expect(view.failures).toEqual([
			{ projectId: 'p1', message: expect.stringContaining('EVER_WORKS_PROJECT_WORKS_ENABLED') }
		]);
		expect(links).toHaveLength(0);
		works.projectWorksEnabled = true;
		const again = await service.decide('m1' as never, { createInEverWorks: ['p1'] as never });
		expect(again.failures).toBeUndefined();
		expect(postsOf(mock)).toHaveLength(2);
		expect(links.find((l) => l['entityType'] === EverWorksLinkType.PROJECT_WORK)?.['gauzyId']).toBe('p1');
	});

	it('follows the mapping switch and the works direction, and only takes active projects of the organization', async () => {
		const off = setup({ enabled: false });
		off.projects.push({ id: 'p1', organizationId: 'o1', name: 'Portal' });
		await expect(off.service.decide('m1' as never, { createInEverWorks: ['p1'] as never })).rejects.toThrow(
			'disabled'
		);
		const noWorks = setup({ works: 'off' });
		noWorks.projects.push({ id: 'p1', organizationId: 'o1', name: 'Portal' });
		await expect(noWorks.service.decide('m1' as never, { createInEverWorks: ['p1'] as never })).rejects.toThrow(
			'not synced'
		);
		const { service, mock, projects } = setup();
		projects.push({ id: 'p-archived', organizationId: 'o1', name: 'Old', isArchived: true });
		await expect(service.decide('m1' as never, { createInEverWorks: ['p-archived'] as never })).rejects.toThrow(
			'not an active project'
		);
		expect(postsOf(mock)).toHaveLength(0);
	});

	it('an Ever Works work for the project that another project holds is never re-paired', async () => {
		const { service, works, ewOrg, addLink, links, projects } = setup();
		projects.push({ id: 'p1', organizationId: 'o1', name: 'Portal' });
		works.addWork(ewOrg.id, {
			id: 'ew-work-old',
			kind: 'project',
			externalLinks: [{ source: 'gauzy', installationId: 'c1', externalId: 'p1', externalUrl: null }]
		});
		addLink(EverWorksLinkType.PROJECT_WORK, 'p-other', 'ew-work-old');
		const view = await service.decide('m1' as never, { createInEverWorks: ['p1'] as never });
		expect(view.failures?.[0]).toMatchObject({
			projectId: 'p1',
			message: expect.stringContaining('paired with another Gauzy project')
		});
		expect(links.find((l) => l['ewId'] === 'ew-work-old')?.['gauzyId']).toBe('p-other');
	});
});
