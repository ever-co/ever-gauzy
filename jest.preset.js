const nxPreset = require('@nx/jest/preset').default;

// Dependencies that ship ESM-only builds Jest cannot `require`. A suite that reaches one of them
// fails to LOAD rather than failing an assertion — Jest reports that as a suite error, which reads
// like "no tests here" instead of "coverage is zero", so the tests silently stop running.
//
// This list used to live in `packages/core/jest.config.ts` (with a copy in integration-zapier), so
// the other projects that inherit this preset started without it. That is why the videos,
// job-proposal and wakatime service/controller specs — whose testing modules load `@gauzy/core` —
// failed to load. It lives here so a project gets it by inheriting the preset. Keep it to packages
// actually reached by a spec, and add whole dependency subtrees (walk for `"type": "module"`) rather
// than one package per failing run:
//   sanitize-html + its parser stack -> rich-html-sanitizer / public-html-sanitizer
//   uuid                             -> time-tracking + email-check suites, and any spec that loads
//                                       `@gauzy/core` for real
//   camelcase                        -> time-tracking suites
//   @faker-js/faker                  -> reached through the entity graph (core/seeds)
//   @nestjs/axios                    -> ships a raw `index.ts` that re-exports `./dist`
// Listing packages, rather than transforming all of node_modules, bounds the transform work. The
// `(?:.*/)?` prefix also matches nested copies and same-named directories inside other packages
// (e.g. `@smithy/uuid`); that only costs some transform time.
//
// Things this depends on that are easy to break from elsewhere:
//   - ts-jest (>= 29.3.2; pinned at 29.4.6) compiles a `.js` file under `node_modules` to CommonJS
//     whenever Jest hands it over, whatever `allowJs` says — so a project needs nothing else for this
//     list to take effect. `allowJs` only matters for repo-local `.js` files.
//   - A project that sets its own `transformIgnorePatterns` REPLACES this one rather than adding to
//     it: the Angular projects (for jest-preset-angular's `.mjs` handling), `docs` (a narrower list)
//     and `integration-zapier` (a copy of this list, which has to track it).
//   - `@gauzy/*` is deliberately absent, and adding it would do nothing. Jest resolves workspace
//     packages to their real source path (`packages/<pkg>/src/index.ts`), which has no
//     `node_modules/` segment, so this pattern is never consulted for them.
const transformIgnorePatterns = [
	'node_modules/(?!(?:.*/)?(sanitize-html|htmlparser2|domelementtype|domhandler|domutils|dom-serializer|entities|nanoid|parse-srcset|uuid|camelcase|@faker-js|@nestjs/axios)/)'
];

module.exports = { ...nxPreset, transformIgnorePatterns };
