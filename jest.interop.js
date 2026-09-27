/**
 * Jest `setupFiles` entry for the whole workspace (wired in `jest.preset.js`): make `moment` loadable
 * with BOTH import styles this codebase uses, the way the app bundlers already treat it.
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
 *     which copies moment's properties into a plain object — so `moment()` stops being callable.
 *
 * Giving the loaded module `default` (itself) and `__esModule` makes every combination resolve to the
 * moment function itself, exactly as the bundlers do. `moment-timezone` returns this same object.
 *
 * Scope: this file runs in each test file's module registry before the spec loads, so the specs see
 * the patched instance. A spec that calls `jest.resetModules()` and then re-requires moment gets a
 * fresh, unpatched copy — do the same patch there if one ever needs it.
 */
const moment = require('moment');

if (typeof moment === 'function') {
	if (moment.default === undefined) {
		moment.default = moment;
	}
	if (!moment.__esModule) {
		Object.defineProperty(moment, '__esModule', { value: true });
	}
}
