import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * 🛑 Regression guard for the /pages/documents main-thread hang.
 *
 * `@ngneat/effects-ng`'s `provideEffectsManager()` is documented "Must be called at the root
 * level": it runs `initEffects()`, which creates the effects manager and subscribes it to the
 * GLOBAL `actions` stream. The app root already provides it
 * (apps/gauzy/src/app/bootstrap.module.ts). When `DocsUiModule` — a LAZY-loaded module — provided
 * it a SECOND time, first navigation to the hub stood up a second manager on the same global
 * stream and re-entered synchronously, pegging the main thread. The route wedged BEFORE any HTTP
 * (before the guards' `/api/auth/permissions` call), so every unit test passed while the feature
 * was completely unreachable in a browser.
 *
 * A feature module must contribute only its effects via `provideEffects()`. This test asserts the
 * module source never reintroduces the root-only call. It is a source-level invariant on purpose:
 * the providers are opaque `EnvironmentProviders`, and `initEffects()` mutates global singleton
 * state, so the defect cannot be observed cleanly through TestBed without leaking across specs —
 * whereas the one thing that must never come back is textual and unambiguous.
 */
describe('DocsUiModule effects wiring', () => {
	const source = readFileSync(join(__dirname, 'docs-ui.module.ts'), 'utf8');

	// Strip block and line comments so the explanatory note above the providers (which names the
	// forbidden call) does not count as a usage.
	const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

	it('does NOT call provideEffectsManager() — that is the app root\'s job', () => {
		expect(code).not.toMatch(/provideEffectsManager\s*\(/);
	});

	it('does NOT import provideEffectsManager from @ngneat/effects-ng', () => {
		expect(code).not.toMatch(/provideEffectsManager/);
	});

	it('still registers its own effects via provideEffects(DocumentsEffects)', () => {
		expect(code).toMatch(/provideEffects\s*\(\s*DocumentsEffects\s*\)/);
	});
});
