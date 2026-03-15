export default {
	displayName: 'plugin-dashboard-time-track-angular-ui',
	preset: '../../../jest.preset.js',
	setupFilesAfterSetup: ['<rootDir>/src/test-setup.ts'],
	coverageDirectory: '../../../coverage/packages/plugins/dashboard-time-track-angular-ui',
	transform: {
		'^.+\\.(ts|mjs|js|html)$': [
			'jest-preset-angular',
			{
				tsconfig: '<rootDir>/tsconfig.spec.json',
				stringifyContentPathRegex: '\\.(html|svg)$'
			}
		]
	},
	transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
	snapshotSerializers: [
		'jest-preset-angular/build/serializers/no-ng-attributes',
		'jest-preset-angular/build/serializers/ng-snapshot',
		'jest-preset-angular/build/serializers/html-comment'
	]
};
