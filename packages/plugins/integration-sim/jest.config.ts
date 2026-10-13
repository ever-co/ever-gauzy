export default {
	displayName: 'integration-sim',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	// transformIgnorePatterns: inherited from jest.preset.js, which takes the Node rule under --experimental-vm-modules (an ESM config cannot `require`).
	coverageDirectory: '../../../coverage/packages/plugins/integration-sim'
};
