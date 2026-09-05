/**
 * Root ESLint flat config for the Ever Gauzy workspace.
 *
 * ESLint 9 reads `eslint.config.js` and never reads `.eslintrc.json`. The previous version of
 * this file did:
 *
 *     const { FlatESLint } = require('@nx/eslint-plugin-nx');
 *     module.exports = new FlatESLint({ overrides: [] });
 *
 * which could never have worked: a flat config must export an ARRAY, no Nx package has ever
 * exported a `FlatESLint` class, and `@nx/eslint-plugin-nx@16.0.0-beta.1` is the beta-only
 * predecessor name of `@nx/eslint-plugin`. Requiring it pulled a nested `@nx/devkit@16` that
 * expects an `nx` internal path nx@22 no longer ships, so every `eslint` invocation in the
 * workspace died with `Cannot find module 'nx/src/utils/typescript'`.
 *
 * Shape below follows what Nx 22 generates itself — see
 * `@nx/eslint/src/generators/init/global-eslint-config.js` (`getGlobalFlatEslintConfiguration`).
 *
 * Project configs inherit this file directly (`require('../../eslint.config.js')`). They used to
 * spread the legacy `.eslintrc.json`, which is a JSON *object*, so `[...baseConfig]` threw
 * `TypeError: baseConfig is not iterable` and every `nx lint <project>` failed.
 */
const nx = require('@nx/eslint-plugin');

/** Files ESLint should never look at. */
const IGNORES = [
	'**/node_modules',
	'**/dist',
	'**/build',
	'**/out-tsc',
	'**/coverage',
	'**/.angular',
	'**/.nx',
	'**/*.d.ts',
	// Generated TypeORM migrations: several hundred machine-written files that dominate both the
	// lint wall clock and the finding count, and that nobody hand-edits.
	'packages/core/src/lib/database/migrations/**',
	// Codegen output.
	'**/*.generated.ts',
	'packages/plugins/integration-ai/src/lib/sdk/gauzy-ai-sdk.ts',
	'**/src/assets/**'
];

module.exports = [
	// Registers the `@nx` plugin namespace (enforce-module-boundaries, dependency-checks,
	// nx-plugin-checks) that the project configs rely on.
	...nx.configs['flat/base'],
	...nx.configs['flat/typescript'],
	...nx.configs['flat/javascript'],

	// Replaces the legacy root `.eslintrc.json`'s `"ignorePatterns": ["**/*"]`, which disabled
	// linting for the entire workspace.
	{ ignores: IGNORES },

	{
		files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts', '**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
		rules: {
			// Carried over from the legacy root config, with the plugin renamed `@nrwl/nx` -> `@nx`.
			// The `allow` entry is Nx 22's default and is what lets a project's eslint.config.js
			// require this file without tripping the boundary rule on itself.
			'@nx/enforce-module-boundaries': [
				'error',
				{
					enforceBuildableLibDependency: true,
					allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
					depConstraints: [{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }]
				}
			],

			// `@nx/eslint-plugin`'s presets still enable this rule, but typescript-eslint
			// deprecated it in v8.0.0 and replaced it with `no-empty-object-type`, which the
			// same presets also enable. Leaving both on double-reports every occurrence
			// (90 + 90 in packages/contracts alone). Off, so the count means something.
			'@typescript-eslint/no-empty-interface': 'off',

			// Preserved from the legacy root config: formatting is Prettier's job.
			// The legacy config also disabled `@typescript-eslint/comma-dangle`; that rule no
			// longer exists in typescript-eslint v8 (it moved to @stylistic), so it is dropped
			// rather than carried forward as a name that can never resolve.
			'comma-dangle': 'off',

			// Re-enabled deliberately. `typescript-eslint`'s `eslint-recommended` overlay — pulled
			// in by `nx.configs['flat/typescript']` — turns these OFF on the grounds that `tsc`
			// already reports them. That reasoning does not hold here: no CI job in this
			// workspace runs `tsc --noEmit`, and a duplicate object key in `packages/core/jest.config.ts`
			// has already silently changed behaviour once. These are the guardrail.
			'no-dupe-keys': 'error',
			'no-dupe-class-members': 'error',
			'no-dupe-args': 'error',
			'no-unreachable': 'error'
		}
	}
];
