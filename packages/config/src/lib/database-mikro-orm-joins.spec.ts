import { MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS } from './database-helpers';

/**
 * Every MikroORM connection profile joins only the references a read loads, and no TypeORM profile is touched.
 *
 * MikroORM 6 defaults `autoJoinRefsForFilters` to `true`, and with the soft-delete filter on every platform entity
 * that joined every to-one relation of every row a read loaded, recursively, into the one statement: the time-log
 * list became 80 joins and SQLite refused it (`at most 64 tables in a join`). The measurement against the core
 * entities is `packages/core/src/lib/time-tracking/time-log/time-log.service.mikro-orm-joins.spec.ts`; this suite
 * pins that each `DB_TYPE` branch of `database.ts` states the option, and that it is not a TypeORM option there.
 *
 * `database.ts` computes its exports from `process.env` at import time, so each profile is loaded in an isolated
 * registry, as `database-config-validation.spec.ts` loads it.
 */

const DATABASE_ENV_KEYS = ['DB_TYPE', 'DB_ORM'] as const;

function loadDatabaseConfig(dbType: string): any {
	const previous = Object.fromEntries(DATABASE_ENV_KEYS.map((key) => [key, process.env[key]]));
	process.env.DB_TYPE = dbType;
	process.env.DB_ORM = 'mikro-orm';

	let loaded: any;
	try {
		jest.isolateModules(() => {
			loaded = require('./database');
		});
	} finally {
		for (const key of DATABASE_ENV_KEYS) {
			if (previous[key] === undefined) delete process.env[key];
			else process.env[key] = previous[key];
		}
	}
	return loaded;
}

describe('MikroORM joins only the references a read loads', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('is off', () => {
		expect(MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS).toBe(false);
	});

	it.each(['postgres', 'mysql', 'better-sqlite3', 'sqlite'])('is stated by the %s MikroORM profile', (dbType) => {
		const { dbMikroOrmConnectionConfig, dbTypeOrmConnectionConfig } = loadDatabaseConfig(dbType);

		expect(dbMikroOrmConnectionConfig.autoJoinRefsForFilters).toBe(false);
		// The TypeORM profile beside it is untouched: TypeORM has no such option and never joins what it does not load.
		expect(dbTypeOrmConnectionConfig).not.toHaveProperty('autoJoinRefsForFilters');
	});
});
