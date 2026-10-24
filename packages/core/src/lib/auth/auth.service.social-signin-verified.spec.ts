/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller (see
 * `user.email-lookup.spec.ts` for the cycle it avoids).
 */
import '../core/entities/internal';
import { UnauthorizedException } from '@nestjs/common';
import { ProviderEnum } from '@gauzy/contracts';
import { Column, DataSource, Entity, PrimaryColumn, Repository } from 'typeorm';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import {
	SOCIAL_SIGNIN_UNCONFIRMED_ACCOUNT_MESSAGE,
	SOCIAL_SIGNIN_VERIFIED_ACCOUNT_ENV,
	socialSigninRequiresVerifiedAccount
} from './social-signin-verified-account';

/**
 * Owner decision 5: a provider sign-in matches only when the provider reports the email verified AND the Gauzy
 * account has confirmed that address itself; when the address owns several workspaces, the person picks one in
 * the workspace picker the password sign-in shows. Built on ever-co/ever-gauzy#11291, which only skipped an
 * unconfirmed account that had no tenant: an unconfirmed account INSIDE a tenant (an admin of another tenant set
 * the address, or a squatter onboarded a workspace before the owner arrived) still matched, and the first match
 * won silently.
 */

const EMAIL = 'pat@corp.example';
const TENANT_A = '4e000000-0000-4000-8000-00000000000a';
const TENANT_B = '4e000000-0000-4000-8000-00000000000b';
const CONFIRMED = new Date('2026-01-01T00:00:00.000Z');

@Entity('social_signin_verified_user')
class FixtureUser {
	@PrimaryColumn('varchar')
	id: string;

	@Column('varchar')
	email: string;

	@Column('varchar', { nullable: true })
	tenantId?: string | null;

	@Column('boolean', { default: true })
	isActive?: boolean;

	@Column('boolean', { default: false })
	isArchived?: boolean;

	@Column({ type: 'datetime', nullable: true })
	emailVerifiedAt?: Date | null;

	@Column({ type: 'varchar', nullable: true })
	code?: string | null;

	@Column({ type: 'datetime', nullable: true })
	codeExpireAt?: Date | null;
}

/** Registered on /auth/register, never confirmed, no workspace. */
const SQUATTER = { id: 'squatter', email: EMAIL, tenantId: null, emailVerifiedAt: null };
/** In a tenant, but never confirmed the address (set by that tenant's admin, or onboarded by a squatter). */
const UNCONFIRMED_MEMBER = { id: 'unconfirmed-member', email: EMAIL, tenantId: TENANT_A, emailVerifiedAt: null };
/** Pat's own workspaces. */
const PAT_A = { id: 'pat-a', email: EMAIL, tenantId: TENANT_A, emailVerifiedAt: CONFIRMED };
const PAT_B = { id: 'pat-b', email: EMAIL, tenantId: TENANT_B, emailVerifiedAt: CONFIRMED };
/** Confirmed, but deactivated. */
const PAT_GONE = { id: 'pat-gone', email: EMAIL, tenantId: TENANT_B, emailVerifiedAt: CONFIRMED, isActive: false };

let dataSource: DataSource;
let users: Repository<FixtureUser>;

beforeAll(async () => {
	dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [FixtureUser],
		synchronize: true,
		logging: false
	});
	await dataSource.initialize();
	users = dataSource.getRepository(FixtureUser);
});

afterAll(async () => {
	await dataSource?.destroy();
});

const previousSwitch = process.env[SOCIAL_SIGNIN_VERIFIED_ACCOUNT_ENV];

afterEach(() => {
	jest.restoreAllMocks();
	if (previousSwitch === undefined) delete process.env[SOCIAL_SIGNIN_VERIFIED_ACCOUNT_ENV];
	else process.env[SOCIAL_SIGNIN_VERIFIED_ACCOUNT_ENV] = previousSwitch;
});

async function seed(...rows: Array<Partial<FixtureUser>>) {
	await users.clear();
	await users.insert(rows as FixtureUser[]);
}

/** A UserService over the sqlite table. */
function buildUserService() {
	const service: UserService = Object.create(UserService.prototype);
	Object.assign(service, { ormType: 'typeorm', typeOrmRepository: users, typeOrmUserRepository: users });
	return service;
}

/**
 * An AuthService over the sqlite table: the real provider sign-in and e-mail code sign-in, with the access token
 * stubbed. The service passes `relations: { tenant: true }` to the user lookups; the fixture has no relations.
 */
function buildAuthService() {
	const service: AuthService = Object.create(AuthService.prototype);
	const getJwtAccessToken = jest.fn(async (user: { id: string }) => `jwt-for-${user.id}`);
	const attempt = { fail: jest.fn(), succeed: jest.fn(), release: jest.fn() };
	Object.assign(service, {
		ormType: 'typeorm',
		clientBaseUrl: 'https://app.gauzy.example',
		logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() },
		userService: buildUserService(),
		typeOrmUserRepository: {
			find: jest.fn(({ where }) => users.find({ where })),
			update: jest.fn((where, values) => users.update(where, values))
		},
		employeeService: { findEmployeeIdByUserId: jest.fn(async () => null) },
		loginAttemptService: { begin: jest.fn(async () => attempt) },
		getJwtAccessToken
	});
	return { service, getJwtAccessToken };
}

describe('socialSigninRequiresVerifiedAccount', () => {
	it.each([
		[undefined, true],
		['true', true],
		['false', false],
		[' False ', false]
	])('%p reads as %p', (value, expected) => {
		if (value === undefined) delete process.env[SOCIAL_SIGNIN_VERIFIED_ACCOUNT_ENV];
		else process.env[SOCIAL_SIGNIN_VERIFIED_ACCOUNT_ENV] = value;
		expect(socialSigninRequiresVerifiedAccount()).toBe(expected);
	});
});

describe('UserService.findOAuthLoginUsers', () => {
	it('returns only the active accounts that confirmed the address — CONTROL: #11291 resolved the unconfirmed member', async () => {
		const service = buildUserService();

		// CONTROL: with no confirmed account first in line, the earlier lookup picked an unconfirmed one.
		await seed(SQUATTER, UNCONFIRMED_MEMBER);
		await expect(service.findOAuthLoginUser(EMAIL)).resolves.toMatchObject({ id: UNCONFIRMED_MEMBER.id });
		await expect(service.findOAuthLoginUsers(EMAIL)).resolves.toEqual([]);

		await seed(SQUATTER, UNCONFIRMED_MEMBER, PAT_A, PAT_B, PAT_GONE);
		const found = await service.findOAuthLoginUsers(EMAIL);
		expect(found.map((user) => user.id).sort()).toEqual([PAT_A.id, PAT_B.id]);
	});

	it('with SOCIAL_SIGNIN_REQUIRE_VERIFIED_ACCOUNT=false, also an unconfirmed account in a tenant, never the squatter', async () => {
		await seed(SQUATTER, UNCONFIRMED_MEMBER);

		const found = await buildUserService().findOAuthLoginUsers(EMAIL, { requireVerifiedAccount: false });

		expect(found.map((user) => user.id)).toEqual([UNCONFIRMED_MEMBER.id]);
	});

	it('answers nothing for an empty email rather than matching every account', async () => {
		await seed(PAT_A);

		await expect(buildUserService().findOAuthLoginUsers('')).resolves.toEqual([]);
		await expect(buildUserService().findOAuthLoginUsers(undefined as any)).resolves.toEqual([]);
	});
});

describe('AuthService.validateOAuthLoginEmail (Google, GitHub, Microsoft, Twitter, Keycloak redirect sign-ins)', () => {
	it('ignores an email the provider did not verify', async () => {
		await seed(PAT_A);
		const { service, getJwtAccessToken } = buildAuthService();

		await expect(service.validateOAuthLoginEmail([{ value: EMAIL, verified: false }])).resolves.toEqual({
			success: false,
			authData: { jwt: null, userId: null }
		});
		expect(getJwtAccessToken).not.toHaveBeenCalled();
	});

	it('signs in the one account that confirmed the address', async () => {
		await seed(SQUATTER, UNCONFIRMED_MEMBER, PAT_A);
		const { service } = buildAuthService();

		await expect(service.validateOAuthLoginEmail([{ value: EMAIL, verified: true }])).resolves.toEqual({
			success: true,
			authData: { jwt: `jwt-for-${PAT_A.id}`, userId: PAT_A.id }
		});
	});

	it('matches no unconfirmed account, in a tenant or not (the register page follows)', async () => {
		await seed(SQUATTER, UNCONFIRMED_MEMBER);
		const { service, getJwtAccessToken } = buildAuthService();

		await expect(service.validateOAuthLoginEmail([{ value: EMAIL, verified: true }])).resolves.toEqual({
			success: false,
			authData: { jwt: null, userId: null }
		});
		expect(getJwtAccessToken).not.toHaveBeenCalled();
	});

	it('offers the workspace picker for several confirmed accounts instead of choosing one', async () => {
		await seed(UNCONFIRMED_MEMBER, PAT_A, PAT_B);
		const { service, getJwtAccessToken } = buildAuthService();

		const { success, authData } = await service.validateOAuthLoginEmail([{ value: EMAIL, verified: true }]);

		expect(success).toBe(true);
		expect(authData.jwt).toBeNull();
		expect(getJwtAccessToken).not.toHaveBeenCalled();
		expect(authData.workspaces).toEqual({ email: EMAIL, code: expect.any(String) });

		// The code is stored on the confirmed accounts only, with an expiry.
		const { code } = authData.workspaces;
		expect((await users.findOneByOrFail({ id: PAT_A.id })).code).toBe(code);
		expect((await users.findOneByOrFail({ id: PAT_B.id })).code).toBe(code);
		expect((await users.findOneByOrFail({ id: PAT_A.id })).codeExpireAt.getTime()).toBeGreaterThan(Date.now());
		expect((await users.findOneByOrFail({ id: UNCONFIRMED_MEMBER.id })).code).toBeNull();

		// The picker page exchanges it exactly as after a password or e-mail code sign-in: both confirmed
		// workspaces, nothing else, and the code is used up.
		const picker = await service.signinWorkspacesByMagicCode({ email: EMAIL, code }, false);
		expect(picker).toMatchObject({ confirmed_email: EMAIL, show_popup: true, total_workspaces: 2 });
		expect(picker.workspaces.map((workspace) => workspace.user.id).sort()).toEqual([PAT_A.id, PAT_B.id]);
		await expect(service.signinWorkspacesByMagicCode({ email: EMAIL, code }, false)).rejects.toBeInstanceOf(
			UnauthorizedException
		);
	});

	it('answers 401, not a server error, when the one account is refused a token', async () => {
		await seed(PAT_A);
		const { service, getJwtAccessToken } = buildAuthService();
		getJwtAccessToken.mockRejectedValueOnce(new UnauthorizedException());

		await expect(service.validateOAuthLoginEmail([{ value: EMAIL, verified: true }])).rejects.toBeInstanceOf(
			UnauthorizedException
		);
	});

	it('with SOCIAL_SIGNIN_REQUIRE_VERIFIED_ACCOUNT=false, signs in the unconfirmed account in a tenant', async () => {
		process.env[SOCIAL_SIGNIN_VERIFIED_ACCOUNT_ENV] = 'false';
		await seed(SQUATTER, UNCONFIRMED_MEMBER);
		const { service } = buildAuthService();

		await expect(service.validateOAuthLoginEmail([{ value: EMAIL, verified: true }])).resolves.toEqual({
			success: true,
			authData: { jwt: `jwt-for-${UNCONFIRMED_MEMBER.id}`, userId: UNCONFIRMED_MEMBER.id }
		});
	});
});

describe('SocialAuthService.routeRedirect', () => {
	const redirectOf = async (success: boolean, authData: any) => {
		const { service } = buildAuthService();
		const res = { redirect: jest.fn() };
		await service.routeRedirect(success, authData, res);
		return res.redirect.mock.calls[0][0];
	};

	it('takes several workspaces to the workspace picker', async () => {
		await expect(
			redirectOf(true, {
				jwt: null,
				userId: null,
				workspaces: { email: 'pat+work@corp.example', code: 'AB12CD' }
			})
		).resolves.toBe('https://app.gauzy.example/#/auth/magic-sign-in?email=pat%2Bwork%40corp.example&code=AB12CD');
	});

	it('still signs one account in directly (control)', async () => {
		await expect(redirectOf(true, { jwt: 'jwt', userId: 'pat-a' })).resolves.toBe(
			'https://app.gauzy.example/#/sign-in/success?jwt=jwt&userId=pat-a'
		);
	});

	it('still sends no match to the register page (control)', async () => {
		await expect(redirectOf(false, { jwt: null, userId: null })).resolves.toBe(
			'https://app.gauzy.example/#/auth/register'
		);
	});
});

describe('AuthService.signinWorkspacesByEmailSocial (POST /auth/signin.email.social, Ever Teams)', () => {
	function buildSocial() {
		const { service } = buildAuthService();
		const socialAccountService = {
			findAccountByProvider: jest.fn(async () => null),
			linkSocialAccountToUser: jest.fn(async ({ user }) => ({ id: `link-${user.id}`, userId: user.id }))
		};
		Object.assign(service, {
			userService: { find: jest.fn(({ where }) => users.find({ where })) },
			socialAccountService,
			verifyOAuthToken: jest.fn(async () => ({
				provider: ProviderEnum.GOOGLE,
				id: 'google-42',
				email: EMAIL,
				rawEmail: EMAIL
			}))
		});
		return { service, socialAccountService };
	}

	it('lists and links only the accounts that confirmed the address', async () => {
		await seed(SQUATTER, UNCONFIRMED_MEMBER, PAT_A, PAT_B);
		const { service, socialAccountService } = buildSocial();

		const response = await service.signinWorkspacesByEmailSocial(
			{ provider: ProviderEnum.GOOGLE, token: 't' },
			false
		);

		expect(response.total_workspaces).toBe(2);
		expect(response.show_popup).toBe(true);
		expect(response.workspaces.map((workspace) => workspace.user.id).sort()).toEqual([PAT_A.id, PAT_B.id]);
		const linked = socialAccountService.linkSocialAccountToUser.mock.calls.map(([{ user }]) => user.id).sort();
		expect(linked).toEqual([PAT_A.id, PAT_B.id]);
	});

	it('refuses, linking nothing, when no account confirmed the address — CONTROL: it signed them in before', async () => {
		await seed(SQUATTER, UNCONFIRMED_MEMBER);
		const { service, socialAccountService } = buildSocial();

		await expect(
			service.signinWorkspacesByEmailSocial({ provider: ProviderEnum.GOOGLE, token: 't' }, false)
		).rejects.toThrow(SOCIAL_SIGNIN_UNCONFIRMED_ACCOUNT_MESSAGE);
		expect(socialAccountService.linkSocialAccountToUser).not.toHaveBeenCalled();

		// CONTROL: the earlier candidates (every active account) were both unconfirmed rows.
		process.env[SOCIAL_SIGNIN_VERIFIED_ACCOUNT_ENV] = 'false';
		const response = await service.signinWorkspacesByEmailSocial(
			{ provider: ProviderEnum.GOOGLE, token: 't' },
			false
		);
		expect(response.total_workspaces).toBe(2);
	});
});
