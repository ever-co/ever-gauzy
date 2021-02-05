module.exports = {
	testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
	transform: {
		'^.+\\.(ts|js|html)$': 'ts-jest'
	},
	resolver: '@nrwl/jest/plugins/resolver',
	moduleFileExtensions: ['ts', 'js', 'html'],
	collectCoverage: true,
	coverageReporters: ['html'],
	projects: [
		'<rootDir>/apps/gauzy',
		'<rootDir>/apps/api',
		'<rootDir>/apps/desktop',
		'<rootDir>/libs/desktop-ui-lib'
	]
};
