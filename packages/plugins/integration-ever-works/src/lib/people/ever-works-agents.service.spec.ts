/**
 * Agents (G-P1-6): Ever Works agents become Gauzy employees of kind `agent` through the platform's
 * agent-provisioning path, one way, linked as AGENT; archived/deleted → archived, private → unlinked.
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
				'UserOrganization',
				'Employee',
				'User',
				'EmployeeNotification',
				'IntegrationTenant',
				'IntegrationSetting',
				'EmployeeService',
				'EmployeeAgentProfileService'
			].map((name) => [name, entity(name)])
		),
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, currentOrganizationId: () => null }
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import { ServiceUnavailableException } from '@nestjs/common';
import { EmployeeAgentSourceEnum } from '@gauzy/contracts';
import { EmployeeAgentProfileService, EmployeeService, User } from '@gauzy/core';
import { EverWorksApiError } from '../client/ever-works-client';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { agentEmailDomain, EverWorksAgentsService, reportingDepths } from './ever-works-agents.service';

const context = {
	tenantId: 't1',
	organizationId: 'o1',
	integrationTenantId: 'm1',
	connection: { id: 'c1' },
	everWorksOrganizationSlug: 'acme',
	directions: { agents: 'ew_to_gauzy' },
	isEnabled: true,
	everWorksOrganizationId: 'ewo1'
};
const agent = {
	id: 'AG-1',
	organizationId: 'ewo1',
	name: 'Scout',
	slug: 'scout',
	title: 'Researcher',
	capabilities: 'search',
	status: 'active',
	scope: 'organization',
	scopeTargetId: 'ewo1',
	avatar: { mode: 'image', url: 'https://cdn.example.test/a.png' },
	webUrl: 'https://app.example.test/agents/AG-1'
};
const envelope = (type: string, data: Record<string, unknown>, version = 2) => ({
	id: 'evt-1',
	seq: '1',
	type,
	tenantId: 'ewt',
	organizationId: 'ewo1',
	aggregate: { type: 'agent', id: 'AG-1', version },
	data
});
const applyContext = { connection: { id: 'c1' }, event: {}, organizationId: 'o1' } as never;

function setup(options: { link?: { gauzyId: string; ewVersion: number | null; state?: string }; provisioning?: boolean; visible?: boolean } = {}) {
	const employeesRepo = {
		findOne: jest.fn(async () => (options.link ? { id: options.link.gauzyId, userId: 'u1' } : null)),
		update: jest.fn(async () => ({ affected: 1 }))
	};
	const usersRepo = { update: jest.fn(async () => ({ affected: 1 })) };
	const dataSource = { getRepository: (target: unknown) => (target === User ? usersRepo : employeesRepo) };
	// The AG-1 link as the link service would hold it: record() writes it (state OK unless given), unlink() ends it.
	let current: Record<string, unknown> | null = options.link ? { state: EverWorksLinkState.OK, ...options.link } : null;
	const links = {
		byEw: jest.fn(async (_m: string, _type: string, ewId: string) => (ewId === 'AG-1' && current ? { ...current } : null)),
		record: jest.fn(async (input: Record<string, unknown>) => {
			if (input['ewId'] === 'AG-1')
				current = { ...(current ?? {}), gauzyId: input['gauzyId'], ewVersion: input['ewVersion'] ?? null, state: input['state'] ?? EverWorksLinkState.OK };
		}),
		unlink: jest.fn(async () => {
			if (current) current = { ...current, state: EverWorksLinkState.UNLINKED };
		})
	};
	const contexts = { forEverWorksOrganization: jest.fn(async () => context), forRequest: jest.fn(async () => context) };
	const inbound = { record: jest.fn(async () => ({ duplicate: false })) };
	// GET /agents/:id answers the agent as it is now while it is visible to the integration (never a private one: 404).
	const remote = { visible: options.visible ?? true, agent: { ...agent, version: 2 } as Record<string, unknown> };
	const client = {
		request: jest.fn(async (_method: string, path: string): Promise<any> => {
			if (path === '/agents/AG-1') {
				if (!remote.visible) throw new EverWorksApiError(404, 'not_found', 'No such agent.');
				return { ...remote.agent };
			}
			return { data: [], nextCursor: null, hasMore: false };
		})
	};
	const connections = { client: () => client };
	const employees = { createAgentEmployee: jest.fn(async () => ({ employee: { id: 'e-new', userId: 'u-new' }, created: true })) };
	const profiles = { upsertForEmployee: jest.fn(async () => undefined) };
	const moduleRef = {
		get: (token: unknown) =>
			options.provisioning === false ? undefined : token === EmployeeService ? employees : token === EmployeeAgentProfileService ? profiles : undefined
	};
	const service = new EverWorksAgentsService(dataSource as never, contexts as never, connections as never, links as never, moduleRef as never, inbound as never);
	return { service, employeesRepo, usersRepo, links, contexts, employees, profiles, inbound, client, remote, link: () => current };
}

describe('EverWorksAgentsService', () => {
	it('agent employees get an address that can never receive mail', () => {
		expect(agentEmailDomain({})).toBe('agents.invalid');
		expect(agentEmailDomain({ EVER_WORKS_AGENT_EMAIL_DOMAIN: 'Bots.Example.invalid' })).toBe('bots.example.invalid');
		expect(agentEmailDomain({ EVER_WORKS_AGENT_EMAIL_DOMAIN: 'example.com' })).toBe('agents.invalid');
	});

	it('a new agent is provisioned through the platform path, managed by Ever Works, and linked', async () => {
		const { service, employees, links, employeesRepo } = setup();
		expect(await service.apply(envelope('agent.created', agent) as never, applyContext)).toEqual({ status: 'applied' });
		expect(employees.createAgentEmployee).toHaveBeenCalledTimes(1);
		const [input] = employees.createAgentEmployee.mock.calls[0] as unknown as [Record<string, any>];
		expect(input).toMatchObject({ tenantId: 't1', organizationId: 'o1', name: 'Scout', email: 'agent-ag-1@agents.invalid' });
		expect(input['profile']).toMatchObject({
			source: EmployeeAgentSourceEnum.EVER_WORKS,
			externalId: 'AG-1',
			managedExternally: true,
			avatarUrl: 'https://cdn.example.test/a.png',
			externalUrl: 'https://app.example.test/agents/AG-1'
		});
		expect(employeesRepo.update).toHaveBeenCalledWith({ id: 'e-new' }, expect.objectContaining({ isActive: true, isArchived: false }));
		expect(links.record).toHaveBeenCalledWith(
			expect.objectContaining({ entityType: EverWorksLinkType.AGENT, gauzyId: 'e-new', ewId: 'AG-1', ewVersion: 2, direction: 'inbound' })
		);
	});

	it('an archived agent is archived in Gauzy (never deleted), its profile rewritten from Ever Works', async () => {
		const { service, employees, profiles, employeesRepo } = setup({ link: { gauzyId: 'e1', ewVersion: 1 } });
		await service.apply(envelope('agent.archived', agent) as never, applyContext);
		expect(employees.createAgentEmployee).not.toHaveBeenCalled();
		expect(profiles.upsertForEmployee).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }), expect.objectContaining({ status: 'archived' }));
		expect(employeesRepo.update).toHaveBeenCalledWith({ id: 'e1' }, { isActive: false, isArchived: true });
	});

	it('an event at or below the linked version is skipped and writes nothing', async () => {
		const { service, employeesRepo, links } = setup({ link: { gauzyId: 'e1', ewVersion: 2 } });
		expect(await service.apply(envelope('agent.updated', agent, 2) as never, applyContext)).toMatchObject({ status: 'skipped' });
		expect(employeesRepo.update).not.toHaveBeenCalled();
		expect(links.record).not.toHaveBeenCalled();
	});

	it('an agent turned private is unlinked and no longer synced', async () => {
		const { service, links, employeesRepo } = setup({ link: { gauzyId: 'e1', ewVersion: 1 } });
		const outcome = await service.apply(envelope('agent.visibility_changed', { id: 'AG-1', visibility: 'private' }) as never, applyContext);
		expect(outcome).toMatchObject({ status: 'skipped' });
		expect(links.unlink).toHaveBeenCalledTimes(1);
		expect(employeesRepo.update).not.toHaveBeenCalled();
	});

	it('a stale public event after the private notice never brings the agent back; shared again, it resumes (review F19)', async () => {
		const { service, links, employees, profiles, employeesRepo, link, remote } = setup({ link: { gauzyId: 'e1', ewVersion: 5 } });
		remote.visible = false;
		expect(await service.apply(envelope('agent.visibility_changed', { id: 'AG-1', visibility: 'private' }, 7) as never, applyContext)).toMatchObject({
			status: 'skipped'
		});
		// The private notice's version is kept on the ended link (a tombstone).
		expect(link()).toMatchObject({ gauzyId: 'e1', ewVersion: 7, state: EverWorksLinkState.UNLINKED });
		// A late webhook or an import listed before the agent turned private: older, skipped.
		expect(await service.apply(envelope('agent.updated', agent, 6) as never, applyContext)).toMatchObject({ status: 'skipped' });
		// A newer event while it is still private (Ever Works answers 404) is skipped too.
		expect(await service.apply(envelope('agent.updated', agent, 8) as never, applyContext)).toMatchObject({ status: 'skipped' });
		expect(employees.createAgentEmployee).not.toHaveBeenCalled();
		expect(profiles.upsertForEmployee).not.toHaveBeenCalled();
		expect(employeesRepo.update).not.toHaveBeenCalled();
		expect(link()).toMatchObject({ state: EverWorksLinkState.UNLINKED });
		// Shared again (a newer visibility change): read from Ever Works and linked again on the same employee.
		Object.assign(remote, { visible: true, agent: { ...agent, version: 9, visibility: 'organization' } });
		expect(await service.apply(envelope('agent.visibility_changed', { id: 'AG-1', visibility: 'organization' }, 9) as never, applyContext)).toEqual({
			status: 'applied'
		});
		expect(profiles.upsertForEmployee).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }), expect.objectContaining({ externalId: 'AG-1' }));
		expect(link()).toMatchObject({ gauzyId: 'e1', ewVersion: 9, state: EverWorksLinkState.OK });
		expect(links.unlink).toHaveBeenCalledTimes(1);
	});

	it('an agent never linked is read from Ever Works before it is provisioned: a private one is never created (review F19)', async () => {
		const { service, employees, links, client } = setup({ visible: false });
		// The private notice of an agent Gauzy never had leaves nothing to end; a stale created event comes later.
		expect(await service.apply(envelope('agent.visibility_changed', { id: 'AG-1', visibility: 'private' }, 7) as never, applyContext)).toMatchObject({
			status: 'skipped'
		});
		expect(await service.apply(envelope('agent.created', agent, 1) as never, applyContext)).toEqual({
			status: 'skipped',
			message: 'the agent is not visible in Ever Works (private or gone)'
		});
		expect(client.request).toHaveBeenCalledWith('GET', '/agents/AG-1');
		expect(employees.createAgentEmployee).not.toHaveBeenCalled();
		expect(links.record).not.toHaveBeenCalled();
	});

	it('a resync after the agent was shared again while offline restores it; a late archive event never overrides its current state (#11025 review)', async () => {
		const { service, profiles, employeesRepo, link, remote } = setup({ link: { gauzyId: 'e1', ewVersion: 5 } });
		remote.visible = false;
		await service.apply(envelope('agent.visibility_changed', { id: 'AG-1', visibility: 'private' }, 7) as never, applyContext);
		// Shared again while the feed was out of reach: the resync's initial event is an `agent.updated` at the current version.
		Object.assign(remote, { visible: true, agent: { ...agent, version: 12, visibility: 'team' } });
		expect(await service.apply(envelope('agent.updated', { ...agent, visibility: 'team' }, 12) as never, applyContext)).toEqual({ status: 'applied' });
		expect(link()).toMatchObject({ gauzyId: 'e1', ewVersion: 12, state: EverWorksLinkState.OK });
		expect(profiles.upsertForEmployee).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }), expect.objectContaining({ status: 'active' }));
		// A never-linked agent archived and restored before its delayed archive event arrives: applied as it is now (active).
		const fresh = setup();
		Object.assign(fresh.remote, { agent: { ...agent, version: 4, status: 'active' } });
		expect(await fresh.service.apply(envelope('agent.archived', agent, 3) as never, applyContext)).toEqual({ status: 'applied' });
		expect(fresh.employeesRepo.update).toHaveBeenCalledWith({ id: 'e-new' }, expect.objectContaining({ isActive: true, isArchived: false }));
		expect(fresh.link()).toMatchObject({ ewVersion: 4 });
		expect(employeesRepo.update).not.toHaveBeenCalledWith({ id: 'e1' }, { isActive: false, isArchived: true });
	});

	it('nothing is written when agents are not synced for the mapping', async () => {
		const { service, contexts, employees } = setup();
		contexts.forEverWorksOrganization.mockResolvedValueOnce({ ...context, directions: { agents: 'off' } });
		expect(await service.apply(envelope('agent.created', agent) as never, applyContext)).toMatchObject({ status: 'skipped' });
		expect(employees.createAgentEmployee).not.toHaveBeenCalled();
	});

	it('a process without the platform provisioning path refuses instead of half-writing', async () => {
		const { service, links } = setup({ provisioning: false });
		await expect(service.apply(envelope('agent.created', agent) as never, applyContext)).rejects.toBeInstanceOf(ServiceUnavailableException);
		expect(links.record).not.toHaveBeenCalled();
	});

	it('a disabled mapping writes nothing, and import refuses it (and agents switched off)', async () => {
		const { service, contexts, employees } = setup();
		contexts.forEverWorksOrganization.mockResolvedValueOnce({ ...context, isEnabled: false });
		expect(await service.apply(envelope('agent.created', agent) as never, applyContext)).toMatchObject({ status: 'skipped', message: 'the mapping is disabled' });
		expect(employees.createAgentEmployee).not.toHaveBeenCalled();
		contexts.forRequest.mockResolvedValueOnce({ ...context, isEnabled: false });
		await expect(service.importAll('m1' as never)).rejects.toThrow(/disabled/);
		contexts.forRequest.mockResolvedValueOnce({ ...context, directions: { agents: 'off' } });
		await expect(service.importAll('m1' as never)).rejects.toThrow(/not synced/);
	});

	it('fields Ever Works cleared are cleared in Gauzy (manager, title, model, avatar, URL)', async () => {
		const { service, profiles, usersRepo } = setup({ link: { gauzyId: 'e1', ewVersion: 1 } });
		await service.apply(envelope('agent.updated', { ...agent, title: null, modelId: null, avatar: null, webUrl: null, reportsToAgentId: null }) as never, applyContext);
		const [, profile] = profiles.upsertForEmployee.mock.calls[0] as unknown as [unknown, Record<string, unknown>];
		expect(profile).toMatchObject({ title: null, modelId: null, avatarUrl: null, externalUrl: null, reportsToEmployeeId: null });
		expect(usersRepo.update).toHaveBeenCalledWith({ id: 'u1' }, { firstName: 'Scout', imageUrl: null });
	});

	it('import queues every agent as an initial event for the sync loop, managers first, never writing itself', async () => {
		const { service, inbound, client, employees } = setup();
		client.request.mockResolvedValueOnce({
			data: [
				{ ...agent, id: 'C', reportsToAgentId: 'B', version: 4 },
				{ ...agent, id: 'B', reportsToAgentId: 'A', version: 2 },
				{ ...agent, id: 'A', reportsToAgentId: null, version: 7 }
			],
			nextCursor: null,
			hasMore: false
		});
		expect(await service.importAll('m1' as never)).toEqual({ queued: 3, duplicates: 0 });
		const queued = inbound.record.mock.calls.map((call) => (call as unknown as [unknown, Record<string, any>, string])[1]);
		expect(Object.fromEntries(queued.map((e) => [e['aggregate'].id, e['seq']]))).toEqual({ A: '0', B: '1', C: '2' });
		expect(queued.find((e) => e['aggregate'].id === 'C')).toMatchObject({ id: 'initial:agent:C:v4', type: 'agent.updated', organizationId: 'ewo1', aggregate: { version: 4 } });
		expect((inbound.record.mock.calls[0] as unknown as unknown[])[2]).toBe('initial');
		expect(employees.createAgentEmployee).not.toHaveBeenCalled();
	});

	it('reporting depths order a chain however it is listed, and survive a cycle', () => {
		expect(reportingDepths([{ id: 'C', reportsToAgentId: 'B' }, { id: 'B', reportsToAgentId: 'A' }, { id: 'A' }])).toEqual(
			new Map([['C', 2], ['B', 1], ['A', 0]])
		);
		expect(reportingDepths([{ id: 'X', reportsToAgentId: 'Y' }, { id: 'Y', reportsToAgentId: 'X' }]).get('X')).toBe(1);
		expect(reportingDepths([{ id: 'Z', reportsToAgentId: 'outside' }]).get('Z')).toBe(0);
	});
});
