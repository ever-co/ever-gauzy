/* eslint-disable */
/**
 * Two Jest projects, both run by `nx test gauzy-server`:
 *
 * - `server`: the Angular specs (jest-preset-angular, jsdom, and the zone.js test environment that
 *   `src/test-setup.ts` starts).
 * - `server-preload`: the specs of `src/preload/`, the Electron main-process code, which is plain Node (the static
 *   file server spec starts a real `http` server). They run in Node's own environment WITHOUT `src/test-setup.ts`: a
 *   `setupFilesAfterEnv` entry loads into every suite of its project, whatever `@jest-environment` a spec asks for,
 *   and zone.js then patches Node's global `EventTarget`. Its wrapped listener threw "Cannot read properties of
 *   undefined (reading 'false')" (`globalCallback`) on an event Node dispatches internally, and the suite failed
 *   after all of its tests had passed.
 *
 * Both run WITHOUT `--experimental-vm-modules`: this file names jest-preset-angular, so
 * `.github/scripts/jest-angular-projects.js` puts the Nx project in the Angular group (and `.env.test` clears
 * NODE_OPTIONS locally). The preload code and what it loads (serve-static, finalhandler) are CommonJS, which loads
 * the same either way.
 */
const preset = '../../jest.preset.js';

export default {
	coverageDirectory: '../../coverage/apps/server',
	projects: [
		{
			displayName: 'server',
			preset,
			setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
			// The Node specs are the `server-preload` project's (below).
			testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/preload/'],
			transform: {
				'^.+\\.(ts|mjs|js|html)$': [
					'jest-preset-angular',
					{
						tsconfig: '<rootDir>/tsconfig.spec.json',
						stringifyContentPathRegex: '\\.(html|svg)$'
					}
				]
			},
			// `transformIgnorePatterns` is inherited from the root `jest.preset.js` (the ESM-only packages plus
			// every `.mjs` bundle). Do not redefine it here: a project key REPLACES the preset list, and the one
			// that used to sit here carried only the `.mjs` exception, so @datorama/akita, @ngneat/* and
			// lodash-es were never transformed and the suites that reach them failed to load.
			snapshotSerializers: [
				'jest-preset-angular/build/serializers/no-ng-attributes',
				'jest-preset-angular/build/serializers/ng-snapshot',
				'jest-preset-angular/build/serializers/html-comment'
			]
		},
		{
			displayName: 'server-preload',
			preset,
			testEnvironment: 'node',
			testMatch: ['<rootDir>/src/preload/**/*.spec.ts'],
			transform: {
				'^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
			}
		}
	]
};
