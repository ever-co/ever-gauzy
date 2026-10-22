/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller (see
 * `user.email-lookup.spec.ts` for the cycle it avoids).
 */
import '../core/entities/internal';
import { MultiORMEnum } from '../core/utils';
import { AuthService } from '../auth/auth.service';
import { UserService } from './user.service';

/**
 * A sign-in through an identity provider never resolves to an unproven self-registration.
 *
 * `POST /auth/register` is public and takes any email without proof of owning it, so anyone could register the
 * address of someone who had not signed up yet, with a password of their own. The provider sign-in (Google,
 * GitHub, Keycloak…) then matched the first row carrying the email: the real owner, on their first sign-in, got a
 * session for the squatter's row, onboarded a workspace into it, and the squatter signed in to that workspace with
 * their password.
 */
const EMAIL = 'newhire@corp.example';
const TENANT = '11111111-1111-4111-8111-111111111111';

const squatter = { id: 'squatter', email: EMAIL, tenantId: null, emailVerifiedAt: null };
const unverifiedMember = { id: 'member', email: EMAIL, tenantId: TENANT, emailVerifiedAt: null };
const verifiedMember = { id: 'verified', email: EMAIL, tenantId: TENANT, emailVerifiedAt: new Date('2026-01-01') };
const verifiedSignup = { id: 'verified-signup', email: EMAIL, tenantId: null, emailVerifiedAt: new Date('2026-01-01') };

const buildService = (rows: Array<Record<string, unknown>>) => {
	const repository = {
		find: jest.fn(async ({ where }: any) => rows.filter((row) => row['email'] === where.email))
	};
	const service = new UserService(repository as any, {} as any, {} as any, {} as any, {} as any);
	Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
	return service;
};

describe('UserService.findOAuthLoginUser — never an unproven self-registration', () => {
	it('does not resolve to a row with no tenant and no verified email', async () => {
		await expect(buildService([squatter]).findOAuthLoginUser(EMAIL)).resolves.toBeNull();
	});

	it('resolves to the proven account even when the squatter’s row comes first', async () => {
		await expect(buildService([squatter, unverifiedMember]).findOAuthLoginUser(EMAIL)).resolves.toMatchObject({
			id: 'member'
		});
	});

	it('prefers a verified account to an unverified one', async () => {
		await expect(
			buildService([squatter, unverifiedMember, verifiedMember]).findOAuthLoginUser(EMAIL)
		).resolves.toMatchObject({ id: 'verified' });
	});

	it('still resolves a verified sign-up that has not created a workspace yet (control)', async () => {
		await expect(buildService([verifiedSignup]).findOAuthLoginUser(EMAIL)).resolves.toMatchObject({
			id: 'verified-signup'
		});
	});
});

describe('AuthService.validateOAuthLoginEmail — signs in only a proven account', () => {
	const buildAuth = (rows: Array<Record<string, unknown>>) => {
		const auth = Object.create(AuthService.prototype);
		auth.userService = buildService(rows);
		auth.getJwtAccessToken = jest.fn(async (user: { id: string }) => `jwt-for-${user.id}`);
		return auth as AuthService;
	};

	it('answers no account, rather than the squatter’s session, for an address only a squatter registered', async () => {
		await expect(
			buildAuth([squatter]).validateOAuthLoginEmail([{ value: EMAIL, verified: true }])
		).resolves.toEqual({
			success: false,
			authData: { jwt: null, userId: null }
		});
	});

	it('signs in the proven account (control)', async () => {
		await expect(
			buildAuth([squatter, verifiedMember]).validateOAuthLoginEmail([{ value: EMAIL, verified: true }])
		).resolves.toEqual({ success: true, authData: { jwt: 'jwt-for-verified', userId: 'verified' } });
	});
});
