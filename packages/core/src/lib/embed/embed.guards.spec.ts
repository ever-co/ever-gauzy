import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { ExtractJwt } from 'passport-jwt';
import { environment } from '@gauzy/config';
import { EmbedEnabledGuard, EmbedSessionGuard } from './embed.guards';
import { EMBED_CREDENTIAL_CLAIM, EMBED_EMPLOYEE_CLAIM, isEmbedRoute, readEmbedClaims } from './embed-session';
import {
	EMBED_TOKENS_ENV,
	embedCredentialHashesMatch,
	embedTokenTtlSeconds,
	generateEmbedCredential,
	hashEmbedCredential,
	isEmbedEnabled,
	isWellFormedEmbedCredential
} from './embed.utils';

const ORG = '7a000000-0000-4000-8000-0000000000f1';
const OTHER_ORG = '7a000000-0000-4000-8000-0000000000f2';
const EMPLOYEE = '7a000000-0000-4000-8000-0000000000e1';
const CREDENTIAL = '7a000000-0000-4000-8000-0000000000c1';

const embedToken = (claims: Record<string, unknown> = {}) =>
	sign(
		{ id: 'user', tenantId: 'tenant', organizationId: ORG, [EMBED_CREDENTIAL_CLAIM]: CREDENTIAL, [EMBED_EMPLOYEE_CLAIM]: EMPLOYEE, ...claims },
		environment.JWT_SECRET
	);

/** An HTTP execution context around a request. */
const contextOf = (request: Record<string, unknown>) =>
	({
		getType: () => 'http',
		switchToHttp: () => ({ getRequest: () => request })
	}) as any;

const guardWith = (revoked = false) => {
	const isRevoked = jest.fn(async () => revoked);
	return { guard: new EmbedSessionGuard({ isRevoked } as any), isRevoked };
};

// The switch and the token lifetime as a server without them: a developer's .env (loaded with the config) may set them.
const TTL_ENV = 'GAUZY_EMBED_TOKEN_TTL_SECONDS';
let savedSwitch: string | undefined;
let savedTtl: string | undefined;
beforeAll(() => {
	savedSwitch = process.env[EMBED_TOKENS_ENV];
	savedTtl = process.env[TTL_ENV];
});
beforeEach(() => {
	delete process.env[EMBED_TOKENS_ENV];
	delete process.env[TTL_ENV];
});
afterAll(() => {
	if (savedSwitch !== undefined) {
		process.env[EMBED_TOKENS_ENV] = savedSwitch;
	}
	if (savedTtl !== undefined) {
		process.env[TTL_ENV] = savedTtl;
	}
});

describe('embed helpers', () => {
	it('turns on only for true, 1, yes or on', () => {
		expect(['true', '1', 'yes', 'on', ' ON '].every((v) => isEmbedEnabled(v))).toBe(true);
		expect(['', 'false', '0', 'no', undefined].some((v) => isEmbedEnabled(v as any))).toBe(false);
	});

	it('keeps a token between one minute and one hour, fifteen minutes by default', () => {
		expect(embedTokenTtlSeconds(undefined)).toBe(900);
		expect(embedTokenTtlSeconds('10')).toBe(60);
		expect(embedTokenTtlSeconds('7200')).toBe(3600);
		expect(embedTokenTtlSeconds('600')).toBe(600);
	});

	it('makes a credential with its prefix, stores its digest, and compares digests', () => {
		const { secret, keyHash, prefix } = generateEmbedCredential();
		expect(isWellFormedEmbedCredential(secret)).toBe(true);
		expect(prefix).toBe(secret.slice(0, 12));
		expect(keyHash).toBe(hashEmbedCredential(secret));
		expect(embedCredentialHashesMatch(keyHash, hashEmbedCredential(secret))).toBe(true);
		expect(embedCredentialHashesMatch(keyHash, hashEmbedCredential(`${secret}x`))).toBe(false);
		expect(isWellFormedEmbedCredential('gzp_' + secret.slice(4))).toBe(false);
	});

	it('reads the embed claims of a bearer token, and none of an ordinary one', () => {
		expect(readEmbedClaims(`Bearer ${embedToken()}`)).toEqual({
			credentialId: CREDENTIAL,
			employeeId: EMPLOYEE,
			organizationId: ORG,
			tenantId: 'tenant'
		});
		expect(readEmbedClaims(`Bearer ${sign({ id: 'user' }, 'test-secret')}`)).toBeNull();
		expect(readEmbedClaims(undefined)).toBeNull();
	});

	it('opens the user, the permissions, the teams and the timer, and nothing else', () => {
		expect(isEmbedRoute('GET', '/api/user/me')).toBe(true);
		expect(isEmbedRoute('GET', '/api/role-permissions/me')).toBe(true);
		expect(isEmbedRoute('GET', '/api/organization-team/me')).toBe(true);
		expect(isEmbedRoute('GET', '/api/timesheet/timer/status')).toBe(true);
		expect(isEmbedRoute('post', '/api/timesheet/timer/start')).toBe(true);
		expect(isEmbedRoute('POST', '/api/timesheet/timer/stop')).toBe(true);
		expect(isEmbedRoute('GET', '/api/timesheet/time-log')).toBe(false);
		expect(isEmbedRoute('POST', '/api/timesheet/time-slot')).toBe(false);
		expect(isEmbedRoute('POST', '/api/timesheet/timer/toggle')).toBe(false);
		expect(isEmbedRoute('GET', '/api/employee')).toBe(false);
		expect(isEmbedRoute('DELETE', '/api/user/me')).toBe(false);
	});
});

describe('EmbedEnabledGuard', () => {
	afterEach(() => delete process.env[EMBED_TOKENS_ENV]);

	it('answers 404 while the switch is off', () => {
		expect(() => new EmbedEnabledGuard().canActivate()).toThrow(NotFoundException);
		process.env[EMBED_TOKENS_ENV] = 'true';
		expect(new EmbedEnabledGuard().canActivate()).toBe(true);
	});
});

describe('EmbedSessionGuard', () => {
	beforeEach(() => (process.env[EMBED_TOKENS_ENV] = 'true'));
	afterEach(() => delete process.env[EMBED_TOKENS_ENV]);

	it('lets every request without the embed claims through, without a query', async () => {
		const { guard, isRevoked } = guardWith();
		const request = { method: 'GET', path: '/api/timesheet/time-log', headers: { authorization: `Bearer ${sign({ id: 'u' }, 's')}` } };

		await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
		expect(isRevoked).not.toHaveBeenCalled();
	});

	it('lets an embed token reach the timer of its member', async () => {
		const { guard } = guardWith();
		const request = {
			method: 'GET',
			path: '/api/timesheet/timer/status',
			query: { organizationId: ORG },
			headers: { authorization: `Bearer ${embedToken()}` }
		};

		await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
	});

	it('refuses any other route with EMBED_SCOPE', async () => {
		const { guard } = guardWith();
		const request = { method: 'GET', path: '/api/timesheet/time-log', headers: { authorization: `Bearer ${embedToken()}` } };

		await expect(guard.canActivate(contextOf(request))).rejects.toThrow(ForbiddenException);
		await expect(guard.canActivate(contextOf(request))).rejects.toMatchObject({ response: { code: 'EMBED_SCOPE' } });
	});

	it('refuses another organization or another member', async () => {
		const { guard } = guardWith();
		const otherOrganization = {
			method: 'GET',
			path: '/api/timesheet/timer/status',
			query: { organizationId: OTHER_ORG },
			headers: { authorization: `Bearer ${embedToken()}` }
		};
		const otherMember = {
			method: 'GET',
			path: '/api/timesheet/timer/status',
			query: { organizationId: ORG, employeeId: '7a000000-0000-4000-8000-0000000000e2' },
			headers: { authorization: `Bearer ${embedToken()}` }
		};

		await expect(guard.canActivate(contextOf(otherOrganization))).rejects.toThrow(ForbiddenException);
		await expect(guard.canActivate(contextOf(otherMember))).rejects.toThrow(ForbiddenException);
	});

	it('drops the start time, stop time and manual slot of a start, so an embed cannot backdate', async () => {
		const { guard } = guardWith();
		const body = { organizationId: ORG, startedAt: '2020-01-01T00:00:00Z', stoppedAt: '2020-01-01T08:00:00Z', manualTimeSlot: true, description: 'x' };
		const request = { method: 'POST', path: '/api/timesheet/timer/start', body, headers: { authorization: `Bearer ${embedToken()}` } };

		await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
		expect(body).toEqual({ organizationId: ORG, description: 'x' });
	});

	it('refuses the token of a revoked credential, and every embed token once the switch is off', async () => {
		const revoked = guardWith(true).guard;
		const request = { method: 'GET', path: '/api/user/me', headers: { authorization: `Bearer ${embedToken()}` } };
		await expect(revoked.canActivate(contextOf(request))).rejects.toThrow(UnauthorizedException);

		delete process.env[EMBED_TOKENS_ENV];
		await expect(guardWith().guard.canActivate(contextOf(request))).rejects.toThrow(UnauthorizedException);
	});

	it('reads the token passport reads, so a suffixed Authorization header is held to the timer too', async () => {
		const { guard } = guardWith();
		const token = embedToken();
		for (const authorization of [`Bearer ${token} ignored`, `Bearer\t${token}\textra words`]) {
			// What JwtStrategy authenticates with, and what the guard must judge.
			expect(ExtractJwt.fromAuthHeaderAsBearerToken()({ headers: { authorization } } as any)).toBe(token);
			expect(readEmbedClaims(authorization)).toMatchObject({ credentialId: CREDENTIAL, employeeId: EMPLOYEE });

			const request = { method: 'GET', path: '/api/timesheet/time-log', headers: { authorization } };
			await expect(guard.canActivate(contextOf(request))).rejects.toMatchObject({ response: { code: 'EMBED_SCOPE' } });
		}
	});

	it('refuses relations and every query parameter the route does not take', async () => {
		const { guard } = guardWith();
		const headers = { authorization: `Bearer ${embedToken()}` };
		const refused = [
			{ path: '/api/user/me', query: { relations: ['organizations.organization.employees.timeLogs'] } },
			{ path: '/api/user/me', query: { includeEmployee: 'true', select: { email: true } } },
			{ path: '/api/role-permissions/me', query: { relations: ['role'] } },
			{ path: '/api/timesheet/timer/status', query: { organizationId: ORG, relations: ['employee.user'] } },
			{ path: '/api/timesheet/timer/status', query: { organizationId: ORG, employeeIds: [EMPLOYEE] } }
		];
		for (const { path, query } of refused) {
			await expect(guard.canActivate(contextOf({ method: 'GET', path, query, headers }))).rejects.toMatchObject({
				response: { code: 'EMBED_SCOPE' }
			});
		}

		const me = { method: 'GET', path: '/api/user/me', query: { includeEmployee: 'true', includeOrganization: 'true' }, headers };
		await expect(guard.canActivate(contextOf(me))).resolves.toBe(true);
	});

	it('reads only the teams of its member in its organization, both named in where', async () => {
		const { guard } = guardWith();
		const headers = { authorization: `Bearer ${embedToken()}` };
		const teams = (query: Record<string, unknown>) => contextOf({ method: 'GET', path: '/api/organization-team/me', query, headers });
		const own = { organizationId: ORG, members: { employeeId: EMPLOYEE } };

		await expect(guard.canActivate(teams({}))).rejects.toThrow(ForbiddenException);
		await expect(guard.canActivate(teams({ where: { organizationId: ORG } }))).rejects.toThrow(ForbiddenException);
		await expect(guard.canActivate(teams({ where: { ...own, organizationId: OTHER_ORG } }))).rejects.toThrow(ForbiddenException);
		await expect(
			guard.canActivate(teams({ where: { ...own, members: { employeeId: '7a000000-0000-4000-8000-0000000000e2' } } }))
		).rejects.toThrow(ForbiddenException);
		await expect(guard.canActivate(teams({ where: { ...own, members: { employeeId: EMPLOYEE, role: 'x' } } }))).rejects.toThrow(
			ForbiddenException
		);
		await expect(guard.canActivate(teams({ where: own, relations: ['members'] }))).rejects.toThrow(ForbiddenException);
		await expect(guard.canActivate(teams({ where: { ...own, tenantId: 'tenant' } }))).resolves.toBe(true);
	});

	it('looks up the credential of a token this server signed only', async () => {
		const { guard, isRevoked } = guardWith();
		const forged = sign({ id: 'user', tenantId: 'tenant', organizationId: ORG, [EMBED_CREDENTIAL_CLAIM]: 'any', [EMBED_EMPLOYEE_CLAIM]: EMPLOYEE }, 'not-the-secret');
		const expired = sign(
			{ id: 'user', tenantId: 'tenant', organizationId: ORG, [EMBED_CREDENTIAL_CLAIM]: CREDENTIAL, [EMBED_EMPLOYEE_CLAIM]: EMPLOYEE, exp: Math.floor(Date.now() / 1000) - 60 },
			environment.JWT_SECRET
		);
		for (const token of [forged, expired]) {
			const request = { method: 'GET', path: '/api/user/me', headers: { authorization: `Bearer ${token}` } };
			await expect(guard.canActivate(contextOf(request))).rejects.toThrow(UnauthorizedException);
		}
		expect(isRevoked).not.toHaveBeenCalled();
	});

	it('lets a bearer it cannot decode through to the JWT guard instead of failing the request', async () => {
		const { guard } = guardWith();
		const part = (value: string) => Buffer.from(value).toString('base64url');
		// A header typed JWT over a payload that is not JSON: `jws` throws on it.
		const undecodable = `${part('{"alg":"HS256","typ":"JWT"}')}.${part('not json')}.c2ln`;

		expect(readEmbedClaims(`Bearer ${undecodable}`)).toBeNull();
		const request = { method: 'GET', path: '/api/public/thing', headers: { authorization: `Bearer ${undecodable}` } };
		await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
	});

	it('checks every place a request names an organization, a tenant or a member, each on its own', async () => {
		const { guard } = guardWith();
		const authorization = `Bearer ${embedToken()}`;
		const status = (query: Record<string, unknown>, extraHeaders: Record<string, string> = {}) =>
			contextOf({ method: 'GET', path: '/api/timesheet/timer/status', query, headers: { authorization, ...extraHeaders } });
		const start = (body: Record<string, unknown>) =>
			contextOf({ method: 'POST', path: '/api/timesheet/timer/start', body, headers: { authorization } });

		await expect(guard.canActivate(status({ organizationId: ORG }, { 'organization-id': OTHER_ORG }))).rejects.toThrow(ForbiddenException);
		await expect(guard.canActivate(status({ organizationId: ORG }, { 'tenant-id': 'another-tenant' }))).rejects.toThrow(ForbiddenException);
		await expect(guard.canActivate(start({ organizationId: OTHER_ORG }))).rejects.toThrow(ForbiddenException);
		await expect(guard.canActivate(start({ organizationId: ORG, tenantId: 'another-tenant' }))).rejects.toThrow(ForbiddenException);
		await expect(
			guard.canActivate(start({ organizationId: ORG, employeeId: '7a000000-0000-4000-8000-0000000000e2' }))
		).rejects.toThrow(ForbiddenException);
		await expect(
			guard.canActivate(contextOf({ method: 'POST', path: '/api/timesheet/timer/start', query: { organizationId: ORG }, body: {}, headers: { authorization } }))
		).rejects.toThrow(ForbiddenException);

		await expect(guard.canActivate(status({ organizationId: ORG }, { 'organization-id': ORG, 'tenant-id': 'tenant' }))).resolves.toBe(true);
		await expect(guard.canActivate(start({ organizationId: ORG, tenantId: 'tenant', employeeId: EMPLOYEE }))).resolves.toBe(true);
	});

	it('refuses an embed token on GraphQL', async () => {
		const { guard } = guardWith();
		const context = {
			getType: () => 'graphql',
			getArgByIndex: () => ({ req: { headers: { authorization: `Bearer ${embedToken()}` } } })
		} as any;

		await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
	});
});
