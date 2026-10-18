/**
 * "Invite to Gauzy" on the People tab (G-P1-6, plan 01 §3 "No match"): an Ever Works member with no Gauzy person gets
 * a Gauzy employee invitation through the platform's own invite flow (its e-mail, role rules and accept path), with
 * the role the admin chose. Nothing is accepted or linked by it; an invitation already pending is answered again.
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
		InviteBulkCreateCommand: class {
			constructor(
				public readonly input: unknown,
				public readonly languageCode: unknown
			) {}
		},
		RequestContext: {
			currentTenantId: () => null,
			currentUserId: () => null,
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
import { InvitationTypeEnum, InviteStatusEnum, PermissionsEnum } from '@gauzy/contracts';
import { Employee, Invite, InviteBulkCreateCommand, RequestContext, Role } from '@gauzy/core';
import { EverWorksInboundEvent, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EverWorksMember, EverWorksPeopleService } from './ever-works-people.service';

const granted = (RequestContext as unknown as { __granted: Set<string> }).__granted;
const context = { tenantId: 't1', organizationId: 'o1', integrationTenantId: 'm1', connection: { id: 'c1' }, everWorksOrganizationSlug: 'acme' };
const ROLE = '7f1c2a8e-5b0d-4c3e-9a41-2d6f8b9e0c11';
const ADMIN_ROLE = '0c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

function member(overrides: Partial<EverWorksMember> = {}): EverWorksMember {
	return {
		organizationId: 'ewo1',
		userId: 'U-ada',
		username: 'ada',
		displayName: 'Ada Lovelace',
		email: 'Ada@Example.test',
		emailVerified: true,
		avatarUrl: null,
		role: 'member',
		isActive: true,
		joinedAt: '2026-10-01T00:00:00.000Z',
		updatedAt: '2026-10-01T00:00:00.000Z',
		everIdSubjects: [],
		...overrides
	};
}

function setup(
	options: {
		members?: EverWorksMember[];
		links?: Array<{ ewId: string; gauzyId: string }>;
		employees?: Array<{ id: string; email: string; kind?: string }>;
		invites?: Array<{ id: string; email: string; status: InviteStatusEnum; expireDate: Date | null; roleId?: string }>;
		noEmployeeRole?: boolean;
	} = {}
) {
	const links = options.links ?? [];
	const invites = [...(options.invites ?? [])];
	const inviteQuery = () => {
		const chain = {
			select: () => chain,
			where: () => chain,
			andWhere: () => chain,
			orderBy: () => chain,
			getMany: async () => [...invites]
		};
		return chain;
	};
	const employees = (options.employees ?? []).map((e) => ({ id: e.id, kind: e.kind ?? 'human', user: { firstName: 'G', lastName: e.id, email: e.email } }));
	const repositories = new Map<unknown, unknown>([
		[Employee, { find: jest.fn(async () => employees) }],
		[Invite, { createQueryBuilder: jest.fn(inviteQuery) }],
		[Role, { findOne: jest.fn(async () => (options.noEmployeeRole ? null : { id: ROLE })) }],
		[EverWorksInboundEvent, { find: jest.fn(async () => []) }]
	]);
	const dataSource = { getRepository: (target: unknown) => repositories.get(target), transaction: jest.fn() };
	const contexts = { forRequest: jest.fn(async () => context) };
	const connections = { client: () => ({ request: jest.fn(async () => ({ data: options.members ?? [member()], hasMore: false, nextCursor: null })) }) };
	const linkService = {
		list: jest.fn(async () => links),
		byEw: jest.fn(async (_m: string, _t: string, ewId: string) => links.find((l) => l.ewId === ewId) ?? null),
		byGauzy: jest.fn(async (_m: string, _t: string, gauzyId: string) => links.find((l) => l.gauzyId === gauzyId) ?? null),
		record: jest.fn(),
		remove: jest.fn()
	};
	const commandBus = {
		execute: jest.fn(async (command: { input: { emailIds: string[]; roleId: string } }) => {
			// Yield first, like the real command's own database work, so overlapping calls really overlap.
			await new Promise((resolve) => setTimeout(resolve, 5));
			const created = {
				id: invites.length ? `invite-${invites.length + 1}` : 'invite-new',
				email: command.input.emailIds[0],
				expireDate: new Date('2026-10-25T00:00:00.000Z'),
				status: InviteStatusEnum.INVITED,
				roleId: command.input.roleId
			};
			invites.push(created);
			return { items: [created], total: 1, ignored: 0 };
		})
	};
	const service = new EverWorksPeopleService(dataSource as never, contexts as never, connections as never, linkService as never, commandBus as never);
	return { service, commandBus, linkService };
}

describe('EverWorksPeopleService — invite to Gauzy', () => {
	beforeEach(() => {
		granted.clear();
		granted.add(PermissionsEnum.ORG_INVITE_EDIT);
	});

	it('invites an Ever Works member with no Gauzy person through the platform invite flow, with the chosen role', async () => {
		const { service, commandBus } = setup();
		const result = await service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada', roleId: ROLE as never }, 'o1' as never);

		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		const command = commandBus.execute.mock.calls[0][0] as unknown as InviteBulkCreateCommand;
		expect(command).toBeInstanceOf(InviteBulkCreateCommand);
		expect(command.input).toEqual(
			expect.objectContaining({
				emailIds: ['Ada@Example.test'],
				tenantId: 't1',
				organizationId: 'o1',
				roleId: ROLE,
				inviteType: InvitationTypeEnum.EMPLOYEE,
				fullName: 'Ada Lovelace'
			})
		);
		expect(command.languageCode).toBe('en');
		expect(result).toEqual({ status: 'invited', inviteId: 'invite-new', email: 'Ada@Example.test', roleId: ROLE, expireDate: new Date('2026-10-25T00:00:00.000Z') });
	});

	it("invites with the tenant's Employee role when the admin names none", async () => {
		const { service, commandBus } = setup();
		const result = await service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada' });
		expect((commandBus.execute.mock.calls[0][0] as unknown as InviteBulkCreateCommand).input.roleId).toBe(ROLE);
		expect(result.roleId).toBe(ROLE);
	});

	it('refuses a role other than Employee (400): accepting it would create no employee to pair', async () => {
		const { service, commandBus } = setup();
		await expect(service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada', roleId: ADMIN_ROLE as never })).rejects.toBeInstanceOf(BadRequestException);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('refuses when the tenant has no Employee role (400)', async () => {
		const { service, commandBus } = setup({ noEmployeeRole: true });
		await expect(service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada' })).rejects.toBeInstanceOf(BadRequestException);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('sends one invitation when two requests for the same member overlap', async () => {
		const { service, commandBus } = setup();
		const [first, second] = await Promise.all([
			service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada', roleId: ROLE as never }),
			service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada', roleId: ROLE as never })
		]);
		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		expect([first.status, second.status].sort()).toEqual(['invited', 'pending']);
	});

	it('refuses (409) when an invitation for another role is still pending for that e-mail', async () => {
		const expireDate = new Date(Date.now() + 86_400_000);
		const { service, commandBus } = setup({
			invites: [{ id: 'invite-admin', email: 'ada@example.test', status: InviteStatusEnum.INVITED, expireDate, roleId: ADMIN_ROLE }]
		});
		await expect(service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada' })).rejects.toBeInstanceOf(ConflictException);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('names the invitee by username when the member has no display name', async () => {
		const { service, commandBus } = setup({ members: [member({ displayName: null })] });
		await service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada', roleId: ROLE as never });
		expect((commandBus.execute.mock.calls[0][0] as unknown as InviteBulkCreateCommand).input.fullName).toBe('ada');
	});

	it('refuses an admin without the invite permission (403) and invites nobody', async () => {
		granted.clear();
		const { service, commandBus } = setup();
		await expect(service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada', roleId: ROLE as never })).rejects.toBeInstanceOf(ForbiddenException);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('refuses an id that is not a member of the mapped Ever Works organization (400)', async () => {
		const { service, commandBus } = setup();
		await expect(service.inviteToGauzy('m1' as never, { ewUserId: 'U-nobody', roleId: ROLE as never })).rejects.toBeInstanceOf(BadRequestException);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('refuses a member already paired with a Gauzy person (409)', async () => {
		const { service, commandBus } = setup({ links: [{ ewId: 'U-ada', gauzyId: 'E-1' }] });
		await expect(service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada', roleId: ROLE as never })).rejects.toBeInstanceOf(ConflictException);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('refuses a member with no e-mail, or an e-mail Ever Works has not verified (400)', async () => {
		for (const overrides of [{ email: null }, { emailVerified: false }] as Array<Partial<EverWorksMember>>) {
			const { service, commandBus } = setup({ members: [member(overrides)] });
			await expect(service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada', roleId: ROLE as never })).rejects.toBeInstanceOf(BadRequestException);
			expect(commandBus.execute).not.toHaveBeenCalled();
		}
	});

	it('refuses a member Ever Works has deactivated (400)', async () => {
		const { service, commandBus } = setup({ members: [member({ isActive: false })] });
		await expect(service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada', roleId: ROLE as never })).rejects.toBeInstanceOf(BadRequestException);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('refuses when a person of the organization already has that e-mail, whatever its case (409: pair them instead)', async () => {
		const { service, commandBus } = setup({ employees: [{ id: 'E-ada', email: 'ada@example.TEST' }] });
		await expect(service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada', roleId: ROLE as never })).rejects.toBeInstanceOf(ConflictException);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('answers an invitation still pending for that e-mail again instead of sending another', async () => {
		const expireDate = new Date(Date.now() + 3 * 86_400_000);
		const { service, commandBus } = setup({ invites: [{ id: 'invite-old', email: 'ada@example.test', status: InviteStatusEnum.INVITED, expireDate }] });
		const result = await service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada', roleId: ROLE as never });
		expect(commandBus.execute).not.toHaveBeenCalled();
		expect(result).toEqual({ status: 'pending', inviteId: 'invite-old', email: 'ada@example.test', roleId: ROLE, expireDate });
	});

	it('sends a new invitation when the earlier one expired', async () => {
		const { service, commandBus } = setup({
			invites: [{ id: 'invite-old', email: 'ada@example.test', status: InviteStatusEnum.INVITED, expireDate: new Date(Date.now() - 86_400_000) }]
		});
		const result = await service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada', roleId: ROLE as never });
		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		expect(result.status).toBe('invited');
	});

	it('shows the pending Gauzy invitation of an unpaired member on the People tab', async () => {
		const expireDate = new Date(Date.now() + 86_400_000);
		const { service } = setup({
			members: [member(), member({ userId: 'U-bob', username: 'bob', email: 'bob@example.test' })],
			invites: [
				{ id: 'invite-ada', email: 'ADA@example.test', status: InviteStatusEnum.INVITED, expireDate },
				{ id: 'invite-gone', email: 'bob@example.test', status: InviteStatusEnum.INVITED, expireDate: new Date(Date.now() - 1000) }
			]
		});
		const view = await service.people('m1' as never, 'o1' as never);
		const byUser = new Map(view.members.map((row) => [row.ewUserId, row]));
		expect(byUser.get('U-ada')?.gauzyInvite).toEqual({ inviteId: 'invite-ada', expireDate });
		expect(byUser.get('U-bob')?.gauzyInvite).toBeNull();
	});

	it('leaves the link table alone: an invitation pairs nobody', async () => {
		const { service, linkService } = setup();
		await service.inviteToGauzy('m1' as never, { ewUserId: 'U-ada', roleId: ROLE as never });
		expect(linkService.record).not.toHaveBeenCalled();
		expect(linkService.byEw).toHaveBeenCalledWith('m1', EverWorksLinkType.MEMBER, 'U-ada');
	});
});
