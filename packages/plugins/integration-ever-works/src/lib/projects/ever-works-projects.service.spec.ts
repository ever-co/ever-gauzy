/**
 * Projects ↔ Works (G-P1-8, link only) against in-memory stand-ins: pairing suggestions, the shared
 * fields following Ever Works (only what changed there), members, teams, archive on delete.
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
			['Tenant', 'Organization', 'Employee', 'User', 'IntegrationTenant', 'IntegrationSetting', 'OrganizationProject', 'OrganizationProjectEmployee'].map((name) => [
				name,
				entity(name)
			])
		),
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, currentOrganizationId: () => null }
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import { ProjectStatusEnum } from '@gauzy/contracts';
import { IntegrationTenant, OrganizationProject, OrganizationProjectEmployee } from '@gauzy/core';
import { EverWorksApiError } from '../client/ever-works-client';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksProjectsService, projectStatusOf, sameUrl } from './ever-works-projects.service';

interface LinkRow {
	id: string;
	integrationTenantId: string;
	entityType: string;
	gauzyId: string;
	ewId: string;
	ewVersion: number | null;
	snapshot: string | null;
	ewOnly: string | null;
	state: string;
}

function setup() {
	const context = {
		tenantId: 't1',
		organizationId: 'o1',
		integrationTenantId: 'm1',
		connection: { id: 'c1' },
		everWorksOrganizationSlug: 'acme',
		directions: { works: 'link_only' },
		isEnabled: true
	};
	const links: LinkRow[] = [];
	// Row ids are never reused (a removed row's id never comes back), as in a database.
	let rowIds = 0;
	// Like rows read from a database: a read is a copy, so a stale read stays stale after a later write.
	const copy = (row: LinkRow | undefined) => (row ? { ...row } : null);
	const linkService = {
		byEw: async (m: string, type: string, ewId: string) => copy(links.find((l) => l.integrationTenantId === m && l.entityType === type && l.ewId === ewId)),
		byGauzy: async (m: string, type: string, gauzyId: string) => copy(links.find((l) => l.integrationTenantId === m && l.entityType === type && l.gauzyId === gauzyId)),
		list: async (m: string, type: string) => links.filter((l) => l.integrationTenantId === m && l.entityType === type).map((l) => ({ ...l })),
		snapshot: (link: LinkRow | null) => (link?.snapshot ? JSON.parse(link.snapshot) : {}),
		record: async (input: Record<string, any>) => {
			const existing = links.find((l) => l.entityType === input['entityType'] && (l.ewId === input['ewId'] || l.gauzyId === input['gauzyId']));
			const values = { gauzyId: input['gauzyId'], ewId: input['ewId'], ewVersion: input['ewVersion'] ?? null, snapshot: JSON.stringify(input['snapshot']), ewOnly: JSON.stringify(input['ewOnly']), state: 'ok' };
			if (existing) Object.assign(existing, values);
			else links.push({ id: `l${++rowIds}`, integrationTenantId: input['integrationTenantId'], entityType: input['entityType'], ...values });
		},
		remove: async (link: LinkRow) => {
			const at = links.findIndex((l) => l.id === link.id);
			if (at >= 0) links.splice(at, 1);
		},
		unlink: async (link: LinkRow) => {
			const row = links.find((l) => l.id === link.id);
			if (row) row.state = EverWorksLinkState.UNLINKED;
		},
		// Like the real conditional update: only the same pair, still synced, with the fields as read.
		patchEverWorksOnly: async (link: LinkRow, ewOnly: Record<string, unknown>) => {
			const row = links.find((l) => l.id === link.id && l.gauzyId === link.gauzyId && l.ewId === link.ewId && l.state === 'ok' && l.ewOnly === link.ewOnly);
			if (!row) return false;
			row.ewOnly = JSON.stringify(ewOnly);
			return true;
		}
	};
	const addLink = (entityType: string, gauzyId: string, ewId: string) =>
		links.push({ id: `x-${ewId}`, integrationTenantId: 'm1', entityType, gauzyId, ewId, ewVersion: null, snapshot: null, ewOnly: null, state: 'ok' });
	const projects: Array<Record<string, any>> = [];
	const members: Array<Record<string, any>> = [];
	const projectTeams = new Map<string, Set<string>>();
	const matches = (row: Record<string, any>, where: Record<string, any>) => Object.entries(where).every(([k, v]) => typeof v === 'object' || row[k] === v);
	const projectRepo = {
		findOne: async ({ where }: { where: Record<string, any> }) => projects.find((p) => p['id'] === where['id']) ?? null,
		find: async () => projects.filter((p) => !p['isArchived']),
		update: async (where: Record<string, any>, values: Record<string, any>) => {
			for (const row of projects.filter((p) => matches(p, where))) Object.assign(row, values);
		}
	};
	const memberRepo = {
		create: (values: Record<string, any>) => values,
		save: async (values: Record<string, any>) => void members.push({ id: `pm${members.length + 1}`, ...values }),
		findOne: async ({ where }: { where: Record<string, any> }) => members.find((m) => matches(m, where)) ?? null,
		update: async (where: Record<string, any>, values: Record<string, any>) => {
			for (const row of members.filter((m) => matches(m, where))) Object.assign(row, values);
		},
		delete: async (where: Record<string, any>) => {
			for (const row of members.filter((m) => matches(m, where))) members.splice(members.indexOf(row), 1);
		}
	};
	const mappingRepo = {
		find: async () => [{ id: 'm1', tenantId: 't1', organizationId: 'o1', settings: [{ settingsName: 'CONNECTION_ID', settingsValue: 'c1' }] }]
	};
	const dataSource = {
		getRepository: (target: unknown) =>
			target === OrganizationProject ? projectRepo : target === OrganizationProjectEmployee ? memberRepo : target === IntegrationTenant ? mappingRepo : null,
		createQueryBuilder: () => ({
			relation: () => ({
				of: (projectId: string) => ({
					loadMany: async () => [...(projectTeams.get(projectId) ?? [])].map((id) => ({ id })),
					addAndRemove: async (add: string[], remove: string[]) => {
						const set = projectTeams.get(projectId) ?? new Set<string>();
						for (const id of add) set.add(id);
						for (const id of remove) set.delete(id);
						projectTeams.set(projectId, set);
					}
				})
			})
		})
	};
	const client = { request: jest.fn(async (): Promise<any> => ({ data: [], nextCursor: null, hasMore: false })) };
	const commandBus = {
		execute: jest.fn(async (command: { input: Record<string, any> }) => {
			const row = { id: `p-new-${projects.length + 1}`, ...command.input };
			projects.push(row);
			return row;
		})
	};
	const contexts = { forEverWorksOrganization: async () => context, forRequest: async () => context, forOrganization: async () => context };
	const service = new EverWorksProjectsService(dataSource as never, contexts as never, { client: () => client } as never, linkService as never, commandBus as never);
	return { service, links, linkService, addLink, projects, members, projectTeams, client, commandBus, context };
}

const work = {
	name: 'Acme Site',
	slug: 'acme-site',
	kind: 'website',
	status: 'active',
	website: 'https://acme.example.test',
	repoUrls: ['https://github.com/acme/site'],
	members: [{ userId: 'ew-ann', role: 'owner' }],
	teamIds: ['ew-team-1']
};
const envelope = (type: string, data: Record<string, unknown>, version = 3) => ({
	id: 'evt',
	seq: '1',
	type,
	tenantId: 'ewt',
	organizationId: 'ewo1',
	aggregate: { type: 'work', id: 'ew-work-1', version },
	data
});
const applyContext = { connection: { id: 'c1' }, event: {}, organizationId: 'o1' } as never;

describe('projects ↔ works helpers', () => {
	it('URLs compare loosely; statuses map open / in progress, archived is not a status', () => {
		expect(sameUrl('https://GitHub.com/acme/site.git', 'https://github.com/acme/site/')).toBe(true);
		expect(sameUrl('', '')).toBe(false);
		expect(sameUrl('https://github.com/acme/site.git/', 'https://github.com/acme/site')).toBe(true);
		expect(projectStatusOf('draft')).toBe(ProjectStatusEnum.OPEN);
		expect(projectStatusOf('registered')).toBe(ProjectStatusEnum.IN_PROGRESS);
		expect(projectStatusOf('archived')).toBeNull();
	});
});

describe('EverWorksProjectsService', () => {
	it('suggests a pair by URL before name, and keeps suggested projects unmatched until paired', async () => {
		const { service, projects, client } = setup();
		projects.push({ id: 'p-url', name: 'Website', openSourceProjectUrl: 'https://github.com/acme/site.git' });
		projects.push({ id: 'p-name', name: 'acme site' });
		client.request.mockResolvedValueOnce({ data: [{ id: 'ew-work-1', ...work }], nextCursor: null, hasMore: false });
		const view = await service.projects('m1' as never);
		expect(view.works[0].suggestion).toEqual({ projectId: 'p-url', reason: 'same_url' });
		expect(view.unmatchedProjects.map((p) => p.projectId).sort()).toEqual(['p-name', 'p-url']);
	});

	it('pairing changes neither record; afterwards only what changed in Ever Works is written', async () => {
		const { service, projects, client, members, projectTeams, addLink } = setup();
		projects.push({ id: 'p1', name: 'Our name', description: 'Gauzy text', status: 'open' });
		addLink(EverWorksLinkType.MEMBER, 'emp-ann', 'ew-ann');
		addLink(EverWorksLinkType.MEMBER, 'emp-bob', 'ew-bob');
		addLink(EverWorksLinkType.TEAM, 'g-team-1', 'ew-team-1');
		addLink(EverWorksLinkType.TEAM, 'g-team-2', 'ew-team-2');
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work, description: 'EW text', version: 2 }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }] });
		expect(projects[0]).toMatchObject({ name: 'Our name', description: 'Gauzy text' });
		// Ever Works renames the work, adds Bob as manager and moves it to another team; the description is unchanged.
		const outcome = await service.apply(
			envelope('work.updated', {
				...work,
				name: 'Acme Website',
				description: 'EW text',
				members: [{ userId: 'ew-ann', role: 'owner' }, { userId: 'ew-bob', role: 'manager' }],
				teamIds: ['ew-team-2']
			}) as never,
			applyContext
		);
		expect(outcome).toEqual({ status: 'applied' });
		expect(projects[0]).toMatchObject({ name: 'Acme Website', description: 'Gauzy text' });
		expect(members).toEqual([expect.objectContaining({ organizationProjectId: 'p1', employeeId: 'emp-bob', isManager: true })]);
		expect([...(projectTeams.get('p1') ?? [])]).toEqual(['g-team-2']);
	});

	it('a work that is not paired is never created on its own; archived and deleted archive the project', async () => {
		const { service, projects, client, links } = setup();
		expect(await service.apply(envelope('work.created', work) as never, applyContext)).toMatchObject({ status: 'skipped' });
		expect(projects).toHaveLength(0);
		projects.push({ id: 'p1', name: 'Acme Site' });
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }] });
		await service.apply(envelope('work.archived', { ...work, status: 'archived' }, 4) as never, applyContext);
		expect(projects[0]['isArchived']).toBe(true);
		await service.apply(envelope('work.deleted', { ...work, deleted: true }, 5) as never, applyContext);
		expect(links.find((l) => l.entityType === EverWorksLinkType.PROJECT_WORK)?.state).toBe(EverWorksLinkState.UNLINKED);
	});

	it('"create from work" goes through the platform project command and links the new project', async () => {
		const { service, client, commandBus, links, addLink, members } = setup();
		addLink(EverWorksLinkType.MEMBER, 'emp-ann', 'ew-ann');
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work, version: 6 }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { createInGauzy: ['ew-work-1'] });
		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		expect((commandBus.execute.mock.calls[0] as unknown as [{ input: Record<string, unknown> }])[0].input).toMatchObject({
			name: 'Acme Site',
			tenantId: 't1',
			organizationId: 'o1',
			projectUrl: 'https://acme.example.test',
			openSourceProjectUrl: 'https://github.com/acme/site',
			status: ProjectStatusEnum.IN_PROGRESS
		});
		expect(links.find((l) => l.entityType === EverWorksLinkType.PROJECT_WORK)).toMatchObject({ ewId: 'ew-work-1', ewVersion: 6 });
		expect(members).toEqual([expect.objectContaining({ employeeId: 'emp-ann', isManager: true })]);
	});

	it('a work paired on the Projects tab, or made into a project, links back to its Gauzy project (local e2e)', async () => {
		const { service, projects, client, links } = setup();
		projects.push({ id: 'p1', name: 'Our name' });
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work }, { id: 'ew-work-2', ...work, name: 'Other' }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }], createInGauzy: ['ew-work-2'] });
		const puts = () => client.request.mock.calls.filter((call) => (call as unknown[])[0] === 'PUT');
		// Off the Projects tab's response: the sweep sends them.
		expect(puts()).toEqual([]);
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		// Like a task created from Ever Works (and like a work Gauzy created, through its externalRef).
		expect(puts()).toEqual([
			['PUT', '/links/work/ew-work-1', { body: { externalId: 'p1', installationId: 'c1' } }],
			['PUT', '/links/work/ew-work-2', { body: { externalId: projects[1]?.['id'], installationId: 'c1' } }]
		]);
		expect(links.filter((l) => l.entityType === EverWorksLinkType.PROJECT_WORK).map((l) => JSON.parse(l.ewOnly as string)['linkedBack'])).toEqual(['p1', projects[1]?.['id']]);
		// Sent once: the next sweep has nothing to link back.
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(puts()).toHaveLength(2);
	});

	it('a refused link back never undoes the pairing and is tried again by a later sweep', async () => {
		const { service, projects, client, links } = setup();
		projects.push({ id: 'p1', name: 'Our name' });
		let refuse = true;
		client.request.mockImplementation(async (...args: unknown[]) => {
			if (args[0] === 'PUT' && refuse) throw new EverWorksApiError(404, 'not_found', 'Not found.');
			return { data: [{ id: 'ew-work-1', ...work }], nextCursor: null, hasMore: false };
		});
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }] });
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		const pair = links.find((l) => l.entityType === EverWorksLinkType.PROJECT_WORK);
		expect(pair).toMatchObject({ gauzyId: 'p1', ewId: 'ew-work-1', state: 'ok' });
		expect(JSON.parse(pair?.ewOnly as string)['linkedBack']).toBeNull();
		refuse = false;
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(client.request.mock.calls.filter((call) => (call as unknown[])[0] === 'PUT')).toHaveLength(2);
		expect(JSON.parse(pair?.ewOnly as string)['linkedBack']).toBe('p1');
	});

	it('a work paired again while its link-back is on the way gets the newer project (#11049 review)', async () => {
		const { service, projects, client, links } = setup();
		projects.push({ id: 'p1', name: 'First' }, { id: 'p2', name: 'Second' });
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }] });
		client.request.mockImplementation(async (...args: unknown[]) => {
			if (args[0] === 'PUT' && (args[2] as { body: { externalId: string } }).body.externalId === 'p1') {
				// The admin pairs the work with another project while the first link-back is on the way.
				await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p2' }] });
			}
			return { data: [{ id: 'ew-work-1', ...work }], nextCursor: null, hasMore: false };
		});
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		const pair = links.find((l) => l.entityType === EverWorksLinkType.PROJECT_WORK);
		expect(pair).toMatchObject({ gauzyId: 'p2' });
		// The older link-back is not recorded for the new pair, so the next sweep sends the newer project.
		expect(JSON.parse(pair?.ewOnly as string)['linkedBack']).toBeNull();
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		const puts = client.request.mock.calls.filter((call) => (call as unknown[])[0] === 'PUT').map((call) => (call as unknown[])[2]);
		expect(puts).toEqual([{ body: { externalId: 'p1', installationId: 'c1' } }, { body: { externalId: 'p2', installationId: 'c1' } }]);
		expect(JSON.parse(pair?.ewOnly as string)['linkedBack']).toBe('p2');
	});

	it('pairs Ever Works keeps refusing never hold up the others (#11049 review)', async () => {
		const { service, projects, client, links } = setup();
		const ids = Array.from({ length: 51 }, (_, i) => i);
		for (const i of ids) projects.push({ id: `p${i}`, name: `Project ${i}` });
		const works = ids.map((i) => ({ id: `ew-work-${i}`, ...work, name: `Work ${i}` }));
		client.request.mockImplementation(async (...args: unknown[]) => {
			// The first 50 works are refused every time (e.g. not visible to the key any more).
			if (args[0] === 'PUT' && Number(String(args[1]).split('-').pop()) < 50) throw new EverWorksApiError(404, 'not_found', 'Not found.');
			return { data: works, nextCursor: null, hasMore: false };
		});
		await service.decide('m1' as never, { links: ids.map((i) => ({ ewWorkId: `ew-work-${i}`, projectId: `p${i}` })) });
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		const last = links.find((l) => l.ewId === 'ew-work-50');
		expect(JSON.parse(last?.ewOnly as string)['linkedBack']).toBe('p50');
	});

	it('a work unpaired while its link-back is on the way stays unpaired (#11049 review)', async () => {
		const { service, projects, client, links } = setup();
		projects.push({ id: 'p1', name: 'First' });
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }] });
		client.request.mockImplementation(async (...args: unknown[]) => {
			if (args[0] === 'PUT') await service.decide('m1' as never, { unlinks: ['ew-work-1'] });
			return { data: [{ id: 'ew-work-1', ...work }], nextCursor: null, hasMore: false };
		});
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(links.filter((l) => l.entityType === EverWorksLinkType.PROJECT_WORK)).toEqual([]);
	});

	/** The `DELETE /links/work/:id` calls the client made. */
	const deletes = (client: { request: jest.Mock }) => client.request.mock.calls.filter((call) => (call as unknown[])[0] === 'DELETE');

	it('a work unpaired on the Projects tab loses the Gauzy link in Ever Works, this installation only (I3c)', async () => {
		const { service, projects, client, links } = setup();
		projects.push({ id: 'p1', name: 'Our name' });
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }] });
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(deletes(client)).toEqual([]);
		await service.decide('m1' as never, { unlinks: ['ew-work-1'] });
		expect(links.filter((l) => l.entityType === EverWorksLinkType.PROJECT_WORK)).toEqual([]);
		expect(deletes(client)).toEqual([['DELETE', '/links/work/ew-work-1', { query: { installationId: 'c1' } }]]);
	});

	it('a project paired with another work: the old work loses the link; a work paired with another project keeps one (I3c)', async () => {
		const { service, projects, client, links } = setup();
		projects.push({ id: 'p1', name: 'First' }, { id: 'p2', name: 'Second' });
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work }, { id: 'ew-work-2', ...work, name: 'Other' }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }] });
		// p1 now goes with ew-work-2: ew-work-1 is unpaired.
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-2', projectId: 'p1' }] });
		expect(deletes(client)).toEqual([['DELETE', '/links/work/ew-work-1', { query: { installationId: 'c1' } }]]);
		// ew-work-2 now goes with p2: still paired, so its link is replaced by the sweep, never removed.
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-2', projectId: 'p2' }] });
		expect(deletes(client)).toHaveLength(1);
		expect(links.filter((l) => l.entityType === EverWorksLinkType.PROJECT_WORK).map((l) => [l.ewId, l.gauzyId])).toEqual([['ew-work-2', 'p2']]);
	});

	it('a work unpaired and paired again in one request keeps its link; a refused removal never fails the tab (I3c)', async () => {
		const { service, projects, client, links } = setup();
		projects.push({ id: 'p1', name: 'First' }, { id: 'p2', name: 'Second' });
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work }, { id: 'ew-work-2', ...work, name: 'Other' }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }, { ewWorkId: 'ew-work-2', projectId: 'p2' }] });
		await service.decide('m1' as never, { unlinks: ['ew-work-1'], links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }] });
		expect(deletes(client)).toEqual([]);
		client.request.mockImplementation(async (...args: unknown[]) => {
			if (args[0] === 'DELETE') throw new EverWorksApiError(500, 'internal_error', 'Try again.');
			return { data: [{ id: 'ew-work-1', ...work }, { id: 'ew-work-2', ...work, name: 'Other' }], nextCursor: null, hasMore: false };
		});
		await expect(service.decide('m1' as never, { unlinks: ['ew-work-1', 'ew-work-2'] })).resolves.toBeDefined();
		expect(deletes(client)).toHaveLength(2);
		expect(links.filter((l) => l.entityType === EverWorksLinkType.PROJECT_WORK)).toEqual([]);
	});

	/**
	 * Ever Works' own record of the links (`GET /links?entityType=work`), and a client that answers it, the works list
	 * and the writes; `fail(method)` makes the next call of that method fail once.
	 */
	const remote = (client: { request: jest.Mock }, works: Array<Record<string, unknown>>) => {
		let state = { links: [] as Array<Record<string, unknown>>, failNext: new Set<string>(), pageSize: 0 };
		client.request.mockImplementation(async (...args: unknown[]) => {
			const [method, path, options] = args as [string, string, { body?: Record<string, unknown>; query?: Record<string, string> }];
			if (state.failNext.delete(method)) throw new EverWorksApiError(503, 'unavailable', 'Try again.');
			const workId = path.split('/').pop();
			if (method === 'GET' && path === '/links') {
				const all = state.links.map((link) => ({ entityType: 'work', source: 'gauzy', ...link }));
				if (!state.pageSize) return { data: all };
				// Paged like the other lists: `cursor` is the offset of the page.
				const at = Number(options.query?.['cursor'] ?? 0);
				const next = at + state.pageSize;
				return { data: all.slice(at, next), hasMore: next < all.length, nextCursor: next < all.length ? String(next) : null };
			}
			if (method === 'PUT') {
				state.links = state.links.filter((link) => !(link['entityId'] === workId && link['installationId'] === options.body?.['installationId']));
				state.links.push({ entityId: workId, installationId: options.body?.['installationId'], externalId: options.body?.['externalId'] });
				return {};
			}
			if (method === 'DELETE') {
				state.links = state.links.filter((link) => !(link['entityId'] === workId && link['installationId'] === options.query?.['installationId']));
				return undefined;
			}
			return { data: works, nextCursor: null, hasMore: false };
		});
		return state;
	};

	it('a removal Ever Works did not take is made by a later sweep (#11054 review)', async () => {
		const { service, projects, client } = setup();
		projects.push({ id: 'p1', name: 'First' });
		const ew = remote(client, [{ id: 'ew-work-1', ...work }]);
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }] });
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(ew.links).toEqual([expect.objectContaining({ entityId: 'ew-work-1', installationId: 'c1', externalId: 'p1' })]);
		ew.failNext.add('DELETE');
		await service.decide('m1' as never, { unlinks: ['ew-work-1'] });
		expect(ew.links).toHaveLength(1);
		// The sweep sees the work keep a Gauzy link with no pair, and removes it (this installation's only).
		ew.links.push({ entityId: 'ew-work-9', installationId: 'c-other', externalId: 'p9' });
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(ew.links).toEqual([expect.objectContaining({ entityId: 'ew-work-9', installationId: 'c-other' })]);
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(deletes(client)).toHaveLength(2);
	});

	it('every page of the links is read, and a pair on a later page is never taken for one with no link (#11054 review)', async () => {
		const { service, projects, client, links } = setup();
		const works = [1, 2, 3].map((i) => ({ id: `ew-work-${i}`, ...work, name: `Work ${i}` }));
		projects.push({ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }, { id: 'p3', name: 'Three' });
		const ew = remote(client, works);
		await service.decide('m1' as never, { links: [1, 2, 3].map((i) => ({ ewWorkId: `ew-work-${i}`, projectId: `p${i}` })) });
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		const puts = () => client.request.mock.calls.filter((call) => (call as unknown[])[0] === 'PUT').length;
		expect(puts()).toBe(3);
		ew.pageSize = 1;
		// A stale link on the last page is removed, and no pair is linked back again.
		ew.links.push({ entityId: 'ew-work-9', installationId: 'c1', externalId: 'p9' });
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(ew.links.map((link) => link['entityId'])).toEqual(['ew-work-1', 'ew-work-2', 'ew-work-3']);
		expect(puts()).toBe(3);
		expect(links.map((l) => JSON.parse(l.ewOnly as string)['linkedBack'])).toEqual(['p1', 'p2', 'p3']);
		// A list that cannot be read to its end clears no marker.
		client.request.mockImplementationOnce(async () => ({ data: [], hasMore: true, nextCursor: null }));
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(puts()).toBe(3);
	});

	it('a link a late removal took from a pair made again is put back by the next sweep (#11054 review)', async () => {
		const { service, projects, client, links } = setup();
		projects.push({ id: 'p1', name: 'First' });
		const ew = remote(client, [{ id: 'ew-work-1', ...work }]);
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }] });
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(JSON.parse(links[0]?.ewOnly as string)['linkedBack']).toBe('p1');
		// A removal from an earlier removed pair arrives after the pair was made and linked back again.
		ew.links = [];
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(ew.links).toEqual([expect.objectContaining({ entityId: 'ew-work-1', installationId: 'c1', externalId: 'p1' })]);
		expect(JSON.parse(links[0]?.ewOnly as string)['linkedBack']).toBe('p1');
		expect(deletes(client)).toEqual([]);
	});

	it('a member or team saved by the same sweep keeps the link-back (#11049 review)', async () => {
		const { service, client, addLink, links } = setup();
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { createInGauzy: ['ew-work-1'] }); // Ann is not paired yet
		addLink(EverWorksLinkType.MEMBER, 'emp-ann', 'ew-ann');
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		const pair = links.find((l) => l.entityType === EverWorksLinkType.PROJECT_WORK);
		expect(JSON.parse(pair?.ewOnly as string)).toMatchObject({ unmappedMembers: [], linkedBack: pair?.gauzyId });
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(client.request.mock.calls.filter((call) => (call as unknown[])[0] === 'PUT')).toHaveLength(1);
	});

	it('a key Ever Works no longer takes (401) ends the run, unstamped (#11049 review)', async () => {
		const { service, projects, client, links } = setup();
		projects.push({ id: 'p1', name: 'First' }, { id: 'p2', name: 'Second' });
		client.request.mockImplementation(async (...args: unknown[]) => {
			if (args[0] === 'PUT') throw new EverWorksApiError(401, 'unauthorized', 'The key was revoked.');
			return { data: [{ id: 'ew-work-1', ...work }, { id: 'ew-work-2', ...work, name: 'Other' }], nextCursor: null, hasMore: false };
		});
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }, { ewWorkId: 'ew-work-2', projectId: 'p2' }] });
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(client.request.mock.calls.filter((call) => (call as unknown[])[0] === 'PUT')).toHaveLength(1);
		expect(links.filter((l) => l.entityType === EverWorksLinkType.PROJECT_WORK).map((l) => JSON.parse(l.ewOnly as string)['linkBackTriedAt'])).toEqual([null, null]);
	});

	it('a marker refused by an Ever Works event written in between is made on a fresh read (#11049 review)', async () => {
		const { service, projects, client, links, linkService } = setup();
		projects.push({ id: 'p1', name: 'Our name' });
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }] });
		const patch = linkService.patchEverWorksOnly;
		const spy = jest.spyOn(linkService, 'patchEverWorksOnly').mockImplementationOnce(async (link, ewOnly) => {
			// An Ever Works event rewrites the pair's Ever Works-only fields between the read and this write.
			const row = links.find((l) => l.ewId === 'ew-work-1') as { ewOnly: string | null };
			row.ewOnly = JSON.stringify({ ...JSON.parse(row.ewOnly as string), slug: 'renamed' });
			return patch(link, ewOnly);
		});
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(spy).toHaveBeenCalledTimes(2);
		expect(JSON.parse(links.find((l) => l.ewId === 'ew-work-1')?.ewOnly as string)).toMatchObject({ slug: 'renamed', linkedBack: 'p1' });
	});

	it('a disabled mapping, or works switched off, writes nothing', async () => {
		const serviceFor = (context: Record<string, unknown>) =>
			new EverWorksProjectsService({} as never, { forEverWorksOrganization: async () => context } as never, {} as never, {} as never, {} as never);
		expect(await serviceFor({ isEnabled: false, directions: { works: 'link_only' } }).apply(envelope('work.updated', work) as never, applyContext)).toMatchObject({
			status: 'skipped',
			message: 'the mapping is disabled'
		});
		expect(await serviceFor({ isEnabled: true, directions: { works: 'off' } }).apply(envelope('work.updated', work) as never, applyContext)).toMatchObject({
			status: 'skipped',
			message: 'works are not synced'
		});
	});

	it('"create from work" on the Projects tab follows the mapping switch and the works direction', async () => {
		const { service, client, commandBus, context } = setup();
		context.isEnabled = false;
		await expect(service.decide('m1' as never, { createInGauzy: ['ew-work-1'] })).rejects.toThrow('The mapping is disabled');
		context.isEnabled = true;
		context.directions.works = 'off';
		await expect(service.decide('m1' as never, { createInGauzy: ['ew-work-1'] })).rejects.toThrow('Works are not synced');
		expect(commandBus.execute).not.toHaveBeenCalled();
		expect(client.request).not.toHaveBeenCalled();
	});

	it('private works never sync: not listed, cannot be paired, and a linked work that turns private stops syncing', async () => {
		const { service, projects, client, links } = setup();
		projects.push({ id: 'p1', name: 'Acme Site' });
		client.request.mockResolvedValue({
			data: [
				{ id: 'ew-work-1', ...work },
				{ id: 'ew-secret', ...work, name: 'Secret', visibility: 'private' }
			],
			nextCursor: null,
			hasMore: false
		});
		expect((await service.projects('m1' as never)).works.map((row) => row.ewWorkId)).toEqual(['ew-work-1']);
		await expect(service.decide('m1' as never, { links: [{ ewWorkId: 'ew-secret', projectId: 'p1' }] })).rejects.toThrow('private');
		await expect(service.decide('m1' as never, { createInGauzy: ['ew-secret'] })).rejects.toThrow('private');
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }] });
		expect(await service.apply(envelope('work.updated', { ...work, name: 'Renamed', visibility: 'private' }, 4) as never, applyContext)).toMatchObject({
			status: 'skipped'
		});
		expect(projects[0]['name']).toBe('Acme Site');
		expect(links.find((l) => l.entityType === EverWorksLinkType.PROJECT_WORK)?.state).toBe(EverWorksLinkState.UNLINKED);
	});

	it('a project created from an archived work is archived', async () => {
		const { service, client, projects } = setup();
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work, status: 'archived' }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { createInGauzy: ['ew-work-1'] });
		expect(projects).toHaveLength(1);
		expect(projects[0]).toMatchObject({ isArchived: true });
	});

	it('members and teams Gauzy could not map join the project once they are paired (sweep)', async () => {
		const { service, client, members, projectTeams, addLink, links } = setup();
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { createInGauzy: ['ew-work-1'] }); // Ann and team 1 are not paired yet
		expect(members).toHaveLength(0);
		const link = links.find((l) => l.entityType === EverWorksLinkType.PROJECT_WORK)!;
		expect(JSON.parse(link.ewOnly as string)).toMatchObject({ unmappedMembers: ['ew-ann'], unmappedTeams: ['ew-team-1'] });
		addLink(EverWorksLinkType.MEMBER, 'emp-ann', 'ew-ann'); // paired on the People tab
		addLink(EverWorksLinkType.TEAM, 'g-team-1', 'ew-team-1'); // and on the Teams tab
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(members).toEqual([expect.objectContaining({ organizationProjectId: link.gauzyId, employeeId: 'emp-ann', isManager: true })]);
		expect([...(projectTeams.get(link.gauzyId) ?? [])]).toEqual(['g-team-1']);
		expect(JSON.parse(link.ewOnly as string)).toMatchObject({ unmappedMembers: [], unmappedTeams: [], kind: 'website', repoUrls: ['https://github.com/acme/site'] });
	});

	it('work member events are applied by member, never skipped by a work version another member moved on (review F75)', async () => {
		const { service, client, projects, members, addLink, links } = setup();
		projects.push({ id: 'p1', name: 'Acme Site' });
		addLink(EverWorksLinkType.MEMBER, 'emp-ann', 'ew-ann');
		addLink(EverWorksLinkType.MEMBER, 'emp-bob', 'ew-bob');
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work, members: [], version: 3 }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }] });
		await service.apply(envelope('work.updated', { ...work, members: [] }, 3) as never, applyContext);
		// Bob's add (v5) is delivered before Ann's (v4).
		await service.apply(envelope('work.member.added', { userId: 'ew-bob', role: 'editor' }, 5) as never, applyContext);
		expect(await service.apply(envelope('work.member.added', { userId: 'ew-ann', role: 'editor' }, 4) as never, applyContext)).toEqual({ status: 'applied' });
		expect(members.map((m) => m['employeeId']).sort()).toEqual(['emp-ann', 'emp-bob']);
		const link = links.find((l) => l.entityType === EverWorksLinkType.PROJECT_WORK)!;
		expect(link.ewVersion).toBe(5);
		// The same member's older event stays skipped.
		await service.apply(envelope('work.member.removed', { userId: 'ew-bob', role: 'editor', deleted: true }, 6) as never, applyContext);
		expect(await service.apply(envelope('work.member.added', { userId: 'ew-bob', role: 'editor' }, 5) as never, applyContext)).toMatchObject({ status: 'skipped' });
		expect(members.map((m) => m['employeeId'])).toEqual(['emp-ann']);
	});

	it('"create from work" makes a project for a work whose earlier pair stopped syncing (review F80)', async () => {
		const { service, client, links, projects, commandBus } = setup();
		// The work was paired with p1, turned private (the pair unlinked) and is public again: the tab lists it unpaired.
		projects.push({ id: 'p1', name: 'Acme Site' });
		links.push({ id: 'old', integrationTenantId: 'm1', entityType: EverWorksLinkType.PROJECT_WORK, gauzyId: 'p1', ewId: 'ew-work-1', ewVersion: 2, snapshot: null, ewOnly: null, state: EverWorksLinkState.UNLINKED });
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work, version: 7 }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { createInGauzy: ['ew-work-1'] });
		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		const pairs = links.filter((l) => l.entityType === EverWorksLinkType.PROJECT_WORK);
		expect(pairs).toEqual([expect.objectContaining({ ewId: 'ew-work-1', gauzyId: 'p-new-2', state: 'ok' })]);
	});

	it('the project sweep goes on past a pair it cannot sweep, and skips a project deleted in Gauzy (review F76)', async () => {
		const { service, client, members, addLink, links, projects } = setup();
		for (const id of ['ew-work-1', 'ew-work-2', 'ew-work-3']) {
			client.request.mockResolvedValueOnce({ data: [{ ...work, id, teamIds: [] }], nextCursor: null, hasMore: false });
			await service.decide('m1' as never, { createInGauzy: [id] });
		}
		const projectOf = (ewId: string) => links.find((l) => l.entityType === EverWorksLinkType.PROJECT_WORK && l.ewId === ewId)!.gauzyId;
		projects.splice(projects.findIndex((p) => p['id'] === projectOf('ew-work-1')), 1); // deleted in Gauzy
		const failing = projectOf('ew-work-2');
		const push = members.push.bind(members);
		members.push = (...rows: Array<Record<string, any>>) => {
			if (rows.some((row) => row['organizationProjectId'] === failing)) throw new Error('a constraint refused the member');
			return push(...rows);
		};
		addLink(EverWorksLinkType.MEMBER, 'emp-ann', 'ew-ann'); // paired: Ann joins every project at the next sweep
		client.request.mockResolvedValue({ data: [], nextCursor: null, hasMore: false });
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(members.map((m) => m['organizationProjectId'])).toEqual([projectOf('ew-work-3')]);
	});

	it('a member event keeps the kind, the slug and every repository URL on the link', async () => {
		const { service, client, links, projects, members, addLink } = setup();
		projects.push({ id: 'p1', name: 'Acme Site' });
		addLink(EverWorksLinkType.MEMBER, 'emp-bob', 'ew-bob');
		const repoUrls = ['https://github.com/acme/site', 'https://gitlab.example.test/acme/site'];
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work, repoUrls, webUrl: 'https://ever.works.test/acme/site' }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { links: [{ ewWorkId: 'ew-work-1', projectId: 'p1' }] });
		await service.apply(envelope('work.member.added', { userId: 'ew-bob', role: 'editor' }, 4) as never, applyContext);
		expect(members).toEqual([expect.objectContaining({ organizationProjectId: 'p1', employeeId: 'emp-bob', isManager: false })]);
		const link = links.find((l) => l.entityType === EverWorksLinkType.PROJECT_WORK)!;
		expect(JSON.parse(link.ewOnly as string)).toMatchObject({ slug: 'acme-site', kind: 'website', webUrl: 'https://ever.works.test/acme/site', repoUrls });
		expect(JSON.parse(link.snapshot as string).repoUrl).toBe('https://github.com/acme/site');
	});

	it('accepting suggestions pairs the unambiguous ones and leaves a project suggested for two works to the admin', async () => {
		const { service, projects, client, links } = setup();
		projects.push({ id: 'p-shared', name: 'Shared', openSourceProjectUrl: 'https://github.com/acme/mono' });
		projects.push({ id: 'p-docs', name: 'Docs' });
		client.request.mockResolvedValue({
			data: [
				{ id: 'ew-web', name: 'Web', repoUrls: ['https://github.com/acme/mono'] },
				{ id: 'ew-api', name: 'API', repoUrls: ['https://github.com/acme/mono.git'] },
				{ id: 'ew-docs', name: 'Docs' }
			],
			nextCursor: null,
			hasMore: false
		});
		const view = await service.decide('m1' as never, { acceptSuggestions: true });
		expect(links.filter((l) => l.entityType === EverWorksLinkType.PROJECT_WORK).map((l) => [l.ewId, l.gauzyId])).toEqual([['ew-docs', 'p-docs']]);
		expect(view.works.find((row) => row.ewWorkId === 'ew-web')?.suggestion).toEqual({ projectId: 'p-shared', reason: 'same_url' });
	});

	it('two overlapping "create from work" requests create one project', async () => {
		const { service, client, commandBus, projects } = setup();
		client.request.mockResolvedValue({ data: [{ id: 'ew-work-1', ...work }], nextCursor: null, hasMore: false });
		await Promise.all([service.decide('m1' as never, { createInGauzy: ['ew-work-1'] }), service.decide('m1' as never, { createInGauzy: ['ew-work-1'] })]);
		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		expect(projects).toHaveLength(1);
	});
});
