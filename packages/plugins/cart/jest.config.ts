module.exports = {
	displayName: 'plugin-cart',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		// No `isolatedModules` here, unlike the other plugin configs: transpiling each file on its own
		// changes the order the barrel's import cycle resolves in, and `CrudService` — which
		// `TenantAwareCrudService` extends — is then `undefined` when the class is defined. The suites
		// load without it.
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/cart'
};
