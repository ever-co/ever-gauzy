/* eslint-disable */
module.exports = {
	displayName: 'plugin-tax',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		// `isolatedModules` transpiles each file on its own, so a spec is not blocked by a compile error
		// in a package it merely imports. `@gauzy/core`'s barrel is in every one of these suites' import
		// graph, and a type error anywhere in it — including one another workstream is halfway through —
		// would otherwise fail the suite to LOAD, which reads as "0 tests" rather than as a failure of
		// the behaviour under test. The assertions are unaffected: nothing here is a type-level test.
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json', isolatedModules: true }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	// A suite that exercises a service reaches `@gauzy/core` through its source barrel, and the barrel
	// pulls in dependencies that ship ESM-only builds Jest cannot `require` (`uuid`, `camelcase`, …).
	// Without this exception the suite fails to LOAD and Jest reports "0 tests in 1 suite" instead of
	// failing an assertion. Same list, and the same reasoning, as `packages/core/jest.config.ts`; the
	// exception only does anything because `allowJs` is true in `tsconfig.spec.json`.
	transformIgnorePatterns: [
		'node_modules/(?!(?:.*/)?(sanitize-html|htmlparser2|domelementtype|domhandler|domutils|dom-serializer|entities|nanoid|parse-srcset|uuid|camelcase|@faker-js|@nestjs/axios)/)'
	],
	coverageDirectory: '../../../coverage/packages/plugins/tax'
};
