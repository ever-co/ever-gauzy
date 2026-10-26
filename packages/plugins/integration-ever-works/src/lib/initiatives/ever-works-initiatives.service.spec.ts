/**
 * G-P2-2 Missions ↔ Strategic Initiatives against in-memory Gauzy stand-ins and the mock Ever Works API
 * (real client): the Initiatives tab pairs by title (leadership never offered); a mission created after
 * the mapping becomes an initiative; its status, teams, works and primary goals follow; an initiative
 * becomes a PAUSED mission (never activated), finishing it completes the mission; leadership and drafts
 * never go.
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
		TenantBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		...Object.fromEntries(
			[
				'Tenant',
				'Organization',
				'Employee',
				'User',
				'IntegrationTenant',
				'IntegrationSetting',
				'Goal',
				'OrganizationStrategicInitiative'
			].map((name) => [name, entity(name)])
		),
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, currentOrganizationId: () => null }
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import { Goal, IntegrationTenant, OrganizationStrategicInitiative } from '@gauzy/core';
import { EverWorksClient } from '../client/ever-works-client';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { MockEverWorksMissions } from '../testing/mock-ever-works.missions';
import { MockEverWorksServer } from '../testing/mock-ever-works.server';
import { EverWorksInitiativesService } from './ever-works-initiatives.service';

type Row = Record<string, any>;

function setup(options: { missions?: string } = {}) {
	const mock = new MockEverWorksServer();
	const ewOrg = { id: 'ew-org-1', slug: 'acme', displayName: 'Acme' };
	const key = mock.addKey({ organizations: [ewOrg] });
	const missionsMock = new MockEverWorksMissions(mock);
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
		mapping: { id: 'm1', settings: [], createdAt: new Date('2026-10-01T00:00:00Z') },
		connection: { id: 'c1', connectedByUserId: 'u-admin' },
		everWorksOrganizationSlug: 'acme',
		directions: { missions: options.missions ?? 'both' },
		isEnabled: true
	};
	const links: Row[] = [];
	const linkService = {
		byEw: async (m: string, type: string, ewId: string) =>
			links.find((l) => l['integrationTenantId'] === m && l['entityType'] === type && l['ewId'] === ewId) ?? null,
		byGauzy: async (m: string, type: string, gauzyId: string) =>
			links.find((l) => l['integrationTenantId'] === m && l['entityType'] === type && l['gauzyId'] === gauzyId) ??
			null,
		list: async (m: string, type: string) =>
			links.filter((l) => l['integrationTenantId'] === m && l['entityType'] === type),
		snapshot: (link: Row | null) => (link?.['snapshot'] ? JSON.parse(link['snapshot']) : {}),
		record: async (input: Row) => {
			const existing = links.find(
				(l) =>
					l['entityType'] === input['entityType'] &&
					(l['ewId'] === input['ewId'] || l['gauzyId'] === input['gauzyId'])
			);
			const values: Row = {
				gauzyId: input['gauzyId'],
				ewId: input['ewId'],
				ewVersion: input['ewVersion'] ?? null,
				lastDirection: input['direction'],
				state: 'ok'
			};
			if (input['snapshot'] !== undefined) values['snapshot'] = JSON.stringify(input['snapshot']);
			if (input['ewOnly'] !== undefined) values['ewOnly'] = JSON.stringify(input['ewOnly']);
			if (existing) return Object.assign(existing, values);
			const row = {
				id: `l${links.length + 1}`,
				integrationTenantId: input['integrationTenantId'],
				entityType: input['entityType'],
				snapshot: null,
				ewOnly: null,
				...values
			};
			links.push(row);
			return row;
		},
		remove: async (link: Row) => void links.splice(links.indexOf(link), 1),
		unlink: async (link: Row) => void (link['state'] = EverWorksLinkState.UNLINKED)
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
	const initiatives: Row[] = [];
	const goals: Row[] = [];
	const matches = (row: Row, where: Row) =>
		Object.entries(where).every(([k, v]) =>
			v === null
				? row[k] == null
				: typeof v === 'object'
					? true
					: k === 'isArchived'
						? !!row[k] === v
						: row[k] === v
		);
	const table = (rows: Row[]) => ({
		findOne: async ({ where }: { where: Row }) => rows.find((r) => matches(r, where)) ?? null,
		find: async ({ where }: { where: Row }) => rows.filter((r) => matches(r, where)),
		insert: async (row: Row) => void rows.push({ teams: [], projects: [], ...row }),
		update: async (where: Row, values: Row) => {
			for (const row of rows.filter((r) => matches(r, where))) Object.assign(row, values);
		}
	});
	const mappings: Row[] = [
		{
			id: 'm1',
			tenantId: 't1',
			organizationId: 'o1',
			settings: [{ settingsName: 'CONNECTION_ID', settingsValue: 'c1' }]
		}
	];
	const repositories = new Map<unknown, Row>([
		[OrganizationStrategicInitiative, table(initiatives)],
		[Goal, table(goals)],
		[IntegrationTenant, { find: async () => mappings }]
	]);
	const dataSource = {
		options: { type: 'postgres' },
		getRepository: (target: unknown) => repositories.get(target),
		createQueryBuilder: () => ({
			relation: (_entity: unknown, field: 'teams' | 'projects') => ({
				of: (id: string) => {
					const row = initiatives.find((r) => r['id'] === id) as Row;
					return {
						loadMany: async () => [...(row[field] ?? [])],
						addAndRemove: async (add: string[], remove: string[]) => {
							row[field] = [
								...(row[field] ?? []).filter((r: Row) => !remove.includes(r['id'])),
								...add.map((x) => ({ id: x }))
							];
						}
					};
				}
			})
		})
	};
	const contexts = {
		forEverWorksOrganization: async () => context,
		forOrganization: async () => context,
		forRequest: async () => context
	};
	const log = { write: jest.fn(async () => undefined) };
	const queue = { enqueue: jest.fn(async () => true) };
	const service = new EverWorksInitiativesService(
		dataSource as never,
		contexts as never,
		{ client: () => client } as never,
		linkService as never,
		log as never,
		{ register: jest.fn() } as never,
		{ register: jest.fn() } as never,
		{ registerSweeper: jest.fn() } as never,
		queue as never
	);
	return { service, mock, missionsMock, ewOrg, links, addLink, initiatives, goals, log, queue };
}

const envelope = (type: string, data: Row, version = 1, id = 'ew-mission-1') => ({
	id: `evt-${type}-${version}`,
	seq: String(version),
	type,
	version: 1,
	occurredAt: new Date().toISOString(),
	tenantId: 'ewt',
	organizationId: 'ew-org-1',
	aggregate: { type: 'mission', id, version },
	actor: { type: 'user', id: 'ew-ann' },
	data
});
const applyContext = { connection: { id: 'c1' }, event: {}, organizationId: 'o1' } as never;
const pushContext = { connection: { id: 'c1' }, mapping: { id: 'm1' } } as never;
const change = (gauzyId: string, op = 'upsert') =>
	({
		id: 'ch',
		tenantId: 't1',
		organizationId: 'o1',
		entityType: 'INITIATIVE_MISSION',
		gauzyId,
		op,
		actorUserId: null
	}) as never;
const mission: Row = {
	id: 'ew-mission-1',
	title: 'Win the SMB market',
	description: 'Grow SMB revenue.',
	status: 'paused',
	teamIds: [],
	works: [],
	goals: [],
	visibility: 'organization',
	owner: { type: 'user', id: 'ew-ann' }
};

describe('EverWorksInitiativesService — EW → G', () => {
	it('an existing mission is paired on the tab first; one created after the mapping becomes an initiative (paused → active + stalled)', async () => {
		const { service, initiatives, addLink } = setup();
		expect(await service.apply(envelope('mission.updated', mission) as never, applyContext)).toMatchObject({
			status: 'skipped'
		});
		addLink(EverWorksLinkType.TEAM, 'g-team-1', 'ew-team-1');
		addLink(EverWorksLinkType.MEMBER, 'e-ann', 'ew-ann');
		expect(
			await service.apply(
				envelope('mission.created', { ...mission, teamIds: ['ew-team-1'], visibility: 'team' }) as never,
				applyContext
			)
		).toMatchObject({ status: 'applied' });
		expect(initiatives[0]).toMatchObject({
			title: 'Win the SMB market',
			intent: 'Grow SMB revenue.',
			state: 'active',
			visibilityScope: 'team',
			stewardId: 'e-ann'
		});
		expect(initiatives[0]['signals']).toEqual({ perceivedMomentum: 'stalled' });
		expect(initiatives[0]['teams']).toEqual([{ id: 'g-team-1' }]);
	});

	it('status, works and the primary goal follow; a finished mission resolves the initiative with its outcome', async () => {
		const { service, initiatives, goals, addLink } = setup();
		await service.apply(envelope('mission.created', mission, 1) as never, applyContext);
		const initiativeId = initiatives[0]['id'];
		addLink(EverWorksLinkType.PROJECT_WORK, 'p-1', 'ew-work-1');
		goals.push({ id: 'goal-1', tenantId: 't1' });
		addLink(EverWorksLinkType.GOAL, 'goal-1', 'ew-goal-1');
		await service.apply(
			envelope(
				'mission.work.linked',
				{ missionId: 'ew-mission-1', workId: 'ew-work-1', relation: 'created' },
				2
			) as never,
			applyContext
		);
		expect(initiatives[0]['projects']).toEqual([{ id: 'p-1' }]);
		await service.apply(
			envelope(
				'mission.goal.linked',
				{ missionId: 'ew-mission-1', goalId: 'ew-goal-1', isPrimary: true },
				3
			) as never,
			applyContext
		);
		expect(goals[0]['organizationStrategicInitiativeId']).toBe(initiativeId);
		await service.apply(
			envelope('mission.status_changed', { ...mission, status: 'active' }, 4) as never,
			applyContext
		);
		expect(initiatives[0]['signals']).toBeNull();
		await service.apply(
			envelope('mission.status_changed', { ...mission, status: 'completed', outcome: 'succeeded' }, 5) as never,
			applyContext
		);
		expect(initiatives[0]).toMatchObject({
			state: 'resolved',
			signals: { strategicNotes: 'Ever Works mission succeeded.' }
		});
	});

	it('a retry after a failure half-way finds the initiative it created; a delayed created event of an older mission waits for the tab', async () => {
		const { service, initiatives, links } = setup();
		await service.apply(envelope('mission.created', mission, 1) as never, applyContext);
		// The link was never written (a failure after the insert): the retry reuses the same initiative.
		links.splice(0, links.length);
		await service.apply(envelope('mission.created', mission, 1) as never, applyContext);
		expect(initiatives).toHaveLength(1);
		expect(links).toHaveLength(1);
		const older = await service.apply(
			envelope(
				'mission.created',
				{ ...mission, createdAt: '2026-09-01T00:00:00.000Z' },
				1,
				'ew-mission-old'
			) as never,
			applyContext
		);
		expect(older).toMatchObject({ status: 'skipped', message: expect.stringContaining('predates the mapping') });
		expect(initiatives).toHaveLength(1);
	});

	it('a retry that finds the initiative it wrote gives it Ever Works\u2019 current fields (review F87)', async () => {
		const { service, initiatives, links } = setup();
		await service.apply(envelope('mission.created', mission, 1) as never, applyContext);
		links.splice(0, links.length); // the link was never written (a failure after the insert)
		await service.apply(envelope('mission.created', { ...mission, title: 'Win the SMB market in Europe' }, 2) as never, applyContext);
		expect(initiatives).toHaveLength(1);
		expect(initiatives[0]['title']).toBe('Win the SMB market in Europe');
	});

	it('a retry after the mission resumed clears the "stalled" its first attempt set and keeps a person’s notes (#11081 review)', async () => {
		const { service, initiatives, links } = setup();
		await service.apply(envelope('mission.created', mission, 1) as never, applyContext); // paused → stalled
		links.splice(0, links.length); // the link was never written
		initiatives[0]['signals'] = { perceivedMomentum: 'stalled', strategicNotes: 'Board asked' };
		await service.apply(envelope('mission.created', { ...mission, status: 'active' }, 2) as never, applyContext);
		expect(initiatives[0]['signals']).toEqual({ strategicNotes: 'Board asked' });
	});

	it('a retry keeps a "stalled" a person set on the row after the first attempt (#11081 review)', async () => {
		const { service, initiatives, links } = setup();
		await service.apply(envelope('mission.created', { ...mission, status: 'active' }, 1) as never, applyContext);
		links.splice(0, links.length); // the link was never written
		Object.assign(initiatives[0], {
			signals: { perceivedMomentum: 'stalled' },
			createdAt: new Date('2026-10-18T10:00:00Z'),
			updatedAt: new Date('2026-10-18T10:05:00Z')
		});
		await service.apply(envelope('mission.created', { ...mission, status: 'active' }, 2) as never, applyContext);
		expect(initiatives[0]['signals']).toEqual({ perceivedMomentum: 'stalled' });
	});

	it('a retry removes the teams its first attempt linked that the mission no longer has (#11081 review)', async () => {
		const { service, initiatives, links, addLink } = setup();
		addLink(EverWorksLinkType.TEAM, 'g-team-1', 'ew-team-1');
		addLink(EverWorksLinkType.TEAM, 'g-team-2', 'ew-team-2');
		const onTeams = { ...mission, teamIds: ['ew-team-1', 'ew-team-2'], visibility: 'team' };
		await service.apply(envelope('mission.created', onTeams, 1) as never, applyContext);
		expect(initiatives[0]['teams']).toEqual([{ id: 'g-team-1' }, { id: 'g-team-2' }]);
		// The mission's link was never written; the mission lost a team before the retry.
		links.splice(links.findIndex((l) => l['entityType'] === EverWorksLinkType.INITIATIVE_MISSION), 1);
		await service.apply(envelope('mission.created', { ...onTeams, teamIds: ['ew-team-1'] }, 2) as never, applyContext);
		expect(initiatives[0]['teams']).toEqual([{ id: 'g-team-1' }]);
	});

	it('a mission on a team not paired yet waits for it instead of making an initiative nobody can see (review F89)', async () => {
		const { service, initiatives, addLink, missionsMock, ewOrg } = setup();
		const onTeam = { ...mission, teamIds: ['ew-team-9'], visibility: 'team' };
		expect(await service.apply(envelope('mission.created', onTeam) as never, applyContext)).toMatchObject({ status: 'deferred' });
		expect(initiatives).toHaveLength(0);
		missionsMock.addMission(ewOrg.id, { id: 'ew-m-team', title: 'Team only', teamIds: ['ew-team-9'], visibility: 'team' });
		await expect(service.decide('m1' as never, { createInGauzy: ['ew-m-team'] })).rejects.toThrow(/teams first/);
		expect(initiatives).toHaveLength(0);
		addLink(EverWorksLinkType.TEAM, 'g-team-9', 'ew-team-9');
		expect(await service.apply(envelope('mission.created', onTeam) as never, applyContext)).toMatchObject({ status: 'applied' });
		expect(initiatives[0]).toMatchObject({ visibilityScope: 'team', teams: [{ id: 'g-team-9' }] });
	});

	it('a resume clears only the "stalled" the sync set; a person\u2019s own assessment stays', async () => {
		const { service, initiatives } = setup();
		await service.apply(envelope('mission.created', { ...mission, status: 'active' }, 1) as never, applyContext);
		expect(initiatives[0]['signals'] ?? null).toBeNull();
		initiatives[0]['signals'] = { perceivedMomentum: 'stalled' };
		await service.apply(
			envelope('mission.status_changed', { ...mission, status: 'paused' }, 2) as never,
			applyContext
		);
		await service.apply(
			envelope('mission.status_changed', { ...mission, status: 'active' }, 3) as never,
			applyContext
		);
		expect(initiatives[0]['signals']).toEqual({ perceivedMomentum: 'stalled' });
	});

	it('a leadership initiative stops syncing (flagged); a deleted mission retires and archives the initiative', async () => {
		const { service, initiatives, links, log } = setup();
		await service.apply(envelope('mission.created', mission, 1) as never, applyContext);
		initiatives[0]['visibilityScope'] = 'leadership';
		expect(
			await service.apply(envelope('mission.updated', { ...mission, title: 'New' }, 2) as never, applyContext)
		).toMatchObject({ status: 'skipped' });
		expect(links[0]['state']).toBe(EverWorksLinkState.UNLINKED);
		expect(log.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'unlinked_leadership' }));
		const other = setup();
		await other.service.apply(envelope('mission.created', mission, 1) as never, applyContext);
		await other.service.apply(envelope('mission.deleted', { ...mission, deleted: true }, 2) as never, applyContext);
		expect(other.initiatives[0]).toMatchObject({ state: 'retired', isArchived: true });
	});
});

describe('EverWorksInitiativesService — G → EW', () => {
	const initiative = (extra: Row = {}) => ({
		id: 'init-1',
		tenantId: 't1',
		organizationId: 'o1',
		title: 'Enter Europe',
		intent: 'Open the EU market.',
		state: 'active',
		visibilityScope: 'organization',
		createdAt: new Date('2026-10-10T00:00:00Z'),
		teams: [],
		projects: [],
		...extra
	});

	it('an initiative becomes a PAUSED mission with its works; retiring it completes the mission as cancelled; never active', async () => {
		const { service, mock, missionsMock, initiatives, addLink } = setup();
		addLink(EverWorksLinkType.PROJECT_WORK, 'p-1', 'ew-work-1');
		initiatives.push(initiative({ projects: [{ id: 'p-1' }] }));
		expect(await service.push(change('init-1'), pushContext)).toMatchObject({ status: 'pushed' });
		const [created] = [...missionsMock.missions.values()];
		expect(created).toMatchObject({
			title: 'Enter Europe',
			description: 'Open the EU market.',
			status: 'paused',
			works: [{ workId: 'ew-work-1', relation: 'improves' }]
		});
		initiatives[0]['state'] = 'retired';
		await service.push(change('init-1'), pushContext);
		expect(created).toMatchObject({ status: 'completed', outcome: 'cancelled' });
		for (const request of mock.requests.filter((r) => r.method !== 'GET'))
			expect(JSON.stringify(request.body ?? {})).not.toContain('"status":"active"');
	});

	it('a team-scoped initiative never goes to Ever Works as an organization-visible mission (review F24)', async () => {
		const { service, mock, missionsMock, initiatives, addLink } = setup();
		// Team-scoped through its aligned projects' teams only (no direct teams): no team to scope the mission to.
		initiatives.push(initiative({ visibilityScope: 'team', teams: [], projects: [{ id: 'p-1' }] }));
		expect(await service.push(change('init-1'), pushContext)).toEqual({
			status: 'skipped',
			message: 'a team-scoped initiative goes to Ever Works once it is linked to a paired team'
		});
		expect(missionsMock.missions.size).toBe(0);
		// With a paired direct team it goes, team-visible.
		addLink(EverWorksLinkType.TEAM, 'g-team-1', 'ew-team-1');
		initiatives[0]['teams'] = [{ id: 'g-team-1' }];
		expect(await service.push(change('init-1'), pushContext)).toMatchObject({ status: 'pushed' });
		const [created] = [...missionsMock.missions.values()];
		expect(created).toMatchObject({ visibility: 'team', teamIds: ['ew-team-1'] });
		// Its direct teams cleared in Gauzy later (still team-scoped): the mission keeps its teams, other edits go.
		initiatives[0]['teams'] = [];
		initiatives[0]['title'] = 'Enter Europe now';
		expect(await service.push(change('init-1'), pushContext)).toMatchObject({ status: 'pushed' });
		expect(created).toMatchObject({ title: 'Enter Europe now', visibility: 'team', teamIds: ['ew-team-1'] });
		for (const request of mock.requests.filter((r) => r.method !== 'GET'))
			expect(JSON.stringify(request.body ?? {})).not.toContain('"visibility":"organization"');
	});

	it('leadership initiatives and drafts are never pushed; one made before the mapping waits for the tab', async () => {
		const { service, missionsMock, initiatives } = setup();
		initiatives.push(
			initiative({ visibilityScope: 'leadership' }),
			initiative({ id: 'init-2', state: 'draft' }),
			initiative({ id: 'init-3', createdAt: new Date('2026-09-01T00:00:00Z') })
		);
		expect(await service.push(change('init-1'), pushContext)).toMatchObject({ status: 'skipped' });
		expect(await service.push(change('init-2'), pushContext)).toMatchObject({ status: 'skipped' });
		expect(await service.push(change('init-3'), pushContext)).toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('Initiatives tab')
		});
		expect(missionsMock.missions.size).toBe(0);
	});

	it('the sweep queues an initiative deleted by id (its mission is cancelled, the link ends) and one a goal moved off', async () => {
		const { service, missionsMock, initiatives, goals, links, addLink, queue } = setup();
		addLink(EverWorksLinkType.GOAL, 'goal-1', 'ew-goal-1');
		goals.push({ id: 'goal-1', tenantId: 't1', organizationStrategicInitiativeId: 'init-1' });
		initiatives.push(initiative());
		await service.push(change('init-1'), pushContext);
		const [created] = [...missionsMock.missions.values()];
		expect((created['goals'] as Row[]).map((g) => g['goalId'])).toEqual(['ew-goal-1']);
		// Nothing changed: the sweep queues nothing.
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(queue.enqueue).not.toHaveBeenCalled();
		// A person moved the goal to another initiative: this mission loses it.
		goals[0]['organizationStrategicInitiativeId'] = 'init-other';
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(queue.enqueue).toHaveBeenCalledWith(
			expect.objectContaining({
				entityType: EverWorksLinkType.INITIATIVE_MISSION,
				gauzyId: 'init-1',
				op: 'upsert'
			})
		);
		await service.push(change('init-1'), pushContext);
		expect(created['goals']).toEqual([]);
		// Deleted by id (no row for the subscriber): the sweep queues the delete.
		initiatives.splice(0, 1);
		queue.enqueue.mockClear();
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ gauzyId: 'init-1', op: 'delete' }));
		await service.push(change('init-1', 'delete'), pushContext);
		expect(created).toMatchObject({ status: 'completed', outcome: 'cancelled' });
		expect(links.find((l) => l['entityType'] === EverWorksLinkType.INITIATIVE_MISSION)?.['state']).toBe(
			EverWorksLinkState.UNLINKED
		);
	});

	it('the missions direction "ew_to_gauzy" (the default) pushes nothing', async () => {
		const { service, initiatives, missionsMock } = setup({ missions: 'ew_to_gauzy' });
		initiatives.push(initiative());
		expect(await service.push(change('init-1'), pushContext)).toMatchObject({ status: 'skipped' });
		expect(missionsMock.missions.size).toBe(0);
	});
});

describe('EverWorksInitiativesService — Initiatives tab', () => {
	it('suggests a same-title initiative (never a leadership one) and pairs it on accept, changing neither record', async () => {
		const { service, missionsMock, ewOrg, initiatives, links } = setup();
		missionsMock.addMission(ewOrg.id, { id: 'ew-m-1', title: 'Enter Europe' });
		missionsMock.addMission(ewOrg.id, { id: 'ew-m-2', title: 'Board only' });
		initiatives.push(
			{
				id: 'init-1',
				tenantId: 't1',
				organizationId: 'o1',
				title: 'enter europe',
				state: 'active',
				visibilityScope: 'organization'
			},
			{
				id: 'init-2',
				tenantId: 't1',
				organizationId: 'o1',
				title: 'Board only',
				state: 'active',
				visibilityScope: 'leadership'
			}
		);
		const view = await service.initiatives('m1' as never);
		expect(view.missions.find((m) => m.ewMissionId === 'ew-m-1')?.suggestion).toEqual({
			initiativeId: 'init-1',
			reason: 'same_title'
		});
		expect(view.missions.find((m) => m.ewMissionId === 'ew-m-2')?.suggestion).toBeNull();
		expect(view.unmatchedInitiatives.map((i) => i.initiativeId)).toEqual(['init-1']);
		const after = await service.decide('m1' as never, { acceptSuggestions: true });
		expect(after.missions.find((m) => m.ewMissionId === 'ew-m-1')?.linkedInitiativeId).toBe('init-1');
		expect(links.find((l) => l['ewId'] === 'ew-m-1')?.['gauzyId']).toBe('init-1');
		expect(initiatives[0]['title']).toBe('enter europe');
		await expect(
			service.decide('m1' as never, { links: [{ ewMissionId: 'ew-m-2', initiativeId: 'init-2' as never }] })
		).rejects.toThrow('leadership');
	});

	it('suggests nothing when two free initiatives have the mission\'s title, so accepting pairs neither', async () => {
		const { service, missionsMock, ewOrg, initiatives, links } = setup();
		missionsMock.addMission(ewOrg.id, { id: 'ew-m-9', title: 'Launch' });
		for (const id of ['init-a', 'init-b']) {
			initiatives.push({ id, tenantId: 't1', organizationId: 'o1', title: 'launch', state: 'active', visibilityScope: 'organization' });
		}
		const view = await service.initiatives('m1' as never);
		expect(view.missions.find((m) => m.ewMissionId === 'ew-m-9')?.suggestion).toBeNull();
		await service.decide('m1' as never, { acceptSuggestions: true });
		expect(links.find((l) => l['ewId'] === 'ew-m-9')).toBeUndefined();
	});

	it('refuses to create a team-scoped initiative with no paired team as a mission (review F24)', async () => {
		const { service, missionsMock, initiatives } = setup();
		initiatives.push({
			id: 'init-9',
			tenantId: 't1',
			organizationId: 'o1',
			title: 'Team only',
			state: 'active',
			visibilityScope: 'team',
			createdAt: new Date('2026-09-01T00:00:00Z'),
			teams: [],
			projects: []
		});
		await expect(service.decide('m1' as never, { createInEverWorks: ['init-9' as never] })).rejects.toThrow(
			/team-scoped initiative goes to Ever Works once it is linked to a paired team/
		);
		expect(missionsMock.missions.size).toBe(0);
	});

	it("pairing aligns the initiative, so its first Gauzy save never strips the mission's teams or works (review F25)", async () => {
		const { service, missionsMock, ewOrg, initiatives, addLink, mock } = setup();
		addLink(EverWorksLinkType.TEAM, 'g-team-1', 'ew-team-1');
		addLink(EverWorksLinkType.PROJECT_WORK, 'p-1', 'ew-work-1');
		addLink(EverWorksLinkType.PROJECT_WORK, 'p-2', 'ew-work-2');
		const remote = missionsMock.addMission(ewOrg.id, {
			id: 'ew-m-5',
			title: 'Grow',
			teamIds: ['ew-team-1'],
			works: [{ workId: 'ew-work-1', relation: 'improves' }]
		});
		// An organization-scoped initiative with no team of its own, aligned with another project.
		initiatives.push({
			id: 'init-5',
			tenantId: 't1',
			organizationId: 'o1',
			title: 'Grow',
			state: 'active',
			visibilityScope: 'organization',
			teams: [],
			projects: [{ id: 'p-2' }]
		});
		await service.decide('m1' as never, { links: [{ ewMissionId: 'ew-m-5', initiativeId: 'init-5' as never }] });
		// The mission's teams (it is team-scoped now, D11) and works are the initiative's too; nothing was removed.
		expect(initiatives[0]).toMatchObject({ visibilityScope: 'team', teams: [{ id: 'g-team-1' }] });
		expect((initiatives[0]['projects'] as Row[]).map((p) => p['id']).sort()).toEqual(['p-1', 'p-2']);
		// The first Gauzy save after pairing: the mission keeps its team and visibility, and gains the Gauzy work.
		initiatives[0]['title'] = 'Grow faster';
		expect(await service.push(change('init-5'), pushContext)).toMatchObject({ status: 'pushed' });
		expect(remote).toMatchObject({ title: 'Grow faster', visibility: 'team', teamIds: ['ew-team-1'] });
		expect((remote['works'] as Row[]).map((w) => w['workId']).sort()).toEqual(['ew-work-1', 'ew-work-2']);
		for (const request of mock.requests.filter((r) => r.method !== 'GET'))
			expect(JSON.stringify(request.body ?? {})).not.toContain('"visibility":"organization"');
	});

	it('pairing again finishes an alignment that failed half-way, never leaving the initiative wider (#11026 review)', async () => {
		const { service, missionsMock, ewOrg, initiatives, addLink } = setup();
		addLink(EverWorksLinkType.TEAM, 'g-team-1', 'ew-team-1');
		missionsMock.addMission(ewOrg.id, { id: 'ew-m-6', title: 'Grow', teamIds: ['ew-team-1'] });
		initiatives.push({ id: 'init-6', tenantId: 't1', organizationId: 'o1', title: 'Grow', state: 'active', visibilityScope: 'organization', teams: [], projects: [] });
		// The teams write fails after the scope was written: the initiative is team-scoped (narrower), with no team yet.
		const teams = jest.spyOn(service as never, 'applyTeams').mockRejectedValueOnce(new Error('connection reset') as never);
		await expect(service.decide('m1' as never, { links: [{ ewMissionId: 'ew-m-6', initiativeId: 'init-6' as never }] })).rejects.toThrow('connection reset');
		expect(initiatives[0]).toMatchObject({ visibilityScope: 'team', teams: [] });
		teams.mockRestore();
		await service.decide('m1' as never, { links: [{ ewMissionId: 'ew-m-6', initiativeId: 'init-6' as never }] });
		expect(initiatives[0]).toMatchObject({ visibilityScope: 'team', teams: [{ id: 'g-team-1' }] });
	});

	it('pairing keeps on the link what the mission has that Gauzy cannot map, so a push never removes it', async () => {
		const { service, missionsMock, ewOrg, initiatives, links } = setup();
		missionsMock.addMission(ewOrg.id, {
			id: 'ew-m-3',
			title: 'Grow',
			visibility: 'organization',
			works: [{ workId: 'ew-work-x', relation: 'improves' }],
			goals: [{ goalId: 'ew-goal-x', isPrimary: true }]
		});
		initiatives.push({
			id: 'init-3',
			tenantId: 't1',
			organizationId: 'o1',
			title: 'Grow',
			state: 'active',
			visibilityScope: 'organization'
		});
		await service.decide('m1' as never, { links: [{ ewMissionId: 'ew-m-3', initiativeId: 'init-3' as never }] });
		const link = links.find((l) => l['ewId'] === 'ew-m-3');
		expect(JSON.parse(link?.['ewOnly'])).toMatchObject({
			unmappedWorks: ['ew-work-x'],
			unmappedGoals: ['ew-goal-x']
		});
	});
});
