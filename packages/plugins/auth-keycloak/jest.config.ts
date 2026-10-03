module.exports = {
	displayName: 'plugin-auth-keycloak',
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
				diagnostics: { exclude: ['!**/packages/plugins/auth-keycloak/**'] }
			}
		]
	},
	// `jose` (used by the shared OIDC library in `@gauzy/auth`) ships as an ES module only, so it joins the
	// preset's list of ESM-only dependencies that ts-jest compiles. A project-level list replaces the
	// preset's, so the preset's own pattern is extended rather than redefined.
	// Computed inline rather than in top-level constants: a config with no import/export is a script,
	// so top-level names are global to the `typecheck-configs` program and collide across configs.
	transformIgnorePatterns: (() => {
		const preset = require('../../../jest.preset.js') as { transformIgnorePatterns: string[] };
		const withJose = preset.transformIgnorePatterns.map((pattern) =>
			pattern.replace('|internmap)', '|internmap|jose)')
		);
		if (!withJose.some((pattern) => pattern.includes('|jose)'))) {
			throw new Error(
				'jest.preset.js transformIgnorePatterns changed shape: add `jose` to it for plugin-auth-keycloak'
			);
		}
		return withJose;
	})(),
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../../coverage/packages/plugins/auth-keycloak'
};
