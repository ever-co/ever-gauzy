import '../core/entities/internal';

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { environment, TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { ProviderEnum } from '@gauzy/contracts';
import { sign, verify } from 'jsonwebtoken';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { SocialAccountService } from './social-account/social-account.service';
import { signPurposeToken, TokenPurposeEnum } from './purpose-token';

/**
 * POST /auth/signin.workspace and the social sign-in / link routes.
 *
 * GHSA-28wv-vrxj-rp4q: `workspaceSigninVerifyToken` accepted ANY JWT_SECRET-signed token and looked
 * the user up by `{ id: payload.userId, email: <body email>, tenantId: payload.tenantId }`. A token
 * with no `userId` / `tenantId` (appointment, invite, estimate, password reset) lost those
 * predicates to the ORM's `undefined: 'ignore'`, so the attacker-chosen body email alone picked the
 * account that received access and refresh tokens.
 *
 * GHSA-58x4-7mw9-gmqg: social sign-in trusted whatever the provider verifier returned; a missing
 * email matched every user and links were saved without a tenant.
 *
 * Lookups run against a real better-sqlite3 database with the shipped where-value behavior, and
 * every rejection is paired with a CONTROL running the pre-fix call shape against the same rows.
 */

const UserSchema = new EntitySchema({
	name: 'TokenPurposeSpecUser',
	tableName: 'token_purpose_spec_user',
	columns: {
		id: { primary: true, type: 'varchar' },
		email: { type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		isActive: { type: 'boolean' },
		isArchived: { type: 'boolean' }
	}
});

const SocialAccountSchema = new EntitySchema({
	name: 'TokenPurposeSpecSocialAccount',
	tableName: 'token_purpose_spec_social_account',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		provider: { type: 'varchar' },
		providerAccountId: { type: 'varchar' },
		userId: { type: 'varchar', nullable: true },
		tenantId: { type: 'varchar', nullable: true },
		isActive: { type: 'boolean', default: true },
		isArchived: { type: 'boolean', default: false }
	}
});

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

const ATTACKER = { id: 'attacker', email: 'attacker@evil.co', tenantId: TENANT_A, isActive: true, isArchived: false };
const VICTIM = { id: 'victim', email: 'victim@ever.co', tenantId: TENANT_B, isActive: true, isArchived: false };
const TENANTLESS = { id: 'fresh', email: 'fresh@ever.co', tenantId: null, isActive: true, isArchived: false };
const INACTIVE = { id: 'gone', email: 'gone@ever.co', tenantId: TENANT_A, isActive: false, isArchived: false };

let dataSource: DataSource;
let users: Repository<any>;
let socialAccounts: Repository<any>;

beforeAll(async () => {
	dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [UserSchema, SocialAccountSchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();
	users = dataSource.getRepository('TokenPurposeSpecUser');
	socialAccounts = dataSource.getRepository('TokenPurposeSpecSocialAccount');
	await users.save([ATTACKER, VICTIM, TENANTLESS, INACTIVE]);
});

afterAll(async () => {
	await dataSource?.destroy();
});

/** An AuthService wired to the sqlite user table; only what these paths touch. */
function buildAuthService() {
	const service: AuthService = Object.create(AuthService.prototype);
	const getJwtAccessToken = jest.fn(async (user: any) => `access-for-${user.id}`);
	const getJwtRefreshToken = jest.fn(async (user: any) => `refresh-for-${user.id}`);
	Object.assign(service, {
		ormType: 'typeorm',
		logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() },
		// The service passes `relations: { role: true }`; the spec table has no relations.
		typeOrmUserRepository: {
			findOneOrFail: jest.fn(({ where }) => users.findOneOrFail({ where })),
			update: jest.fn(async () => undefined)
		},
		employeeService: {
			findOneByUserId: jest.fn(async () => null),
			findEmployeeIdByUserId: jest.fn(async () => null)
		},
		userService: {
			setCurrentRefreshToken: jest.fn(async () => undefined),
			setUserLastLoginTimestamp: jest.fn(async () => undefined),
			setLastOrganizationAndTeam: jest.fn(async () => undefined)
		},
		resolveDefaultOrganizationId: jest.fn(async () => null),
		hasActiveOrganizationMembership: jest.fn(async () => false),
		getJwtAccessToken,
		getJwtRefreshToken
	});
	return { service, getJwtAccessToken };
}

/** The workspace token the sign-in flows hand out for a user. */
const workspaceTokenFor = (service: AuthService, user: any) =>
	(service as any).generateToken({ ...user, tenant: user.tenantId ? { id: user.tenantId } : undefined }, 'ABC123');

/**
 * The PRE-FIX lookup of `workspaceSigninVerifyToken`: any JWT_SECRET token, where built from its
 * claims plus the body email.
 */
async function preFixWorkspaceLookup(token: string, email: string) {
	const payload: any = verify(token, environment.JWT_SECRET);
	return users.findOne({
		where: { id: payload.userId, email, tenantId: payload.tenantId, isActive: true, isArchived: false }
	});
}

describe('AuthService.workspaceSigninVerifyToken (GHSA-28wv-vrxj-rp4q)', () => {
	it('signs in the user a workspace token was issued for', async () => {
		const { service, getJwtAccessToken } = buildAuthService();
		const token = workspaceTokenFor(service, VICTIM);

		const result = await service.workspaceSigninVerifyToken({ email: VICTIM.email, token } as any);

		expect(result.token).toBe('access-for-victim');
		expect(getJwtAccessToken).toHaveBeenCalledTimes(1);
		expect(verify(token, environment.JWT_SECRET)).toMatchObject({ purpose: TokenPurposeEnum.WORKSPACE_SIGNIN });
	});

	it('signs in a tenant-less user (tenantId: null) and compares the email case-insensitively', async () => {
		const { service } = buildAuthService();
		const token = workspaceTokenFor(service, TENANTLESS);

		const result = await service.workspaceSigninVerifyToken({ email: 'Fresh@Ever.CO', token } as any);

		expect(result.token).toBe('access-for-fresh');
	});

	it.each([
		['an appointment token', () => sign({ appointmentId: 'a1' }, environment.JWT_SECRET)],
		['an invite token', () => sign({ email: 'attacker@evil.co', code: 'X1' }, environment.JWT_SECRET)],
		[
			'a typed invite token',
			() => signPurposeToken(TokenPurposeEnum.INVITE, { email: 'attacker@evil.co', code: 'X1' })
		],
		[
			'an estimate token',
			() =>
				sign(
					{ invoiceId: 'inv', organizationId: 'org', tenantId: undefined, email: 'x@y.z' },
					environment.JWT_SECRET
				)
		]
	])('rejects %s used with a victim email — CONTROL: the pre-fix lookup found the victim', async (_label, mint) => {
		const token = mint();

		// CONTROL: no userId / tenantId claim, so the pre-fix where collapsed to the body email.
		await expect(preFixWorkspaceLookup(token, VICTIM.email)).resolves.toMatchObject({ id: 'victim' });

		const { service, getJwtAccessToken } = buildAuthService();
		await expect(service.workspaceSigninVerifyToken({ email: VICTIM.email, token } as any)).rejects.toBeInstanceOf(
			UnauthorizedException
		);
		expect(getJwtAccessToken).not.toHaveBeenCalled();
	});

	it('rejects a password-reset token for a tenant member — CONTROL: pre-fix took over any user of that tenant', async () => {
		const colleague = {
			id: 'colleague',
			email: 'boss@ever.co',
			tenantId: TENANT_A,
			isActive: true,
			isArchived: false
		};
		await users.save(colleague);
		const reset = signPurposeToken(TokenPurposeEnum.PASSWORD_RESET, { id: ATTACKER.id, tenantId: TENANT_A });

		await expect(preFixWorkspaceLookup(reset, colleague.email)).resolves.toMatchObject({ id: 'colleague' });

		const { service, getJwtAccessToken } = buildAuthService();
		await expect(
			service.workspaceSigninVerifyToken({ email: colleague.email, token: reset } as any)
		).rejects.toBeInstanceOf(UnauthorizedException);
		expect(getJwtAccessToken).not.toHaveBeenCalled();
	});

	it('rejects an untyped (legacy) workspace token', async () => {
		const legacy = sign(
			{ userId: VICTIM.id, email: VICTIM.email, tenantId: VICTIM.tenantId, code: 'C' },
			environment.JWT_SECRET
		);
		const { service } = buildAuthService();
		await expect(
			service.workspaceSigninVerifyToken({ email: VICTIM.email, token: legacy } as any)
		).rejects.toBeInstanceOf(UnauthorizedException);
	});

	it("rejects the attacker's own workspace token replayed with the victim's email", async () => {
		const { service, getJwtAccessToken } = buildAuthService();
		const token = workspaceTokenFor(service, ATTACKER);
		await expect(service.workspaceSigninVerifyToken({ email: VICTIM.email, token } as any)).rejects.toBeInstanceOf(
			UnauthorizedException
		);
		expect(getJwtAccessToken).not.toHaveBeenCalled();
	});

	it('rejects a workspace token whose tenantId claim is absent (not null)', async () => {
		const token = signPurposeToken(TokenPurposeEnum.WORKSPACE_SIGNIN, {
			userId: VICTIM.id,
			email: VICTIM.email,
			code: 'C'
		});
		const { service } = buildAuthService();
		await expect(service.workspaceSigninVerifyToken({ email: VICTIM.email, token } as any)).rejects.toBeInstanceOf(
			UnauthorizedException
		);
	});

	it('rejects a workspace token of a deactivated user', async () => {
		const { service } = buildAuthService();
		const token = workspaceTokenFor(service, INACTIVE);
		await expect(
			service.workspaceSigninVerifyToken({ email: INACTIVE.email, token } as any)
		).rejects.toBeInstanceOf(UnauthorizedException);
	});
});

/** A SocialAccountService over the sqlite link table. */
function buildSocialAccountService() {
	const service: SocialAccountService = Object.create(SocialAccountService.prototype);
	Object.assign(service, { typeOrmRepository: socialAccounts, repository: socialAccounts });
	return service;
}

describe('SocialAccountService (GHSA-58x4-7mw9-gmqg)', () => {
	beforeEach(async () => {
		await socialAccounts.clear();
	});

	it('findAccountByProvider ignores an empty providerAccountId — CONTROL: the raw lookup matched a link', async () => {
		await socialAccounts.save({
			provider: ProviderEnum.GITHUB,
			providerAccountId: '42',
			userId: 'victim',
			tenantId: TENANT_B
		});

		// CONTROL: an undefined providerAccountId is dropped from the where.
		await expect(
			socialAccounts.findOne({
				where: {
					provider: ProviderEnum.GITHUB,
					providerAccountId: undefined,
					isActive: true,
					isArchived: false
				}
			})
		).resolves.toMatchObject({ userId: 'victim' });

		const service = buildSocialAccountService();
		await expect(
			service.findAccountByProvider({ provider: ProviderEnum.GITHUB, providerAccountId: undefined })
		).resolves.toBeNull();
		await expect(
			service.findAccountByProvider({ provider: ProviderEnum.GITHUB, providerAccountId: '' })
		).resolves.toBeNull();
	});

	it("links with the USER's tenant on a public route — CONTROL: save() stored no tenant", async () => {
		const service = buildSocialAccountService();

		// CONTROL: the pre-fix path (registerSocialAccount -> TenantAwareCrudService.save) overwrote the
		// tenant with the (absent) request tenant.
		const planted = await service.registerSocialAccount({
			provider: ProviderEnum.GITHUB,
			providerAccountId: 'control',
			userId: VICTIM.id,
			tenantId: VICTIM.tenantId
		} as any);
		expect((await socialAccounts.findOneBy({ id: planted.id })).tenantId).toBeNull();

		const linked = await service.linkSocialAccountToUser({
			provider: ProviderEnum.GITHUB,
			providerAccountId: '42',
			user: VICTIM as any
		});
		expect(await socialAccounts.findOneBy({ id: linked.id })).toMatchObject({
			userId: 'victim',
			tenantId: TENANT_B
		});

		// Idempotent: a second link attempt returns the existing row.
		const again = await service.linkSocialAccountToUser({
			provider: ProviderEnum.GITHUB,
			providerAccountId: '42',
			user: VICTIM as any
		});
		expect(again.id).toBe(linked.id);
		expect(await socialAccounts.countBy({ providerAccountId: '42' })).toBe(1);
	});

	it('refuses to link an empty providerAccountId', async () => {
		const service = buildSocialAccountService();
		await expect(
			service.linkSocialAccountToUser({
				provider: ProviderEnum.GITHUB,
				providerAccountId: '',
				user: VICTIM as any
			})
		).rejects.toBeInstanceOf(BadRequestException);
	});
});

describe('AuthService social sign-in / link (GHSA-58x4-7mw9-gmqg)', () => {
	function buildSocial(identity: any) {
		const { service } = buildAuthService();
		const userService = {
			find: jest.fn(async ({ where }) => users.find({ where })),
			...(service as any).userService
		};
		const socialAccountService = {
			findAccountByProvider: jest.fn(async () => null),
			linkSocialAccountToUser: jest.fn(async ({ user }) => ({ id: `link-${user.id}`, userId: user.id }))
		};
		Object.assign(service, {
			userService,
			socialAccountService,
			verifyOAuthToken: jest.fn(async () => {
				if (identity instanceof Error) throw identity;
				return identity;
			})
		});
		return { service, userService, socialAccountService };
	}

	it.each([
		['no email', { provider: ProviderEnum.FACEBOOK, id: '99' }],
		['no provider id', { provider: ProviderEnum.FACEBOOK, email: 'victim@ever.co' }]
	])('sign-in with an identity carrying %s never queries users or links anything', async (_label, identity) => {
		const { service, userService, socialAccountService } = buildSocial(identity);

		await expect(
			service.signinWorkspacesByEmailSocial({ provider: ProviderEnum.FACEBOOK, token: 't' }, false)
		).rejects.toBeInstanceOf(UnauthorizedException);

		expect(userService.find).not.toHaveBeenCalled();
		expect(socialAccountService.findAccountByProvider).not.toHaveBeenCalled();
		expect(socialAccountService.linkSocialAccountToUser).not.toHaveBeenCalled();
	});

	it('signs in the owner of a verified email and links the provider account to that user only', async () => {
		const { service, socialAccountService } = buildSocial({
			provider: ProviderEnum.GITHUB,
			id: '42',
			email: 'victim@ever.co',
			rawEmail: 'Victim@ever.co'
		});

		const response = await service.signinWorkspacesByEmailSocial(
			{ provider: ProviderEnum.GITHUB, token: 't' },
			false
		);

		expect(response.total_workspaces).toBe(1);
		expect(response.workspaces[0].user.id).toBe('victim');
		expect(verify(response.workspaces[0].token, environment.JWT_SECRET)).toMatchObject({
			purpose: TokenPurposeEnum.WORKSPACE_SIGNIN,
			userId: 'victim'
		});
		expect(socialAccountService.linkSocialAccountToUser).toHaveBeenCalledTimes(1);
		expect(socialAccountService.linkSocialAccountToUser.mock.calls[0][0]).toMatchObject({
			provider: ProviderEnum.GITHUB,
			providerAccountId: '42',
			user: expect.objectContaining({ id: 'victim', tenantId: TENANT_B })
		});
	});

	it('link: a rejected provider token is a 401 and links nothing', async () => {
		const { service, userService, socialAccountService } = buildSocial(new UnauthorizedException());

		await expect(
			service.linkUserToSocialAccount({ provider: ProviderEnum.GITHUB, token: 'ghp_pat' })
		).rejects.toBeInstanceOf(UnauthorizedException);
		expect(userService.find).not.toHaveBeenCalled();
		expect(socialAccountService.linkSocialAccountToUser).not.toHaveBeenCalled();
	});

	it('link: an identity without email links nothing — CONTROL: pre-fix getUserByEmail(undefined) returned a user', async () => {
		// CONTROL: the pre-fix link used `findOneBy({ email })`; undefined drops the predicate.
		await expect(users.findOneBy({ email: undefined })).resolves.toBeTruthy();

		const { service, userService, socialAccountService } = buildSocial({
			provider: ProviderEnum.FACEBOOK,
			id: '99'
		});
		await expect(
			service.linkUserToSocialAccount({ provider: ProviderEnum.FACEBOOK, token: 't' })
		).rejects.toBeInstanceOf(UnauthorizedException);
		expect(userService.find).not.toHaveBeenCalled();
		expect(socialAccountService.linkSocialAccountToUser).not.toHaveBeenCalled();
	});

	it('link: a verified identity links the owner of that email', async () => {
		const { service, socialAccountService } = buildSocial({
			provider: ProviderEnum.GOOGLE,
			id: 'g-1',
			email: 'victim@ever.co',
			rawEmail: 'victim@ever.co'
		});
		await expect(
			service.linkUserToSocialAccount({ provider: ProviderEnum.GOOGLE, token: 't' })
		).resolves.toMatchObject({
			userId: 'victim'
		});
		expect(socialAccountService.linkSocialAccountToUser).toHaveBeenCalledTimes(1);
	});
});
