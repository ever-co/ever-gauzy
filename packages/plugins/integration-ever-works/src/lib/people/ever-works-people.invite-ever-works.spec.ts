/**
 * "Invite to Ever Works" on the People tab (G-P1-6, plan 01 §3 "No match"): a Gauzy person with no Ever Works member
 * is invited into the mapped Ever Works organization through the integration API (`POST /members/invite`, CR-13,
 * contract v1-draft.15) — the app's own invitation, sent as the admin's paired Ever Works user. Nothing is paired
 * by it; a repeat is answered by Ever Works as the pending invitation. Against the mock Ever Works server.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const entity = (name: string) => ({ [name]: class {} })[name];
	const granted = new Set<string>();
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
			['Tenant', 'Organization', 'UserOrganization', 'Employee', 'EmployeeNotification', 'User', 'Invite', 'Role', 'IntegrationTenant', 'IntegrationSetting'].map(
				(name) => [name, entity(name)]
			)
		),
		InviteBulkCreateCommand: class {},
		RequestContext: {
			currentTenantId: () => null,
			currentUserId: () => 'user-admin',
			currentOrganizationId: () => null,
			getLanguageCode: () => 'en',
			hasPermission: (permission: string) => granted.has(permission),
			__granted: granted
		}
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { Employee, RequestContext } from '@gauzy/core';
import { TestEverWorksClientFactory } from '../client/ever-works-client.factory';
import { EverWorksInboundEvent, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { MOCK_PRESET_SCOPES, MockEverWorksServer } from '../testing/mock-ever-works.server';
import { EverWorksPeopleService } from './ever-works-people.service';

const granted = (RequestContext as unknown as { __granted: Set<string> }).__granted;
const MAPPING = 'mapping-1';
const ADMIN_EW = 'ew-user-admin';

function setup(options: { scopes?: string[]; links?: Array<{ ewId: string; gauzyId: string }>; ewMembers?: Array<Record<string, unknown>>; adminPaired?: boolean } = {}) {
	const mock = new MockEverWorksServer();
	const ewOrg = { id: 'ew-org-1', slug: 'acme', displayName: 'Acme' };
	const key = mock.addKey({ organizations: [ewOrg], scopes: options.scopes ?? [...MOCK_PRESET_SCOPES] });
	mock.addMember(ewOrg.id, { userId: ADMIN_EW, email: 'admin@example.test', username: 'admin' });
	for (const member of options.ewMembers ?? []) mock.addMember(ewOrg.id, member);
	const context = {
		tenantId: 't1',
		organizationId: 'o1',
		integrationTenantId: MAPPING,
		connection: { id: 'conn-1' },
		everWorksOrganizationId: ewOrg.id,
		everWorksOrganizationSlug: ewOrg.slug
	};
	const links = [...(options.links ?? []), ...(options.adminPaired === false ? [] : [{ ewId: ADMIN_EW, gauzyId: 'employee-admin' }])].map((l) => ({
		...l,
		integrationTenantId: MAPPING,
		entityType: EverWorksLinkType.MEMBER,
		state: 'ok'
	}));
	const employees = [
		{ id: 'employee-admin', userId: 'user-admin', kind: 'human', user: { firstName: 'Ann', lastName: 'Admin', email: 'admin@example.test' } },
		{ id: 'employee-grace', userId: 'user-grace', kind: 'human', user: { firstName: 'Grace', lastName: 'Hopper', email: 'Grace@Example.test' } },
		{ id: 'employee-mute', userId: 'user-mute', kind: 'human', user: { firstName: 'No', lastName: 'Mail', email: null } },
		{ id: 'employee-bot', userId: 'user-bot', kind: 'agent', user: { firstName: 'Scout', lastName: '', email: 'scout@agents.invalid' } }
	];
	const employeeRepo = {
		find: jest.fn(async ({ where }: { where: { id?: { _value?: string[] } } }) => {
			const only = where.id && (where.id as { _value?: string[] })._value;
			return employees.filter((e) => !only || only.includes(e.id));
		}),
		findOne: jest.fn(async ({ where }: { where: { userId?: string } }) => employees.find((e) => e.userId === where.userId) ?? null)
	};
	const dataSource = {
		getRepository: (target: unknown) => {
			if (target === Employee) return employeeRepo;
			if (target === EverWorksInboundEvent) return { find: async () => [] };
			throw new Error('unexpected repository');
		},
		options: { type: 'sqlite' }
	};
	const factory = new TestEverWorksClientFactory(mock.transport(), { allowInsecure: true });
	const connections = {
		client: (_connection: unknown, scopeSlug?: string | null) =>
			factory.create({ apiBaseUrl: 'http://ever-works.test/api', apiKey: key, connectionId: 'conn-1', scopeSlug: scopeSlug ?? null })
	};
	const linkService = {
		list: jest.fn(async () => links),
		byEw: jest.fn(async (_m: string, _t: string, ewId: string) => links.find((l) => l.ewId === ewId) ?? null),
		byGauzy: jest.fn(async (_m: string, _t: string, gauzyId: string) => links.find((l) => l.gauzyId === gauzyId) ?? null),
		record: jest.fn(),
		remove: jest.fn()
	};
	const contexts = { forRequest: jest.fn(async () => context) };
	const service = new EverWorksPeopleService(dataSource as never, contexts as never, connections as never, linkService as never, { execute: jest.fn() } as never);
	const invites = () => mock.requests.filter((r) => r.method === 'POST' && r.path === '/members/invite');
	return { service, mock, invites, linkService };
}

describe('EverWorksPeopleService — invite to Ever Works', () => {
	beforeEach(() => {
		granted.clear();
		granted.add(PermissionsEnum.ORG_INVITE_EDIT);
	});

	it("invites a Gauzy person with no Ever Works member into the mapped organization, as the admin's Ever Works user", async () => {
		const { service, mock, invites } = setup();
		const result = await service.inviteToEverWorks(MAPPING as never, { employeeId: 'employee-grace' as never }, 'o1' as never);

		expect(invites()).toHaveLength(1);
		const request = invites()[0];
		expect(request.body).toEqual({ email: 'Grace@Example.test', role: 'member', invitedName: 'Grace Hopper' });
		expect(request.headers['x-scope-slug']).toBe('acme');
		expect(request.headers['x-act-as-user']).toBe(ADMIN_EW);
		expect(request.headers['idempotency-key']).toBeTruthy();
		expect(mock.memberInvitations).toHaveLength(1);
		expect(result).toEqual({
			status: 'invited',
			email: 'Grace@Example.test',
			invitationId: mock.memberInvitations[0].dto['id'],
			expiresAt: mock.memberInvitations[0].dto['expiresAt'],
			ewUserId: null
		});
	});

	it('invites as the key owner when the admin has no paired Ever Works user', async () => {
		const { service, invites } = setup({ adminPaired: false });
		await service.inviteToEverWorks(MAPPING as never, { employeeId: 'employee-grace' as never });
		expect(invites()[0].headers['x-act-as-user']).toBeUndefined();
	});

	it('a second invitation of the same person is answered as the pending one (Ever Works sends nothing twice)', async () => {
		const { service, mock } = setup();
		await service.inviteToEverWorks(MAPPING as never, { employeeId: 'employee-grace' as never });
		const again = await service.inviteToEverWorks(MAPPING as never, { employeeId: 'employee-grace' as never });
		expect(again.status).toBe('pending');
		expect(again.invitationId).toBe(mock.memberInvitations[0].dto['id']);
		expect(mock.memberInvitations).toHaveLength(1);
	});

	it('refuses an admin without the invite permission (403) and sends nothing', async () => {
		granted.clear();
		const { service, invites } = setup();
		await expect(service.inviteToEverWorks(MAPPING as never, { employeeId: 'employee-grace' as never })).rejects.toBeInstanceOf(ForbiddenException);
		expect(invites()).toHaveLength(0);
	});

	it('refuses an agent, an unknown id, or a person without an e-mail (400)', async () => {
		for (const employeeId of ['employee-bot', 'employee-nobody', 'employee-mute']) {
			const { service, invites } = setup();
			await expect(service.inviteToEverWorks(MAPPING as never, { employeeId: employeeId as never })).rejects.toBeInstanceOf(BadRequestException);
			expect(invites()).toHaveLength(0);
		}
	});

	it('refuses a person already paired with an Ever Works member (409)', async () => {
		const { service, invites } = setup({ links: [{ ewId: 'ew-user-grace', gauzyId: 'employee-grace' }] });
		await expect(service.inviteToEverWorks(MAPPING as never, { employeeId: 'employee-grace' as never })).rejects.toBeInstanceOf(ConflictException);
		expect(invites()).toHaveLength(0);
	});

	it('refuses (409: pair them instead) when a member of the Ever Works organization already has that e-mail, whatever its case', async () => {
		const { service, invites } = setup({ ewMembers: [{ userId: 'ew-user-grace', email: 'grace@example.TEST' }] });
		await expect(service.inviteToEverWorks(MAPPING as never, { employeeId: 'employee-grace' as never })).rejects.toBeInstanceOf(ConflictException);
		expect(invites()).toHaveLength(0);
	});

	it('names the missing members:write scope (403) when the key cannot invite', async () => {
		const { service, mock } = setup({ scopes: MOCK_PRESET_SCOPES.filter((scope) => scope !== 'members:write') });
		const error = await service.inviteToEverWorks(MAPPING as never, { employeeId: 'employee-grace' as never }).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ForbiddenException);
		expect((error as Error).message).toContain('members:write');
		expect(mock.memberInvitations).toHaveLength(0);
	});

	it('says so (400) when the Ever Works server predates member invitations (contract v1-draft.15)', async () => {
		const { service, mock } = setup();
		mock.failures.push({ method: 'POST', path: '/members/invite', status: 404, body: MockEverWorksServer.error(404, 'not_found', 'Cannot POST /members/invite').data });
		const error = await service.inviteToEverWorks(MAPPING as never, { employeeId: 'employee-grace' as never }).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(BadRequestException);
		expect((error as Error).message).toContain('v1-draft.15');
	});

	it('pairs nobody: the link table is not written', async () => {
		const { service, linkService } = setup();
		await service.inviteToEverWorks(MAPPING as never, { employeeId: 'employee-grace' as never });
		expect(linkService.record).not.toHaveBeenCalled();
	});
});
