// Must stay first: loads the entity graph before the services pull an entity (see user.create.handler.spec.ts).
import '../../core/entities/internal';

import { BadRequestException, ForbiddenException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { UserApiTokenExpiryEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { UserApiTokenResponseDTO, UserApiTokenWithSecretResponseDTO } from './dto/user-api-token.dto';
import { USER_API_TOKEN_CLAIM } from './user-api-token-session';
import { UserApiTokenService } from './user-api-token.service';
import { hashUserApiToken, MAX_ACTIVE_USER_API_TOKENS, USER_API_TOKEN_SESSION_TTL_MS } from './user-api-token.utils';

const TENANT_A = '7a000000-0000-4000-8000-00000000000a';
const TENANT_B = '7a000000-0000-4000-8000-00000000000b';
const USER_1 = '7a000000-0000-4000-8000-000000000001';
const USER_2 = '7a000000-0000-4000-8000-000000000002';
const ORG = '7a000000-0000-4000-8000-0000000000f1';

/** Equality on every key of a `where`; a FindOperator is read as the `IS NULL` these queries use it for. */
const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
	Object.entries(where).every(([key, value]) =>
		value && typeof value === 'object' && (value as any)['@instanceof'] ? row[key] === null || row[key] === undefined : row[key] === value
	);

/**
 * The service with an in-memory table behind its dual-ORM base class, under the TypeORM branch. The tenant scoping of
 * `TenantAwareCrudService` is applied by this double the way the real one applies it, from `RequestContext`.
 */
function build() {
	const rows: any[] = [];
	const scoped = (where: Record<string, unknown>) => {
		const tenantId = RequestContext.currentTenantId();
		return rows.filter((row) => matches(row, where) && (!tenantId || row.tenantId === tenantId));
	};
	const issueUserApiTokenSession = jest.fn(async (_input: any) => 'an-access-token');
	const typeOrmUpdate = jest.fn(async (criteria: any, patch: any) => {
		rows.filter((row) => matches(row, criteria)).forEach((row) => Object.assign(row, patch));
		return { affected: 1 };
	});
	const service = new UserApiTokenService(
		{
			metadata: { hasColumnWithPropertyPath: () => true, tableName: 'user_api_token' },
			findOne: jest.fn(async ({ where }) => rows.find((row) => matches(row, where)) ?? null),
			update: typeOrmUpdate
		} as any,
		{} as any,
		{ issueUserApiTokenSession } as any
	);
	jest.spyOn(service, 'ormType', 'get').mockReturnValue('typeorm' as any);
	jest.spyOn(service, 'find').mockImplementation(async (options: any) => scoped(options.where) as any);
	jest.spyOn(service, 'create').mockImplementation(async (input: any) => {
		const row = { id: `row-${rows.length + 1}`, createdAt: new Date(), ...input };
		rows.push(row);
		return row;
	});
	jest.spyOn(service, 'update').mockImplementation(async (criteria: any, patch: any) => {
		scoped(criteria).forEach((row) => Object.assign(row, patch));
		return { affected: 1 } as any;
	});
	return { service, rows, issueUserApiTokenSession, typeOrmUpdate };
}

/** Signs in as a user of a tenant, with an ordinary session token. */
const signIn = (userId: string, tenantId: string, claims: Record<string, unknown> = {}) => {
	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(userId);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenantId);
	jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(null);
	jest.spyOn(RequestContext, 'currentToken').mockReturnValue(sign({ id: userId, tenantId, ...claims }, 'test-secret'));
};

/** The public exchange route: nobody is signed in. */
const signOut = () => {
	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(null);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
	jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(null);
	jest.spyOn(RequestContext, 'currentToken').mockReturnValue(null);
};

afterEach(() => {
	jest.restoreAllMocks();
});

describe('UserApiTokenService', () => {
	describe('creating a token', () => {
		it('returns the plain token once and stores only its hash', async () => {
			const { service, rows } = build();
			signIn(USER_1, TENANT_A);

			const created = await service.createOwn({ name: 'Agent', expiry: UserApiTokenExpiryEnum.DAYS_90 });

			expect(created.token).toMatch(/^gzp_[A-Za-z0-9_-]{43}$/);
			expect(rows).toHaveLength(1);
			expect(rows[0].tokenHash).toBe(hashUserApiToken(created.token));
			expect(rows[0].prefix).toBe(created.token.slice(0, 12));
			// The plain value appears nowhere on the stored row.
			expect(JSON.stringify(rows[0])).not.toContain(created.token);

			// Nothing but the answer of the create carries it, and no answer carries the hash.
			expect(created).toBeInstanceOf(UserApiTokenWithSecretResponseDTO);
			expect(JSON.stringify(created)).not.toContain(rows[0].tokenHash);
			const { items } = await service.listOwn();
			expect(JSON.stringify(items)).not.toContain(created.token);
			expect(JSON.stringify(items)).not.toContain(rows[0].tokenHash);
			expect(items[0]).toBeInstanceOf(UserApiTokenResponseDTO);
			expect(service.find).toHaveBeenLastCalledWith(
				expect.objectContaining({ order: { createdAt: 'DESC' }, take: 100 })
			);
		});

		it('generates a different token every time', async () => {
			const { service } = build();
			signIn(USER_1, TENANT_A);

			const first = await service.createOwn({ name: 'One', expiry: UserApiTokenExpiryEnum.NEVER });
			const second = await service.createOwn({ name: 'Two', expiry: UserApiTokenExpiryEnum.NEVER });

			expect(first.token).not.toBe(second.token);
		});

		it.each([
			[UserApiTokenExpiryEnum.DAYS_90, 90],
			[UserApiTokenExpiryEnum.YEAR_1, 365]
		])('%s sets the expiry', async (expiry, days) => {
			const { service, rows } = build();
			signIn(USER_1, TENANT_A);

			await service.createOwn({ name: 'Agent', expiry });

			const expected = Date.now() + days * 24 * 60 * 60 * 1000;
			expect(Math.abs(rows[0].expiresAt.getTime() - expected)).toBeLessThan(5000);
		});

		it('"never" stores no expiry', async () => {
			const { service, rows } = build();
			signIn(USER_1, TENANT_A);

			await service.createOwn({ name: 'Agent', expiry: UserApiTokenExpiryEnum.NEVER });

			expect(rows[0].expiresAt).toBeNull();
		});

		it('takes the owner and the tenant from the session, never from the input', async () => {
			const { service, rows } = build();
			signIn(USER_1, TENANT_A);

			await service.createOwn({
				name: 'Agent',
				expiry: UserApiTokenExpiryEnum.NEVER,
				userId: USER_2,
				tenantId: TENANT_B
			} as any);

			expect(rows[0]).toMatchObject({ userId: USER_1, tenantId: TENANT_A });
		});

		it('refuses a token beyond the limit; revoked and expired tokens do not count', async () => {
			const { service, rows } = build();
			signIn(USER_1, TENANT_A);

			for (let i = 0; i < MAX_ACTIVE_USER_API_TOKENS; i++) {
				await service.createOwn({ name: `T${i}`, expiry: UserApiTokenExpiryEnum.NEVER });
			}
			await expect(service.createOwn({ name: 'Over', expiry: UserApiTokenExpiryEnum.NEVER })).rejects.toThrow(
				BadRequestException
			);

			// Another user is not held to this user's count.
			signIn(USER_2, TENANT_A);
			await expect(service.createOwn({ name: 'Theirs', expiry: UserApiTokenExpiryEnum.NEVER })).resolves.toBeDefined();
			signIn(USER_1, TENANT_A);

			rows.find((row) => row.name === 'T0').revokedAt = new Date();
			rows.find((row) => row.name === 'T1').expiresAt = new Date(Date.now() - 1000);
			await expect(service.createOwn({ name: 'Fits', expiry: UserApiTokenExpiryEnum.NEVER })).resolves.toBeDefined();
			await expect(service.createOwn({ name: 'Fits too', expiry: UserApiTokenExpiryEnum.NEVER })).resolves.toBeDefined();
			await expect(service.createOwn({ name: 'Over', expiry: UserApiTokenExpiryEnum.NEVER })).rejects.toThrow(
				BadRequestException
			);
		});

		it('holds the limit against creates in parallel: one that finds too many takes its row back and shows nothing', async () => {
			const { service, rows } = build();
			signIn(USER_1, TENANT_A);

			for (let i = 0; i < MAX_ACTIVE_USER_API_TOKENS - 1; i++) {
				await service.createOwn({ name: `T${i}`, expiry: UserApiTokenExpiryEnum.NEVER });
			}
			// Another create lands between this one's check and its insert.
			const create = service.create as jest.Mock;
			const insert = create.getMockImplementation();
			create.mockImplementationOnce(async (input: any) => {
				await insert({ ...input, name: 'The other one', tokenHash: 'the-other-hash' });
				return insert(input);
			});

			const caught = await service
				.createOwn({ name: 'This one', expiry: UserApiTokenExpiryEnum.NEVER })
				.catch((error) => error);

			expect(caught).toBeInstanceOf(BadRequestException);
			expect(rows.find((row) => row.name === 'This one').revokedAt).toBeInstanceOf(Date);
			expect(rows.filter((row) => !row.revokedAt)).toHaveLength(MAX_ACTIVE_USER_API_TOKENS);
		});

		it('cannot be done from a session that came from an API token', async () => {
			const { service, rows } = build();
			signIn(USER_1, TENANT_A, { [USER_API_TOKEN_CLAIM]: 'row-1' });

			await expect(service.createOwn({ name: 'Copy', expiry: UserApiTokenExpiryEnum.NEVER })).rejects.toThrow(
				ForbiddenException
			);
			expect(rows).toHaveLength(0);
		});

		it('cannot be done with a third-party OAuth-app token', async () => {
			const { service, rows } = build();
			signIn(USER_1, TENANT_A);
			jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(['zap', 'zap:write']);

			await expect(service.createOwn({ name: 'Copy', expiry: UserApiTokenExpiryEnum.NEVER })).rejects.toThrow(
				ForbiddenException
			);
			expect(rows).toHaveLength(0);
		});
	});

	describe('one person never reaches another person’s tokens', () => {
		/** USER_1 of tenant A holds one token; the same-looking USER_2 and a user of tenant B hold none. */
		const withToken = async () => {
			const built = build();
			signIn(USER_1, TENANT_A);
			const created = await built.service.createOwn({ name: 'Mine', expiry: UserApiTokenExpiryEnum.NEVER });
			return { ...built, created };
		};

		it.each([
			['another user of the same tenant', USER_2, TENANT_A],
			['a user of another tenant', USER_2, TENANT_B],
			['the same user id under another tenant', USER_1, TENANT_B]
		])('%s does not see it', async (_who, userId, tenantId) => {
			const { service } = await withToken();

			signIn(userId, tenantId);

			await expect(service.listOwn()).resolves.toEqual({ items: [], total: 0 });
		});

		it.each([
			['another user of the same tenant', USER_2, TENANT_A],
			['a user of another tenant', USER_2, TENANT_B],
			['the same user id under another tenant', USER_1, TENANT_B]
		])('%s cannot revoke it', async (_who, userId, tenantId) => {
			const { service, rows, created } = await withToken();

			signIn(userId, tenantId);

			await expect(service.revokeOwn(created.id)).rejects.toThrow(NotFoundException);
			expect(rows[0].revokedAt).toBeNull();
		});

		it('the owner does see it and can revoke it, once', async () => {
			const { service, rows, created } = await withToken();

			expect((await service.listOwn()).items.map((item) => item.id)).toEqual([created.id]);

			await service.revokeOwn(created.id);
			expect(rows[0].revokedAt).toBeInstanceOf(Date);
			// A revoked token leaves the list, and revoking it again finds nothing.
			await expect(service.listOwn()).resolves.toEqual({ items: [], total: 0 });
			await expect(service.revokeOwn(created.id)).rejects.toThrow(NotFoundException);
		});

		it('a session that came from an API token neither lists nor revokes', async () => {
			const { service, rows, created } = await withToken();

			signIn(USER_1, TENANT_A, { [USER_API_TOKEN_CLAIM]: created.id });

			await expect(service.listOwn()).rejects.toThrow(ForbiddenException);
			await expect(service.revokeOwn(created.id)).rejects.toThrow(ForbiddenException);
			expect(rows[0].revokedAt).toBeNull();
		});
	});

	describe('exchanging a token', () => {
		const withToken = async (expiry = UserApiTokenExpiryEnum.NEVER) => {
			const built = build();
			signIn(USER_1, TENANT_A);
			const created = await built.service.createOwn({ name: 'Mine', expiry });
			signOut();
			return { ...built, created };
		};

		it('mints for the owner and the tenant of the row, with a session lifetime', async () => {
			const { service, issueUserApiTokenSession, created } = await withToken();

			await expect(service.exchange({ token: created.token })).resolves.toEqual({ token: 'an-access-token' });

			const [input] = issueUserApiTokenSession.mock.calls[0];
			expect(input).toMatchObject({ userId: USER_1, tenantId: TENANT_A, apiTokenId: created.id });
			expect(input.organizationId).toBeUndefined();
			expect(input.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + USER_API_TOKEN_SESSION_TTL_MS);
			expect(input.expiresAt.getTime()).toBeGreaterThan(Date.now() + USER_API_TOKEN_SESSION_TTL_MS - 5000);
		});

		it('passes the organization asked for on to the mint, which judges it', async () => {
			const { service, issueUserApiTokenSession, created } = await withToken();

			await service.exchange({ token: created.token, organizationId: ORG });

			expect(issueUserApiTokenSession.mock.calls[0][0].organizationId).toBe(ORG);
		});

		it('never lets the session outlive the API token', async () => {
			const { service, rows, issueUserApiTokenSession, created } = await withToken();
			const soon = new Date(Date.now() + 60_000);
			rows[0].expiresAt = soon;

			await service.exchange({ token: created.token });

			expect(issueUserApiTokenSession.mock.calls[0][0].expiresAt).toEqual(soon);
		});

		it('records the use, and does not write again within the minute', async () => {
			const { service, rows, typeOrmUpdate, created } = await withToken();

			await service.exchange({ token: created.token });
			expect(rows[0].lastUsedAt).toBeInstanceOf(Date);
			expect(typeOrmUpdate).toHaveBeenCalledTimes(1);

			await service.exchange({ token: created.token });
			expect(typeOrmUpdate).toHaveBeenCalledTimes(1);

			rows[0].lastUsedAt = new Date(Date.now() - 2 * 60_000);
			await service.exchange({ token: created.token });
			expect(typeOrmUpdate).toHaveBeenCalledTimes(2);
		});

		it('still answers when the use could not be recorded', async () => {
			const { service, typeOrmUpdate, created } = await withToken();
			typeOrmUpdate.mockRejectedValueOnce(new Error('deadlock'));

			await expect(service.exchange({ token: created.token })).resolves.toEqual({ token: 'an-access-token' });
		});

		it('logs neither the token nor its hash', async () => {
			const { service, rows, created } = await withToken();
			const logged: string[] = [];
			for (const level of ['log', 'warn', 'error'] as const) {
				jest.spyOn((service as any).logger, level).mockImplementation((message: any) => {
					logged.push(String(message));
				});
			}

			await service.exchange({ token: created.token });
			rows[0].revokedAt = new Date();
			await expect(service.exchange({ token: created.token })).rejects.toThrow(UnauthorizedException);
			await expect(service.exchange({ token: `gzp_${'A'.repeat(43)}` })).rejects.toThrow(UnauthorizedException);

			expect(logged.length).toBeGreaterThan(0);
			const all = logged.join('\n');
			expect(all).not.toContain(created.token);
			expect(all).not.toContain(rows[0].tokenHash);
			expect(all).not.toContain(rows[0].prefix);
		});

		describe('refuses with the same answer, and does not mint', () => {
			const refusals: [string, (context: Awaited<ReturnType<typeof withToken>>) => any][] = [
				['no token at all', () => ({})],
				['a null token', () => ({ token: null })],
				['a token that is not a string', () => ({ token: { $ne: '' } })],
				['an array', () => ({ token: ['gzp_x'] })],
				['an empty token', () => ({ token: '' })],
				['a token of the wrong shape', () => ({ token: 'gzp_short' })],
				['a token without the prefix', ({ created }) => ({ token: created.token.slice(4) })],
				['a token with something after it', ({ created }) => ({ token: `${created.token}x` })],
				['a token of the right shape that does not exist', () => ({ token: `gzp_${'A'.repeat(43)}` })],
				['the stored hash presented as a token', ({ rows }) => ({ token: rows[0].tokenHash })],
				['an organization that is not an id', ({ created }) => ({ token: created.token, organizationId: "' OR 1=1" })],
				[
					'a revoked token',
					({ rows, created }) => {
						rows[0].revokedAt = new Date();
						return { token: created.token };
					}
				],
				[
					'an expired token',
					({ rows, created }) => {
						rows[0].expiresAt = new Date(Date.now() - 1000);
						return { token: created.token };
					}
				],
				[
					'a token expiring this instant',
					({ rows, created }) => {
						rows[0].expiresAt = new Date();
						return { token: created.token };
					}
				],
				[
					'a row without a tenant',
					({ rows, created }) => {
						rows[0].tenantId = null;
						return { token: created.token };
					}
				]
			];

			it.each(refusals)('%s', async (_name, arrange) => {
				const context = await withToken();
				const input = arrange(context);

				const caught = await context.service.exchange(input).catch((error) => error);

				expect(caught).toBeInstanceOf(UnauthorizedException);
				expect(caught.getResponse()).toEqual(new UnauthorizedException().getResponse());
				expect(context.issueUserApiTokenSession).not.toHaveBeenCalled();
			});

			it('an owner the mint refuses (inactive, archived, deleted, ended) answers the same', async () => {
				const context = await withToken();
				// `AuthService.issueUserApiTokenSession` is what judges those; its own cases are in the spec beside it.
				context.issueUserApiTokenSession.mockRejectedValueOnce(new UnauthorizedException('a private reason'));

				const caught = await context.service.exchange({ token: context.created.token }).catch((error) => error);

				expect(caught).toBeInstanceOf(UnauthorizedException);
				expect(caught.getResponse()).toEqual(new UnauthorizedException().getResponse());
			});

			it('an unexpected failure answers the same and does not record a use', async () => {
				const context = await withToken();
				context.issueUserApiTokenSession.mockRejectedValueOnce(new Error('jwt secret missing'));

				const caught = await context.service.exchange({ token: context.created.token }).catch((error) => error);

				expect(caught).toBeInstanceOf(UnauthorizedException);
				expect(caught.getResponse()).toEqual(new UnauthorizedException().getResponse());
				expect(context.rows[0].lastUsedAt).toBeNull();
			});
		});

		it('answers 503, not 401, when the database cannot be reached: the token was not judged', async () => {
			const { service, created } = await withToken();
			jest
				.spyOn(service as any, 'findByHash')
				.mockRejectedValueOnce(Object.assign(new Error('terminating connection'), { code: '57P01' }));

			await expect(service.exchange({ token: created.token })).rejects.toThrow(ServiceUnavailableException);
		});

		it('takes the tenant from the row even when the request names another', async () => {
			const { service, issueUserApiTokenSession, created } = await withToken();
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_B);

			await service.exchange({ token: created.token });

			expect(issueUserApiTokenSession.mock.calls[0][0].tenantId).toBe(TENANT_A);
		});
	});
});
