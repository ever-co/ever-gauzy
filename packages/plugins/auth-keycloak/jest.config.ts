module.exports = {
	displayName: 'plugin-auth-keycloak',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': [
			'ts-jest',
			{
				tsconfig: '<rootDir>/tsconfig.spec.json',
				// Type errors are reported for this plugin's own files. The specs load other workspace packages
				// (`@gauzy/core`, `@gauzy/auth`, ...) from source; their type check belongs to their own builds
				// and tests, and repeating it here only made these suites slow and dependent on unrelated code.
				diagnostics: { exclude: ['!**/packages/plugins/auth-keycloak/**'] }
			}
		]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/auth-keycloak'
};
