module.exports = {
	displayName: 'web-desktop-timer',
	preset: '../../jest.preset.js',
	setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
	globals: {
		'ts-jest': {
			tsConfig: '<rootDir>/tsconfig.spec.json',
			stringifyContentPathRegex: '\\.(html|svg)$',
			astTransformers: {
				before: [
					'jest-preset-angular/build/InlineFilesTransformer',
					'jest-preset-angular/build/StripStylesTransformer'
				]
			}
		}
	},
	coverageDirectory: '../../coverage/apps/web-desktop-timer',
	snapshotSerializers: [
		'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js',
		'jest-preset-angular/build/AngularSnapshotSerializer.js',
		'jest-preset-angular/build/HTMLCommentSerializer.js'
	]
};
