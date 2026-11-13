module.exports = {
	displayName: 'plugin-realtime',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': [
			'ts-jest',
			{
				tsconfig: '<rootDir>/tsconfig.spec.json',
				// Type errors are reported for this plugin's own files; the specs that load other workspace
				// packages from source leave their type check to those packages' own builds.
				diagnostics: { exclude: ['!**/packages/plugins/realtime/**'] }
			}
		]
	},
	// The PostgreSQL suites have a config of their own (`jest.postgres.config.ts`, `nx run plugin-realtime:test-postgres`).
	testPathIgnorePatterns: ['/node_modules/', String.raw`\.postgres\.spec\.ts$`],
	moduleFileExtensions: ['ts', 'js', 'json', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/realtime'
};
