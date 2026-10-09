module.exports = {
	displayName: 'plugin-ai-provider-localai',
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
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/ai-provider-localai'
};
