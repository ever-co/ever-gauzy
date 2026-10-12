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
	// The core barrel reaches dependencies that ship ESM-only builds Jest cannot `require` (`uuid` through
	// the request context, `camelcase`, …). Same list, and the same reasoning, as
	// `packages/core/jest.config.ts` and the plugin packages that load the barrel.
	transformIgnorePatterns: [
		'node_modules/(?!(?:.*/)?(sanitize-html|htmlparser2|domelementtype|domhandler|domutils|dom-serializer|entities|nanoid|parse-srcset|uuid|camelcase|@faker-js|@nestjs/axios)/)'
	],
	coverageDirectory: '../../coverage/apps/worker'
};
