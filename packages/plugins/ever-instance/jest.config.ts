module.exports = {
	displayName: 'plugin-ever-instance',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\.[tj]s$': [
			'ts-jest',
			{
				tsconfig: '<rootDir>/tsconfig.spec.json',
				// Type errors are reported for this package's own files; the specs that load other workspace
				// packages from source leave their type check to those packages' own builds.
				diagnostics: { exclude: ['!**/packages/plugins/ever-instance/**'] }
			}
		]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/ever-instance'
};
