/**
 * The `transformIgnorePatterns` every Jest project of the workspace uses, in one place (see `jest.preset.js` for why
 * each package is listed). Two variants, because the two kinds of project load ES modules differently:
 *
 * - `transformIgnorePatterns` (the preset's default) also transforms every `.mjs` file. The Angular projects need
 *   that: Angular and its ecosystem ship `fesm2022/*.mjs` bundles that jest-preset-angular compiles (and links).
 *
 * - `nodeTransformIgnorePatterns` leaves every ES module alone. The Node projects run with
 *   `NODE_OPTIONS=--experimental-vm-modules` (the workspace `.env.test`; CI sets it for them), so Jest loads an ES
 *   module natively, also one a CommonJS spec requires (`require(esm)`, Node >= 24.9). NestJS 12 ships as ES modules,
 *   which is why the flag is on. Under it Jest decides how to load a file by the file alone — a `.mjs`, or a `.js` in
 *   a `"type": "module"` package, is evaluated as an ES module — so a transform to CommonJS breaks such a package
 *   instead of fixing it: Nest found no named exports in the `.mjs` of `uid` ("The requested module 'uid' does not
 *   provide an export named 'uid'"), and uuid 14 and jose 6, both ESM-only, threw "exports is not defined" in the
 *   auth, pricing, catalog and inventory suites. Only a package that puts ES module syntax in files Node takes for
 *   CommonJS still needs the transform: `@datorama/akita` (plain `.js`, no `"type"`), and `@nestjs/axios` (see
 *   `jest.preset.js`). Every other package on the list above loads natively.
 *
 * The Angular projects run WITHOUT that flag (each one's `.env.test` clears `NODE_OPTIONS`; CI runs them separately):
 * under it, Jest would evaluate every `.mjs` bundle as an ES module after jest-preset-angular compiled it to CommonJS
 * ("module is not defined" in `setup-env/zone`, and every Angular suite failed to load).
 *
 * A project's own `transformIgnorePatterns` REPLACES the preset's, so a Node project that sets the key takes it from
 * here rather than restating the list.
 */
const ESM_PACKAGES = String.raw`(?:.*/)?(sanitize-html|htmlparser2|domelementtype|domhandler|domutils|dom-serializer|entities|nanoid|parse-srcset|uuid|camelcase|@faker-js|@nestjs/axios|@datorama|@ngneat|lodash-es|d3-[a-z-]+|internmap|jose|marked|hash-it)/`;

/** The packages a Node project still transforms: ES module syntax in files Node loads as CommonJS (see above). */
const NODE_TRANSFORMED_PACKAGES = String.raw`(?:.*/)?(@datorama|@nestjs/axios)/`;

module.exports = {
	ESM_PACKAGES,
	NODE_TRANSFORMED_PACKAGES,
	transformIgnorePatterns: [String.raw`node_modules/(?!.*\.mjs$|${ESM_PACKAGES})`],
	nodeTransformIgnorePatterns: [String.raw`node_modules/(?!${NODE_TRANSFORMED_PACKAGES})`]
};
