import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

// `setupZoneTestEnv()` loads zone.js and configures jest-preset-angular's testing environment.
// 🛑 It is NOT enough on its own here: this package has a nested `node_modules/@angular` (a hoist
// artifact), so under the spec tsconfig (`moduleResolution: bundler`) a `.spec.ts` — and this file
// — resolve a DIFFERENT `@angular/core/testing` instance than jest-preset-angular does. So the env
// it initialized was invisible to the specs and all 17 component suites died with
// "Need to call TestBed.initTestEnvironment() first". We therefore ALSO initialize the instance the
// specs actually use, from THIS file (same module instance as the specs). Mirrors the inline
// workaround in @gauzy/plugin-docs-ui's menu-editor-rebinding.spec.ts, hoisted to the global setup.
setupZoneTestEnv({
	errorOnUnknownElements: true,
	errorOnUnknownProperties: true
});

const testBed = getTestBed() as unknown as { platform?: unknown };
if (!testBed.platform) {
	getTestBed().initTestEnvironment([BrowserTestingModule], platformBrowserTesting(), {
		errorOnUnknownElements: true,
		errorOnUnknownProperties: true
	});
}
