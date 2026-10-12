module.exports = {
	displayName: 'desktop-activity',
	preset: '../../jest.preset.js',
	testEnvironment: 'node',
	// Loads `.mjs` natively (NestJS 12 is ES modules; run with NODE_OPTIONS=--experimental-vm-modules): see jest.patterns.js.
	transformIgnorePatterns: require('../../jest.patterns').nodeTransformIgnorePatterns,
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js'],
	coverageDirectory: '../../coverage/packages/desktop-activity'
};
