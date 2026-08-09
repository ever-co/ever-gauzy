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
	transformIgnorePatterns: [
		'node_modules/(?!(?:.*/)?(sanitize-html|htmlparser2|domelementtype|domhandler|domutils|dom-serializer|entities|nanoid|parse-srcset|uuid|camelcase|@faker-js|@nestjs/axios)/)'
	],
	coverageDirectory: '../../coverage/packages/core'
};
