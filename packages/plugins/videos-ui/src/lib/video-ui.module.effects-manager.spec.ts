import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * 🛑 Regression guard for the lazy-module effects-manager hang.
 *
 * `@ngneat/effects-ng`'s `provideEffectsManager()` is documented "Must be called at the root
 * level": it runs `initEffects()`, which creates the effects manager and subscribes it to the
 * GLOBAL `actions` stream. The app root already provides it
 * (apps/gauzy/src/app/bootstrap.module.ts). `VideoUiModule` is lazy-loaded via `loadChildren`
 * (apps/gauzy .../employees/activity/activity.module.ts); providing the manager again stood up a
 * second manager on the same global stream, which re-entered synchronously on first navigation to
 * the videos route and pegged the main thread — before any HTTP, so unit tests passed while the
 * route was unreachable in a browser. Same defect as `@gauzy/plugin-docs-ui`.
 *
 * Source-level invariant on purpose: the providers are opaque `EnvironmentProviders` and
 * `initEffects()` mutates global singleton state, so the one thing that must never return is
 * asserted textually.
 */
describe('VideoUiModule effects wiring', () => {
	const source = readFileSync(join(__dirname, 'video-ui.module.ts'), 'utf8');
	const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

	it('does NOT call provideEffectsManager() — that is the app root\'s job', () => {
		expect(code).not.toMatch(/provideEffectsManager\s*\(/);
	});

	it('does NOT import provideEffectsManager from @ngneat/effects-ng', () => {
		expect(code).not.toMatch(/provideEffectsManager/);
	});

	it('still registers its own effects via provideEffects(...)', () => {
		expect(code).toMatch(/provideEffects\s*\(\s*VideoEffects/);
	});
});
