/**
 * Jest `setupFiles` entry for the whole workspace (wired in `jest.preset.js`): make the callable
 * CommonJS packages that this codebase imports BOTH ways load under either import style, the way the
 * app bundlers already treat them.
 *
 * `moment` is a CommonJS function (`module.exports = moment`, no `default`, no `__esModule`), and the
 * code imports it two ways:
 *   - `import moment from 'moment'`       — ui-core (43 files), public-layout-ui, the React UI plugins;
 *   - `import * as moment from 'moment'`  — core, desktop-lib, desktop-ui-lib, apps/gauzy and others.
 * Webpack / esbuild accept both. The TypeScript CommonJS emit Jest runs cannot accept both under one
 * `esModuleInterop` setting:
 *   - `esModuleInterop: false` (the root tsconfig) compiles the default import to `moment_1.default`,
 *     which is undefined — "(0, moment_1.default) is not a function" failed ~50 Angular suites at load
 *     time, in every project that reaches ui-core's date-range-picker service;
 *   - `esModuleInterop: true` fixes that, but compiles the namespace import through `__importStar`,
 *     which copies the module's properties into a plain object — so `moment()` stops being callable.
 * `randomcolor` has the same shape and is namespace-imported and called (ui-core's tags colour input,
 * apps/gauzy's weekly report), which breaks in exactly the projects that set `esModuleInterop: true`.
 *
 * Giving each loaded module `default` (itself) and `__esModule` makes every combination resolve to the
 * function itself, exactly as the bundlers do. `moment-timezone` returns the same object as `moment`.
 *
 * Scope: this file runs in each test file's module registry before the spec loads, so the specs see
 * the patched instances. A spec that calls `jest.resetModules()` and then re-requires one of these
 * gets a fresh, unpatched copy — repeat the patch there if one ever needs it.
 */
const CALLABLE_COMMONJS_PACKAGES = ['moment', 'randomcolor'];

for (const name of CALLABLE_COMMONJS_PACKAGES) {
	let mod;
	try {
		mod = require(name);
	} catch {
		continue; // not installed in this checkout: nothing can import it either
	}
	if (typeof mod !== 'function') {
		continue;
	}
	if (mod.default === undefined) {
		mod.default = mod;
	}
	if (!mod.__esModule) {
		Object.defineProperty(mod, '__esModule', { value: true });
	}
}
