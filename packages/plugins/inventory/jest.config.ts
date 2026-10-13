module.exports = {
	displayName: 'plugin-inventory',
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
	coverageDirectory: '../../../coverage/packages/plugins/inventory'
};
