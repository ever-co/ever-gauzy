module.exports = {
	displayName: 'plugin-ai-provider-vercel-gateway',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	// `@gauzy/plugin-ai-chat`'s barrel exports the NestJS plugin alongside the pure catalogue helpers,
	// so importing `keyedCatalogue` drags in @gauzy/core and the whole entity graph — minutes of
	// transform, and an ESM dependency jest cannot load. Point the specs at the helper module itself:
	// the code under test is the REAL cache and fetch, not a stub.
	//
	// CAVEAT for the next spec here: this redirects EVERY import of the package, so anything the
	// helper module does not export (`BaseAiProviderPlugin`, `importEsm`, `AiProviderRegistry`) is
	// `undefined` at runtime with no useful error. It holds only because no spec calls `createModel`.
	// A spec that needs the plugin class wants a real entry point for the helpers instead.
	moduleNameMapper: {
		'^@gauzy/plugin-ai-chat$': '<rootDir>/../ai-chat/src/lib/model-catalogue.ts'
	},
	// The catalogue specs re-`require` the provider through `jest.resetModules()` for every case, and
	// the shared fetch now runs an SSRF egress pre-flight (a DNS resolve-then-check, GHSA-w3mx-m5cr-3gxp)
	// before the mocked `fetch` answers. Jest's 5s default leaves no margin for that on a loaded
	// machine, and a timeout there looks like a product failure rather than a slow first case.
	testTimeout: 20_000,
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/ai-provider-vercel-gateway'
};
