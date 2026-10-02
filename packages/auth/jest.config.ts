const { transformIgnorePatterns } = require('../../jest.preset.js');

// `jose` ships as an ES module only. The OIDC library specs reach it, so it joins the preset's list of
// ESM-only dependencies that ts-jest compiles. A project-level `transformIgnorePatterns` replaces the
// preset's, so the preset's own pattern is extended rather than redefined.
const transformIgnorePatternsWithJose = transformIgnorePatterns.map((pattern: string) =>
	pattern.replace('|internmap)', '|internmap|jose)')
);
if (!transformIgnorePatternsWithJose.some((pattern: string) => pattern.includes('|jose)'))) {
	throw new Error('jest.preset.js transformIgnorePatterns changed shape: add `jose` to it for packages/auth');
}

module.exports = {
	displayName: 'auth',
	preset: '../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	transformIgnorePatterns: transformIgnorePatternsWithJose,
	moduleFileExtensions: ['ts', 'js', 'html'],
	coverageDirectory: '../../coverage/packages/auth'
};
