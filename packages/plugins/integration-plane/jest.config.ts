// `module.exports`, like every other package's jest config here: with `export default` Jest cannot
// parse this file when it is run directly (only through the nx executor's ts-node hook).
module.exports = {
	displayName: 'integration-plane',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/integration-plane'
};
