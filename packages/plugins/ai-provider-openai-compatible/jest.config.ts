module.exports = {
	displayName: 'plugin-ai-provider-openai-compatible',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	// Provider specs map the `@gauzy/plugin-ai-chat` barrel (which drags in the NestJS plugin and
	// @gauzy/core) onto its helpers-only entry point — real catalogue cache/fetch and real speech
	// request, minus the entity graph. Anything else (`BaseAiProviderPlugin`, `importEsm`,
	// `AiProviderRegistry`) is `undefined` under this mapping; no spec here calls `createModel`.
	moduleNameMapper: {
		'^@gauzy/plugin-ai-chat$': '<rootDir>/../ai-chat/src/lib/provider-helpers.ts'
	},
	// The catalogue specs re-`require` the provider through `jest.resetModules()` for every case, and
	// the shared fetch now runs an SSRF egress pre-flight (a DNS resolve-then-check, GHSA-w3mx-m5cr-3gxp)
	// before the mocked `fetch` answers. Jest's 5s default leaves no margin for that on a loaded
	// machine, and a timeout there looks like a product failure rather than a slow first case.
	testTimeout: 20_000,
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/ai-provider-openai-compatible'
};
