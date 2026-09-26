import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * A stored token is validated and revoked on MikroORM, and answers what it answers on TypeORM.
 *
 * **The defect.** The validation and revocation handlers ask the token they read for its rules — `isUsable`,
 * `isActivated`, `isExpired`, `isInactive`, `isAtUsageLimit`, `canRevoke` — which `IToken` declares and `Token`
 * implements. `TokenRepository` reads through the CRUD base, and on MikroORM that answers `wrap(entity).toJSON()` —
 * the row's data as a plain object, without the entity's prototype — so every validation failed with
 * `tokenRecord.isUsable is not a function` (the refresh-token strategy, the refresh that rotates a token, the
 * access-token check) and every revocation with `token.canRevoke is not a function` (logout, which only logs it,
 * so the session's tokens stayed active). The rules call one another through `this`, so the fix reads the row
 * through a view whose prototype is `Token`'s (`tokenWithRules`).
 *
 * **What is real here.** One better-sqlite3 database whose tables TypeORM created from the platform's own mapping;
 * the core entities imported under `DB_ORM=mikro-orm`, so MikroORM maps `Token` as it does in production, opened
 * with the platform's own `autoJoinRefsForFilters` (`@gauzy/config`); the real `TokenRepository` over each ORM's
 * repository in turn, and the real handlers and config registry over it. Only the JWT service (whose `verify`
 * answers the payload of the token it is handed) and the hasher are stood in for. Each ORM works on tokens of its
 * own, so what one ORM writes cannot decide what the other answers; the outcomes and the rows each left behind
 * are then compared.
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '6e000000-0000-4000-8000-000000000001';
const USER = '6e000000-0000-4000-8000-000000000002';
const TOKEN_TYPE = 'refresh_token';
const DAY = 24 * 60 * 60 * 1000;

/** The token type's rules: an inactivity threshold of a day and a usage cap of five. */
const CONFIG = {
	tokenType: TOKEN_TYPE,
	threshold: DAY,
	maxUsageCount: 5,
	allowRotation: true,
	allowMultipleSessions: true
};

/** The stored tokens each ORM validates or revokes, by what makes each one what it is. */
const KINDS = ['usable', 'expired', 'revoked', 'inactive', 'atLimit', 'toRevoke', 'alreadyRevoked'] as const;
type Kind = (typeof KINDS)[number];

/** What one ORM answered, and left in the store. */
interface IRun {
	/** What validating each token answered, or the message it failed with. */
	validated: Partial<Record<Kind, unknown>>;
	/** What revoking each token answered, or the message it failed with. */
	revoked: Partial<Record<Kind, unknown>>;
	/** Each token's row after the run: the columns the handlers write. */
	stored: Partial<Record<Kind, Record<string, unknown>>>;
	/** Whether the rows `TokenRepository` answered carried the rules of their own. */
	rowsCarryTheRules?: boolean;
	/** For each rule a handler asked for, whether it ran on the very object the repository answered. */
	ruledOnAnsweredRows?: boolean[];
	/** For each rule a handler asked for, whether its receiver had `Token`'s prototype. */
	ruledOnTokens?: boolean[];
}

/** The identifier of one ORM's token of one kind. */
function tokenId(orm: string, kind: Kind): string {
	const index = KINDS.indexOf(kind) + 1;
	return `6e000000-0000-4000-8${orm === 'typeorm' ? '1' : '2'}00-${String(index).padStart(12, '0')}`;
}

async function runThroughBothOrms(): Promise<{ typeorm: IRun; mikroorm: IRun }> {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = 'mikro-orm';

	const database = join(tmpdir(), `token-rules-${process.pid}-${Date.now()}.sqlite`);
	const runs: { typeorm?: IRun; mikroorm?: IRun } = {};

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../core/entities');
			const { DataSource } = require('typeorm');
			const { MikroORM, EntityCaseNamingStrategy } = require('@mikro-orm/core');
			const { BetterSqliteDriver } = require('@mikro-orm/better-sqlite');
			const { SoftDeleteHandler } = require('mikro-orm-soft-delete');
			const { MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS } = require('@gauzy/config');
			const { CrudService } = require('../core/crud/crud.service');
			const { MultiORMEnum } = require('../core/utils');
			const { Token } = require('./entities/token.entity');
			const { TokenStatus } = require('./interfaces');
			const { TokenRepository } = require('./repositories/token.repository');
			const { TypeOrmTokenRepository } = require('./repositories/type-orm/type-orm-token.repository');
			const { MikroOrmTokenRepository } = require('./repositories/micro-orm/micro-orm-token.repository');
			const { TokenConfigRegistry } = require('./token-config.registry');
			const { ValidateTokenHandler } = require('./queries/handlers/validate-token-query.handler');
			const { RevokeTokenHandler } = require('./commands/handlers/revoke-token-command.handler');
			const { ValidateTokenQuery } = require('./queries/validate-token.query');
			const { RevokeTokenCommand } = require('./commands/revoke-token.command');

			// The tables as TypeORM creates them from the platform's mapping.
			const dataSource = new DataSource({
				type: 'better-sqlite3',
				database,
				entities: coreEntities,
				synchronize: true,
				migrationsRun: false,
				logging: false
			});
			await dataSource.initialize();

			const orm = await MikroORM.init({
				driver: BetterSqliteDriver,
				dbName: database,
				entities: coreEntities,
				persistOnCreate: true,
				extensions: [SoftDeleteHandler],
				// Join only what a read populates, as the platform's MikroORM does (see `database-helpers.ts`).
				autoJoinRefsForFilters: MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
				namingStrategy: EntityCaseNamingStrategy,
				allowGlobalContext: true,
				discovery: { warnWhenNoEntities: false }
			});

			try {
				// The user the tokens belong to, and the one a revocation names, are not what this suite is about,
				// so neither ORM's connection is asked to enforce them.
				await dataSource.query('PRAGMA foreign_keys = OFF');
				await orm.em.getConnection().execute('PRAGMA foreign_keys = OFF');

				// Far from now wherever a date decides a rule, so no clock or time zone can move a token across it.
				const now = Date.now();
				const future = new Date('2099-01-01T12:00:00.000Z');
				const past = new Date('2001-01-01T12:00:00.000Z');
				const recently = new Date(now - 60 * 60 * 1000);
				const longAgo = new Date(now - 30 * DAY);

				const rows = (orm: string) => {
					const row = (kind: Kind, members: object) => ({
						id: tokenId(orm, kind),
						userId: USER,
						tokenType: TOKEN_TYPE,
						tokenHash: `hash:${orm}:${kind}`,
						status: TokenStatus.ACTIVE,
						expiresAt: future,
						lastUsedAt: recently,
						usageCount: 0,
						version: 1,
						...members
					});
					return [
						row('usable', {}),
						row('expired', { expiresAt: past }),
						row('revoked', { status: TokenStatus.REVOKED, revokedAt: past, revokedReason: 'Earlier' }),
						row('inactive', { lastUsedAt: longAgo }),
						row('atLimit', { usageCount: CONFIG.maxUsageCount }),
						row('toRevoke', {}),
						row('alreadyRevoked', {
							status: TokenStatus.REVOKED,
							revokedAt: past,
							revokedReason: 'Earlier'
						})
					];
				};
				await dataSource.getRepository(Token).insert([...rows('typeorm'), ...rows('mikro-orm')]);

				const runOn = async (ormType: string): Promise<IRun> => {
					const ormTypeSpy = jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
					const repository = new TokenRepository(
						new TypeOrmTokenRepository(dataSource.getRepository(Token)),
						// A fresh context per ORM, so an answer is the store's rather than an earlier read's.
						new MikroOrmTokenRepository(orm.em.fork(), Token)
					);

					const registry = new TokenConfigRegistry();
					registry.register(CONFIG);
					registry.registerJwtService(TOKEN_TYPE, {
						// A raw token here is `<orm>:<kind>`, and its payload names the stored token it was issued for.
						verify: async (raw: string) => {
							const [, kind] = raw.split(':');
							return { userId: USER, tokenType: TOKEN_TYPE, tokenId: tokenId(ormType, kind as Kind) };
						},
						sign: async () => '',
						decode: () => null
					});
					const hasher = { hashToken: (raw: string) => `hash:${raw}` };
					const validate = new ValidateTokenHandler(registry, repository, repository, hasher);
					const revoke = new RevokeTokenHandler(repository, repository, hasher);

					// What the repository answered, and which objects the rules ran on: the two tell the paths apart.
					const answered: unknown[] = [];
					const findByHash = repository.findByHash.bind(repository);
					jest.spyOn(repository, 'findByHash').mockImplementation(async (hash: string) => {
						const row = await findByHash(hash);
						answered.push(row);
						return row;
					});
					const rules = ['isUsable', 'canRevoke'].map((rule) => jest.spyOn(Token.prototype, rule));

					const outcome = async (work: () => Promise<unknown>) => {
						try {
							return await work();
						} catch (error) {
							return { failed: error instanceof Error ? error.message : String(error) };
						}
					};

					try {
						const validated: IRun['validated'] = {};
						for (const kind of ['usable', 'expired', 'revoked', 'inactive', 'atLimit'] as const) {
							validated[kind] = await outcome(() =>
								validate.execute(
									new ValidateTokenQuery({
										rawToken: `${ormType}:${kind}`,
										tokenType: TOKEN_TYPE,
										checkInactivity: true
									})
								)
							);
						}

						const revoked: IRun['revoked'] = {};
						for (const kind of ['toRevoke', 'alreadyRevoked'] as const) {
							revoked[kind] = await outcome(() =>
								revoke.execute(
									new RevokeTokenCommand({
										rawToken: `${ormType}:${kind}`,
										revokedById: USER,
										reason: 'Logout'
									})
								)
							);
						}

						const contexts = rules.flatMap((rule) => rule.mock.contexts);
						const stored: IRun['stored'] = {};
						for (const kind of KINDS) {
							const [row] = await dataSource.query(
								'SELECT "status", "revokedReason", "revokedById", "usageCount", "version" FROM "tokens" WHERE "id" = ?',
								[tokenId(ormType, kind)]
							);
							stored[kind] = row;
						}

						return {
							validated,
							revoked,
							stored,
							rowsCarryTheRules: answered.every((row: any) => typeof row?.isUsable === 'function'),
							ruledOnAnsweredRows: contexts.map((context) => answered.includes(context)),
							ruledOnTokens: contexts.map((context) => Object.getPrototypeOf(context) === Token.prototype)
						};
					} finally {
						rules.forEach((rule) => rule.mockRestore());
						ormTypeSpy.mockRestore();
					}
				};

				runs.typeorm = await runOn(MultiORMEnum.TypeORM);
				runs.mikroorm = await runOn(MultiORMEnum.MikroORM);
			} finally {
				jest.restoreAllMocks();
				await orm.close(true);
				await dataSource.destroy();
			}
		});
	} finally {
		if (previous === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previous;
		for (const file of [database, `${database}-wal`, `${database}-shm`]) {
			rmSync(file, { force: true });
		}
	}

	return runs as { typeorm: IRun; mikroorm: IRun };
}

describe('the token rules on MikroORM', () => {
	let typeorm: IRun;
	let mikroorm: IRun;

	beforeAll(async () => {
		({ typeorm, mikroorm } = await runThroughBothOrms());
	}, TIMEOUT);

	it('reads tokens through TokenRepository that carry no rules of their own on MikroORM, and do on TypeORM', () => {
		// The premise of the defect, stated so the suite fails loudly if it stops holding.
		expect(typeorm.rowsCarryTheRules).toBe(true);
		expect(mikroorm.rowsCarryTheRules).toBe(false);
	});

	it('asks the entity itself on TypeORM, as it always did, and a Token view of the row on MikroORM', () => {
		// Control: on TypeORM every rule ran on the very object the repository answered, so nothing it decides can
		// have changed. On MikroORM the same rules ran on views of the rows, with `Token`'s prototype.
		expect(typeorm.ruledOnAnsweredRows.length).toBeGreaterThan(0);
		expect(typeorm.ruledOnAnsweredRows.every(Boolean)).toBe(true);
		expect(mikroorm.ruledOnAnsweredRows.length).toBe(typeorm.ruledOnAnsweredRows.length);
		expect(mikroorm.ruledOnAnsweredRows.some(Boolean)).toBe(false);
		expect(mikroorm.ruledOnTokens.every(Boolean)).toBe(true);
	});

	it('validates each token as TypeORM does', () => {
		// Each ORM validated tokens of its own, so the payload of a valid one names that ORM's token.
		const answered = (run: IRun, orm: string) =>
			JSON.parse(JSON.stringify(run.validated).split(tokenId(orm, 'usable')).join('<the usable token>'));

		expect(answered(mikroorm, 'mikro-orm')).toEqual(answered(typeorm, 'typeorm'));
		expect(mikroorm.validated).toEqual({
			usable: {
				isValid: true,
				token: { userId: USER, tokenType: TOKEN_TYPE, tokenId: tokenId('mikro-orm', 'usable') }
			},
			expired: { isValid: false, reason: 'Token has expired' },
			revoked: { isValid: false, reason: 'Token is revoked' },
			inactive: { isValid: false, reason: 'Token revoked due to inactivity' },
			atLimit: { isValid: false, reason: 'Token maximum usage count reached' }
		});
	});

	it('revokes a usable token and leaves a revoked one as it was, as TypeORM does', () => {
		expect(mikroorm.revoked).toEqual(typeorm.revoked);
		expect(mikroorm.revoked).toEqual({ toRevoke: undefined, alreadyRevoked: undefined });
	});

	it('leaves each token stored as TypeORM leaves it', () => {
		expect(mikroorm.stored).toEqual(typeorm.stored);
		expect(mikroorm.stored).toEqual({
			// Validated: its use is counted.
			usable: { status: 'ACTIVE', revokedReason: null, revokedById: null, usageCount: 1, version: 2 },
			expired: { status: 'EXPIRED', revokedReason: null, revokedById: null, usageCount: 0, version: 2 },
			revoked: { status: 'REVOKED', revokedReason: 'Earlier', revokedById: null, usageCount: 0, version: 1 },
			inactive: {
				status: 'REVOKED',
				revokedReason: 'Inactivity timeout',
				revokedById: null,
				usageCount: 0,
				version: 2
			},
			atLimit: {
				status: 'REVOKED',
				revokedReason: 'Maximum usage count reached',
				revokedById: null,
				usageCount: 5,
				version: 2
			},
			toRevoke: { status: 'REVOKED', revokedReason: 'Logout', revokedById: USER, usageCount: 0, version: 2 },
			alreadyRevoked: {
				status: 'REVOKED',
				revokedReason: 'Earlier',
				revokedById: null,
				usageCount: 0,
				version: 1
			}
		});
	});
});
