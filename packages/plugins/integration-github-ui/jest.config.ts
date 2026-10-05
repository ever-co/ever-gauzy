export default {
	displayName: 'plugin-integration-github-ui',
	preset: '../../../jest.preset.js',
	// test-setup starts the zone test env; the root defaults add the app-wide TestBed providers (see file).
	setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts', '<rootDir>/../../../jest.angular-defaults.ts'],
	coverageDirectory: '../../../coverage/packages/plugins/integration-github-ui',
	transform: {
		'^.+\\.(ts|mjs|js|html)$': [
			'jest-preset-angular',
			{
				tsconfig: '<rootDir>/tsconfig.spec.json',
				stringifyContentPathRegex: '\\.(html|svg)$'
			}
		]
	},
	// `transformIgnorePatterns` is inherited from the root `jest.preset.js` (the ESM-only packages plus
	// every `.mjs` bundle). Do not redefine it here: a project key REPLACES the preset list, and the one
	// that used to sit here carried only the `.mjs` exception, so @datorama/akita, @ngneat/* and
	// lodash-es were never transformed and the suites that reach them failed to load.
	snapshotSerializers: [
		'jest-preset-angular/build/serializers/no-ng-attributes',
		'jest-preset-angular/build/serializers/ng-snapshot',
		'jest-preset-angular/build/serializers/html-comment'
	]
};
