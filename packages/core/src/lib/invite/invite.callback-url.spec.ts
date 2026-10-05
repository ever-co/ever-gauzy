/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or handler — the
 * entity graph has to finish initializing before anything applies the custom validators.
 * See invite-accept.security.spec.ts.
 */
import '../core/entities/internal';
import { InvitationTypeEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { InviteService } from './invite.service';

/**
 * `POST /invite/emails` and `POST /invite/resend` build the invitation link on a caller-supplied
 * `callbackUrl`. The callback is honoured only on an origin the deployment serves; otherwise the
 * invitation gets the default accept link.
 */
describe('InviteService - invitation callbackUrl', () => {
	const TEAMS = 'https://app.ever.team';
	const CLIENT = 'https://app.gauzy.co';
	const savedAllowList = process.env['EMAIL_LINK_ALLOWED_ORIGINS'];

	let emailService: { inviteTeamMember: jest.Mock; inviteUser: jest.Mock; inviteEmployee: jest.Mock };
	let warn: jest.Mock;

	beforeEach(() => {
		process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = TEAMS;
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('inviter-1');
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue('role-manager');
		emailService = { inviteTeamMember: jest.fn(), inviteUser: jest.fn(), inviteEmployee: jest.fn() };
		warn = jest.fn();
	});

	afterEach(() => {
		jest.restoreAllMocks();
		if (savedAllowList === undefined) delete process.env['EMAIL_LINK_ALLOWED_ORIGINS'];
		else process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = savedAllowList;
	});

	function build(): InviteService {
		const service: InviteService = Object.create(InviteService.prototype);
		Object.assign(service, {
			logger: { warn, error: jest.fn(), log: jest.fn() },
			configService: { get: () => CLIENT },
			emailService,
			fetchInvitesRelations: jest.fn(async () => ({
				projects: [],
				departments: [],
				organizationContacts: [],
				organizationTeams: [{ id: 'team-1', name: 'Team' }]
			})),
			userService: {
				findOneByIdString: jest.fn(async () => ({ id: 'inviter-1', role: { name: RolesEnum.MANAGER } }))
			},
			roleService: {
				findOneByIdString: jest.fn(async (id: string, options?: any) => {
					if (options?.where?.name) throw new Error('EntityNotFound'); // the caller is not an EMPLOYEE
					return { id, name: RolesEnum.EMPLOYEE };
				})
			},
			organizationService: { findOneByIdString: jest.fn(async () => ({ id: 'org-1', inviteExpiryPeriod: 7 })) },
			findAll: jest.fn(async () => ({ items: [], total: 0 })),
			typeOrmOrganizationTeamEmployeeRepository: { findBy: jest.fn(async () => []) },
			saveMany: jest.fn(async (invites: any[]) => invites),
			findOneByIdString: jest.fn(async () => ({
				id: 'invite-1',
				email: 'new@ever.co',
				organization: { id: 'org-1', tenantId: 'tenant-1' },
				role: { name: RolesEnum.EMPLOYEE },
				teams: [{ id: 'team-1', name: 'Team' }]
			}))
		});
		return service;
	}

	async function createBulk(body: Record<string, unknown>) {
		await build().createBulk(
			{
				emailIds: ['new@ever.co'],
				teamIds: ['team-1'],
				organizationId: 'org-1',
				tenantId: 'tenant-1',
				roleId: 'role-employee',
				...body
			} as any,
			'en' as any
		);
	}

	describe('createBulk', () => {
		it('keeps a callback on an origin the deployment serves', async () => {
			await createBulk({ inviteType: InvitationTypeEnum.TEAM, callbackUrl: `${TEAMS}/auth/accept-invite` });

			const [{ inviteLink, inviteCode }] = emailService.inviteTeamMember.mock.calls[0];
			expect(inviteLink).toBe(`${TEAMS}/auth/accept-invite?email=new%40ever.co&code=${inviteCode}`);
			expect(warn).not.toHaveBeenCalled();
		});

		it.each([
			['foreign origin', 'https://attacker.example/accept'],
			['javascript: URL', 'javascript:alert(1)'],
			['protocol-relative URL', '//attacker.example/accept'],
			['look-alike subdomain', 'https://app.ever.team.attacker.example/accept']
		])('uses the default accept link for a team invitation with a %s', async (_label, callbackUrl) => {
			await createBulk({ inviteType: InvitationTypeEnum.TEAM, callbackUrl });

			const [{ inviteLink }] = emailService.inviteTeamMember.mock.calls[0];
			expect(inviteLink.startsWith(`${CLIENT}/#/auth/accept-invite?email=new%40ever.co&token=`)).toBe(true);
			expect(inviteLink).not.toContain('attacker.example');
			expect(warn).toHaveBeenCalledTimes(1);
		});

		it('ignores queryParams together with a callback on a foreign origin', async () => {
			await createBulk({
				inviteType: InvitationTypeEnum.USER,
				callbackUrl: 'https://attacker.example/accept',
				queryParams: { t: 'token', c: 'code' }
			});

			const [{ registerUrl }] = emailService.inviteUser.mock.calls[0];
			expect(registerUrl.startsWith(`${CLIENT}/#/auth/accept-invite?`)).toBe(true);
			expect(registerUrl).not.toContain('attacker.example');
		});
	});

	describe('resendEmail', () => {
		beforeEach(() => {
			// `super.update` at the end of resendEmail.
			jest.spyOn(TenantAwareCrudService.prototype as any, 'update').mockResolvedValue({} as never);
		});

		it('keeps a callback on an origin the deployment serves', async () => {
			await build().resendEmail(
				{
					inviteId: 'invite-1',
					inviteType: InvitationTypeEnum.TEAM,
					callbackUrl: `${TEAMS}/auth/accept-invite`
				} as any,
				'en' as any
			);

			const [{ inviteLink, inviteCode }] = emailService.inviteTeamMember.mock.calls[0];
			expect(inviteLink).toBe(`${TEAMS}/auth/accept-invite?email=new%40ever.co&code=${inviteCode}`);
		});

		it('uses the default accept link for a callback on a foreign origin', async () => {
			await build().resendEmail(
				{
					inviteId: 'invite-1',
					inviteType: InvitationTypeEnum.TEAM,
					callbackUrl: 'https://attacker.example/x'
				} as any,
				'en' as any
			);

			const [{ inviteLink }] = emailService.inviteTeamMember.mock.calls[0];
			expect(inviteLink.startsWith(`${CLIENT}/#/auth/accept-invite?email=new%40ever.co&token=`)).toBe(true);
			expect(inviteLink).not.toContain('attacker.example');
			expect(warn).toHaveBeenCalledTimes(1);
		});
	});
});
