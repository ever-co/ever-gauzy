/* eslint-disable */
export default {
	displayName: 'worker',
	preset: '../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		// `isolatedModules` transpiles each file on its own. `worker-composition.spec.ts` loads the real
		// plugins the worker hosts — and through them `@gauzy/core`'s whole barrel — so a full type-check
		// of every file in that graph would make the suite take many times as long, and a type error in a
		// package it merely imports would fail it to LOAD ("0 tests") rather than fail an assertion. The
		// type-check is `tsc -p apps/worker/tsconfig.spec.json`'s job; the plugin packages' suites make the
		// same trade for the same reason.
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json', isolatedModules: true }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	// Loads ES modules natively (NestJS 12 is ES modules; run with NODE_OPTIONS=--experimental-vm-modules): see jest.patterns.js.
	transformIgnorePatterns: require('../../jest.patterns').nodeTransformIgnorePatterns,
	coverageDirectory: '../../coverage/apps/worker'
};
