/* eslint-disable */
module.exports = {
	displayName: 'plugin-tax',
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
