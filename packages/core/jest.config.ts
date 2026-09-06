module.exports = {
	displayName: 'core',
	preset: '../../jest.preset.js',
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'js', 'html'],
	// Dependencies that ship ESM-only builds Jest cannot `require`. A suite that reaches one of
	// them fails to LOAD rather than failing an assertion — Jest reports that as a suite error,
	// which reads like "no tests here" instead of "coverage is zero", so the tests silently stop
	// running. That is how both server-side sanitization suites, every time-tracking suite and
	// both email-check suites came to contribute nothing.
	//
	// Keep this list to packages actually reached by a spec, and add whole dependency subtrees
	// (walk for `"type": "module"`) rather than one package per failing run:
	//   sanitize-html + its parser stack -> rich-html-sanitizer / public-html-sanitizer
	//   uuid                             -> time-tracking + email-check suites
	//   camelcase                        -> time-tracking suites
	//   @faker-js/faker                  -> reached through the entity graph (core/seeds)
	//   @nestjs/axios                    -> ships a raw `index.ts` that re-exports `./dist`
	// Listing packages explicitly, rather than transforming all of node_modules, is what keeps the
	// run fast.
	//
	// Two things this list depends on that are easy to break from elsewhere:
	//   - `allowJs: true` in tsconfig.spec.json — ts-jest hands a `.js` file back UNCHANGED when
	//     allowJs is false, so without it every exception here silently stops working.
	//   - `@gauzy/*` is deliberately absent, and adding it would do nothing. Jest resolves
	//     workspace packages to their real source path (`packages/<pkg>/src/index.ts`), which has
	//     no `node_modules/` segment, so this pattern is never consulted for them. A second, older
	//     copy of this key used to list `@gauzy`; it was inert there too.
	transformIgnorePatterns: [
		'node_modules/(?!(?:.*/)?(sanitize-html|htmlparser2|domelementtype|domhandler|domutils|dom-serializer|entities|nanoid|parse-srcset|uuid|camelcase|@faker-js|@nestjs/axios)/)'
	],
	coverageDirectory: '../../coverage/packages/core'
};
