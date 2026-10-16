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
	const linkService = {
		byEw: async (m: string, type: string, ewId: string) => links.find((l) => l.integrationTenantId === m && l.entityType === type && l.ewId === ewId) ?? null,
		byGauzy: async (m: string, type: string, gauzyId: string) => links.find((l) => l.integrationTenantId === m && l.entityType === type && l.gauzyId === gauzyId) ?? null,
		list: async (m: string, type: string) => links.filter((l) => l.integrationTenantId === m && l.entityType === type),
		snapshot: (link: LinkRow | null) => (link?.snapshot ? JSON.parse(link.snapshot) : {}),
		record: async (input: Record<string, any>) => {
			const existing = links.find((l) => l.entityType === input['entityType'] && (l.ewId === input['ewId'] || l.gauzyId === input['gauzyId']));
			const values = { gauzyId: input['gauzyId'], ewId: input['ewId'], ewVersion: input['ewVersion'] ?? null, snapshot: JSON.stringify(input['snapshot']), ewOnly: JSON.stringify(input['ewOnly']), state: 'ok' };
			if (existing) Object.assign(existing, values);
			else links.push({ id: `l${links.length + 1}`, integrationTenantId: input['integrationTenantId'], entityType: input['entityType'], ...values });
		},
		remove: async (link: LinkRow) => void links.splice(links.indexOf(link), 1),
		unlink: async (link: LinkRow) => void (link.state = EverWorksLinkState.UNLINKED)
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
	return { service, links, addLink, projects, members, projectTeams, client, commandBus, context };
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

	it('private works never sync: not listed, not pairable, and a linked work that turns private stops syncing', async () => {
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
