import '../core/entities/internal';

import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import { TWO_FACTOR_REQUIRED_CODE } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { AuthService } from './auth.service';
import { WorkspaceSigninVerifyTokenHandler } from './commands/handlers/workspace-signin-verify-token.handler';
import { WorkspaceSigninVerifyTokenCommand } from './commands/workspace-signin-verify-token.command';
import {
	TwoFactorRequiredException,
	signTwoFactorChallenge,
	verifyTwoFactorChallenge
} from './two-factor/two-factor-challenge';

/**
 * ever-co/ever-gauzy#11916: every sign-in that ends with a session asks for a two-factor code when the user has it on.
 *
 * The password sign-in and the workspace sign-in (where the password, e-mail code and social sign-ins end) answer a
 * 403 carrying a challenge instead of the session, without minting a token; `signinWithTwoFactorCode` trades the
 * challenge and a right code for the session. A user who never turned it on signs in exactly as before.
 */

const TENANT = '9e000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '9e000000-0000-4000-8000-0000000000a1';
const TEAM = '9e000000-0000-4000-8000-0000000000d1';

const userWith = (id: string) => ({
	id,
	email: `${id}@ever.co`,
	tenantId: TENANT,
	tenant: { id: TENANT },
	lastOrganizationId: ORGANIZATION,
	hash: 'stored-hash',
	isActive: true,
	isArchived: false
});

/**
 * An AuthService whose collaborators are in memory. `withCode` are the users with two-factor authentication on;
 * `strict` makes their organization require it.
 */
function buildAuthService(
	user: ReturnType<typeof userWith>,
	{ withCode = [] as string[], strict = false, wrongCode = false } = {}
) {
	const service: AuthService = Object.create(AuthService.prototype);
	const attempt = {
		fail: jest.fn(async () => undefined),
		succeed: jest.fn(async () => undefined),
		release: jest.fn(async () => undefined)
	};
	const getJwtAccessToken = jest.fn(async (_user: unknown, organizationId?: string) => `access:${organizationId}`);
	const getJwtRefreshToken = jest.fn(async (_user: unknown, organizationId?: string) => `refresh:${organizationId}`);
	const userTwoFactorService = {
		isEnabled: jest.fn(async (userId: string) => withCode.includes(userId)),
		enabledAmong: jest.fn(async (userIds: string[]) => new Set(userIds.filter((id) => withCode.includes(id)))),
		isSetupRequired: jest.fn(async (userId: string) => strict && !withCode.includes(userId)),
		verifySecondFactor: jest.fn(async () => {
			if (wrongCode) {
				throw new UnauthorizedException('This code is not right.');
			}
		})
	};
	const userService = {
		find: jest.fn(async () => [user]),
		setCurrentRefreshToken: jest.fn(async () => undefined),
		setUserLastLoginTimestamp: jest.fn(async () => undefined),
		setLastOrganizationAndTeam: jest.fn(async () => undefined)
	};

	Object.assign(service, {
		ormType: 'typeorm',
		logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() },
		loginAttemptService: { begin: jest.fn(async () => attempt) },
		passwordHashService: { verify: jest.fn(async () => true), needsRehash: jest.fn(() => false) },
		employeeService: {
			findOneByUserId: jest.fn(async () => null),
			findEmployeeIdByUserId: jest.fn(async () => null)
		},
		typeOrmUserRepository: { findOneOrFail: jest.fn(async () => user) },
		userService,
		userTwoFactorService,
		isDeactivatedEmployeeUser: jest.fn(async () => false),
		resolveStoredOrganizationId: jest.fn(async () => ORGANIZATION),
		resolveDefaultOrganizationId: jest.fn(async () => ORGANIZATION),
		hasActiveOrganizationMembership: jest.fn(async () => true),
		issueWorkspaceSigninCode: jest.fn(async () => 'PICKER'),
		getJwtAccessToken,
		getJwtRefreshToken
	});

	return { service, attempt, userService, userTwoFactorService, getJwtAccessToken };
}

/** The workspace token the sign-in flows hand out for a user. */
const workspaceTokenFor = (service: AuthService, user: ReturnType<typeof userWith>) =>
	(service as unknown as { generateToken(user: unknown, code: string): string }).generateToken(user, 'ABC123');

/** The 403 a promise is refused with, and the challenge it carries. */
async function challengeOf(promise: Promise<unknown>) {
	const error = await promise.then(
		() => null,
		(reason: unknown) => reason
	);
	expect(error).toBeInstanceOf(TwoFactorRequiredException);
	const exception = error as TwoFactorRequiredException;
	expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
	const body = exception.getResponse() as { code: string; challenge: string };
	expect(body.code).toBe(TWO_FACTOR_REQUIRED_CODE);
	return verifyTwoFactorChallenge(body.challenge);
}

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentIp').mockReturnValue('203.0.113.7');
	jest.spyOn(RequestContext, 'currentUserAgent').mockReturnValue('jest');
});

afterEach(() => jest.restoreAllMocks());

describe('AuthService.login (POST /auth/login) with two-factor authentication', () => {
	it('signs a user without it in exactly as before', async () => {
		const user = userWith('plain');
		const { service, getJwtAccessToken } = buildAuthService(user);

		const result = await service.login({ email: user.email, password: 'right' });

		expect(result).toEqual({
			user: expect.objectContaining({ id: user.id }),
			token: `access:${ORGANIZATION}`,
			refresh_token: `refresh:${ORGANIZATION}`
		});
		expect(Object.keys(result)).toEqual(['user', 'token', 'refresh_token']);
		expect(getJwtAccessToken).toHaveBeenCalled();
	});

	it('answers a challenge instead of a session when it is on, and mints no token', async () => {
		const user = userWith('protected');
		const { service, attempt, getJwtAccessToken, userService } = buildAuthService(user, { withCode: [user.id] });

		const claims = await challengeOf(service.login({ email: user.email, password: 'right' }));

		expect(claims).toEqual(expect.objectContaining({ userId: user.id, email: user.email, tenantId: TENANT }));
		expect(getJwtAccessToken).not.toHaveBeenCalled();
		expect(userService.setCurrentRefreshToken).not.toHaveBeenCalled();
		// The password was right: its streak of failures is cleared, not counted.
		expect(attempt.succeed).toHaveBeenCalled();
		expect(attempt.fail).not.toHaveBeenCalled();
	});

	it('still refuses a wrong password with a plain 401', async () => {
		const user = userWith('protected');
		const { service } = buildAuthService(user, { withCode: [user.id] });
		(
			service as unknown as { passwordHashService: { verify: jest.Mock } }
		).passwordHashService.verify.mockResolvedValue(false);

		await expect(service.login({ email: user.email, password: 'wrong' })).rejects.toBeInstanceOf(
			UnauthorizedException
		);
	});

	it('tells a member whose organization requires it to set it up', async () => {
		const user = userWith('member');
		const { service } = buildAuthService(user, { strict: true });

		const result = await service.login({ email: user.email, password: 'right' });

		expect(result.twoFactorSetupRequired).toBe(true);
		expect(result.token).toBe(`access:${ORGANIZATION}`);
	});
});

describe('AuthService.workspaceSigninVerifyToken (POST /auth/signin.workspace) with two-factor authentication', () => {
	it('signs a user without it in exactly as before', async () => {
		const user = userWith('plain');
		const { service } = buildAuthService(user);

		const result = await service.workspaceSigninVerifyToken({
			email: user.email,
			token: workspaceTokenFor(service, user),
			lastTeamId: TEAM
		});

		expect(Object.keys(result)).toEqual(['user', 'token', 'refresh_token']);
		expect(result.token).toBe(`access:${ORGANIZATION}`);
	});

	it('answers a challenge carrying the organization and team asked for, and mints no token', async () => {
		const user = userWith('protected');
		const { service, getJwtAccessToken } = buildAuthService(user, { withCode: [user.id] });

		const claims = await challengeOf(
			service.workspaceSigninVerifyToken({
				email: user.email,
				token: workspaceTokenFor(service, user),
				lastOrganizationId: ORGANIZATION,
				lastTeamId: TEAM
			})
		);

		expect(claims).toEqual({
			userId: user.id,
			email: user.email,
			tenantId: TENANT,
			lastOrganizationId: ORGANIZATION,
			lastTeamId: TEAM
		});
		expect(getJwtAccessToken).not.toHaveBeenCalled();
	});

	it('lets the 403 through the command handler, which turns every other error into a 401', async () => {
		const user = userWith('protected');
		const { service } = buildAuthService(user, { withCode: [user.id] });
		const handler = new WorkspaceSigninVerifyTokenHandler(service);

		await expect(
			handler.execute(
				new WorkspaceSigninVerifyTokenCommand({ email: user.email, token: workspaceTokenFor(service, user) })
			)
		).rejects.toBeInstanceOf(TwoFactorRequiredException);
		await expect(
			handler.execute(new WorkspaceSigninVerifyTokenCommand({ email: user.email, token: 'forged' }))
		).rejects.toBeInstanceOf(UnauthorizedException);
	});
});

describe('AuthService.signinWithTwoFactorCode (POST /auth/two-factor/verify)', () => {
	const challengeFor = (user: ReturnType<typeof userWith>) =>
		signTwoFactorChallenge({
			userId: user.id,
			email: user.email,
			tenantId: TENANT,
			lastOrganizationId: ORGANIZATION,
			lastTeamId: TEAM
		}).challenge;

	it('issues the session once the code is right, with the scope the sign-in asked for', async () => {
		const user = userWith('protected');
		const { service, userTwoFactorService, userService } = buildAuthService(user, { withCode: [user.id] });

		const result = await service.signinWithTwoFactorCode({ challenge: challengeFor(user), code: '123456' });

		expect(userTwoFactorService.verifySecondFactor).toHaveBeenCalledWith(
			user.id,
			expect.objectContaining({ code: '123456' })
		);
		expect(result.token).toBe(`access:${ORGANIZATION}`);
		expect(userService.setLastOrganizationAndTeam).toHaveBeenCalledWith(user.id, ORGANIZATION, TEAM);
	});

	it('issues nothing for a wrong code', async () => {
		const user = userWith('protected');
		const { service, getJwtAccessToken } = buildAuthService(user, { withCode: [user.id], wrongCode: true });

		await expect(
			service.signinWithTwoFactorCode({ challenge: challengeFor(user), code: '000000' })
		).rejects.toThrow('This code is not right.');
		expect(getJwtAccessToken).not.toHaveBeenCalled();
	});

	it('refuses something that is not a challenge before checking any code', async () => {
		const user = userWith('protected');
		const { service, userTwoFactorService } = buildAuthService(user, { withCode: [user.id] });

		await expect(
			service.signinWithTwoFactorCode({ challenge: workspaceTokenFor(service, user), code: '123456' })
		).rejects.toBeInstanceOf(UnauthorizedException);
		expect(userTwoFactorService.verifySecondFactor).not.toHaveBeenCalled();
	});
});

describe('the workspace lists and the social sign-in with two-factor authentication', () => {
	it('marks only the workspaces whose sign-in asks for a code', async () => {
		const plain = userWith('plain');
		const protectedUser = userWith('protected');
		const { service } = buildAuthService(plain, { withCode: [protectedUser.id] });

		const response = await (
			service as unknown as {
				createUserSigninWorkspaceResponse(
					input: object
				): Promise<{ workspaces: Array<Record<string, unknown>> }>;
			}
		).createUserSigninWorkspaceResponse({
			users: [plain, protectedUser],
			email: plain.email,
			code: 'ABC123',
			includeTeams: false
		});

		expect(response.workspaces[0]).not.toHaveProperty('twoFactorRequired');
		expect(response.workspaces[1].twoFactorRequired).toBe(true);
	});

	it('takes a social sign-in of an account with it on to the workspace picker, never to a session', async () => {
		const user = userWith('protected');
		const { service, getJwtAccessToken } = buildAuthService(user, { withCode: [user.id] });
		(service as unknown as { userService: Record<string, jest.Mock> }).userService.findOAuthLoginUsers = jest.fn(
			async () => [user]
		);

		const result = await service.validateOAuthLoginEmail([{ value: user.email, verified: true }]);

		expect(result).toEqual({
			success: true,
			authData: { jwt: null, userId: null, workspaces: { email: user.email, code: 'PICKER' } }
		});
		expect(getJwtAccessToken).not.toHaveBeenCalled();
	});

	it('still signs an account without it straight in from a social sign-in', async () => {
		const user = userWith('plain');
		const { service } = buildAuthService(user);
		(service as unknown as { userService: Record<string, jest.Mock> }).userService.findOAuthLoginUsers = jest.fn(
			async () => [user]
		);

		const result = await service.validateOAuthLoginEmail([{ value: user.email, verified: true }]);

		expect(result).toEqual({ success: true, authData: { jwt: 'access:undefined', userId: user.id } });
	});
});
