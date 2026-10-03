module.exports = {
	displayName: 'auth',
	preset: '../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	// `jose` ships as an ES module only. The OIDC library specs reach it, so it joins the preset's list of
	// ESM-only dependencies that ts-jest compiles. A project-level `transformIgnorePatterns` replaces the
	// preset's, so the preset's own pattern is extended rather than redefined.
	// Computed inline rather than in top-level constants: a config with no import/export is a script,
	// so top-level names are global to the `typecheck-configs` program and collide across configs.
	transformIgnorePatterns: (() => {
		const preset = require('../../jest.preset.js') as { transformIgnorePatterns: string[] };
		const withJose = preset.transformIgnorePatterns.map((pattern) =>
			pattern.replace('|internmap)', '|internmap|jose)')
		);
		if (!withJose.some((pattern) => pattern.includes('|jose)'))) {
			throw new Error('jest.preset.js transformIgnorePatterns changed shape: add `jose` to it for packages/auth');
		}
		return withJose;
	})(),
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../coverage/packages/auth'
};
