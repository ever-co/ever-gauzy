/**
 * Jest resolver for the whole workspace (wired in `jest.preset.js`): Nx's resolver, plus ONE rule —
 * every `@angular/*` import inside a Jest project resolves to the SAME copy of Angular.
 *
 * Why: the root `package.json` sets `workspaces.nohoist: ["**\/@angular*\/**"]`, so every workspace
 * that depends on Angular gets its own `node_modules/@angular/*`, next to the root copy. Node-style
 * resolution then hands different files different copies:
 *   - a spec (and the component it tests) gets the project's copy, e.g.
 *     `packages/plugins/jobs-ui/node_modules/@angular/core`;
 *   - `jest-preset-angular/setup-env/zone`, which lives in the ROOT `node_modules`, gets the root copy;
 *   - a workspace library the spec pulls in (`packages/ui-core/src/...`) gets ui-core's copy.
 * Each copy has its own `TestBed` and its own injection tokens. `setupZoneTestEnv()` initialised the
 * root copy's TestBed while the spec used another one, so every TestBed spec failed with "Need to
 * call TestBed.initTestEnvironment() first" — in desktop, desktop-ui-lib, ui-core, plugin-jobs-ui,
 * gauzy-server and gauzy-api-server, on every run since the Unit Tests workflow was added.
 *
 * The fix resolves `@angular/*` from the Jest project's `rootDir` whoever asks: the project's own
 * copy when it has one (the one it builds against), otherwise the next copy up the tree (the root
 * one). One project, one Angular. Anything else goes through Nx's resolver unchanged.
 */
const nxResolver = require('@nx/jest/plugins/resolver');

const ANGULAR_PACKAGE = /^@angular\//;

module.exports = function resolve(request, options) {
	if (ANGULAR_PACKAGE.test(request) && options.rootDir && options.basedir !== options.rootDir) {
		try {
			return nxResolver(request, { ...options, basedir: options.rootDir });
		} catch {
			// Not resolvable from the project root (no copy on that path) — fall back to the usual
			// lookup from the requiring file rather than failing a lookup that used to work.
		}
	}
	return nxResolver(request, options);
};
