const root = require('path').resolve(__dirname, '..');

module.exports = {
	displayName: 'zzqprobe',
	rootDir: __dirname,
	testEnvironment: 'jsdom',
	setupFilesAfterEnv: ['<rootDir>/setup.ts'],
	transform: {
		'^.+\\.(ts|mjs|js|html)$': [
			'jest-preset-angular',
			{
				tsconfig: '<rootDir>/tsconfig.json',
				stringifyContentPathRegex: '\\.(html|svg)$'
			}
		]
	},
	transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
	testMatch: ['<rootDir>/**/*.spec.ts'],
	// This repo has NESTED copies of @angular/* inside @angular/platform-browser, @angular/forms,
	// @angular/common ... which give the test sandbox several distinct Angular runtimes (that is why
	// every TestBed spec in this repo currently dies with NG0203/"initTestEnvironment first").
	// Force every Angular entry point to the single hoisted copy.
	moduleNameMapper: {
		'^@angular/core/testing$': `${root}/node_modules/@angular/core/fesm2022/testing.mjs`,
		'^@angular/core$': `${root}/node_modules/@angular/core/fesm2022/core.mjs`,
		'^@angular/common/http$': `${root}/node_modules/@angular/common/fesm2022/http.mjs`,
		'^@angular/common$': `${root}/node_modules/@angular/common/fesm2022/common.mjs`,
		'^@angular/forms$': `${root}/node_modules/@angular/forms/fesm2022/forms.mjs`,
		'^@angular/platform-browser/testing$': `${root}/node_modules/@angular/platform-browser/fesm2022/testing.mjs`,
		'^@angular/platform-browser/animations$': `${root}/node_modules/@angular/platform-browser/fesm2022/animations.mjs`,
		'^@angular/platform-browser$': `${root}/node_modules/@angular/platform-browser/fesm2022/platform-browser.mjs`,
		'^@angular/compiler$': `${root}/node_modules/@angular/compiler/fesm2022/compiler.mjs`,
		'^@ng-select/ng-select$': `${root}/node_modules/@ng-select/ng-select/fesm2022/ng-select-ng-select.mjs`
	}
};
