/* eslint-disable */
module.exports = {
	displayName: 'plugin-pricing',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		// Type checking is ON, as it is in the thirteen sibling plugin packages. It used to be off here:
		// `isolatedModules: true` transpiled each spec on its own so that a compile error in a package
		// the spec merely imports could not fail the suite to LOAD. The cost was larger than the
		// protection. These specs are excluded from `tsconfig.lib.json`, so nothing else type-checks
		// them either — and a spec that calls a method that has since been renamed still transpiled, so
		// a case sitting inside `await expect(...).rejects.toThrow(...)` went green on the `TypeError`
		// the missing method threw, asserting nothing about the behaviour it names. The sibling packages
		// import the same `@gauzy/core` barrel under a checking transform, so the compile error this
		// exception was written against is not one this package is exposed to on its own.
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	// Loads ES modules natively (NestJS 12 is ES modules; run with NODE_OPTIONS=--experimental-vm-modules): see jest.patterns.js.
	transformIgnorePatterns: require('../../../jest.patterns').nodeTransformIgnorePatterns,
	coverageDirectory: '../../../coverage/packages/plugins/pricing'
};
