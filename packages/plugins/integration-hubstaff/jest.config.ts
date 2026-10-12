module.exports = {
	displayName: 'plugin-integration-hubstaff',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	// A suite that reaches `@gauzy/core` through its source barrel pulls in dependencies that ship
	// ESM-only builds Jest cannot `require` — `uuid` through the request context, and the rest of this
	// list through the modules that context touches. Without the exception the suite fails to LOAD with
	// `SyntaxError: Unexpected token 'export'` and Jest reports "0 tests" instead of failing an
	// assertion. Same list, and the same reasoning, as `packages/core/jest.config.ts`.
	transformIgnorePatterns: [
		'node_modules/(?!(?:.*/)?(sanitize-html|htmlparser2|domelementtype|domhandler|domutils|dom-serializer|entities|nanoid|parse-srcset|uuid|camelcase|@faker-js|@nestjs/axios)/)'
	],
	coverageDirectory: '../../../coverage/packages/plugins/integration-hubstaff'
};
