/**
 * Minimal ambient declarations for `tools/tsconfig.jest-configs.json`.
 *
 * That project deliberately sets `"types": []` so it can run with nothing installed but
 * TypeScript itself — a CI job that needed `yarn install` first would cost minutes instead of
 * seconds, and the whole point of the check is that it is cheap enough to run on every PR.
 *
 * `@types/node` is therefore unavailable, but 53 of the workspace's jest configs are CommonJS
 * (`module.exports = { ... }`). These two declarations are all they need. Do not grow this file
 * into a general-purpose Node shim — if a config needs more than this, it probably belongs in a
 * project that has real types.
 */
declare const module: { exports: unknown };
declare const require: (id: string) => unknown;

/**
 * The root `jest.config.ts` is the only one of the 95 that imports anything; the other 94 are
 * self-contained data literals. Declaring the module here keeps the check at 95/95 with no
 * exclusion to remember, without resolving into `node_modules`.
 *
 * This deliberately does not describe `@nx/jest`'s real API — the point of the check is the
 * syntax and shape of the config files themselves, not the types of a third-party package.
 */
declare module '@nx/jest' {
	export function getJestProjectsAsync(): Promise<unknown>;
}
