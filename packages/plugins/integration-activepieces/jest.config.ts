/* eslint-disable */
// The `test` target in project.json has always pointed at this file, but it did not exist, so
// `nx run plugin-integration-activepieces:test` failed before Jest started ("Can't find a root
// directory while resolving a config file path") and turned the whole Unit Tests run red. The
// plugin has no specs yet; with this config the target runs and passes with no tests (the
// `@nx/jest:jest` default is `passWithNoTests: true`), and a spec added later is picked up.
// Same shape as the other Node-side integration plugins (e.g. integration-make-com).
module.exports = {
	displayName: 'plugin-integration-activepieces',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/integration-activepieces'
};
