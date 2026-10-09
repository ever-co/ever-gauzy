module.exports = {
	displayName: 'mcp-server',
	setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
	preset: '../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../coverage/packages/mcp-server'
};
