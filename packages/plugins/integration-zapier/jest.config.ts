module.exports = {
	displayName: 'plugin-integration-zapier',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		// Transpile-only: `tsconfig.spec.json` sets `isolatedModules`, and ts-jest follows it — see the
		// comment there for why. It is deliberately not passed here as a ts-jest option: that form is
		// deprecated in ts-jest 29.4 and removed in 30.
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	// Mirrors packages/core/jest.config.ts's own list, for the same reason: importing `@gauzy/core`
	// reaches ESM-only builds Jest cannot `require` (e.g. `uuid`, via `core/context/request-context`).
	// Keep in sync with that list if it grows.
	transformIgnorePatterns: [
		'node_modules/(?!(?:.*/)?(sanitize-html|htmlparser2|domelementtype|domhandler|domutils|dom-serializer|entities|nanoid|parse-srcset|uuid|camelcase|@faker-js|@nestjs/axios)/)'
	],
	coverageDirectory: '../../../coverage/packages/plugins/integration-zapier'
};
