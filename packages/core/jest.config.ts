module.exports = {
	displayName: 'core',
	preset: '../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	// Several dependencies now ship ESM only. Jest's default here is ["/node_modules/"], i.e.
	// transform nothing under node_modules, so the bare `export` in those packages reached the
	// CommonJS loader and every suite that transitively imported one died at import time with
	// "SyntaxError: Unexpected token 'export'" — 14 of 15 suites, silently, since no CI job runs
	// this project. Listing them explicitly (rather than transforming all of node_modules) keeps
	// the run fast. Add to this list when a dependency goes ESM-only.
	transformIgnorePatterns: ['node_modules/(?!(.*/)?(uuid|camelcase|nanoid|@gauzy)/)'],
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../coverage/packages/core'
};
