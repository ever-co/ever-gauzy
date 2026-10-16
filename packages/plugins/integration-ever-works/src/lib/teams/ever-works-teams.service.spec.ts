/**
 * Teams and record scope (G-P1-7): the D11 scope helpers, and the team handler both ways against
 * in-memory stand-ins (team rows, memberships, links, the Ever Works client).
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
		BaseEntityEventSubscriber: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		...Object.fromEntries(
			['Tenant', 'Organization', 'Employee', 'User', 'IntegrationTenant', 'IntegrationSetting', 'OrganizationTeam', 'OrganizationTeamEmployee', 'OrganizationProject', 'Task', 'Role'].map(
				(name) => [name, entity(name)]
			)
		),
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, currentOrganizationId: () => null }
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import { RolesEnum } from '@gauzy/contracts';
import { IntegrationTenant, OrganizationTeam, OrganizationTeamEmployee, Role } from '@gauzy/core';
import { EverWorksApiError } from '../client/ever-works-client';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { emojiOf, gauzyTeamsFor, isSyncedVisibility, teamScopeFor } from './ever-works-team-scope';
import { EverWorksTeamsService } from './ever-works-teams.service';

describe('record scope (D11)', () => {
	it('a record on linked teams is team-scoped; on no team it is organization-scoped', () => {
		const links = new Map([['g1', 'ew1'], ['g2', 'ew2']]);
		expect(teamScopeFor(['g1', 'g2', 'g1'], links)).toEqual({ scope: { visibility: 'team', teamIds: ['ew1', 'ew2'] } });
		expect(teamScopeFor([], links)).toEqual({ scope: { visibility: 'organization', teamIds: [] } });
	});

	it('a record whose team is not linked yet waits instead of going out organization-wide', () => {
		expect(teamScopeFor(['g1', 'g3'], new Map([['g1', 'ew1']]))).toEqual({ waitingFor: 'g3' });
	});

	it('Ever Works teams Gauzy cannot map are returned to keep, never dropped', () => {
		expect(gauzyTeamsFor(['ew1', 'ew9'], new Map([['ew1', 'g1']]))).toEqual({ teamIds: ['g1'], unmapped: ['ew9'] });
		expect(gauzyTeamsFor(null, new Map())).toEqual({ teamIds: [], unmapped: [] });
	});

	it('private records never sync; icons become a team emoji only when they are one', () => {
		expect(isSyncedVisibility('private')).toBe(false);
		expect(isSyncedVisibility('team')).toBe(true);
		expect(isSyncedVisibility(undefined)).toBe(true);
		expect(emojiOf('🚀')).toBe('🚀');
		expect(emojiOf('👩🏽‍💻')).toBe('👩🏽‍💻');
		expect(emojiOf('rocket')).toBeNull();
		expect(emojiOf(null)).toBeNull();
	});
});

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
		directions: { teams: 'both' },
		isEnabled: true,
		mapping: { id: 'm1', createdAt: new Date('2026-10-01T00:00:00Z') }
	};
	const links: LinkRow[] = [];
	const linkService = {
		byEw: async (m: string, type: string, ewId: string) => links.find((l) => l.integrationTenantId === m && l.entityType === type && l.ewId === ewId) ?? null,
		byGauzy: async (m: string, type: string, gauzyId: string) => links.find((l) => l.integrationTenantId === m && l.entityType === type && l.gauzyId === gauzyId) ?? null,
		list: async (m: string, type: string) => links.filter((l) => l.integrationTenantId === m && l.entityType === type),
		snapshot: (link: LinkRow | null) => (link?.snapshot ? JSON.parse(link.snapshot) : {}),
		record: async (input: Record<string, any>) => {
			const existing = links.find((l) => l.entityType === input['entityType'] && (l.ewId === input['ewId'] || l.gauzyId === input['gauzyId']));
			const values = {
				gauzyId: input['gauzyId'],
				ewId: input['ewId'],
				ewVersion: input['ewVersion'] ?? null,
				snapshot: JSON.stringify(input['snapshot']),
				ewOnly: JSON.stringify(input['ewOnly']),
				state: EverWorksLinkState.OK
			};
			if (existing) Object.assign(existing, values);
			else links.push({ id: `l${links.length + 1}`, integrationTenantId: input['integrationTenantId'], entityType: input['entityType'], ...values });
		},
		remove: async () => undefined,
		unlink: async (link: LinkRow) => void (link.state = EverWorksLinkState.UNLINKED)
	};
	const person = (gauzyId: string, ewId: string, type = EverWorksLinkType.MEMBER) =>
		links.push({ id: `p-${ewId}`, integrationTenantId: 'm1', entityType: type, gauzyId, ewId, ewVersion: null, snapshot: null, ewOnly: null, state: 'ok' });
	const teams: Array<Record<string, any>> = [];
	const memberships: Array<Record<string, any>> = [];
	const matches = (row: Record<string, any>, where: Record<string, any>) => Object.entries(where).every(([k, v]) => row[k] === v);
	const teamRepo = {
		create: (values: Record<string, any>) => values,
		save: async (values: Record<string, any>) => {
			const row = { id: `g-team-${teams.length + 1}`, createdAt: new Date(), ...values };
			teams.push(row);
			return row;
		},
		findOne: async ({ where }: { where: Record<string, any> }) => teams.find((row) => row['id'] === where['id']) ?? null,
		find: async ({ where }: { where: Record<string, any> }) => {
			const only = where['id']?.value ?? where['id']?._value;
			return teams.filter((row) => !row['isArchived'] && (!only || only.includes(row['id'])));
		},
		update: async (where: Record<string, any>, values: Record<string, any>) => {
			for (const row of teams.filter((r) => matches(r, where))) Object.assign(row, values);
		}
	};
	const memberRepo = {
		create: (values: Record<string, any>) => values,
		save: async (values: Record<string, any>) => void memberships.push({ id: `tm${memberships.length + 1}`, ...values }),
		findOne: async ({ where }: { where: Record<string, any> }) => memberships.find((row) => matches(row, where)) ?? null,
		find: async ({ where }: { where: Record<string, any> }) => memberships.filter((row) => matches(row, where)),
		update: async (where: Record<string, any>, values: Record<string, any>) => {
			for (const row of memberships.filter((r) => matches(r, where))) Object.assign(row, values);
		},
		delete: async (where: Record<string, any>) => {
			for (const row of memberships.filter((r) => matches(r, where))) memberships.splice(memberships.indexOf(row), 1);
		}
	};
	const roleRepo = { findOne: async () => ({ id: 'role-manager', name: RolesEnum.MANAGER }) };
	const mappingRepo = {
		find: async () => [{ id: 'm1', tenantId: 't1', organizationId: 'o1', settings: [{ settingsName: 'CONNECTION_ID', settingsValue: 'c1' }] }]
	};
	const dataSource = {
		getRepository: (target: unknown) =>
			target === OrganizationTeam ? teamRepo : target === OrganizationTeamEmployee ? memberRepo : target === Role ? roleRepo : target === IntegrationTenant ? mappingRepo : null
	};
	const client = { request: jest.fn(async (_method: string, _path: string, _options?: Record<string, any>): Promise<any> => ({ version: 8 })) };
	const contexts = { forEverWorksOrganization: async () => context, forOrganization: async () => context, forRequest: async () => context };
	const connections = { client: () => client };
	const queue = { enqueue: jest.fn(async () => true) };
	const service = new EverWorksTeamsService(dataSource as never, contexts as never, connections as never, linkService as never, queue as never);
	return { service, links, person, teams, memberships, client, context, queue };
}

const envelope = (type: string, data: Record<string, unknown>, version = 3) => ({
	id: 'evt',
	seq: '1',
	type,
	tenantId: 'ewt',
	organizationId: 'ewo1',
	aggregate: { type: 'team', id: 'ew-team-1', version },
	data
});
const applyContext = { connection: { id: 'c1' }, event: {}, organizationId: 'o1' } as never;

describe('EverWorksTeamsService', () => {
	it('a team created in Ever Works is created in Gauzy with its mapped members; unmapped members stay on the link', async () => {
		const { service, person, teams, memberships, links } = setup();
		person('emp-ann', 'ew-user-ann');
		const outcome = await service.apply(
			envelope('team.created', {
				name: 'Platform',
				slug: 'platform',
				avatarIcon: '🚀',
				parentTeamId: 'ew-parent',
				members: [
					{ memberType: 'user', memberId: 'ew-user-ann', role: 'lead' },
					{ memberType: 'user', memberId: 'ew-user-unmapped', role: 'member' }
				],
				resources: []
			}) as never,
			applyContext
		);
		expect(outcome).toEqual({ status: 'applied' });
		expect(teams).toHaveLength(1);
		expect(teams[0]).toMatchObject({ name: 'Platform', emoji: '🚀', tenantId: 't1', organizationId: 'o1' });
		expect(memberships).toEqual([expect.objectContaining({ organizationTeamId: teams[0]['id'], employeeId: 'emp-ann', isManager: true })]);
		const link = links.find((l) => l.entityType === EverWorksLinkType.TEAM)!;
		expect(link).toMatchObject({ gauzyId: teams[0]['id'], ewId: 'ew-team-1', ewVersion: 3 });
		const ewOnly = JSON.parse(link.ewOnly as string);
		expect(ewOnly.parentTeamId).toBe('ew-parent'); // Ever Works nesting is preserved
		expect(ewOnly.members).toHaveLength(2);
	});

	it('an existing Ever Works team that was never paired waits for the Teams tab', async () => {
		const { service, teams } = setup();
		expect(await service.apply(envelope('team.updated', { name: 'Old team', members: [], resources: [] }) as never, applyContext)).toMatchObject({
			status: 'skipped'
		});
		expect(teams).toHaveLength(0);
	});

	it('member removals in Ever Works remove only that membership; a deleted team is archived, never deleted', async () => {
		const { service, person, teams, memberships, links } = setup();
		person('emp-ann', 'ew-user-ann');
		person('emp-bob', 'ew-user-bob');
		await service.apply(
			envelope('team.created', {
				name: 'Platform',
				members: [
					{ memberType: 'user', memberId: 'ew-user-ann', role: 'member' },
					{ memberType: 'user', memberId: 'ew-user-bob', role: 'member' }
				],
				resources: []
			}) as never,
			applyContext
		);
		await service.apply(envelope('team.member.removed', { teamId: 'ew-team-1', memberType: 'user', memberId: 'ew-user-bob', role: 'member', deleted: true }, 4) as never, applyContext);
		expect(memberships.map((m) => m['employeeId'])).toEqual(['emp-ann']);
		await service.apply(envelope('team.deleted', { name: 'Platform', members: [], resources: [], deleted: true }, 5) as never, applyContext);
		expect(teams[0]).toMatchObject({ isArchived: true, isActive: false });
		expect(links.find((l) => l.entityType === EverWorksLinkType.TEAM)?.state).toBe(EverWorksLinkState.UNLINKED);
	});

	it('a Gauzy rename and a new member are pushed as a patch and a merged member set (Ever Works-only members kept)', async () => {
		const { service, person, teams, memberships, links, client } = setup();
		person('emp-ann', 'ew-user-ann');
		person('emp-cy', 'ew-user-cy');
		await service.apply(
			envelope('team.created', {
				name: 'Platform',
				members: [
					{ memberType: 'user', memberId: 'ew-user-ann', role: 'member' },
					{ memberType: 'agent', memberId: 'ew-agent-1', role: 'member' },
					{ memberType: 'user', memberId: 'ew-user-unmapped', role: 'member' }
				],
				resources: []
			}) as never,
			applyContext
		);
		// In Gauzy: renamed, and Cy joins as manager.
		teams[0]['name'] = 'Platform Core';
		memberships.push({ id: 'tm-cy', organizationTeamId: teams[0]['id'], employeeId: 'emp-cy', isManager: true });
		const outcome = await service.push(
			{ id: 'ch1', tenantId: 't1', organizationId: 'o1', gauzyId: teams[0]['id'], op: 'upsert', entityType: EverWorksLinkType.TEAM } as never,
			{ connection: { id: 'c1' }, mapping: { id: 'm1' } } as never
		);
		expect(outcome).toEqual({ status: 'pushed' });
		const calls = client.request.mock.calls.map(([method, path, options]) => ({ method, path, body: options?.['body'] }));
		expect(calls[0]).toEqual({ method: 'PATCH', path: '/teams/ew-team-1', body: { name: 'Platform Core' } });
		expect(calls[1].method).toBe('PUT');
		expect(calls[1].path).toBe('/teams/ew-team-1/members');
		expect(calls[1].body.members).toEqual(
			expect.arrayContaining([
				{ memberType: 'user', memberId: 'ew-user-ann', role: 'member' },
				{ memberType: 'agent', memberId: 'ew-agent-1', role: 'member' },
				{ memberType: 'user', memberId: 'ew-user-unmapped', role: 'member' },
				{ memberType: 'user', memberId: 'ew-user-cy', role: 'lead' }
			])
		);
		expect(calls[1].body.members).toHaveLength(4);
		expect(links.find((l) => l.entityType === EverWorksLinkType.TEAM)?.ewVersion).toBe(8);
	});

	it('nothing changed since the last sync → nothing is sent (loop guard 2); a Gauzy delete is not pushed', async () => {
		const { service, teams, client } = setup();
		await service.apply(envelope('team.created', { name: 'Platform', members: [], resources: [] }) as never, applyContext);
		const change = { id: 'ch1', tenantId: 't1', organizationId: 'o1', gauzyId: teams[0]['id'], op: 'upsert', entityType: EverWorksLinkType.TEAM };
		expect(await service.push(change as never, { connection: { id: 'c1' }, mapping: { id: 'm1' } } as never)).toMatchObject({ status: 'skipped' });
		expect(await service.push({ ...change, op: 'delete' } as never, { connection: { id: 'c1' }, mapping: { id: 'm1' } } as never)).toMatchObject({
			status: 'skipped',
			message: expect.stringContaining('delete policy')
		});
		expect(client.request).not.toHaveBeenCalled();
	});

	it('a Gauzy team created after the mapping is created in Ever Works with its idempotency key; an older unpaired one waits', async () => {
		const { service, teams, client, links } = setup();
		teams.push({ id: 'g-new', name: 'New team', createdAt: new Date('2026-10-10T00:00:00Z') });
		teams.push({ id: 'g-old', name: 'Old team', createdAt: new Date('2026-09-01T00:00:00Z') });
		client.request.mockResolvedValueOnce({ id: 'ew-team-new', name: 'New team', version: 1, members: [] });
		const pushContext = { connection: { id: 'c1' }, mapping: { id: 'm1' } } as never;
		expect(await service.push({ id: 'a', tenantId: 't1', organizationId: 'o1', gauzyId: 'g-new', op: 'upsert' } as never, pushContext)).toMatchObject({ status: 'pushed' });
		const [method, path, options] = client.request.mock.calls[0];
		expect([method, path]).toEqual(['POST', '/teams']);
		expect(options?.['body']).toMatchObject({ name: 'New team', externalRef: { source: 'ever-gauzy', installationId: 'c1', externalId: 'g-new' } });
		expect(options?.['idempotencyKey']).toMatch(/^[0-9a-f]{64}$/);
		expect(links.find((l) => l.gauzyId === 'g-new')?.ewId).toBe('ew-team-new');
		expect(await service.push({ id: 'b', tenantId: 't1', organizationId: 'o1', gauzyId: 'g-old', op: 'upsert' } as never, pushContext)).toMatchObject({ status: 'skipped' });
		expect(client.request).toHaveBeenCalledTimes(1);
	});

	it('a disabled mapping writes nothing in either direction', async () => {
		const { service, teams, client, context } = setup();
		(context as { isEnabled: boolean }).isEnabled = false;
		expect(await service.apply(envelope('team.created', { name: 'Platform', members: [], resources: [] }) as never, applyContext)).toMatchObject({
			status: 'skipped',
			message: 'the mapping is disabled'
		});
		teams.push({ id: 'g-new', name: 'New team', createdAt: new Date('2026-10-10T00:00:00Z') });
		expect(
			await service.push({ id: 'a', tenantId: 't1', organizationId: 'o1', gauzyId: 'g-new', op: 'upsert' } as never, { connection: { id: 'c1' }, mapping: { id: 'm1' } } as never)
		).toMatchObject({ status: 'skipped', message: 'the mapping is disabled' });
		expect(teams).toHaveLength(1);
		expect(client.request).not.toHaveBeenCalled();
	});

	it('a Gauzy manager holding only the MANAGER role (as the platform makes them) is pushed as a lead', async () => {
		const { service, person, teams, memberships, client } = setup();
		person('emp-ann', 'ew-user-ann');
		await service.apply(envelope('team.created', { name: 'Platform', members: [], resources: [] }) as never, applyContext);
		memberships.push({ id: 'tm-ann', organizationTeamId: teams[0]['id'], employeeId: 'emp-ann', isManager: false, role: { name: RolesEnum.MANAGER } });
		await service.push({ id: 'c', tenantId: 't1', organizationId: 'o1', gauzyId: teams[0]['id'], op: 'upsert' } as never, { connection: { id: 'c1' }, mapping: { id: 'm1' } } as never);
		const put = client.request.mock.calls.find(([method]) => method === 'PUT');
		expect(put?.[2]?.['body'].members).toEqual([{ memberType: 'user', memberId: 'ew-user-ann', role: 'lead' }]);
	});

	it('a lead from Ever Works gets the MANAGER role as well as isManager', async () => {
		const { service, person, memberships } = setup();
		person('emp-ann', 'ew-user-ann');
		await service.apply(envelope('team.created', { name: 'Platform', members: [{ memberType: 'user', memberId: 'ew-user-ann', role: 'lead' }], resources: [] }) as never, applyContext);
		expect(memberships[0]).toMatchObject({ employeeId: 'emp-ann', isManager: true, roleId: 'role-manager' });
	});

	it('an inbound change keeps a Gauzy edit that is not pushed yet as a difference (it is pushed afterwards)', async () => {
		const { service, person, teams, memberships, client } = setup();
		person('emp-ann', 'ew-user-ann');
		person('emp-cy', 'ew-user-cy');
		await service.apply(envelope('team.created', { name: 'Platform', members: [{ memberType: 'user', memberId: 'ew-user-ann', role: 'member' }], resources: [] }) as never, applyContext);
		memberships.push({ id: 'tm-cy', organizationTeamId: teams[0]['id'], employeeId: 'emp-cy', isManager: false }); // queued, not pushed yet
		await service.apply(envelope('team.member.updated', { teamId: 'ew-team-1', memberType: 'user', memberId: 'ew-user-ann', role: 'lead' }, 4) as never, applyContext);
		await service.push({ id: 'c', tenantId: 't1', organizationId: 'o1', gauzyId: teams[0]['id'], op: 'upsert' } as never, { connection: { id: 'c1' }, mapping: { id: 'm1' } } as never);
		const put = client.request.mock.calls.find(([method]) => method === 'PUT');
		expect(put?.[2]?.['body'].members).toEqual(
			expect.arrayContaining([
				{ memberType: 'user', memberId: 'ew-user-ann', role: 'lead' },
				{ memberType: 'user', memberId: 'ew-user-cy', role: 'member' }
			])
		);
	});

	it('on 412 the newer Ever Works state is applied to Gauzy first, then the push is merged on top of it', async () => {
		const { service, person, teams, memberships, client, links } = setup();
		person('emp-ann', 'ew-user-ann');
		person('emp-dee', 'ew-user-dee');
		await service.apply(envelope('team.created', { name: 'Platform', members: [{ memberType: 'user', memberId: 'ew-user-ann', role: 'member' }], resources: [] }) as never, applyContext);
		teams[0]['name'] = 'Platform Core';
		client.request
			.mockRejectedValueOnce(new EverWorksApiError(412, 'version_mismatch', 'Stale version'))
			.mockResolvedValueOnce({
				id: 'ew-team-1',
				name: 'Platform',
				version: 9,
				members: [
					{ memberType: 'user', memberId: 'ew-user-ann', role: 'member' },
					{ memberType: 'user', memberId: 'ew-user-dee', role: 'member' }
				],
				resources: []
			})
			.mockResolvedValueOnce({ version: 10 });
		expect(await service.push({ id: 'c', tenantId: 't1', organizationId: 'o1', gauzyId: teams[0]['id'], op: 'upsert' } as never, { connection: { id: 'c1' }, mapping: { id: 'm1' } } as never)).toEqual({ status: 'pushed' });
		expect(memberships.map((m) => m['employeeId']).sort()).toEqual(['emp-ann', 'emp-dee']); // Dee, added in Ever Works meanwhile, joined in Gauzy
		const retried = client.request.mock.calls[2];
		expect([retried[0], retried[1], retried[2]?.['body'], retried[2]?.['ifMatchVersion']]).toEqual(['PATCH', '/teams/ew-team-1', { name: 'Platform Core' }, 9]);
		expect(links.find((l) => l.entityType === EverWorksLinkType.TEAM)?.ewVersion).toBe(10);
	});

	it('a manager hand-over between two agent members moves isManager from the old one to the new one', async () => {
		const { service, person, memberships } = setup();
		person('emp-a', 'ag-a', EverWorksLinkType.AGENT);
		person('emp-b', 'ag-b', EverWorksLinkType.AGENT);
		const agents = [
			{ memberType: 'agent', memberId: 'ag-a', role: 'member' },
			{ memberType: 'agent', memberId: 'ag-b', role: 'member' }
		];
		await service.apply(envelope('team.created', { name: 'Bots', managerAgentId: 'ag-a', members: agents, resources: [] }) as never, applyContext);
		await service.apply(envelope('team.updated', { name: 'Bots', managerAgentId: 'ag-b', members: agents, resources: [] }, 4) as never, applyContext);
		expect(Object.fromEntries(memberships.map((m) => [m['employeeId'], m['isManager']]))).toEqual({ 'emp-a': false, 'emp-b': true });
	});

	it('a member Gauzy could not map joins once the person is paired (sweep), and a drifted member set queues a push', async () => {
		const { service, person, teams, memberships, queue } = setup();
		await service.apply(envelope('team.created', { name: 'Platform', members: [{ memberType: 'user', memberId: 'ew-user-eve', role: 'member' }], resources: [] }) as never, applyContext);
		expect(memberships).toHaveLength(0);
		person('emp-eve', 'ew-user-eve'); // paired on the People tab later
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(memberships).toEqual([expect.objectContaining({ employeeId: 'emp-eve' })]);
		expect(queue.enqueue).not.toHaveBeenCalled();
		memberships.splice(0, 1); // removed in Gauzy by a bulk delete no hook sees
		await service.sweep({ id: 'c1', tenantId: 't1' } as never);
		expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ entityType: EverWorksLinkType.TEAM, gauzyId: teams[0]['id'], op: 'upsert' }));
	});

	it('an admin unpairing is durable: the team is not paired or created again on its own', async () => {
		const { service, teams, client, links } = setup();
		teams.push({ id: 'g-new', name: 'New team', createdAt: new Date('2026-10-10T00:00:00Z') });
		client.request.mockResolvedValueOnce({ id: 'ew-team-new', name: 'New team', version: 1, members: [] });
		const pushContext = { connection: { id: 'c1' }, mapping: { id: 'm1' } } as never;
		await service.push({ id: 'a', tenantId: 't1', organizationId: 'o1', gauzyId: 'g-new', op: 'upsert' } as never, pushContext);
		client.request.mockResolvedValueOnce({ data: [{ id: 'ew-team-new', name: 'New team', members: [], resources: [] }], nextCursor: null, hasMore: false });
		client.request.mockResolvedValueOnce({ data: [{ id: 'ew-team-new', name: 'New team', members: [], resources: [] }], nextCursor: null, hasMore: false });
		await service.decide('m1' as never, { unlinks: ['ew-team-new'] });
		expect(links.find((l) => l.gauzyId === 'g-new')?.state).toBe(EverWorksLinkState.UNLINKED);
		const calls = client.request.mock.calls.length;
		teams[0]['name'] = 'New team renamed';
		expect(await service.push({ id: 'b', tenantId: 't1', organizationId: 'o1', gauzyId: 'g-new', op: 'upsert' } as never, pushContext)).toMatchObject({ status: 'skipped' });
		expect(client.request.mock.calls.length).toBe(calls);
	});
});
