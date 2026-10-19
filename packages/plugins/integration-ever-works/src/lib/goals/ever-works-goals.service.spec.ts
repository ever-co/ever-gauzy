/**
 * G-P2-1 Goals ↔ Goal + KeyResults against in-memory Gauzy stand-ins and the mock Ever Works API (real
 * client): an Ever Works goal becomes a Gauzy goal with key results and a time frame; only what Ever
 * Works changed is written; a Gauzy goal becomes a DRAFT Ever Works goal (no status is ever sent), its
 * key result values go as samples.
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
		...Object.fromEntries(
			[
				'Tenant',
				'Organization',
				'Employee',
				'User',
				'IntegrationTenant',
				'IntegrationSetting',
				'Goal',
				'GoalTimeFrame',
				'KeyResult'
			].map((name) => [name, entity(name)])
		),
		RequestContext: {
			currentTenantId: () => null,
			currentUserId: () => null,
			currentOrganizationId: () => null,
			runWithRequest: (_req: unknown, fn: () => unknown) => fn()
		}
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import { Employee, Goal, GoalTimeFrame, IntegrationTenant, KeyResult } from '@gauzy/core';
import { EverWorksClient } from '../client/ever-works-client';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { MockEverWorksGoals } from '../testing/mock-ever-works.goals';
import { MockEverWorksServer } from '../testing/mock-ever-works.server';
import { stableUuid } from '../sync/ever-works-stable-id';
import { EverWorksGoalsService, keyResultEwId } from './ever-works-goals.service';

type Row = Record<string, any>;

function setup(options: { goals?: string; entitySync?: Record<string, boolean> } = {}) {
	const mock = new MockEverWorksServer();
	const ewOrg = { id: 'ew-org-1', slug: 'acme', displayName: 'Acme' };
	const key = mock.addKey({ organizations: [ewOrg] });
	const goalsMock = new MockEverWorksGoals(mock);
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
		mapping: { id: 'm1', settings: [] },
		connection: { id: 'c1', connectedByUserId: 'u-admin' },
		everWorksOrganizationSlug: 'acme',
		directions: { goals: options.goals ?? 'both' },
		entitySync: options.entitySync ?? {},
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
				lastDirection: input['direction'],
				state: 'ok'
			};
			if (input['ewVersion'] !== undefined) values['ewVersion'] = input['ewVersion'];
			if (input['snapshot'] !== undefined) values['snapshot'] = JSON.stringify(input['snapshot']);
			if (input['ewOnly'] !== undefined) values['ewOnly'] = JSON.stringify(input['ewOnly']);
			if (existing) return Object.assign(existing, values);
			const row = {
				id: `l${links.length + 1}`,
				integrationTenantId: input['integrationTenantId'],
				entityType: input['entityType'],
				ewVersion: null,
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
	const goals: Row[] = [];
	const keyResults: Row[] = [];
	const frames: Row[] = [
		{
			id: 'tf-2026',
			tenantId: 't1',
			organizationId: 'o1',
			name: '2026',
			status: 'Active',
			startDate: new Date('2026-01-01'),
			endDate: new Date('2026-12-31')
		}
	];
	const employees: Row[] = [{ id: 'e-admin', userId: 'u-admin', tenantId: 't1', organizationId: 'o1' }];
	const table = (rows: Row[]) => ({
		findOne: async ({ where }: { where: Row }) =>
			rows.find((r) => Object.entries(where).every(([k, v]) => typeof v === 'object' || r[k] === v)) ?? null,
		find: async ({ where }: { where: Row }) =>
			rows.filter((r) =>
				Object.entries(where).every(
					([k, v]) => typeof v === 'object' || (k === 'isArchived' ? !!r[k] === v : r[k] === v)
				)
			),
		insert: async (row: Row) => void rows.push({ ...row }),
		update: async (where: Row, values: Row) => {
			for (const row of rows.filter((r) => r['id'] === where['id'])) Object.assign(row, values);
		}
	});
	const repositories = new Map<unknown, Row>([
		[Goal, table(goals)],
		[KeyResult, table(keyResults)],
		[GoalTimeFrame, table(frames)],
		[Employee, table(employees)]
	]);
	const mappings: Row[] = [
		{
			id: 'm1',
			tenantId: 't1',
			organizationId: 'o1',
			settings: [{ settingsName: 'CONNECTION_ID', settingsValue: 'c1' }]
		}
	];
	repositories.set(IntegrationTenant, { find: async () => mappings });
	const dataSource = { getRepository: (target: unknown) => repositories.get(target) };
	const contexts = { forEverWorksOrganization: async () => context, forOrganization: async () => context };
	const queue = { enqueue: jest.fn(async () => true) };
	const service = new EverWorksGoalsService(
		dataSource as never,
		contexts as never,
		{ client: () => client } as never,
		linkService as never,
		{ write: jest.fn() } as never,
		{ register: jest.fn() } as never,
		{ register: jest.fn() } as never,
		{ registerSweeper: jest.fn() } as never,
		queue as never
	);
	return { service, mock, goalsMock, ewOrg, links, addLink, goals, keyResults, frames, queue, context };
}

const envelope = (type: string, data: Row, version = 1) => ({
	id: `evt-${type}-${version}`,
	seq: String(version),
	type,
	version: 1,
	occurredAt: new Date().toISOString(),
	tenantId: 'ewt',
	organizationId: 'ew-org-1',
	aggregate: { type: 'goal', id: data['id'] ?? 'ew-goal-1', version },
	actor: { type: 'user', id: 'ew-ann' },
	data
});
const applyContext = { connection: { id: 'c1' }, event: {}, organizationId: 'o1' } as never;
const pushContext = { connection: { id: 'c1' }, mapping: { id: 'm1' } } as never;
const change = (gauzyId: string, entityType = EverWorksLinkType.GOAL) =>
	({ id: 'ch', tenantId: 't1', organizationId: 'o1', entityType, gauzyId, op: 'upsert', actorUserId: null }) as never;
const ewGoal: Row = {
	id: 'ew-goal-1',
	title: 'Grow paying customers',
	description: 'Q4 objective',
	goalKind: 'metric',
	status: 'active',
	targetValue: 120,
	baselineValue: 80,
	currentValue: 96,
	unit: 'customers',
	deadline: '2027-05-20T00:00:00.000Z',
	criteria: null,
	dodCriteria: [{ id: 'launch', text: 'Pricing page launched', status: 'done' }],
	progress: 40,
	teamIds: [],
	visibility: 'organization',
	owner: { type: 'user', id: 'ew-ann' }
};

describe('EverWorksGoalsService — EW → G', () => {
	it('a goal becomes a Gauzy goal with its key results, in a new quarter time frame; the admin owns the key results', async () => {
		const { service, goals, keyResults, frames, links } = setup();
		expect(await service.apply(envelope('goal.created', ewGoal) as never, applyContext)).toMatchObject({
			status: 'applied'
		});
		expect(goals[0]).toMatchObject({
			name: 'Grow paying customers',
			description: 'Q4 objective',
			deadline: 'Q2 2027',
			level: 'Organization',
			progress: 40
		});
		expect(frames.find((f) => f['name'] === 'Q2 2027')).toBeTruthy();
		expect(keyResults.map((k) => [k['type'], k['update'], k['progress'], k['ownerId']])).toEqual([
			['Numerical', 96, 40, 'e-admin'],
			['True/False', 1, 100, 'e-admin']
		]);
		const keyLinks = links.filter((l) => l['entityType'] === EverWorksLinkType.KEY_RESULT);
		// Link ids are digests (`<goal>:<key>` may exceed the 64-character column); the goal and key are kept.
		expect(keyLinks.map((l) => JSON.parse(l['ewOnly']))).toEqual([
			{ ewGoalId: 'ew-goal-1', key: 'm' },
			{ ewGoalId: 'ew-goal-1', key: 'd:launch' }
		]);
		expect(keyLinks.map((l) => l['ewId'])).toEqual([
			keyResultEwId('ew-goal-1', 'm'),
			keyResultEwId('ew-goal-1', 'd:launch')
		]);
		for (const link of keyLinks) expect(link['ewId'].length).toBeLessThanOrEqual(64);
	});

	it('only what changed in Ever Works is written; a key result Ever Works dropped is archived, not deleted', async () => {
		const { service, goals, keyResults } = setup();
		await service.apply(envelope('goal.created', ewGoal, 1) as never, applyContext);
		goals[0]['name'] = 'Renamed in Gauzy';
		await service.apply(
			envelope(
				'goal.progress_changed',
				{ ...ewGoal, currentValue: 108, progress: 70, dodCriteria: [] },
				2
			) as never,
			applyContext
		);
		expect(goals[0]).toMatchObject({ name: 'Renamed in Gauzy', progress: 70 });
		expect(keyResults[0]).toMatchObject({ update: 108, progress: 70 });
		expect(keyResults[1]['isArchived']).toBe(true);
	});

	it('a retry that finds the goal it wrote gives it Ever Works\u2019 current fields (review F87)', async () => {
		const { service, goals } = setup();
		// A first attempt inserted the goal (its stable id) with the title of then, and failed before its link.
		goals.push({
			id: stableUuid('m1:goal:ew-goal-1'),
			tenantId: 't1',
			organizationId: 'o1',
			name: 'Grow customers',
			progress: 10
		});
		await service.apply(
			envelope('goal.created', { ...ewGoal, title: 'Grow paying customers' }) as never,
			applyContext
		);
		expect(goals).toHaveLength(1);
		expect(goals[0]).toMatchObject({ name: 'Grow paying customers', progress: 40, deadline: 'Q2 2027' });
	});

	it('a Definition of Done item Ever Works removed and adds back with the same id is restored, not left archived (review F88)', async () => {
		const { service, keyResults, links } = setup();
		await service.apply(envelope('goal.created', ewGoal, 1) as never, applyContext);
		await service.apply(envelope('goal.updated', { ...ewGoal, dodCriteria: [] }, 2) as never, applyContext);
		expect(keyResults[1]['isArchived']).toBe(true);
		await service.apply(envelope('goal.updated', ewGoal, 3) as never, applyContext);
		expect(keyResults).toHaveLength(2);
		expect(keyResults[1]).toMatchObject({ isArchived: false, archivedAt: null });
		expect(links.find((l) => l['gauzyId'] === keyResults[1]['id'])?.['state']).toBe('ok');
	});

	it('a goal Ever Works moves to a team not paired yet keeps its teams on the next Gauzy push (review F85)', async () => {
		const { service, mock, goals, addLink } = setup();
		addLink(EverWorksLinkType.TEAM, 'g-team-1', 'ew-team-1');
		await service.apply(
			envelope('goal.created', { ...ewGoal, teamIds: ['ew-team-1'], visibility: 'team' }, 1) as never,
			applyContext
		);
		await service.apply(
			envelope('goal.updated', { ...ewGoal, teamIds: ['ew-team-2'], visibility: 'team' }, 2) as never,
			applyContext
		);
		expect(goals[0]).toMatchObject({ level: 'Team', ownerTeamId: 'g-team-1' });
		goals[0]['name'] = 'Renamed in Gauzy';
		const before = mock.requests.length;
		// The Ever Works goal is not in the mock (it came from an event): the PATCH it would send is what matters.
		await service.push(change(goals[0]['id']), pushContext).catch(() => undefined);
		const patch = mock.requests.slice(before).find((r) => r.method === 'PATCH');
		expect(patch?.body).toEqual({ title: 'Renamed in Gauzy' });
	});

	it('a goal Ever Works no longer has a primary mission for keeps the initiative a Gauzy user moved it to (review F90)', async () => {
		const { service, goals, addLink, links } = setup();
		addLink(EverWorksLinkType.INITIATIVE_MISSION, 'init-1', 'ew-mission-1');
		addLink(EverWorksLinkType.INITIATIVE_MISSION, 'init-2', 'ew-mission-2');
		const primary = (primaryMissionId: string | null, version: number) =>
			service.apply(envelope('goal.updated', { ...ewGoal, primaryMissionId }, version) as never, applyContext);
		await service.apply(
			envelope('goal.created', { ...ewGoal, primaryMissionId: 'ew-mission-1' }, 1) as never,
			applyContext
		);
		expect(goals[0]['organizationStrategicInitiativeId']).toBe('init-1');
		goals[0]['organizationStrategicInitiativeId'] = 'init-2'; // moved in Gauzy
		await primary(null, 2);
		expect(goals[0]['organizationStrategicInitiativeId']).toBe('init-2');
		// Still on the old primary's initiative when Ever Works clears it: it leaves it.
		await primary('ew-mission-1', 3);
		await primary(null, 4);
		expect(goals[0]['organizationStrategicInitiativeId']).toBeNull();
		// The old primary's pair ended before Ever Works cleared it (the mission was deleted): the goal still leaves it.
		await primary('ew-mission-1', 5);
		expect(goals[0]['organizationStrategicInitiativeId']).toBe('init-1');
		(links.find((l) => l['ewId'] === 'ew-mission-1') as Row)['state'] = EverWorksLinkState.UNLINKED;
		await primary(null, 6);
		expect(goals[0]['organizationStrategicInitiativeId']).toBeNull();
	});

	it('a team-scoped goal waits for its team; a deleted goal archives the Gauzy goal', async () => {
		const { service, goals, addLink } = setup();
		expect(
			await service.apply(
				envelope('goal.created', { ...ewGoal, teamIds: ['ew-team-1'], visibility: 'team' }) as never,
				applyContext
			)
		).toMatchObject({ status: 'deferred' });
		addLink(EverWorksLinkType.TEAM, 'g-team-1', 'ew-team-1');
		await service.apply(
			envelope('goal.created', { ...ewGoal, teamIds: ['ew-team-1'], visibility: 'team' }) as never,
			applyContext
		);
		expect(goals[0]).toMatchObject({ level: 'Team', ownerTeamId: 'g-team-1' });
		await service.apply(envelope('goal.deleted', { ...ewGoal, deleted: true }, 2) as never, applyContext);
		expect(goals[0]['isArchived']).toBe(true);
	});
});

describe('EverWorksGoalsService — G → EW', () => {
	const gauzyGoal = (extra: Row = {}) => ({
		id: 'goal-1',
		tenantId: 't1',
		organizationId: 'o1',
		name: 'Close deals',
		description: 'Q4',
		deadline: '2026',
		level: 'Organization',
		progress: 0,
		...extra
	});
	const keyResult = (id: string, extra: Row = {}) => ({
		id,
		tenantId: 't1',
		organizationId: 'o1',
		goalId: 'goal-1',
		name: `KR ${id}`,
		type: 'Numerical',
		targetValue: 10,
		initialValue: 0,
		unit: 'deals',
		update: 0,
		progress: 0,
		weight: '1',
		isArchived: false,
		...extra
	});

	it('a Gauzy goal becomes a DRAFT Ever Works goal (no status is ever sent); its current value goes as a sample', async () => {
		const { service, mock, goalsMock, goals, keyResults, links } = setup();
		goals.push(gauzyGoal());
		keyResults.push(
			keyResult('kr-a', { update: 4 }),
			keyResult('kr-b', { type: 'True/False', targetValue: 1, unit: null })
		);
		expect(await service.push(change('goal-1'), pushContext)).toMatchObject({ status: 'pushed' });
		const [created] = [...goalsMock.goals.values()];
		expect(created).toMatchObject({
			status: 'draft',
			goalKind: 'metric',
			targetValue: 10,
			unit: 'deals',
			deadline: '2026-12-31T00:00:00.000Z'
		});
		expect(created['dodCriteria']).toEqual([{ id: 'kr-b', text: 'KR kr-b', status: 'open', source: 'operator' }]);
		expect(goalsMock.samples).toEqual([
			{ goalId: created['id'], criterionId: null, value: 4, sampledAt: expect.any(String) }
		]);
		expect(
			links
				.filter((l) => l['entityType'] === EverWorksLinkType.KEY_RESULT)
				.map((l) => JSON.parse(l['ewOnly'])['key'])
				.sort()
		).toEqual(['d:kr-b', 'm']);
		for (const request of mock.requests.filter((r) => r.method !== 'GET'))
			expect(JSON.stringify(request.body ?? {})).not.toMatch(/"status":"(active|paused|completed)"/);
	});

	it('a key result update is a sample; a True/False one moves the Definition of Done; nothing changed sends nothing', async () => {
		const { service, mock, goalsMock, goals, keyResults } = setup();
		goals.push(gauzyGoal());
		keyResults.push(keyResult('kr-a'), keyResult('kr-b', { type: 'True/False', targetValue: 1, unit: null }));
		await service.push(change('goal-1'), pushContext);
		const [created] = [...goalsMock.goals.values()];
		keyResults[0]['update'] = 7;
		expect(await service.push(change('kr-a', EverWorksLinkType.KEY_RESULT), pushContext)).toMatchObject({
			status: 'pushed'
		});
		expect(goalsMock.samples.at(-1)).toMatchObject({ criterionId: null, value: 7 });
		expect(await service.push(change('kr-a', EverWorksLinkType.KEY_RESULT), pushContext)).toMatchObject({
			status: 'skipped'
		});
		keyResults[1]['update'] = 1;
		await service.push(change('goal-1'), pushContext);
		expect((created['dodCriteria'] as Row[])[0]['status']).toBe('done');
		const before = mock.requests.length;
		expect(await service.push(change('goal-1'), pushContext)).toMatchObject({
			status: 'skipped',
			message: 'nothing changed'
		});
		expect(mock.requests.filter((r) => r.method !== 'GET').length).toBe(
			mock.requests.slice(0, before).filter((r) => r.method !== 'GET').length
		);
	});

	it('a sample whose answer shows an Ever Works edit made meanwhile applies it: neither is undone by the older event (review F86)', async () => {
		const { service, goalsMock, goals, keyResults, links } = setup();
		goals.push(gauzyGoal());
		keyResults.push(keyResult('kr-a'));
		await service.push(change('goal-1'), pushContext);
		const [created] = [...goalsMock.goals.values()];
		const goalLink = () => links.find((l) => l['entityType'] === EverWorksLinkType.GOAL) as Row;
		const version = goalLink()['ewVersion'] as number;
		// Ever Works renames the goal: its event (with the value before the sample) is still on the way. Then a Gauzy
		// key result value changes.
		Object.assign(created, { title: 'Renamed in Ever Works', version: version + 1 });
		const edit = envelope('goal.updated', { ...created }, version + 1);
		keyResults[0]['update'] = 7;
		expect(await service.push(change('kr-a', EverWorksLinkType.KEY_RESULT), pushContext)).toMatchObject({
			status: 'pushed'
		});
		expect(goals[0]['name']).toBe('Renamed in Ever Works');
		expect(goalLink()['ewVersion']).toBe(version + 2);
		expect(await service.apply(edit as never, applyContext)).toMatchObject({ status: 'skipped' });
		// The older event never takes the sample back (#11081 review).
		expect(keyResults[0]['update']).toBe(7);
	});

	it('a key result deleted in Gauzy by id (no row for the subscriber) queues its goal from the sweep; the push takes it out', async () => {
		const { service, goalsMock, goals, keyResults, links, queue } = setup();
		goals.push(gauzyGoal());
		keyResults.push(keyResult('kr-a'), keyResult('kr-b', { type: 'True/False', targetValue: 1, unit: null }));
		await service.push(change('goal-1'), pushContext);
		const [created] = [...goalsMock.goals.values()];
		keyResults.splice(1, 1);
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(queue.enqueue).toHaveBeenCalledWith(
			expect.objectContaining({ entityType: EverWorksLinkType.GOAL, gauzyId: 'goal-1' })
		);
		await service.push(change('goal-1'), pushContext);
		expect(created['dodCriteria']).toEqual([]);
		const removed = links.find((l) => l['gauzyId'] === 'kr-b');
		expect(removed?.['state']).toBe(EverWorksLinkState.UNLINKED);
	});

	it('an imported goal keeps its exact deadline while the Gauzy time frame is unchanged', async () => {
		const { service, mock, goals } = setup();
		await service.apply(
			envelope('goal.created', { ...ewGoal, deadline: '2027-05-20T00:00:00.000Z' }) as never,
			applyContext
		);
		goals[0]['name'] = 'Renamed in Gauzy';
		const before = mock.requests.length;
		// The Ever Works goal is not in the mock (it came from an event): the PATCH it would send is what matters.
		await service.push(change(goals[0]['id']), pushContext).catch(() => undefined);
		const patch = mock.requests.slice(before).find((r) => r.method === 'PATCH');
		expect(patch?.body).toEqual({ title: 'Renamed in Gauzy' });
	});

	it('a team goal waits for its team; a goal without a numeric or True/False key result is not pushed yet', async () => {
		const { service, goals, keyResults } = setup();
		goals.push(gauzyGoal({ level: 'Team', ownerTeamId: 'g-team-9' }));
		keyResults.push(keyResult('kr-a'));
		expect(await service.push(change('goal-1'), pushContext)).toMatchObject({ status: 'deferred' });
		goals[0]['level'] = 'Organization';
		keyResults[0]['type'] = 'Task';
		expect(await service.push(change('goal-1'), pushContext)).toMatchObject({ status: 'skipped' });
	});
});

describe('EverWorksGoalsService — the KEY_RESULT sync setting (OQ4, review F77)', () => {
	const off = { KeyResult: false };
	const gauzyGoal = (extra: Row = {}) => ({
		id: 'goal-1',
		tenantId: 't1',
		organizationId: 'o1',
		name: 'Close deals',
		description: 'Q4',
		deadline: '2026',
		level: 'Organization',
		progress: 0,
		...extra
	});
	const keyResult = (id: string, extra: Row = {}) => ({
		id,
		tenantId: 't1',
		organizationId: 'o1',
		goalId: 'goal-1',
		name: `KR ${id}`,
		type: 'Numerical',
		targetValue: 10,
		initialValue: 0,
		unit: 'deals',
		update: 0,
		progress: 0,
		weight: '1',
		isArchived: false,
		...extra
	});

	it('off: an Ever Works goal syncs without key results; on again, the next event brings them', async () => {
		const { service, goals, keyResults, links, context } = setup({ entitySync: off });
		expect(await service.apply(envelope('goal.created', ewGoal, 1) as never, applyContext)).toMatchObject({
			status: 'applied'
		});
		expect(goals[0]).toMatchObject({ name: 'Grow paying customers', progress: 40 });
		expect(keyResults).toEqual([]);
		expect(links.filter((l) => l['entityType'] === EverWorksLinkType.KEY_RESULT)).toEqual([]);
		// The goal's snapshot keeps the key result fields of the last sync (none yet), not Ever Works' new ones.
		const snapshot = JSON.parse(links.find((l) => l['entityType'] === EverWorksLinkType.GOAL)?.['snapshot']);
		expect(snapshot).toMatchObject({ criteria: [], dodCriteria: [] });

		context.entitySync = {};
		await service.apply(envelope('goal.updated', ewGoal, 2) as never, applyContext);
		expect(keyResults.map((k) => k['type'])).toEqual(['Numerical', 'True/False']);
	});

	it('on again, a resync reading the unchanged goal (same version) applies the key results it was synced without (review of #11096)', async () => {
		const { service, keyResults, links, context } = setup({ entitySync: off });
		await service.apply(envelope('goal.created', ewGoal, 1) as never, applyContext);
		expect(keyResults).toEqual([]);
		// Still off: the same version stays applied.
		expect(await service.apply(envelope('goal.updated', ewGoal, 1) as never, applyContext)).toMatchObject({
			status: 'skipped',
			message: 'already applied (version)'
		});

		context.entitySync = {};
		expect(await service.apply(envelope('goal.updated', ewGoal, 1) as never, applyContext)).toMatchObject({
			status: 'applied'
		});
		expect(keyResults.map((k) => [k['type'], k['update']])).toEqual([
			['Numerical', 96],
			['True/False', 1]
		]);
		const goalLink = links.find((l) => l['entityType'] === EverWorksLinkType.GOAL) as Row;
		expect(JSON.parse(goalLink['ewOnly'])['keyResultsPending']).toBeUndefined();
		expect(JSON.parse(goalLink['snapshot'])['dodCriteria']).toEqual([
			expect.objectContaining({ id: 'launch', status: 'done' })
		]);
		// Done: the same version is applied again no more.
		expect(await service.apply(envelope('goal.updated', ewGoal, 1) as never, applyContext)).toMatchObject({
			status: 'skipped',
			message: 'already applied (version)'
		});
	});

	it('on again, the goal sweep applies the key results an unchanged goal was synced without, once (review of #11096)', async () => {
		const { service, mock, goalsMock, keyResults, links, context } = setup({ entitySync: off });
		goalsMock.addGoal('ew-org-1', { ...ewGoal });
		await service.apply(envelope('goal.created', ewGoal, 1) as never, applyContext);
		const reads = () =>
			mock.requests.filter((r) => r.method === 'GET' && r.path.endsWith('/goals/ew-goal-1')).length;

		// Still off: nothing is read or written.
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(reads()).toBe(0);
		expect(keyResults).toEqual([]);

		context.entitySync = {};
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(reads()).toBe(1);
		expect(keyResults.map((k) => [k['type'], k['update']])).toEqual([
			['Numerical', 96],
			['True/False', 1]
		]);
		expect(links.filter((l) => l['entityType'] === EverWorksLinkType.KEY_RESULT)).toHaveLength(2);
		// Done: the next sweep reads nothing.
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(reads()).toBe(1);
		expect(keyResults).toHaveLength(2);
	});

	it('an id-only event for a goal whose key results wait records the version it read, so an older event is skipped (review of #11125)', async () => {
		const { service, goalsMock, goals, keyResults, links, context } = setup({ entitySync: off });
		await service.apply(envelope('goal.created', ewGoal, 1) as never, applyContext);
		// Ever Works is at version 3 by the time the goal is read.
		goalsMock.addGoal('ew-org-1', { ...ewGoal, title: 'Grow paying customers fast', version: 3 });
		context.entitySync = {};
		expect(
			await service.apply(envelope('goal.updated', { id: 'ew-goal-1' }, 1) as never, applyContext)
		).toMatchObject({
			status: 'applied'
		});
		const goalLink = links.find((l) => l['entityType'] === EverWorksLinkType.GOAL) as Row;
		expect(goalLink['ewVersion']).toBe(3);
		expect(goals[0]['name']).toBe('Grow paying customers fast');
		expect(keyResults).toHaveLength(2);
		// The delayed version-2 event is older than what was read: it never writes its fields over it.
		expect(
			await service.apply(envelope('goal.updated', { ...ewGoal, title: 'Older title' }, 2) as never, applyContext)
		).toMatchObject({ status: 'skipped', message: 'already applied (version)' });
		expect(goals[0]['name']).toBe('Grow paying customers fast');
	});

	it('key results without an owner employee wait on the link; the sweep reads the goal again once the admin has an employee (review of #11125)', async () => {
		const { service, mock, goalsMock, keyResults, links, context } = setup();
		goalsMock.addGoal('ew-org-1', { ...ewGoal });
		const reads = () =>
			mock.requests.filter((r) => r.method === 'GET' && r.path.endsWith('/goals/ew-goal-1')).length;
		const pending = () =>
			JSON.parse((links.find((l) => l['entityType'] === EverWorksLinkType.GOAL) as Row)['ewOnly'])[
				'keyResultsPending'
			];
		// The goal's owner is not paired, and the connecting admin has no employee yet.
		context.connection.connectedByUserId = 'u-new-admin';
		expect(await service.apply(envelope('goal.created', ewGoal, 1) as never, applyContext)).toMatchObject({
			status: 'applied',
			message: '2 key result(s) wait for an owner employee'
		});
		expect(keyResults).toEqual([]);
		expect(pending()).toBe('owner');
		// Nobody can own them yet: the sweep reads nothing.
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(reads()).toBe(0);

		context.connection.connectedByUserId = 'u-admin';
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(reads()).toBe(1);
		expect(keyResults.map((k) => [k['type'], k['ownerId']])).toEqual([
			['Numerical', 'e-admin'],
			['True/False', 'e-admin']
		]);
		expect(pending()).toBeUndefined();
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(reads()).toBe(1);
	});

	it('key results that waited for an owner are applied once the goal’s owner is paired, the admin still without an employee (review of #11125)', async () => {
		const { service, mock, goalsMock, keyResults, addLink, context } = setup();
		goalsMock.addGoal('ew-org-1', { ...ewGoal });
		const reads = () =>
			mock.requests.filter((r) => r.method === 'GET' && r.path.endsWith('/goals/ew-goal-1')).length;
		context.connection.connectedByUserId = 'u-new-admin';
		await service.apply(envelope('goal.created', ewGoal, 1) as never, applyContext);
		expect(keyResults).toEqual([]);
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(reads()).toBe(0);

		// The goal's owner (Ever Works user ew-ann) is paired with a Gauzy employee.
		addLink(EverWorksLinkType.MEMBER, 'e-ann', 'ew-ann');
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(reads()).toBe(1);
		expect(keyResults.map((k) => k['ownerId'])).toEqual(['e-ann', 'e-ann']);
	});

	it('key results that waited for an owner are applied once the goal’s agent is paired (review of #11125)', async () => {
		const { service, mock, goalsMock, keyResults, addLink, links, context } = setup();
		const agentGoal = { ...ewGoal, owner: { type: 'integration', id: 'key-1' }, assignedAgentId: 'ew-agent-7' };
		goalsMock.addGoal('ew-org-1', agentGoal);
		const reads = () =>
			mock.requests.filter((r) => r.method === 'GET' && r.path.endsWith('/goals/ew-goal-1')).length;
		context.connection.connectedByUserId = 'u-new-admin';
		await service.apply(envelope('goal.created', agentGoal, 1) as never, applyContext);
		const goalLink = links.find((l) => l['entityType'] === EverWorksLinkType.GOAL) as Row;
		expect(JSON.parse(goalLink['ewOnly'])).toMatchObject({
			keyResultsPending: 'owner',
			agents: { activeAgentId: null, assignedAgentId: 'ew-agent-7' }
		});
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(reads()).toBe(0);

		addLink(EverWorksLinkType.AGENT, 'e-agent-7', 'ew-agent-7');
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(reads()).toBe(1);
		expect(keyResults.map((k) => k['ownerId'])).toEqual(['e-agent-7', 'e-agent-7']);
		expect(JSON.parse(goalLink['ewOnly'])['agents']).toBeUndefined();
	});

	it('an event without the key result fields of a goal whose key results wait reads the goal (review of #11125)', async () => {
		const { service, mock, goalsMock, keyResults, context } = setup({ entitySync: off });
		goalsMock.addGoal('ew-org-1', { ...ewGoal });
		await service.apply(envelope('goal.created', ewGoal, 1) as never, applyContext);
		const reads = () =>
			mock.requests.filter((r) => r.method === 'GET' && r.path.endsWith('/goals/ew-goal-1')).length;
		context.entitySync = {};
		// The title is there, the metric, criteria and Definition of Done are not.
		expect(
			await service.apply(
				envelope('goal.updated', { id: 'ew-goal-1', title: ewGoal['title'] }, 1) as never,
				applyContext
			)
		).toMatchObject({ status: 'applied' });
		expect(reads()).toBe(1);
		expect(keyResults.map((k) => [k['type'], k['update']])).toEqual([
			['Numerical', 96],
			['True/False', 1]
		]);
	});

	it('an event that leaves out the agents keeps the ones kept for the owner (review of #11125)', async () => {
		const { service, mock, goalsMock, keyResults, addLink, links, context } = setup();
		const agentGoal = { ...ewGoal, owner: { type: 'integration', id: 'key-1' }, assignedAgentId: 'ew-agent-7' };
		goalsMock.addGoal('ew-org-1', { ...agentGoal, version: 2 });
		const reads = () =>
			mock.requests.filter((r) => r.method === 'GET' && r.path.endsWith('/goals/ew-goal-1')).length;
		context.connection.connectedByUserId = 'u-new-admin';
		await service.apply(envelope('goal.created', agentGoal, 1) as never, applyContext);
		const { assignedAgentId: _left, ...withoutAgents } = agentGoal;
		await service.apply(envelope('goal.updated', { ...withoutAgents, title: 'Renamed' }, 2) as never, applyContext);
		const goalLink = links.find((l) => l['entityType'] === EverWorksLinkType.GOAL) as Row;
		expect(JSON.parse(goalLink['ewOnly'])).toMatchObject({
			keyResultsPending: 'owner',
			agents: { assignedAgentId: 'ew-agent-7' }
		});
		addLink(EverWorksLinkType.AGENT, 'e-agent-7', 'ew-agent-7');
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(reads()).toBe(1);
		expect(keyResults.map((k) => k['ownerId'])).toEqual(['e-agent-7', 'e-agent-7']);
	});

	it('a goal whose owner lookup fails never stops the sweep for the others (review of #11125)', async () => {
		const { service, mock, goalsMock, keyResults, addLink, context } = setup();
		const second = { ...ewGoal, id: 'ew-goal-2', title: 'Second goal' };
		goalsMock.addGoal('ew-org-1', { ...ewGoal });
		goalsMock.addGoal('ew-org-1', second);
		context.connection.connectedByUserId = 'u-new-admin';
		await service.apply(envelope('goal.created', ewGoal, 1) as never, applyContext);
		await service.apply(envelope('goal.created', second, 1) as never, applyContext);
		addLink(EverWorksLinkType.MEMBER, 'e-ann', 'ew-ann');
		const leadOf = jest
			.spyOn(service as unknown as { leadOf: () => Promise<unknown> }, 'leadOf')
			.mockRejectedValueOnce(new Error('lookup failed'));
		await expect(service.sweep({ id: 'c1', tenantId: 't1' } as never)).resolves.toBeUndefined();
		leadOf.mockRestore();
		expect(mock.requests.filter((r) => r.method === 'GET' && r.path.endsWith('/goals/ew-goal-2'))).toHaveLength(1);
		expect(keyResults.filter((k) => k['ownerId'] === 'e-ann')).toHaveLength(2);
	});

	it('off: a new Gauzy goal is not created in Ever Works (it would be made from its key results)', async () => {
		const { service, mock, goals, keyResults } = setup({ entitySync: off });
		goals.push(gauzyGoal());
		keyResults.push(keyResult('kr-a', { update: 4 }));
		expect(await service.push(change('goal-1'), pushContext)).toMatchObject({
			status: 'skipped',
			message: expect.stringMatching(/key results are not synced/)
		});
		expect(mock.requests.filter((r) => r.method !== 'GET')).toEqual([]);
	});

	it('off: a linked goal pushes its own fields only — no criteria, Definition of Done or sample; a key result change is skipped', async () => {
		const { service, mock, goalsMock, goals, keyResults, context } = setup();
		goals.push(gauzyGoal());
		keyResults.push(
			keyResult('kr-a', { update: 4 }),
			keyResult('kr-b', { type: 'True/False', targetValue: 1, unit: null })
		);
		await service.push(change('goal-1'), pushContext);
		const [created] = [...goalsMock.goals.values()];
		const samples = goalsMock.samples.length;

		context.entitySync = off;
		goals[0]['name'] = 'Close more deals';
		keyResults[0]['update'] = 9;
		keyResults[0]['targetValue'] = 20;
		keyResults[1]['update'] = 1;
		const before = mock.requests.length;
		expect(await service.push(change('goal-1'), pushContext)).toMatchObject({ status: 'pushed' });
		const sent = mock.requests.slice(before).filter((r) => r.method !== 'GET');
		expect(sent.map((r) => r.method)).toEqual(['PATCH']);
		expect(sent[0].body).toEqual({ title: 'Close more deals' });
		expect(created).toMatchObject({ title: 'Close more deals', targetValue: 10 });
		expect((created['dodCriteria'] as Row[])[0]['status']).toBe('open');
		expect(await service.push(change('kr-a', EverWorksLinkType.KEY_RESULT), pushContext)).toMatchObject({
			status: 'skipped',
			message: expect.stringMatching(/key results are not synced/)
		});
		expect(goalsMock.samples).toHaveLength(samples);
	});

	it('off: a delivery goal first synced without key results still pushes its own edits (#11114 review)', async () => {
		const { service, mock, goals, keyResults } = setup({ entitySync: off });
		const delivery = {
			...ewGoal,
			goalKind: 'delivery',
			targetValue: null,
			baselineValue: null,
			currentValue: null,
			unit: null
		};
		expect(await service.apply(envelope('goal.created', delivery, 1) as never, applyContext)).toMatchObject({
			status: 'applied'
		});
		expect(keyResults).toEqual([]);
		goals[0]['name'] = 'Renamed in Gauzy';
		const before = mock.requests.length;
		// The Ever Works goal is not in the mock (it came from an event): the PATCH it would send is what matters.
		await service.push(change(goals[0]['id']), pushContext).catch(() => undefined);
		const sent = mock.requests.slice(before).filter((r) => r.method !== 'GET');
		expect(sent.map((r) => [r.method, r.body])).toEqual([['PATCH', { title: 'Renamed in Gauzy' }]]);
	});

	it('off: the key result sweep leaves the mapping alone', async () => {
		const { service, goalsMock, goals, keyResults, queue, context } = setup();
		goals.push(gauzyGoal());
		keyResults.push(keyResult('kr-a'), keyResult('kr-b', { type: 'True/False', targetValue: 1, unit: null }));
		await service.push(change('goal-1'), pushContext);
		expect(goalsMock.goals.size).toBe(1);
		keyResults.splice(1, 1);
		context.entitySync = off;
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(queue.enqueue).not.toHaveBeenCalled();
	});
});
