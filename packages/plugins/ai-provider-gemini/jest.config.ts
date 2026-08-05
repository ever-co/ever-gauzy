module.exports = {
	displayName: 'plugin-ai-provider-gemini',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	// `@gauzy/plugin-ai-chat`'s barrel exports the NestJS plugin alongside the pure catalogue helpers,
	// so importing `keyedCatalogue` drags in @gauzy/core and the whole entity graph — minutes of
	// transform, and an ESM dependency jest cannot load. Point the specs at the helper module itself:
	// the code under test is the REAL cache and fetch, not a stub. `importEsm` resolves to undefined
	// under this mapping, which is harmless because only `createModel` uses it and no spec calls it.
	moduleNameMapper: {
		'^@gauzy/plugin-ai-chat$': '<rootDir>/../ai-chat/src/lib/model-catalogue.ts'
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/ai-provider-gemini'
};
