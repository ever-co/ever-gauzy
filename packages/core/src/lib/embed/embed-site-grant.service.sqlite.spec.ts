import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import type { DataSource } from 'typeorm';
import type { EmbedSiteGrantService } from './embed-site-grant.service';

/**
 * A person's sign-in from a site the organization allows, on one SQLite database with the tables TypeORM creates for
 * every entity, its transactions one at a time as the application runs them: the timer token is minted for the
 * person's own member, bound to the site and the grant, and the renewal token is stored as its SHA-256 only. A person
 * who is not an active member who may track time, a site the organization does not allow, and a site it does not let
 * people sign in from are each refused with their own code. A renewal token works once, from its own site only, and a
 * used one presented again revokes its whole sign-in.
 */
const TIMEOUT = 10 * 60 * 1000;

const TENANT = '7e000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '7e000000-0000-4000-8000-0000000000f1';
const SISTER_ORGANIZATION = '7e000000-0000-4000-8000-0000000000f2';

/** The sites: allowed with sign-in on, allowed with sign-in off, and allowed with sign-in on by the sister only. */
const TEAM_PAGE = 'https://team.northwind.example';
const DOCS = 'https://docs.northwind.example';
const SISTER_PAGE = 'https://sister.northwind.example';

/** The people, each with what the organization left them. */
const PEOPLE: Record<
	string,
	{ userId: string; employeeId: string; employee?: Record<string, unknown>; membership?: Record<string, unknown> }
> = {
	lina: { userId: '7e000000-0000-4000-8000-000000000001', employeeId: '7e000000-0000-4000-8000-0000000000e1' },
	omar: {
		userId: '7e000000-0000-4000-8000-000000000002',
		employeeId: '7e000000-0000-4000-8000-0000000000e2',
		employee: { isTrackingEnabled: 0 }
	},
	ines: {
		userId: '7e000000-0000-4000-8000-000000000003',
		employeeId: '7e000000-0000-4000-8000-0000000000e3',
		employee: { isArchived: 1 }
	},
	yuki: {
		userId: '7e000000-0000-4000-8000-000000000004',
		employeeId: '7e000000-0000-4000-8000-0000000000e4',
		membership: { isActive: 0 }
	},
	sam: {
		userId: '7e000000-0000-4000-8000-000000000005',
		employeeId: '7e000000-0000-4000-8000-0000000000e5',
		employee: { organizationId: SISTER_ORGANIZATION },
		membership: { organizationId: SISTER_ORGANIZATION }
	}
};

/** A row with the columns given, and a placeholder in every other NOT NULL column without a default. */
async function insert(dataSource: DataSource, table: string, row: Record<string, unknown>): Promise<void> {
	const columns = (await dataSource.query(`PRAGMA table_info("${table}")`)) as Array<{
		name: string;
		type: string;
		notnull: number;
		dflt_value: string | null;
		pk: number;
	}>;
	const values: Record<string, unknown> = { ...row };
	for (const column of columns) {
		const isFilled = column.name in values;
		const isOptional = !column.notnull || column.dflt_value !== null || column.pk === 1;
		if (isFilled || isOptional) {
			continue;
		}
		values[column.name] = placeholderOf(column.type);
	}
	const keys = Object.keys(values);
	const names = keys.map((key) => `"${key}"`).join(', ');
	const marks = keys.map(() => '?').join(', ');
	await dataSource.query(
		`INSERT INTO "${table}" (${names}) VALUES (${marks})`,
		keys.map((key) => values[key])
	);
}

function placeholderOf(type: string): unknown {
	const lower = type.toLowerCase();
	if (/int|bool|numeric|decimal|real|float/.test(lower)) {
		return 0;
	}
	if (/date|time/.test(lower)) {
		return '2026-01-01 00:00:00';
	}
	return 'x';
}

/** The tenant, the two organizations, the people and the allowed sites every case reads. */
async function seed(dataSource: DataSource): Promise<void> {
	await dataSource.query('PRAGMA foreign_keys = OFF');
	await insert(dataSource, 'tenant', { id: TENANT, name: 'Northwind Studio' });
	for (const [id, name] of [
		[ORGANIZATION, 'Northwind Studio'],
		[SISTER_ORGANIZATION, 'Northwind Labs']
	]) {
		await insert(dataSource, 'organization', { id, tenantId: TENANT, name, currency: 'EUR' });
	}
	for (const [name, person] of Object.entries(PEOPLE)) {
		const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
		await insert(dataSource, 'user', {
			id: person.userId,
			tenantId: TENANT,
			email: `${name}@northwind.example`,
			isActive: 1,
			isArchived: 0
		});
		await insert(dataSource, 'employee', {
			id: person.employeeId,
			...scope,
			userId: person.userId,
			isActive: 1,
			isArchived: 0,
			isTrackingEnabled: 1,
			...person.employee
		});
		await insert(dataSource, 'user_organization', {
			id: `${person.userId.slice(0, -4)}${person.employeeId.slice(-4)}`,
			...scope,
			userId: person.userId,
			isActive: 1,
			isArchived: 0,
			...person.membership
		});
	}
	const sites: Array<[string, string, string, number]> = [
		['7e000000-0000-4000-8000-0000000000a1', ORGANIZATION, TEAM_PAGE, 1],
		['7e000000-0000-4000-8000-0000000000a2', ORGANIZATION, DOCS, 0],
		['7e000000-0000-4000-8000-0000000000a3', SISTER_ORGANIZATION, SISTER_PAGE, 1]
	];
	for (const [id, organizationId, origin, allowPersonSignIn] of sites) {
		await insert(dataSource, 'embed_allowed_origin', {
			id,
			tenantId: TENANT,
			organizationId,
			origin,
			allowPersonSignIn
		});
	}
}

describe('EmbedSiteGrantService on SQLite', () => {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	const file = path.join(os.tmpdir(), `gauzy-embed-site-grant-${process.pid}-${Date.now()}.sqlite3`);
	let dataSource: DataSource;
	let service: EmbedSiteGrantService;
	let requestContext: typeof import('../core/context/request-context').RequestContext;
	/** What the mint is handed, and the token it answers: the claims it writes have their own spec. */
	const issueEmbedSession = jest.fn(
		async (input: { employeeId: string; grantId?: string }) => `timer-token-${input.employeeId}`
	);

	beforeAll(async () => {
		process.env.DB_ORM = 'typeorm';
		process.env.DB_TYPE = 'better-sqlite3';
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../core/entities') as typeof import('../core/entities');
			const typeorm = require('typeorm') as typeof import('typeorm');
			const entities = require('../core/entities/internal') as typeof import('../core/entities/internal');
			requestContext = (
				require('../core/context/request-context') as typeof import('../core/context/request-context')
			).RequestContext;
			const { TypeOrmEmployeeRepository } =
				require('../employee/repository/type-orm-employee.repository') as typeof import('../employee/repository/type-orm-employee.repository');
			const { TypeOrmUserOrganizationRepository } =
				require('../user-organization/repository/type-orm-user-organization.repository') as typeof import('../user-organization/repository/type-orm-user-organization.repository');
			const { TypeOrmEmbedAllowedOriginRepository } =
				require('./repository/type-orm-embed-allowed-origin.repository') as typeof import('./repository/type-orm-embed-allowed-origin.repository');
			const { TypeOrmEmbedSiteGrantRepository } =
				require('./repository/type-orm-embed-site-grant.repository') as typeof import('./repository/type-orm-embed-site-grant.repository');
			const { EmbedAllowedOriginService } =
				require('./embed-allowed-origin.service') as typeof import('./embed-allowed-origin.service');
			const grants = require('./embed-site-grant.service') as typeof import('./embed-site-grant.service');

			dataSource = new typeorm.DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true,
				// As the application configures it (TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR)
				invalidWhereValuesBehavior: { null: 'sql-null', undefined: 'ignore' }
			});
			await dataSource.initialize();
			const { serializeEmbeddedTransactions } =
				require('../database/embedded-transaction-queue') as typeof import('../database/embedded-transaction-queue');
			serializeEmbeddedTransactions(dataSource);
			await seed(dataSource);

			const allowedOrigins = new EmbedAllowedOriginService(
				new TypeOrmEmbedAllowedOriginRepository(dataSource.getRepository(entities.EmbedAllowedOrigin)),
				{} as never
			);
			service = new grants.EmbedSiteGrantService(
				new TypeOrmEmbedSiteGrantRepository(dataSource.getRepository(entities.EmbedSiteGrant)),
				new TypeOrmEmployeeRepository(dataSource.getRepository(entities.Employee)),
				{} as never,
				new TypeOrmUserOrganizationRepository(dataSource.getRepository(entities.UserOrganization)),
				{} as never,
				{ issueEmbedSession } as never,
				allowedOrigins
			);
		});
	}, TIMEOUT);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(file, { force: true });
		process.env.DB_ORM = previous.DB_ORM;
		process.env.DB_TYPE = previous.DB_TYPE;
	});

	beforeEach(() => {
		issueEmbedSession.mockClear();
	});

	afterEach(() => jest.restoreAllMocks());

	/** The request of a person signed in to the web app with their own session. */
	const signedInAs = (name: keyof typeof PEOPLE, token = sign({ id: PEOPLE[name].userId }, 'any-secret')) => {
		jest.spyOn(requestContext, 'currentUserId').mockReturnValue(PEOPLE[name].userId);
		jest.spyOn(requestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(requestContext, 'currentOAuthAppScopes').mockReturnValue(null);
		jest.spyOn(requestContext, 'currentToken').mockReturnValue(token);
	};

	const grantRows = async () =>
		(await dataSource.query(`SELECT * FROM "embed_site_grant"`)) as Array<Record<string, unknown>>;

	const authorizeAs = async (name: keyof typeof PEOPLE, origin: string, organizationId = ORGANIZATION) => {
		signedInAs(name);
		return await service.authorize({ organizationId, origin });
	};

	describe('POST /embed/authorize', () => {
		it(
			"answers a timer token for the person's member, bound to the site and the grant, and a renewal token stored as its digest only",
			async () => {
				const before = Date.now();

				const answer = await authorizeAs('lina', 'https://Team.Northwind.example/');

				expect(answer.token).toBe(`timer-token-${PEOPLE.lina.employeeId}`);
				expect(answer.renewalToken).toMatch(/^gzr_[A-Za-z0-9_-]{43}$/);
				const timerLife = Date.parse(answer.expiresAt) - before;
				expect(timerLife).toBeGreaterThanOrEqual(15 * 60 * 1000 - 1000);
				expect(timerLife).toBeLessThanOrEqual(15 * 60 * 1000 + 5000);
				const renewalLife = Date.parse(answer.renewalExpiresAt) - before;
				expect(Math.round(renewalLife / (24 * 60 * 60 * 1000))).toBe(30);

				const rows = await grantRows();
				expect(rows).toHaveLength(1);
				const [row] = rows;
				expect(row).toMatchObject({
					tenantId: TENANT,
					organizationId: ORGANIZATION,
					userId: PEOPLE.lina.userId,
					employeeId: PEOPLE.lina.employeeId,
					origin: TEAM_PAGE,
					keyHash: createHash('sha256').update(answer.renewalToken).digest('hex'),
					usedAt: null,
					revokedAt: null
				});
				const secret = answer.renewalToken.slice(4);
				expect(Object.values(row).some((value) => String(value).includes(secret))).toBe(false);

				expect(issueEmbedSession).toHaveBeenCalledTimes(1);
				expect(issueEmbedSession.mock.calls[0][0]).toMatchObject({
					userId: PEOPLE.lina.userId,
					tenantId: TENANT,
					organizationId: ORGANIZATION,
					employeeId: PEOPLE.lina.employeeId,
					origin: TEAM_PAGE,
					credentialId: row.familyId,
					grantId: row.familyId
				});
			},
			TIMEOUT
		);

		it('starts a sign-in of its own at each authorization, so two devices of one person keep theirs', async () => {
			await dataSource.query(`DELETE FROM "embed_site_grant"`);

			const laptop = await authorizeAs('lina', TEAM_PAGE);
			const phone = await authorizeAs('lina', TEAM_PAGE);

			const rows = await grantRows();
			expect(rows).toHaveLength(2);
			expect(new Set(rows.map((row) => row.familyId)).size).toBe(2);
			expect(laptop.renewalToken).not.toBe(phone.renewalToken);
		});

		it('refuses a site the organization does not allow with EMBED_ORIGIN_NOT_ALLOWED, and writes nothing', async () => {
			await dataSource.query(`DELETE FROM "embed_site_grant"`);

			for (const origin of [
				'https://evil.example',
				SISTER_PAGE,
				'https://team.northwind.example/timer',
				'null'
			]) {
				await expect(authorizeAs('lina', origin)).rejects.toMatchObject({
					status: 403,
					response: {
						code: 'EMBED_ORIGIN_NOT_ALLOWED',
						message: expect.stringContaining('Ask an administrator')
					}
				});
			}

			expect(issueEmbedSession).not.toHaveBeenCalled();
			expect(await grantRows()).toEqual([]);
		});

		it('refuses a site the organization allows without sign-in with EMBED_SITE_SIGN_IN_OFF, and writes nothing', async () => {
			await dataSource.query(`DELETE FROM "embed_site_grant"`);

			await expect(authorizeAs('lina', DOCS)).rejects.toMatchObject({
				status: 403,
				response: { code: 'EMBED_SITE_SIGN_IN_OFF', message: expect.stringContaining('turn sign-in on') }
			});

			expect(issueEmbedSession).not.toHaveBeenCalled();
			expect(await grantRows()).toEqual([]);
		});

		it('refuses with EMBED_MEMBER_NOT_ALLOWED anyone but an active member who may track time, whatever the site', async () => {
			await dataSource.query(`DELETE FROM "embed_site_grant"`);

			// Tracking off, an archived employee, an ended membership, a member of the sister organization only.
			for (const name of ['omar', 'ines', 'yuki', 'sam'] as const) {
				for (const origin of [TEAM_PAGE, 'https://evil.example']) {
					await expect(authorizeAs(name, origin)).rejects.toMatchObject({
						status: 403,
						response: { code: 'EMBED_MEMBER_NOT_ALLOWED' }
					});
				}
			}

			expect(issueEmbedSession).not.toHaveBeenCalled();
			expect(await grantRows()).toEqual([]);
		});

		it("refuses a third-party application's token and an API token's session: allowing a site is the person's own act", async () => {
			await dataSource.query(`DELETE FROM "embed_site_grant"`);

			signedInAs('lina');
			jest.spyOn(requestContext, 'currentOAuthAppScopes').mockReturnValue(['timesheet:write']);
			await expect(service.authorize({ organizationId: ORGANIZATION, origin: TEAM_PAGE })).rejects.toMatchObject({
				status: 403
			});

			signedInAs(
				'lina',
				sign({ id: PEOPLE.lina.userId, apiTokenId: '7e000000-0000-4000-8000-0000000000b1' }, 'any-secret')
			);
			await expect(service.authorize({ organizationId: ORGANIZATION, origin: TEAM_PAGE })).rejects.toMatchObject({
				status: 403
			});

			expect(issueEmbedSession).not.toHaveBeenCalled();
			expect(await grantRows()).toEqual([]);
		});
	});

	describe('POST /embed/renew', () => {
		const renewFrom = (origin: string | undefined, renewalToken: unknown) =>
			service.renew({ renewalToken } as never, origin);

		const familyOf = async (renewalToken: string) => {
			const keyHash = createHash('sha256').update(renewalToken).digest('hex');
			const [row] = await dataSource.query(`SELECT * FROM "embed_site_grant" WHERE "keyHash" = ?`, [keyHash]);
			return row.familyId as string;
		};

		const rowsOf = async (familyId: string) =>
			(await dataSource.query(
				`SELECT * FROM "embed_site_grant" WHERE "familyId" = ? ORDER BY "createdAt", "usedAt" DESC`,
				[familyId]
			)) as Array<Record<string, unknown>>;

		const ended = {
			status: 401,
			response: { code: 'EMBED_GRANT_ENDED', message: expect.stringContaining('Sign in again') }
		};

		it(
			"gives the next pair from the site's own origin, spends the token, and keeps the sign-in",
			async () => {
				const first = await authorizeAs('lina', TEAM_PAGE);
				const familyId = await familyOf(first.renewalToken);
				issueEmbedSession.mockClear();
				const before = Date.now();

				const next = await renewFrom('https://team.northwind.example', first.renewalToken);

				expect(next.token).toBe(`timer-token-${PEOPLE.lina.employeeId}`);
				expect(next.renewalToken).toMatch(/^gzr_/);
				expect(next.renewalToken).not.toBe(first.renewalToken);
				expect(Math.round((Date.parse(next.renewalExpiresAt) - before) / (24 * 60 * 60 * 1000))).toBe(30);
				expect(issueEmbedSession.mock.calls[0][0]).toMatchObject({
					employeeId: PEOPLE.lina.employeeId,
					origin: TEAM_PAGE,
					credentialId: familyId,
					grantId: familyId
				});
				const rows = await rowsOf(familyId);
				expect(rows).toHaveLength(2);
				const spent = rows.find((row) => row.usedAt !== null);
				const live = rows.find((row) => row.usedAt === null);
				expect(spent.revokedAt).toBeNull();
				expect(live).toMatchObject({
					revokedAt: null,
					keyHash: createHash('sha256').update(next.renewalToken).digest('hex')
				});

				await expect(renewFrom(TEAM_PAGE, next.renewalToken)).resolves.toMatchObject({
					token: expect.any(String)
				});
			},
			TIMEOUT
		);

		it('refuses another site, or a request that names none, with EMBED_ORIGIN, and the token keeps working from its own', async () => {
			const { renewalToken } = await authorizeAs('lina', TEAM_PAGE);
			const familyId = await familyOf(renewalToken);
			issueEmbedSession.mockClear();

			for (const origin of ['https://evil.example', DOCS, undefined, 'null']) {
				await expect(renewFrom(origin, renewalToken)).rejects.toMatchObject({
					status: 403,
					response: { code: 'EMBED_ORIGIN' }
				});
			}
			expect(issueEmbedSession).not.toHaveBeenCalled();
			expect(await rowsOf(familyId)).toEqual([expect.objectContaining({ usedAt: null, revokedAt: null })]);

			await expect(renewFrom(TEAM_PAGE, renewalToken)).resolves.toMatchObject({ token: expect.any(String) });
		});

		it('revokes the whole sign-in when a used renewal token is presented again', async () => {
			const first = await authorizeAs('lina', TEAM_PAGE);
			const familyId = await familyOf(first.renewalToken);
			const second = await renewFrom(TEAM_PAGE, first.renewalToken);

			await expect(renewFrom(TEAM_PAGE, first.renewalToken)).rejects.toMatchObject(ended);

			// The token the last renewal gave is refused too: one of its two holders is not the site.
			await expect(renewFrom(TEAM_PAGE, second.renewalToken)).rejects.toMatchObject(ended);
			const rows = await rowsOf(familyId);
			expect(rows).toHaveLength(2);
			expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
		});

		it('gives one of two renewals of the same token at once the pair, and revokes the sign-in for the other', async () => {
			const { renewalToken } = await authorizeAs('lina', TEAM_PAGE);
			const familyId = await familyOf(renewalToken);

			const answers = await Promise.allSettled([
				renewFrom(TEAM_PAGE, renewalToken),
				renewFrom(TEAM_PAGE, renewalToken)
			]);

			expect(answers.filter((answer) => answer.status === 'fulfilled')).toHaveLength(1);
			const refused = answers.find((answer) => answer.status === 'rejected') as PromiseRejectedResult;
			expect(refused.reason).toMatchObject(ended);
			const rows = await rowsOf(familyId);
			expect(rows).toHaveLength(2);
			expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
		});

		it('answers one 401 EMBED_GRANT_ENDED to a malformed, unknown, revoked or expired token, and revokes nothing', async () => {
			const { renewalToken } = await authorizeAs('lina', TEAM_PAGE);
			const familyId = await familyOf(renewalToken);
			await dataSource.query(`UPDATE "embed_site_grant" SET "expiresAt" = ? WHERE "familyId" = ?`, [
				'2026-01-01 00:00:00.000',
				familyId
			]);
			const other = await authorizeAs('lina', TEAM_PAGE);
			const otherFamily = await familyOf(other.renewalToken);
			await dataSource.query(`UPDATE "embed_site_grant" SET "revokedAt" = ? WHERE "familyId" = ?`, [
				'2026-11-19 09:00:00.000',
				otherFamily
			]);
			issueEmbedSession.mockClear();

			const unknown = `gzr_${'A'.repeat(43)}`;
			for (const presented of [renewalToken, other.renewalToken, unknown, 'gze_x', '', undefined, 42]) {
				await expect(renewFrom(TEAM_PAGE, presented)).rejects.toMatchObject(ended);
			}

			expect(issueEmbedSession).not.toHaveBeenCalled();
			expect(await rowsOf(familyId)).toEqual([expect.objectContaining({ usedAt: null, revokedAt: null })]);
		});

		it('refuses while the site is no longer allowed or has sign-in off, and renews again once an admin allows it', async () => {
			const { renewalToken } = await authorizeAs('lina', TEAM_PAGE);
			const setSignIn = (value: number) =>
				dataSource.query(`UPDATE "embed_allowed_origin" SET "allowPersonSignIn" = ? WHERE "origin" = ?`, [
					value,
					TEAM_PAGE
				]);

			await setSignIn(0);
			await expect(renewFrom(TEAM_PAGE, renewalToken)).rejects.toMatchObject({
				status: 403,
				response: { code: 'EMBED_SITE_SIGN_IN_OFF' }
			});
			await setSignIn(1);

			const [site] = await dataSource.query(`SELECT * FROM "embed_allowed_origin" WHERE "origin" = ?`, [
				TEAM_PAGE
			]);
			await dataSource.query(`DELETE FROM "embed_allowed_origin" WHERE "id" = ?`, [site.id]);
			await expect(renewFrom(TEAM_PAGE, renewalToken)).rejects.toMatchObject({
				status: 403,
				response: { code: 'EMBED_ORIGIN_NOT_ALLOWED' }
			});
			await insert(dataSource, 'embed_allowed_origin', { ...site });

			await expect(renewFrom(TEAM_PAGE, renewalToken)).resolves.toMatchObject({ token: expect.any(String) });
		});

		it('writes no renewal token, nor its digest, in a log line', async () => {
			const logger = (service as unknown as { logger: Record<string, (...args: unknown[]) => void> }).logger;
			const lines: string[] = [];
			for (const level of ['log', 'warn', 'error']) {
				jest.spyOn(logger, level).mockImplementation((...args: unknown[]) => {
					lines.push(args.map(String).join(' '));
				});
			}

			const first = await authorizeAs('lina', TEAM_PAGE);
			const second = await renewFrom(TEAM_PAGE, first.renewalToken);
			await expect(renewFrom('https://evil.example', second.renewalToken)).rejects.toMatchObject({ status: 403 });
			await expect(renewFrom(TEAM_PAGE, first.renewalToken)).rejects.toMatchObject(ended);

			expect(lines.length).toBeGreaterThanOrEqual(4);
			const text = lines.join('\n');
			for (const token of [first.renewalToken, second.renewalToken]) {
				expect(text).not.toContain(token.slice(4));
				expect(text).not.toContain(createHash('sha256').update(token).digest('hex'));
			}
		});

		it('refuses a person who may no longer track time with EMBED_MEMBER_NOT_ALLOWED, and renews once they may again', async () => {
			const { renewalToken } = await authorizeAs('lina', TEAM_PAGE);
			const setTracking = (value: number) =>
				dataSource.query(`UPDATE "employee" SET "isTrackingEnabled" = ? WHERE "id" = ?`, [
					value,
					PEOPLE.lina.employeeId
				]);

			await setTracking(0);
			await expect(renewFrom(TEAM_PAGE, renewalToken)).rejects.toMatchObject({
				status: 403,
				response: { code: 'EMBED_MEMBER_NOT_ALLOWED' }
			});
			await setTracking(1);

			await expect(renewFrom(TEAM_PAGE, renewalToken)).resolves.toMatchObject({ token: expect.any(String) });
		});
	});
});
