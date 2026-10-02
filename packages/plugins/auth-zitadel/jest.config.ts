const { transformIgnorePatterns } = require('../../../jest.preset.js');

// `jose` (used by the shared OIDC library in `@gauzy/auth`) ships as an ES module only, so it joins the
// preset's list of ESM-only dependencies that ts-jest compiles. A project-level list replaces the
// preset's, so the preset's own pattern is extended rather than redefined.
const transformIgnorePatternsWithJose = transformIgnorePatterns.map((pattern: string) =>
	pattern.replace('|internmap)', '|internmap|jose)')
);
if (!transformIgnorePatternsWithJose.some((pattern: string) => pattern.includes('|jose)'))) {
	throw new Error('jest.preset.js transformIgnorePatterns changed shape: add `jose` to it for plugin-auth-zitadel');
}

module.exports = {
	displayName: 'plugin-auth-zitadel',
	preset: '../../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': [
			'ts-jest',
			{
				tsconfig: '<rootDir>/tsconfig.spec.json',
				// Type errors are reported for this plugin's own files. The specs load other workspace packages
				// (`@gauzy/core`, `@gauzy/auth`, ...) from source; their type check belongs to their own builds
				// and tests, and repeating it here only made these suites slow and dependent on unrelated code.
				diagnostics: { exclude: ['!**/packages/plugins/auth-zitadel/**'] }
			}
		]
	},
	transformIgnorePatterns: transformIgnorePatternsWithJose,
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/auth-zitadel'
};
