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
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		TenantOrganizationBaseEntity: class {},
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
import { Goal, OrganizationStrategicInitiative } from '@gauzy/core';
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
	const repositories = new Map<unknown, Row>([
		[OrganizationStrategicInitiative, table(initiatives)],
		[Goal, table(goals)]
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
	const service = new EverWorksInitiativesService(
		dataSource as never,
		contexts as never,
		{ client: () => client } as never,
		linkService as never,
		log as never,
		{ register: jest.fn() } as never,
		{ register: jest.fn() } as never
	);
	return { service, mock, missionsMock, ewOrg, links, addLink, initiatives, goals, log };
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
});
