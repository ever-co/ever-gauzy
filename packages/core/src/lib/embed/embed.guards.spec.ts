import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { ExtractJwt } from 'passport-jwt';
import { TimeLogSourceEnum } from '@gauzy/contracts';
import { environment } from '@gauzy/config';
import { EmbedEnabledGuard, EmbedSessionGuard } from './embed.guards';
import {
	EMBED_CLIENT_CLAIM,
	EMBED_CREDENTIAL_CLAIM,
	EMBED_EMPLOYEE_CLAIM,
	EMBED_GRANT_CLAIM,
	embedRouteOf,
	IEmbedClientStart,
	isEmbedRoute,
	isWithinEmbedScope,
	readEmbedClaims
} from './embed-session';
import {
	EMBED_TOKENS_ENV,
	embedCredentialHashesMatch,
	embedTokenTtlSeconds,
	generateEmbedCredential,
	generateEmbedRenewalToken,
	hashEmbedCredential,
	isEmbedEnabled,
	isWellFormedEmbedCredential,
	isWellFormedEmbedRenewalToken
} from './embed.utils';

const ORG = '7a000000-0000-4000-8000-0000000000f1';
const OTHER_ORG = '7a000000-0000-4000-8000-0000000000f2';
const EMPLOYEE = '7a000000-0000-4000-8000-0000000000e1';
const CREDENTIAL = '7a000000-0000-4000-8000-0000000000c1';
const CLIENT = '7a000000-0000-4000-8000-0000000000d1';

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

/** The client's projects and their tasks, in the token's tenant and organization. */
const WEBSITE = '7a000000-0000-4000-8000-0000000000a1';
const HOMEPAGE = '7a000000-0000-4000-8000-0000000000b1';
const OTHER_CLIENT_PROJECT = '7a000000-0000-4000-8000-0000000000a2';
const OTHER_PROJECT_TASK = '7a000000-0000-4000-8000-0000000000b2';

const guardWith = (revoked = false) => {
	const isRevoked = jest.fn(async () => revoked);
	// As `EmbedClientService` reads them (its own spec runs it on SQLite): the website and its homepage task.
	const isStartForClient = jest.fn(
		async (clientId: string, scope: { tenantId: string; organizationId: string }, start: IEmbedClientStart) => {
			const isClientsScope = clientId === CLIENT && scope.tenantId === 'tenant' && scope.organizationId === ORG;
			const isWebsite = start.projectId === WEBSITE;
			const isTaskOfWebsite = start.taskId === null || start.taskId === HOMEPAGE;
			return isClientsScope && isWebsite && isTaskOfWebsite;
		}
	);
	const guard = new EmbedSessionGuard({ isRevoked } as any, { isStartForClient } as any);
	return { guard, isRevoked, isStartForClient };
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

	it('makes a renewal token with its own prefix and stores its digest, never taken for a credential', () => {
		const { token, keyHash } = generateEmbedRenewalToken();
		const other = generateEmbedRenewalToken();

		expect(token).toMatch(/^gzr_[A-Za-z0-9_-]{43}$/);
		expect(isWellFormedEmbedRenewalToken(token)).toBe(true);
		expect(keyHash).toBe(hashEmbedCredential(token));
		expect(keyHash).not.toContain(token.slice(4));
		expect(other.token).not.toBe(token);
		expect(isWellFormedEmbedCredential(token)).toBe(false);
		expect(isWellFormedEmbedRenewalToken(generateEmbedCredential().secret)).toBe(false);
		for (const odd of [`${token}x`, token.slice(0, -1), `gzr_${'*'.repeat(43)}`, 42, null, undefined]) {
			expect(isWellFormedEmbedRenewalToken(odd)).toBe(false);
		}
	});

	it('reads the embed claims of a bearer token, and none of an ordinary one', () => {
		expect(readEmbedClaims(`Bearer ${embedToken()}`)).toEqual({
			credentialId: CREDENTIAL,
			employeeId: EMPLOYEE,
			organizationId: ORG,
			tenantId: 'tenant',
			origin: null,
			clientId: null,
			grantId: null
		});
		expect(readEmbedClaims(`Bearer ${sign({ id: 'user' }, 'test-secret')}`)).toBeNull();
		expect(readEmbedClaims(undefined)).toBeNull();
	});

	it('reads the client of a token exchanged with a credential limited to one, and none that is not a string', () => {
		const withClient = readEmbedClaims(`Bearer ${embedToken({ [EMBED_CLIENT_CLAIM]: CLIENT })}`);
		expect(withClient).toMatchObject({ credentialId: CREDENTIAL, clientId: CLIENT });

		for (const odd of [42, { toString: 1 }, [CLIENT], '']) {
			const claims = readEmbedClaims(`Bearer ${embedToken({ [EMBED_CLIENT_CLAIM]: odd })}`);
			expect(claims).toMatchObject({ credentialId: CREDENTIAL, clientId: null });
		}
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

	it('opens the projects to a GET without query parameters, in the organization and tenant of the token', () => {
		const route = embedRouteOf('GET', '/api/embed/projects');
		const claims = readEmbedClaims(`Bearer ${embedToken()}`);
		const headers = { 'organization-id': ORG, 'tenant-id': 'tenant' };

		expect(route).not.toBeNull();
		expect(isEmbedRoute('GET', '/api/embed/projects/')).toBe(true);
		expect(isEmbedRoute('POST', '/api/embed/projects')).toBe(false);
		expect(isEmbedRoute('GET', '/api/embed/projects/7a000000-0000-4000-8000-0000000000a1')).toBe(false);
		expect(isWithinEmbedScope(route, { query: {}, headers }, claims)).toBe(true);

		const refused = [
			{ query: { organizationId: ORG } },
			{ query: { relations: ['members'] } },
			{ query: { where: { organizationContactId: CLIENT } } },
			{ query: {}, headers: { 'organization-id': OTHER_ORG } },
			{ query: {}, headers: { 'tenant-id': 'another-tenant' } }
		];
		for (const request of refused) {
			expect(isWithinEmbedScope(route, request, claims)).toBe(false);
		}
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
		expect(body).toEqual({ organizationId: ORG, description: 'x', source: TimeLogSourceEnum.EMBED });
	});

	it("starts and stops as an embedded timer, whatever client the body names, so the team's rules hold the start", async () => {
		const { guard } = guardWith();
		for (const path of ['/api/timesheet/timer/start', '/api/timesheet/timer/stop']) {
			for (const named of [TimeLogSourceEnum.DESKTOP, TimeLogSourceEnum.WEB_TIMER, undefined]) {
				const body: Record<string, unknown> = { organizationId: ORG, source: named };
				const request = { method: 'POST', path, body, headers: { authorization: `Bearer ${embedToken()}` } };

				await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
				expect(body.source).toBe(TimeLogSourceEnum.EMBED);
			}
		}
	});

	it("leaves the source of a request that carries no embed token as it is", async () => {
		const { guard } = guardWith();
		const body = { organizationId: ORG, source: TimeLogSourceEnum.DESKTOP };
		const request = { method: 'POST', path: '/api/timesheet/timer/start', body, headers: {} };

		await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
		expect(body.source).toBe(TimeLogSourceEnum.DESKTOP);
	});

	it('refuses the token of a revoked credential, and every embed token once the switch is off', async () => {
		const revoked = guardWith(true).guard;
		const request = { method: 'GET', path: '/api/user/me', headers: { authorization: `Bearer ${embedToken()}` } };
		await expect(revoked.canActivate(contextOf(request))).rejects.toThrow(UnauthorizedException);

		delete process.env[EMBED_TOKENS_ENV];
		await expect(guardWith().guard.canActivate(contextOf(request))).rejects.toThrow(UnauthorizedException);
	});

	it("keeps every embed token, a site grant's too, from the routes that allow a site or list and revoke grants", async () => {
		const { guard } = guardWith();
		const GRANT = '7a000000-0000-4000-8000-0000000000a9';
		const tokens = [embedToken(), embedToken({ [EMBED_CREDENTIAL_CLAIM]: GRANT, [EMBED_GRANT_CLAIM]: GRANT })];
		const routes = [
			{
				method: 'POST',
				path: '/api/embed/authorize',
				body: { organizationId: ORG, origin: 'https://team.example.com' }
			},
			{ method: 'GET', path: '/api/embed/grants' },
			{ method: 'DELETE', path: `/api/embed/grants/${GRANT}` }
		];

		for (const token of tokens) {
			for (const route of routes) {
				const request = { ...route, headers: { authorization: `Bearer ${token}` } };
				await expect(guard.canActivate(contextOf(request))).rejects.toMatchObject({
					response: { code: 'EMBED_SCOPE' }
				});
			}
		}
	});

	it('looks no credential up for the token of a site grant, which reaches the timer as an exchanged one does', async () => {
		const { guard, isRevoked } = guardWith(true);
		const GRANT = '7a000000-0000-4000-8000-0000000000a9';
		const authorization = `Bearer ${embedToken({ [EMBED_CREDENTIAL_CLAIM]: GRANT, [EMBED_GRANT_CLAIM]: GRANT })}`;
		const status = { method: 'GET', path: '/api/timesheet/timer/status', headers: { authorization } };
		const logs = { method: 'GET', path: '/api/timesheet/time-log', headers: { authorization } };

		expect(readEmbedClaims(authorization)).toMatchObject({ credentialId: GRANT, grantId: GRANT });
		await expect(guard.canActivate(contextOf(status))).resolves.toBe(true);
		await expect(guard.canActivate(contextOf(logs))).rejects.toMatchObject({ response: { code: 'EMBED_SCOPE' } });
		expect(isRevoked).not.toHaveBeenCalled();

		delete process.env[EMBED_TOKENS_ENV];
		await expect(guard.canActivate(contextOf(status))).rejects.toThrow(UnauthorizedException);
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

	it('reads an employee claim that is not a string as none, without failing the request', async () => {
		const { guard } = guardWith();
		// An object without a usable toString: String() would throw on it.
		const odd = sign(
			{ id: 'user', tenantId: 'tenant', organizationId: ORG, [EMBED_CREDENTIAL_CLAIM]: CREDENTIAL, [EMBED_EMPLOYEE_CLAIM]: { toString: 1 } },
			'not-the-secret'
		);

		expect(() => readEmbedClaims(`Bearer ${odd}`)).not.toThrow();
		expect(readEmbedClaims(`Bearer ${odd}`)).toMatchObject({ credentialId: CREDENTIAL, employeeId: '' });
		const request = { method: 'GET', path: '/api/user/me', headers: { authorization: `Bearer ${odd}` } };
		await expect(guard.canActivate(contextOf(request))).rejects.toThrow(UnauthorizedException);
	});

	it("reads the timer status of the widget's own day only", async () => {
		const { guard } = guardWith();
		const headers = { authorization: `Bearer ${embedToken()}` };
		const status = (query: Record<string, unknown>) =>
			contextOf({ method: 'GET', path: '/api/timesheet/timer/status', query: { organizationId: ORG, ...query }, headers });
		const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
		const HOUR = 60 * 60 * 1000;

		await expect(guard.canActivate(status({}))).resolves.toBe(true);
		await expect(guard.canActivate(status({ todayStart: at(-10 * HOUR), todayEnd: at(14 * HOUR - 1) }))).resolves.toBe(true);

		const refused = [
			{ todayStart: at(-30 * 24 * HOUR), todayEnd: at(-29 * 24 * HOUR) },
			{ todayStart: at(-48 * HOUR), todayEnd: at(HOUR) },
			{ todayStart: at(-10 * HOUR) },
			{ todayStart: 'yesterday', todayEnd: at(HOUR) },
			{ todayStart: [at(-HOUR)], todayEnd: at(HOUR) }
		];
		for (const query of refused) {
			await expect(guard.canActivate(status(query))).rejects.toMatchObject({ response: { code: 'EMBED_SCOPE' } });
		}
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

	describe('a token limited to a client', () => {
		const ofClient = () => `Bearer ${embedToken({ [EMBED_CLIENT_CLAIM]: CLIENT })}`;
		const start = (body: unknown, authorization = ofClient()) =>
			contextOf({ method: 'POST', path: '/api/timesheet/timer/start', body, headers: { authorization } });

		it('starts the timer on a project of its client, with a task of that project or none', async () => {
			const { guard, isStartForClient } = guardWith();
			const scope = { tenantId: 'tenant', organizationId: ORG };

			await expect(guard.canActivate(start({ organizationId: ORG, projectId: WEBSITE }))).resolves.toBe(true);
			const withTask = { projectId: WEBSITE, taskId: HOMEPAGE, organizationContactId: CLIENT };
			await expect(guard.canActivate(start(withTask))).resolves.toBe(true);

			const website = { projectId: WEBSITE, taskId: null };
			const homepage = { projectId: WEBSITE, taskId: HOMEPAGE };
			expect(isStartForClient).toHaveBeenNthCalledWith(1, CLIENT, scope, website);
			expect(isStartForClient).toHaveBeenNthCalledWith(2, CLIENT, scope, homepage);
		});

		it('refuses with EMBED_CLIENT_PROJECT a start on no project, another project or a task of another one', async () => {
			const { guard } = guardWith();
			const refused = [
				undefined,
				{},
				{ taskId: HOMEPAGE },
				{ projectId: '' },
				{ projectId: [WEBSITE] },
				{ projectId: OTHER_CLIENT_PROJECT },
				{ projectId: WEBSITE, taskId: OTHER_PROJECT_TASK },
				{ projectId: WEBSITE, taskId: { id: HOMEPAGE } }
			];
			for (const body of refused) {
				await expect(guard.canActivate(start(body))).rejects.toMatchObject({
					response: { statusCode: 403, code: 'EMBED_CLIENT_PROJECT' }
				});
			}
		});

		it('refuses with EMBED_CLIENT_PROJECT a start that names another client, before any lookup', async () => {
			const { guard, isStartForClient } = guardWith();
			const otherClient = '7a000000-0000-4000-8000-0000000000d2';

			for (const organizationContactId of [otherClient, [CLIENT], 42]) {
				await expect(
					guard.canActivate(start({ projectId: WEBSITE, organizationContactId }))
				).rejects.toMatchObject({ response: { code: 'EMBED_CLIENT_PROJECT' } });
			}
			expect(isStartForClient).not.toHaveBeenCalled();
		});

		it('takes its client named in capitals, and still refuses another client named so', async () => {
			const { guard, isStartForClient } = guardWith();
			const otherClient = '7A000000-0000-4000-8000-0000000000D2';
			const inCapitals = { projectId: WEBSITE, organizationContactId: CLIENT.toUpperCase() };
			const anotherInCapitals = { projectId: WEBSITE, organizationContactId: otherClient };

			await expect(guard.canActivate(start(inCapitals))).resolves.toBe(true);
			await expect(guard.canActivate(start(anotherInCapitals))).rejects.toMatchObject({
				response: { code: 'EMBED_CLIENT_PROJECT' }
			});
			expect(isStartForClient).toHaveBeenCalledTimes(1);
		});

		it('looks a start up only for a token this server signed and that is not revoked', async () => {
			const { guard, isStartForClient } = guardWith();
			const forged = sign(
				{
					id: 'user',
					tenantId: 'tenant',
					organizationId: ORG,
					[EMBED_CREDENTIAL_CLAIM]: CREDENTIAL,
					[EMBED_EMPLOYEE_CLAIM]: EMPLOYEE,
					[EMBED_CLIENT_CLAIM]: CLIENT
				},
				'not-the-secret'
			);
			await expect(guard.canActivate(start({ projectId: WEBSITE }, `Bearer ${forged}`))).rejects.toThrow(
				UnauthorizedException
			);

			const revoked = guardWith(true);
			const onWebsite = start({ projectId: WEBSITE });
			await expect(revoked.guard.canActivate(onWebsite)).rejects.toThrow(UnauthorizedException);

			expect(isStartForClient).not.toHaveBeenCalled();
			expect(revoked.isStartForClient).not.toHaveBeenCalled();
		});

		it('stops the timer and reaches the other routes as before, without a lookup', async () => {
			const { guard, isStartForClient } = guardWith();
			const authorization = ofClient();
			const stop = { method: 'POST', path: '/api/timesheet/timer/stop', body: {}, headers: { authorization } };
			const status = {
				method: 'GET',
				path: '/api/timesheet/timer/status',
				query: { organizationId: ORG },
				headers: { authorization }
			};

			await expect(guard.canActivate(contextOf(stop))).resolves.toBe(true);
			await expect(guard.canActivate(contextOf(status))).resolves.toBe(true);
			expect(isStartForClient).not.toHaveBeenCalled();
		});

		it('reads the projects it may track time on, as a token without a client does, with no query', async () => {
			const { guard } = guardWith();
			const projects = (authorization: string, query: Record<string, unknown> = {}) =>
				contextOf({ method: 'GET', path: '/api/embed/projects', query, headers: { authorization } });

			await expect(guard.canActivate(projects(ofClient()))).resolves.toBe(true);
			await expect(guard.canActivate(projects(`Bearer ${embedToken()}`))).resolves.toBe(true);
			await expect(guard.canActivate(projects(ofClient(), { organizationId: ORG }))).rejects.toMatchObject({
				response: { code: 'EMBED_SCOPE' }
			});
		});

		it('leaves the start of a token without a client as it was, without a lookup', async () => {
			const { guard, isStartForClient } = guardWith();
			const authorization = `Bearer ${embedToken()}`;

			await expect(guard.canActivate(start({}, authorization))).resolves.toBe(true);
			const onAnyProject = start({ projectId: OTHER_CLIENT_PROJECT }, authorization);
			await expect(guard.canActivate(onAnyProject)).resolves.toBe(true);
			expect(isStartForClient).not.toHaveBeenCalled();
		});
	});
});
