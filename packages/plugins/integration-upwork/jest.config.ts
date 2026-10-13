module.exports = {
	displayName: 'plugin-integration-upwork',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	// Loads ES modules natively (NestJS 12 is ES modules; run with NODE_OPTIONS=--experimental-vm-modules): see jest.patterns.js.
	transformIgnorePatterns: require('../../../jest.patterns').nodeTransformIgnorePatterns,
	coverageDirectory: '../../../coverage/packages/plugins/integration-upwork'
};
