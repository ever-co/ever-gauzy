export default {
	displayName: 'plugin-auth-zitadel-ui',
	preset: '../../../jest.preset.js',
	// test-setup starts the zone test env; the root defaults add the app-wide TestBed providers.
	setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts', '<rootDir>/../../../jest.angular-defaults.ts'],
	coverageDirectory: '../../../coverage/packages/plugins/auth-zitadel-ui',
	transform: {
		'^.+\\.(ts|mjs|js|html)$': [
			'jest-preset-angular',
			{
				tsconfig: '<rootDir>/tsconfig.spec.json',
				stringifyContentPathRegex: '\\.(html|svg)$'
			}
		]
	},
	// `transformIgnorePatterns` is inherited from the root `jest.preset.js`; a project key would replace it.
	snapshotSerializers: [
		'jest-preset-angular/build/serializers/no-ng-attributes',
		'jest-preset-angular/build/serializers/ng-snapshot',
		'jest-preset-angular/build/serializers/html-comment'
	]
};
