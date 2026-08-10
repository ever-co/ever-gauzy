export default {
	displayName: 'videos-ui',
	preset: '../../../jest.preset.js',
	setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
	coverageDirectory: '../../../coverage/packages/plugins/videos-ui',
	transform: {
		'^.+\\.(ts|mjs|js|html)$': [
			'jest-preset-angular',
			{
				tsconfig: '<rootDir>/tsconfig.spec.json',
				stringifyContentPathRegex: '\\.(html|svg)$'
			}
		]
	},
	// `@ngneat/effects` and `@datorama/akita` ship ESM from plain `.js` entries; the `.mjs`-only
	// exception left them untransformed, so any suite reaching the video store/effects failed to
	// LOAD with "Unexpected token". Same fix as @gauzy/plugin-docs-ui.
	transformIgnorePatterns: [
		'node_modules/(?!.*\\.mjs$|(?:.*/)?(@ngneat|@datorama|uuid|lodash-es|camelcase|nanoid)/)'
	],
	snapshotSerializers: [
		'jest-preset-angular/build/serializers/no-ng-attributes',
		'jest-preset-angular/build/serializers/ng-snapshot',
		'jest-preset-angular/build/serializers/html-comment'
	]
};
