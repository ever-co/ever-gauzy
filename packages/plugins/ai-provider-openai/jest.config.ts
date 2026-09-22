module.exports = {
	displayName: 'plugin-ai-provider-openai',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	// `@gauzy/plugin-ai-chat`'s barrel exports the NestJS plugin alongside the pure helpers, so
	// importing `keyedCatalogue` or `transcribeViaOpenAiCompatible` drags in @gauzy/core and the
	// whole entity graph — minutes of transform, and an ESM dependency jest cannot load. Point the
	// specs at the helpers-only entry point (catalogue + speech): the code under test is the REAL
	// cache, fetch and speech request, not a stub.
	//
	// CAVEAT for the next spec here: this redirects EVERY import of the package, so anything that
	// entry point does not export (`BaseAiProviderPlugin`, `importEsm`, `AiProviderRegistry`) is
	// `undefined` at runtime with no useful error. It holds only because no spec calls `createModel`.
	moduleNameMapper: {
		'^@gauzy/plugin-ai-chat$': '<rootDir>/../ai-chat/src/lib/provider-helpers.ts'
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/ai-provider-openai'
};
