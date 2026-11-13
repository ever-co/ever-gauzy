/**
 * The plugin's PostgreSQL suites (`*.postgres.spec.ts`), which `jest.config.ts` leaves out:
 * `nx run plugin-realtime:test-postgres`, with `REALTIME_TEST_POSTGRES_URL` pointing at a disposable database (the
 * build-api job sets it to its service container). Without it every suite is skipped.
 *
 * They load the platform's own entity registry, so they compile with core's compiler options, as core is built. This
 * plugin is `strict` and core is not: under `strictNullChecks` a `string | null` property is emitted with
 * `design:type` Object, and every core column that relies on the reflected type is then refused by TypeORM on
 * PostgreSQL. It takes a config of its own because ts-jest keeps one set of compiler options per Jest project, so a
 * second transform with core's tsconfig in `jest.config.ts` would be ignored.
 */
module.exports = {
	displayName: 'plugin-realtime-postgres',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	testMatch: ['<rootDir>/src/**/*.postgres.spec.ts'],
	transform: {
		'^.+\\.[tj]s$': [
			'ts-jest',
			{
				tsconfig: '<rootDir>/../../core/tsconfig.spec.json',
				// Type errors are reported for this plugin's own files, as in `jest.config.ts`.
				diagnostics: { exclude: ['!**/packages/plugins/realtime/**'] }
			}
		]
	},
	moduleFileExtensions: ['ts', 'js', 'json', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/realtime-postgres'
};
