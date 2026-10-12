import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

// jest-preset-angular 16 takes the environment options directly; the older
// `globalThis.ngJest` handshake needs a `@ts-expect-error` that this TypeScript
// version reports as unused, which fails the whole suite before it runs.
setupZoneTestEnv({
	errorOnUnknownElements: true,
	errorOnUnknownProperties: true
});
