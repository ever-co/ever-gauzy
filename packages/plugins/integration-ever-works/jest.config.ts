module.exports = {
	displayName: 'plugin-integration-ever-works',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': [
			'ts-jest',
			{
				tsconfig: '<rootDir>/tsconfig.spec.json',
				// Type errors are reported for this plugin's own files; the specs that load other workspace
				// packages from source leave their type check to those packages' own builds.
				diagnostics: { exclude: ['!**/packages/plugins/integration-ever-works/**'] }
			}
		]
	},
	moduleFileExtensions: ['ts', 'js', 'json', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/integration-ever-works'
};
