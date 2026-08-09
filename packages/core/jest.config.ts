module.exports = {
	displayName: 'core',
	preset: '../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	// `sanitize-html` resolves an ESM-only `htmlparser2` build, which Jest cannot `require`.
	// Without this exception BOTH server-side sanitization suites — `rich-html-sanitizer.spec.ts`
	// (every legacy rich-text field) and `public-html-sanitizer.spec.ts` (the anonymous
	// `/public/*` responses) — fail to LOAD, so they report as suite errors rather than
	// assertion failures and the XSS policy they pin goes completely unverified.
	// Transforming that dependency subtree is what makes those specs actually execute.
	transformIgnorePatterns: [
		'node_modules/(?!(?:.*/)?(sanitize-html|htmlparser2|domelementtype|domhandler|domutils|dom-serializer|entities|nanoid|parse-srcset)/)'
	],
	coverageDirectory: '../../coverage/packages/core'
};
