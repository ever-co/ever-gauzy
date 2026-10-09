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

// Files ESLint should never look at. Replaces the legacy root `.eslintrc.json`'s
// `"ignorePatterns": ["**/*"]`, which disabled linting for the entire workspace.
//
// Declared as a named binding rather than inline in the array below: Codacy's PMD parses a
// bare object literal in that position as a block statement and reports "Unnecessary block".
// After `=` there is no such ambiguity. `name` is a real ESLint 9 flat-config field, which
// surfaces in config inspection; typescript-eslint's own bundled configs set it too.
const globalIgnores = {
	name: 'gauzy/global-ignores',
	ignores: [
		'**/node_modules',
		'**/dist',
		'**/build',
		'**/out-tsc',
		'**/coverage',
		'**/.angular',
		'**/.nx',
		'**/*.d.ts',
		// Generated TypeORM migrations: several hundred machine-written files that dominate
		// both the lint wall clock and the finding count, and that nobody hand-edits.
		'packages/core/src/lib/database/migrations/**',
		// Codegen output.
		'**/*.generated.ts',
		'packages/plugins/integration-ai/src/lib/sdk/gauzy-ai-sdk.ts',
		'**/src/assets/**'
	]
};

module.exports = [
	// Registers the `@nx` plugin namespace (enforce-module-boundaries, dependency-checks,
	// nx-plugin-checks) that the project configs rely on.
	...nx.configs['flat/base'],
	...nx.configs['flat/typescript'],
	...nx.configs['flat/javascript'],

	globalIgnores,

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
					depConstraints: [
						// TASK 6 (improvement roadmap) — Plugin/Core Boundary Enforcement. `packages/core`
						// (`type:core`) may depend on itself and the foundational shared libs it actually
						// uses (`type:shared`: auth/common/config/constants/contracts/plugin/scheduler/utils,
						// plus the UI foundations below), but never on a specific integration (`type:plugin`,
						// every package under `packages/plugins/*`). Core already depends on plugins only
						// through `@gauzy/plugin`'s neutral contract (`GauzyCorePlugin`/`IOnPluginBootstrap`),
						// never a concrete plugin package by name — this rule makes that direction
						// structurally impossible to regress, rather than relying on it staying true by
						// convention.
						//
						// Every `enforce-module-boundaries` constraint whose `sourceTag` matches a project
						// applies (AND, not first-match/OR) — so each entry below narrows its own source tag
						// alongside the wildcard fallback at the end without needing to reorder anything.
						{ sourceTag: 'type:core', onlyDependOnLibsWithTags: ['type:core', 'type:shared'] },

						// TASK 8 (improvement roadmap) — Nx Dependency Boundary Enforcement, the plugin-layer
						// analog of TASK 6. A `type:plugin` package (one integration/feature) may depend on
						// core/shared infra, but not reach into ANOTHER plugin's internals directly — that is
						// "Feature A imports Feature B's internals" from the roadmap's own problem statement.
						//
						// `type:plugin-extension-point` is a second tag layered onto the small set of plugins
						// that are genuinely, currently depended on by other plugins (confirmed by grepping
						// every real `@gauzy/plugin-*` import across `packages/plugins/*/src` while building
						// this rule):
						//   - `ai-chat`            — a real, intentional SPI: 15 `ai-provider-*` plugins
						//                            implement its provider interface; `docs` feature-detects
						//                            it at runtime via `require(...)`, never a static import.
						//   - `job-proposal`       — imported by `integration-upwork` (ProposalModule /
						//                            ProposalCreateCommand). NOT a designed extension point —
						//                            grandfathered so a real, working integration isn't broken
						//                            by this rule; a real fix (a shared contract or a
						//                            command/event instead of a direct import) is follow-up work.
						//   - `integration-ai`     — imported by `job-search` (GauzyAIService/GauzyAIModule).
						//                            Same grandfathered-not-endorsed status as `job-proposal`.
						//   - `job-employee-ui`, `job-matching-ui`, `job-proposal-ui`, `job-search-ui` —
						//                            assembled by the `jobs-ui` aggregator plugin, an
						//                            intentional composition-root pattern (bundles the four
						//                            sub-UI plugins into one), not accidental coupling.
						//
						// The allowance is per TARGET, not per source-target pair: any `type:plugin` package may
						// import any package tagged `type:plugin-extension-point`, so a new import of, say,
						// `job-proposal` from a plugin other than `integration-upwork` still passes lint. What the
						// rule does catch is a new import of any plugin WITHOUT that tag, which stops the problem
						// from getting worse without requiring the two grandfathered integrations to be refactored
						// in the same change that adds the rule. Pinning each grandfathered pair takes more than a
						// tag on the target: the constraints matching a project AND together and can only narrow,
						// so each consumer (`integration-upwork`, `job-search`, `jobs-ui`) would need a source tag
						// of its own in place of `type:plugin`. That belongs with the follow-up refactor above.
						{
							sourceTag: 'type:plugin',
							onlyDependOnLibsWithTags: ['type:core', 'type:shared', 'type:plugin-extension-point']
						},

						{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }
					]
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
