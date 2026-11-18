// Must stay first: loads the entity graph before the services pull an entity (see user.create.handler.spec.ts).
import '../core/entities/internal';

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { sign } from 'jsonwebtoken';
import { RequestContext } from '../core/context';
import { EmbedAllowedOriginService } from './embed-allowed-origin.service';
import { createEmbedCorsDelegate } from './embed-cors';
import { EmbedSessionGuard } from './embed.guards';
import { EMBED_CREDENTIAL_CLAIM, EMBED_EMPLOYEE_CLAIM, EMBED_ORIGIN_CLAIM } from './embed-session';
import { EMBED_ORIGINS_CACHE_MS, normalizeOrigin } from './embed-origin';
import { EMBED_TOKENS_ENV } from './embed.utils';

const TENANT = '7a000000-0000-4000-8000-00000000000a';
const OTHER_TENANT = '7a000000-0000-4000-8000-00000000000b';
const ORG = '7a000000-0000-4000-8000-0000000000f1';
const OTHER_ORG = '7a000000-0000-4000-8000-0000000000f2';

const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
	Object.entries(where).every(([key, value]) => row[key] === value);

/** The service with an in-memory table, under the TypeORM branch; tenant scoping as the real base class applies it. */
function build() {
	const rows: any[] = [];
	const reads = jest.fn(async ({ where }: any) => rows.filter((row) => matches(row, where ?? {})));
	const service = new EmbedAllowedOriginService({ find: reads } as any, {} as any);
	jest.spyOn(service, 'ormType', 'get').mockReturnValue('typeorm' as any);
	jest.spyOn(service, 'find').mockImplementation(async (options: any) => {
		const tenantId = RequestContext.currentTenantId();
		return rows.filter((row) => matches(row, options.where) && row.tenantId === tenantId) as any;
	});
	jest.spyOn(service, 'create').mockImplementation(async (input: any) => {
		const row = { id: `7a000000-0000-4000-8000-00000000d00${rows.length + 1}`, createdAt: new Date(), ...input };
		rows.push(row);
		return row;
	});
	jest.spyOn(service, 'findOneByOptions').mockImplementation(async (options: any) => {
		const row = rows.find((r) => matches(r, options.where));
		if (!row) throw new NotFoundException();
		return row;
	});
	jest.spyOn(service, 'delete').mockImplementation(async (id: any) => {
		rows.splice(
			rows.findIndex((row) => row.id === id),
			1
		);
		return { affected: 1 } as any;
	});
	return { service, rows, reads };
}

const signIn = (tenantId: string) => jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenantId);

afterEach(() => {
	jest.restoreAllMocks();
	jest.useRealTimers();
});

describe('normalizeOrigin', () => {
	it('keeps scheme, host and port as the browser sends them', () => {
		expect(normalizeOrigin('https://App.Example.com')).toBe('https://app.example.com');
		expect(normalizeOrigin('https://app.example.com:443/')).toBe('https://app.example.com');
		expect(normalizeOrigin('http://localhost:4108')).toBe('http://localhost:4108');
		expect(normalizeOrigin('  https://app.example.com  ')).toBe('https://app.example.com');
		expect(normalizeOrigin('http://[::1]:4200')).toBe('http://[::1]:4200');
		expect(normalizeOrigin('https://bücher.example')).toBe('https://xn--bcher-kva.example');
	});

	it('refuses a path, a query, a wildcard, credentials and any other scheme', () => {
		for (const value of [
			'https://app.example.com/timer',
			'https://app.example.com?x=1',
			'https://*.example.com',
			// What URL would reduce to an origin: a decoded wildcard, a path that resolves to `/`, an empty query or
			// fragment, and a backslash that a special scheme reads as a slash.
			'https://%2A.example.com',
			'https://app.example.com/timer/..',
			'https://app.example.com?',
			'https://app.example.com#',
			'https://app.example.com\\@evil.example',
			'https://app.example.com//',
			'null',
			'https://user:secret@app.example.com',
			'ftp://app.example.com',
			'javascript:alert(1)',
			'app.example.com',
			'',
			undefined
		]) {
			expect(normalizeOrigin(value)).toBeNull();
		}
	});
});

describe('EmbedAllowedOriginService', () => {
	it('adds an origin once, normalized, and lists it with who added it and when', async () => {
		const { service, rows } = build();
		signIn(TENANT);

		const added = await service.addForOrganization({ origin: 'https://App.Example.com/', organizationId: ORG });
		const again = await service.addForOrganization({ origin: 'https://app.example.com', organizationId: ORG });
		const listed = await service.listForOrganization(ORG);

		expect(added.origin).toBe('https://app.example.com');
		expect(again.id).toBe(added.id);
		expect(rows).toHaveLength(1);
		expect(listed.map((row) => row.origin)).toEqual(['https://app.example.com']);
		expect(listed[0]).toHaveProperty('createdAt');
	});

	it('refuses what is not an origin', async () => {
		const { service } = build();
		signIn(TENANT);

		await expect(service.addForOrganization({ origin: 'https://app.example.com/x', organizationId: ORG })).rejects.toThrow(
			BadRequestException
		);
	});

	it('states who adds an origin, so MikroORM stores the creator too: its createdByUserId mirror is not persisted', async () => {
		const ADMIN = '7a000000-0000-4000-8000-0000000000a1';
		const { service } = build();
		signIn(TENANT);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(ADMIN);

		await service.addForOrganization({ origin: 'https://app.example.com', organizationId: ORG });

		expect(service.create).toHaveBeenCalledWith({
			tenantId: TENANT,
			organizationId: ORG,
			origin: 'https://app.example.com',
			createdByUserId: ADMIN
		});
		expect((await service.listForOrganization(ORG))[0].createdByUserId).toBe(ADMIN);
	});

	it('refuses an origin longer than its column once normalized, before any insert', async () => {
		const { service, rows } = build();
		signIn(TENANT);
		// 254 characters as written; punycode makes `bücher` `xn--bcher-kva`, 261 as stored.
		const long = `https://${['a'.repeat(63), 'b'.repeat(63), 'c'.repeat(63), 'd'.repeat(47), 'bücher'].join('.')}`;
		expect(long.length).toBeLessThanOrEqual(255);
		expect(normalizeOrigin(long)?.length).toBeGreaterThan(255);

		await expect(service.addForOrganization({ origin: long, organizationId: ORG })).rejects.toThrow(BadRequestException);
		expect(service.create).not.toHaveBeenCalled();
		expect(rows).toHaveLength(0);
	});

	it('answers 404 only for a miss: a lookup that failed is thrown as it is, and nothing is removed', async () => {
		const { service } = build();
		signIn(TENANT);
		jest.spyOn(service, 'findOneByOptions').mockRejectedValue(new Error('connection lost'));

		await expect(service.remove('7a000000-0000-4000-8000-00000000d001')).rejects.toThrow('connection lost');
		expect(service.delete).not.toHaveBeenCalled();
	});

	it('removes only an origin of the caller tenant', async () => {
		const { service, rows } = build();
		signIn(TENANT);
		const { id } = await service.addForOrganization({ origin: 'https://app.example.com', organizationId: ORG });

		signIn(OTHER_TENANT);
		await expect(service.remove(id)).rejects.toThrow(NotFoundException);
		signIn(TENANT);
		await service.remove(id);

		expect(rows).toHaveLength(0);
	});

	it('tells whether an organization allows an origin, read now', async () => {
		const { service } = build();
		signIn(TENANT);
		await service.addForOrganization({ origin: 'https://app.example.com', organizationId: ORG });

		expect(await service.isAllowed(TENANT, ORG, 'https://app.example.com')).toBe(true);
		expect(await service.isAllowed(TENANT, OTHER_ORG, 'https://app.example.com')).toBe(false);
		expect(await service.isAllowed(TENANT, ORG, 'https://other.example.com')).toBe(false);
	});

	it("counts only a row of the credential's tenant: another tenant naming the organization does not widen its list", async () => {
		const { service, rows } = build();
		rows.push({ id: 'foreign', tenantId: OTHER_TENANT, organizationId: ORG, origin: 'https://evil.example' });

		expect(await service.isAllowed(TENANT, ORG, 'https://evil.example')).toBe(false);
		expect(await service.isAllowed(OTHER_TENANT, ORG, 'https://evil.example')).toBe(true);
		expect(await service.isAllowed(null as any, ORG, 'https://evil.example')).toBe(false);
	});

	it('answers the saved row when another request added the same origin between the read and the insert', async () => {
		const { service, rows } = build();
		signIn(TENANT);
		const saved = { id: 'first', tenantId: TENANT, organizationId: ORG, origin: 'https://app.example.com', createdAt: new Date() };
		jest.spyOn(service, 'create').mockImplementation(async () => {
			// The other request's insert lands first, and the unique index refuses this one.
			rows.push(saved);
			throw new BadRequestException('duplicate key value violates unique constraint');
		});

		const added = await service.addForOrganization({ origin: 'https://app.example.com', organizationId: ORG });

		expect(added.id).toBe('first');
		expect(rows).toHaveLength(1);
	});

	it('still refuses an insert that fails for another reason', async () => {
		const { service } = build();
		signIn(TENANT);
		jest.spyOn(service, 'create').mockRejectedValue(new BadRequestException('the database refused it'));

		await expect(service.addForOrganization({ origin: 'https://app.example.com', organizationId: ORG })).rejects.toThrow(
			'the database refused it'
		);
	});

	it('reads every origin for CORS at most once a minute, and again at once after a change', async () => {
		jest.useFakeTimers({ now: new Date('2026-11-17T12:00:00Z') });
		const { service, reads } = build();
		signIn(TENANT);
		const { id } = await service.addForOrganization({ origin: 'https://app.example.com', organizationId: ORG });

		expect(await service.isAllowedAnywhere('https://app.example.com')).toBe(true);
		expect(await service.isAllowedAnywhere('https://app.example.com')).toBe(true);
		expect(reads).toHaveBeenCalledTimes(1);

		jest.setSystemTime(Date.now() + EMBED_ORIGINS_CACHE_MS + 1);
		await service.isAllowedAnywhere('https://app.example.com');
		expect(reads).toHaveBeenCalledTimes(2);

		await service.remove(id);
		expect(await service.isAllowedAnywhere('https://app.example.com')).toBe(false);
	});

	it('keeps no list of every origin that an add on this server overtook while it was read', async () => {
		const { service, rows, reads } = build();
		signIn(TENANT);
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => (release = resolve));
		reads.mockImplementationOnce(async () => {
			const before = [...rows];
			await gate;
			return before;
		});

		const pending = service.isAllowedAnywhere('https://app.example.com');
		await service.addForOrganization({ origin: 'https://app.example.com', organizationId: ORG });
		release();

		expect(await pending).toBe(false);
		expect(await service.isAllowedAnywhere('https://app.example.com')).toBe(true);
		expect(reads).toHaveBeenCalledTimes(2);
	});
});

describe('EmbedAllowedOriginService under DB_ORM=mikro-orm', () => {
	const originalOrm = process.env.DB_ORM;

	afterEach(() => {
		if (originalOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = originalOrm;
	});

	it('reads every origin for CORS in a MikroORM context of its own: CORS answers before the request has one', async () => {
		process.env.DB_ORM = 'mikro-orm';
		const fork = { name: 'default' };
		const orm = { em: { name: 'default', fork: jest.fn(() => fork) } };
		const find = jest.fn(async () => {
			// As the API runs MikroORM: its global EntityManager refuses a read outside a context.
			if (MikroOrmRequestContext.getEntityManager() !== fork) {
				throw new Error('Using global EntityManager instance methods for context specific actions is disallowed.');
			}
			return [{ origin: 'https://app.example.com' }];
		});
		const service = new EmbedAllowedOriginService({} as any, { find } as any, orm as any);
		jest.spyOn(service, 'ormType', 'get').mockReturnValue('mikro-orm' as any);

		expect(await service.isAllowedAnywhere('https://app.example.com')).toBe(true);
		expect(await service.isAllowedAnywhere('https://other.example.com')).toBe(false);
		expect(find).toHaveBeenCalledTimes(1);
		expect(orm.em.fork).toHaveBeenCalledTimes(1);
	});
});

describe('createEmbedCorsDelegate', () => {
	const base = { origin: 'callback', credentials: true } as any;
	const lookup = { isAllowedAnywhere: jest.fn(async (origin: string) => origin === 'https://app.example.com') };
	const delegate = createEmbedCorsDelegate(base, ['http://localhost:3030'], lookup);
	const answer = (request: any) =>
		new Promise<any>((resolve) => delegate(request, (_error, options) => resolve(options)));

	it('answers an allowed embed origin on the timer routes, without credentials', async () => {
		const options = await answer({
			method: 'GET',
			path: '/api/timesheet/timer/status',
			headers: { origin: 'https://app.example.com' }
		});

		expect(options).toEqual({ ...base, origin: true, credentials: false });
	});

	it('judges a preflight by the method it announces', async () => {
		const start = await answer({
			method: 'OPTIONS',
			path: '/api/timesheet/timer/start',
			headers: { origin: 'https://app.example.com', 'access-control-request-method': 'POST' }
		});
		const logs = await answer({
			method: 'OPTIONS',
			path: '/api/timesheet/time-log',
			headers: { origin: 'https://app.example.com', 'access-control-request-method': 'GET' }
		});

		expect(start.origin).toBe(true);
		expect(logs).toBe(base);
	});

	it('leaves every other request to ALLOWED_ORIGINS: other routes, other origins, the server list itself', async () => {
		expect(await answer({ method: 'GET', path: '/api/employee', headers: { origin: 'https://app.example.com' } })).toBe(base);
		expect(
			await answer({ method: 'GET', path: '/api/timesheet/timer/status', headers: { origin: 'https://evil.example.com' } })
		).toBe(base);
		expect(await answer({ method: 'GET', path: '/api/user/me', headers: { origin: 'http://localhost:3030' } })).toBe(base);
		expect(await answer({ method: 'GET', path: '/api/user/me', headers: {} })).toBe(base);
	});
});

describe('EmbedSessionGuard and the bound origin', () => {
	beforeEach(() => (process.env[EMBED_TOKENS_ENV] = 'true'));
	afterEach(() => delete process.env[EMBED_TOKENS_ENV]);

	const token = sign(
		{
			id: 'user',
			tenantId: TENANT,
			organizationId: ORG,
			[EMBED_CREDENTIAL_CLAIM]: '7a000000-0000-4000-8000-0000000000c1',
			[EMBED_EMPLOYEE_CLAIM]: '7a000000-0000-4000-8000-0000000000e1',
			[EMBED_ORIGIN_CLAIM]: 'https://app.example.com'
		},
		'test-secret'
	);
	const guard = new EmbedSessionGuard({ isRevoked: async () => false } as any);
	const context = (origin?: string) =>
		({
			getType: () => 'http',
			switchToHttp: () => ({
				getRequest: () => ({
					method: 'GET',
					path: '/api/timesheet/timer/status',
					headers: { authorization: `Bearer ${token}`, ...(origin ? { origin } : {}) }
				})
			})
		}) as any;

	it('lets the token work from the origin it was exchanged for, or from a caller that names none', async () => {
		await expect(guard.canActivate(context('https://app.example.com'))).resolves.toBe(true);
		await expect(guard.canActivate(context())).resolves.toBe(true);
	});

	it('refuses it from another site with EMBED_ORIGIN', async () => {
		await expect(guard.canActivate(context('https://evil.example.com'))).rejects.toThrow(ForbiddenException);
		await expect(guard.canActivate(context('https://evil.example.com'))).rejects.toMatchObject({
			response: { code: 'EMBED_ORIGIN' }
		});
	});
});
