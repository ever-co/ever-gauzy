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
	// Loads ES modules natively (NestJS 12 is ES modules; run with NODE_OPTIONS=--experimental-vm-modules): see jest.patterns.js.
	transformIgnorePatterns: require('../../../jest.patterns').nodeTransformIgnorePatterns,
	coverageDirectory: '../../../coverage/packages/plugins/integration-zapier'
};
