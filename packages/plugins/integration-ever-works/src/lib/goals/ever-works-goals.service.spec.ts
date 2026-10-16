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
import { Employee, Goal, GoalTimeFrame, KeyResult } from '@gauzy/core';
import { EverWorksClient } from '../client/ever-works-client';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { MockEverWorksGoals } from '../testing/mock-ever-works.goals';
import { MockEverWorksServer } from '../testing/mock-ever-works.server';
import { EverWorksGoalsService } from './ever-works-goals.service';

type Row = Record<string, any>;

function setup(options: { goals?: string } = {}) {
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
	const dataSource = { getRepository: (target: unknown) => repositories.get(target) };
	const contexts = { forEverWorksOrganization: async () => context, forOrganization: async () => context };
	const service = new EverWorksGoalsService(
		dataSource as never,
		contexts as never,
		{ client: () => client } as never,
		linkService as never,
		{ write: jest.fn() } as never,
		{ register: jest.fn() } as never,
		{ register: jest.fn() } as never
	);
	return { service, mock, goalsMock, ewOrg, links, addLink, goals, keyResults, frames };
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
		expect(links.filter((l) => l['entityType'] === EverWorksLinkType.KEY_RESULT).map((l) => l['ewId'])).toEqual([
			'ew-goal-1:m',
			'ew-goal-1:d:launch'
		]);
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
				.map((l) => l['ewId'])
				.sort()
		).toEqual([`${created['id']}:d:kr-b`, `${created['id']}:m`]);
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
