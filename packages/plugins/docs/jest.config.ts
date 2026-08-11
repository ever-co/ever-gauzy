module.exports = {
	displayName: 'plugin-docs',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	// sanitize-html pulls in ESM-only nested deps (htmlparser2@12 chain) — transform them to CJS.
	transformIgnorePatterns: [
		'node_modules[\\\\/](?!(sanitize-html[\\\\/]node_modules[\\\\/])?(htmlparser2|entities|domhandler|domutils|dom-serializer|domelementtype)[\\\\/])'
	],
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/docs'
};
