module.exports = {
	displayName: 'core',
	preset: '../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	// `transformIgnorePatterns` — the ESM-only dependencies Jest must transform — is inherited from
	// `jest.preset.js`, which documents why each package is there. It used to be defined here (and
	// copied into integration-zapier), so the other projects that inherit the preset started without
	// it. Do not redefine it here: a project's own key REPLACES the preset's, so a copy would drift.
	//
	// Jest's own default (`/node_modules/`) plus the fresh-database migration smoke test. That one
	// spec runs the whole migration chain through ts-jest — about 3-6 minutes with a warm transform
	// cache, and up to half an hour on a cold one — so leaving it in `nx test core` would make every
	// run of this project pay for it. It has its own target instead, `nx run core:test-migration-smoke`,
	// which replaces this list with just `/node_modules/` from the command line.
	testPathIgnorePatterns: ['/node_modules/', String.raw`/src/lib/database/migration-smoke\.spec\.ts$`],
	coverageDirectory: '../../coverage/packages/core'
};
