// Required by mcp-server environment validation when tool modules are imported in tests
process.env.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
process.env.GAUZY_AUTO_LOGIN = process.env.GAUZY_AUTO_LOGIN || 'false';

module.exports = {
	displayName: 'mcp-server',
	preset: '../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../coverage/packages/mcp-server'
};
