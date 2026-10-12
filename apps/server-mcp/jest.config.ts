export default {
	displayName: 'server-mcp',
	preset: '../../jest.preset.js',
	testEnvironment: 'node',
	// Loads `.mjs` natively (NestJS 12 is ES modules; run with NODE_OPTIONS=--experimental-vm-modules): see jest.patterns.js.
	transformIgnorePatterns: require('../../jest.patterns').nodeTransformIgnorePatterns,
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../coverage/apps/server-mcp'
};
