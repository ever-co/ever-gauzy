/* eslint-disable */
export default {
	displayName: 'gauzy',
	preset: '../../jest.preset.js',
	// Moved here from project.json's deprecated `setupFile` executor option. The target itself pointed
	// at a `jest.config.js` that does not exist, so none of this app's specs had ever run.
	setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
	coverageDirectory: '../../coverage/apps/gauzy',
	transform: {
		'^.+\\.(ts|mjs|js|html)$': [
			'jest-preset-angular',
			{
				tsconfig: '<rootDir>/tsconfig.spec.json',
				stringifyContentPathRegex: '\\.(html|svg)$'
			}
		]
	},
	snapshotSerializers: [
		'jest-preset-angular/build/serializers/no-ng-attributes',
		'jest-preset-angular/build/serializers/ng-snapshot',
		'jest-preset-angular/build/serializers/html-comment'
	]
};
