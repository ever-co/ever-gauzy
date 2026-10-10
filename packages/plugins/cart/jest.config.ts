module.exports = {
	displayName: 'plugin-cart',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		// No `isolatedModules` here, unlike the other plugin configs: transpiling each file on its own
		// changes the order the barrel's import cycle resolves in, and `CrudService` — which
		// `TenantAwareCrudService` extends — is then `undefined` when the class is defined. The suites
		// load without it.
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	// A suite that exercises a service reaches `@gauzy/core` through its source barrel, and the barrel
	// pulls in dependencies that ship ESM-only builds Jest cannot `require` (`uuid` through the request
	// context, `camelcase`, …). Without this exception the suite fails to LOAD with
	// `SyntaxError: Unexpected token 'export'` and Jest reports "0 tests" instead of failing an
	// assertion. Same list, and the same reasoning, as `packages/plugins/order/jest.config.ts`.
	transformIgnorePatterns: [
		'node_modules/(?!(?:.*/)?(sanitize-html|htmlparser2|domelementtype|domhandler|domutils|dom-serializer|entities|nanoid|parse-srcset|uuid|camelcase|@faker-js|@nestjs/axios)/)'
	],
	coverageDirectory: '../../../coverage/packages/plugins/cart'
};
