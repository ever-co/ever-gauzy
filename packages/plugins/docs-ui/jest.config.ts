export default {
	displayName: 'docs-ui',
	preset: '../../../jest.preset.js',
	setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
	coverageDirectory: '../../../coverage/packages/plugins/docs-ui',
	transform: {
		'^.+\\.(ts|mjs|js|html)$': [
			'jest-preset-angular',
			{
				tsconfig: '<rootDir>/tsconfig.spec.json',
				stringifyContentPathRegex: '\\.(html|svg)$'
			}
		]
	},
	// `@ngneat/effects` and `@datorama/akita` both ship ESM from plain `.js` entries, so the
	// original `.mjs`-only exception left them untransformed: every suite that reaches `Actions`
	// (`DocsRowActionsService`) or the ui-core `Store` failed to LOAD rather than fail an
	// assertion — which reads as "no tests here" instead of "coverage is zero".
	transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$|(?:.*/)?(@ngneat|@datorama)/)'],
	snapshotSerializers: [
		'jest-preset-angular/build/serializers/no-ng-attributes',
		'jest-preset-angular/build/serializers/ng-snapshot',
		'jest-preset-angular/build/serializers/html-comment'
	]
};
