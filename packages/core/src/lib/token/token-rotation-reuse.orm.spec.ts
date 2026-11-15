import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * A refresh token that was just rotated is answered again, in a real store, on TypeORM and on MikroORM
 * (ever-co/ever-gauzy#11955).
 *
 * `token-rotation-reuse.spec.ts` states the rule over a table in memory. This suite runs it where the rule reads
 * what each ORM stores: the creation time of the token that replaced the presented one (the reuse window is counted
 * from it), the links of the line of rotations, and the compare-and-set a rotation ends with.
 *
 * **What is real here.** One better-sqlite3 database whose tables TypeORM created from the platform's own mapping;
 * the core entities imported under `DB_ORM=mikro-orm`, so MikroORM maps `Token` as it does in production; the real
 * `TokenRepository` over each ORM's repository in turn, and the real handlers that create, validate, rotate and
 * revoke a token, with the config registry. Only the JWT service and the hasher are stood in for. Each ORM works on
 * a user of its own, and the outcomes are compared.
 */

const TIMEOUT = 15 * 60 * 1000;

const TOKEN_TYPE = 'refresh_token';
const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;

/** The token type's rules: a rotated token is answered again for ten seconds. */
const CONFIG = {
	tokenType: TOKEN_TYPE,
	expiration: 30 * DAY,
	threshold: 7 * DAY,
	allowRotation: true,
	allowMultipleSessions: true,
	rotationReuseWindow: 10 * SECOND
};

/** The user whose tokens one ORM works on. */
const USERS: Record<string, string> = {
	typeorm: '6e000000-0000-4000-8100-000000000011',
	'mikro-orm': '6e000000-0000-4000-8200-000000000011'
};

/** What one ORM answered, and left in the store. */
interface IRun {
	/** Whether the token whose rotation's answer was lost is let in again, and answered a token. */
	presentedAgain: { letIn: unknown; answered: boolean };
	/** Whether the token answered then is one the store accepts. */
	answeredTokenIsValid: boolean;
	/** The statuses along the line of rotations, from the first token of the session. */
	line: string[];
	/** The tokens of the user that are active once the token was answered again. */
	activeTokens: number;
	/** Eleven seconds after the rotation: what validating and rotating the old token answer. */
	afterTheWindow: { validated: unknown; rotated: unknown };
	/** Within the window, once the token that replaced the old one is revoked. */
	afterARevocation: { validated: unknown; rotated: unknown };
}

async function runThroughBothOrms(): Promise<{ typeorm: IRun; mikroorm: IRun }> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	// The entities and the rotation ask the configuration, not the connection, which database they talk to. This
	// store is SQLite whatever the environment names: with another `DB_TYPE` the entities would take that database's
	// column types and the rotation would ask for a row lock, and SQLite has neither.
	process.env.DB_TYPE = 'better-sqlite3';

	const database = join(tmpdir(), `token-rotation-reuse-${process.pid}-${Date.now()}.sqlite`);
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
			const { TokenRepository } = require('./repositories/token.repository');
			const { TypeOrmTokenRepository } = require('./repositories/type-orm/type-orm-token.repository');
			const { MikroOrmTokenRepository } = require('./repositories/micro-orm/micro-orm-token.repository');
			const { TokenConfigRegistry } = require('./token-config.registry');
			const { ValidateTokenHandler } = require('./queries/handlers/validate-token-query.handler');
			const { CreateTokenHandler } = require('./commands/handlers/create-token-command.handler');
			const { RotateTokenHandler } = require('./commands/handlers/rotate-token-command.handler');
			const { RevokeTokenHandler } = require('./commands/handlers/revoke-token-command.handler');
			const { ValidateTokenQuery } = require('./queries/validate-token.query');
			const { CreateTokenCommand } = require('./commands/create-token.command');
			const { RotateTokenCommand } = require('./commands/rotate-token.command');
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

			const now = Date.now.bind(Date);

			try {
				// The user the tokens belong to is not what this suite is about, so neither ORM's connection is asked
				// to enforce it.
				await dataSource.query('PRAGMA foreign_keys = OFF');
				await orm.em.getConnection().execute('PRAGMA foreign_keys = OFF');

				const runOn = async (ormType: string): Promise<IRun> => {
					const userId = USERS[ormType];
					const ormTypeSpy = jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
					// A raw token names the stored token it was signed for, as a JWT's payload does.
					const payloads = new Map<string, object>();
					const registry = new TokenConfigRegistry();
					registry.register(CONFIG);
					registry.registerJwtService(TOKEN_TYPE, {
						sign: async (payload: { tokenId: string }) => {
							const raw = `jwt.${payload.tokenId}`;
							payloads.set(raw, payload);
							return raw;
						},
						verify: async (raw: string) => {
							if (!payloads.has(raw)) {
								throw new Error('invalid signature');
							}
							return payloads.get(raw);
						},
						decode: (raw: string) => payloads.get(raw) ?? null
					});
					const hasher = { hashToken: (raw: string) => `hash:${ormType}:${raw}` };
					// The handlers of one request. Each request has a MikroORM context of its own, as the API gives it: a
					// context answers a token it has already read from memory, so one context for the whole run would
					// judge a token as an earlier step left it, which no request does.
					const inRequest = () => {
						const repository = new TokenRepository(
							new TypeOrmTokenRepository(dataSource.getRepository(Token)),
							new MikroOrmTokenRepository(orm.em.fork(), Token)
						);
						return {
							create: new CreateTokenHandler(repository, registry, hasher),
							validate: new ValidateTokenHandler(registry, repository, repository, hasher),
							rotate: new RotateTokenHandler(repository, registry, hasher),
							revoke: new RevokeTokenHandler(repository, repository, hasher)
						};
					};

					const outcome = async (work: () => Promise<unknown>) => {
						try {
							return await work();
						} catch (error) {
							return { failed: error instanceof Error ? error.message : String(error) };
						}
					};
					const signIn = async (): Promise<string> =>
						(await inRequest().create.execute(new CreateTokenCommand({ userId, tokenType: TOKEN_TYPE })))
							.token;
					const validated = (rawToken: string) =>
						outcome(() =>
							inRequest().validate.execute(
								new ValidateTokenQuery({ rawToken, tokenType: TOKEN_TYPE, checkInactivity: true })
							)
						);
					const rotated = (rawOldToken: string) =>
						outcome(async () => {
							const answered = await inRequest().rotate.execute(
								new RotateTokenCommand({ rawOldToken, userId, tokenType: TOKEN_TYPE })
							);
							return answered.token;
						});
					const idOf = (rawToken: string) => rawToken.slice('jwt.'.length);
					// The store itself, whichever ORM wrote it
					const storedRow = async (id: string) => {
						const [row] = await dataSource.query(
							'SELECT "status", "rotatedToTokenId" FROM "tokens" WHERE "id" = ?',
							[id]
						);
						return row as { status: string; rotatedToTokenId: string | null };
					};

					try {
						// A session whose first rotation's answer is lost: the client sends the same token again
						const first = await signIn();
						await rotated(first);
						const letIn = await validated(first);
						const again = await rotated(first);
						const answered = typeof again === 'string';

						const line: string[] = [];
						for (let id: string | null = idOf(first); id;) {
							const row = await storedRow(id);
							line.push(row.status);
							id = row.rotatedToTokenId;
						}
						const [{ active }] = await dataSource.query(
							'SELECT COUNT(*) AS "active" FROM "tokens" WHERE "userId" = ? AND "status" = ?',
							[userId, 'ACTIVE']
						);
						const answeredTokenIsValid =
							answered && ((await validated(again as string)) as { isValid?: boolean }).isValid === true;

						// Another session, whose old token comes back eleven seconds after its rotation
						const late = await signIn();
						await rotated(late);
						const clock = jest.spyOn(Date, 'now').mockImplementation(() => now() + 11 * SECOND);
						const afterTheWindow = { validated: await validated(late), rotated: await rotated(late) };
						clock.mockRestore();

						// And one whose person signs out with the token that replaced the old one
						const signedOut = await signIn();
						const current = (await rotated(signedOut)) as string;
						await inRequest().revoke.execute(
							new RevokeTokenCommand({ rawToken: current, revokedById: userId, reason: 'Logout' })
						);
						const afterARevocation = {
							validated: await validated(signedOut),
							rotated: await rotated(signedOut)
						};

						return {
							presentedAgain: { letIn, answered },
							answeredTokenIsValid,
							line,
							activeTokens: Number(active),
							afterTheWindow,
							afterARevocation
						};
					} finally {
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
		for (const [name, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
		for (const file of [database, `${database}-wal`, `${database}-shm`]) {
			rmSync(file, { force: true });
		}
	}

	return runs as { typeorm: IRun; mikroorm: IRun };
}

describe('a rotated refresh token presented again, in the store of each ORM', () => {
	let typeorm: IRun;
	let mikroorm: IRun;

	beforeAll(async () => {
		({ typeorm, mikroorm } = await runThroughBothOrms());
	}, TIMEOUT);

	it.each(['typeorm', 'mikroorm'] as const)('is answered again within the reuse window on %s', (orm) => {
		const run = { typeorm, mikroorm }[orm];

		expect(run.presentedAgain.letIn).toEqual(expect.objectContaining({ isValid: true }));
		expect(run.presentedAgain.answered).toBe(true);
		expect(run.answeredTokenIsValid).toBe(true);
	});

	it.each(['typeorm', 'mikroorm'] as const)('keeps one line of rotations with one active token on %s', (orm) => {
		const run = { typeorm, mikroorm }[orm];

		// The first token, the one whose answer was lost, and the one answered again
		expect(run.line).toEqual(['ROTATED', 'ROTATED', 'ACTIVE']);
		expect(run.activeTokens).toBe(1);
	});

	it.each(['typeorm', 'mikroorm'] as const)('is refused once the window is over on %s', (orm) => {
		const run = { typeorm, mikroorm }[orm];

		expect(run.afterTheWindow).toEqual({
			validated: { isValid: false, reason: 'Token is rotated' },
			rotated: { failed: 'Token is not active' }
		});
	});

	it.each(['typeorm', 'mikroorm'] as const)('opens nothing once its replacement is revoked on %s', (orm) => {
		const run = { typeorm, mikroorm }[orm];

		expect(run.afterARevocation).toEqual({
			validated: { isValid: false, reason: 'Token is rotated' },
			rotated: { failed: 'Token is not active' }
		});
	});

	it('answers on MikroORM what it answers on TypeORM', () => {
		const comparable = (run: IRun) => ({ ...run, presentedAgain: { answered: run.presentedAgain.answered } });

		expect(comparable(mikroorm)).toEqual(comparable(typeorm));
	});
});
