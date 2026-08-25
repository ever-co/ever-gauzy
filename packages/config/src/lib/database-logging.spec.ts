type SqliteTypeOrmProfile = {
	type: string;
	database: string;
	logging: false | 'all' | Array<'query' | 'error'>;
	logger: string;
	synchronize: boolean;
	prepareDatabase: (database: { pragma: jest.Mock }) => void;
};

type EnvironmentKey = 'DB_TYPE' | 'DB_LOGGING' | 'DB_PATH' | 'DB_SYNCHRONIZE' | 'DB_ORM' | 'IS_ELECTRON';

const environmentKeys: EnvironmentKey[] = [
	'DB_TYPE',
	'DB_LOGGING',
	'DB_PATH',
	'DB_SYNCHRONIZE',
	'DB_ORM',
	'IS_ELECTRON'
];

const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
const databaseTypes = ['sqlite', 'better-sqlite3'] as const;
const loggingCases = [
	{ name: 'absent', value: undefined, expected: ['error'] },
	{ name: 'false', value: 'false', expected: false },
	{ name: 'all', value: 'all', expected: 'all' },
	{ name: 'query', value: 'query', expected: ['query', 'error'] },
	{ name: 'error', value: 'error', expected: ['error'] },
	{ name: 'invalid', value: 'verbose', expected: ['error'] }
] as const;

function loadSqliteProfile(dbType: (typeof databaseTypes)[number], dbLogging?: string): SqliteTypeOrmProfile {
	process.env.DB_TYPE = dbType;
	process.env.DB_PATH = ':memory:';
	process.env.DB_SYNCHRONIZE = 'false';
	process.env.DB_ORM = 'typeorm';
	delete process.env.IS_ELECTRON;

	if (dbLogging === undefined) {
		delete process.env.DB_LOGGING;
	} else {
		process.env.DB_LOGGING = dbLogging;
	}

	let profile: SqliteTypeOrmProfile;
	jest.isolateModules(() => {
		profile = require('./database').dbTypeOrmConnectionConfig as SqliteTypeOrmProfile;
	});

	return profile!;
}

describe('SQLite TypeORM logging profiles', () => {
	let consoleLog: jest.SpyInstance;

	beforeAll(() => {
		consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterAll(() => {
		consoleLog.mockRestore();
	});

	afterEach(() => {
		for (const key of environmentKeys) {
			const value = originalEnvironment[key];
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	});

	it.each(
		databaseTypes.flatMap((dbType) =>
			loggingCases.map(({ name, value, expected }) => ({ dbType, name, value, expected }))
		)
	)('uses the $name DB_LOGGING profile for DB_TYPE=$dbType', ({ dbType, value, expected }) => {
		const profile = loadSqliteProfile(dbType, value);

		expect(profile.logging).toEqual(expected);
		expect(profile.logger).toBe('file');
	});

	it.each(databaseTypes)(
		'retains the existing driver, path, synchronize, and WAL behavior for DB_TYPE=%s',
		(dbType) => {
			const profile = loadSqliteProfile(dbType);
			const database = { pragma: jest.fn() };

			profile.prepareDatabase(database);

			expect(profile.type).toBe('better-sqlite3');
			expect(profile.database).toBe(':memory:');
			expect(profile.synchronize).toBe(false);
			expect(database.pragma).toHaveBeenCalledTimes(1);
			expect(database.pragma).toHaveBeenCalledWith('journal_mode = WAL');
		}
	);
});
