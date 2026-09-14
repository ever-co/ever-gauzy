module.exports = {
	displayName: 'plugin-integration-zapier',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		// `isolatedModules: true`: transpile each file independently instead of type-checking the
		// whole program. Without it, importing anything that transitively reaches `@gauzy/core`
		// (e.g. this package's own handlers, which import `TimerStartedEvent` from it) re-checks
		// `@gauzy/core`'s SOURCE under this package's stricter `noPropertyAccessFromIndexSignature`
		// setting and fails on unrelated `process.env.X` accesses in `packages/core/src/lib/bootstrap`
		// — a cross-package tsconfig-strictness mismatch, not a real type error in this package's own
		// code. Test-tooling-only; does not affect the production build.
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json', isolatedModules: true }]
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
