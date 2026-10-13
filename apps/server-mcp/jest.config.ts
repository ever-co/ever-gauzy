export default {
	displayName: 'server-mcp',
	preset: '../../jest.preset.js',
	testEnvironment: 'node',
	// transformIgnorePatterns: inherited from jest.preset.js, which takes the Node rule under --experimental-vm-modules (an ESM config cannot `require`).
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../coverage/apps/server-mcp'
};
