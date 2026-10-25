/**
 * The second reading of `graphql-feature-gate-check.mjs`: a `@FeatureFlag(...)` is a gate only when `FeatureFlagGuard`
 * is in the chain of the operation it is meant to close.
 *
 * The gate runs at module level against a repository root, so each case builds a small root of its own and reads the
 * gate's report and exit status.
 *
 * Run from the repository root: `node --test tools/scripts/graphql-feature-gate-check.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE = join(dirname(fileURLToPath(import.meta.url)), 'graphql-feature-gate-check.mjs');

/**
 * Runs the gate over a root holding one resolver file under `packages/plugins/widget/src`.
 *
 * @param {string} source The resolver file's text.
 * @returns {{ out: string, status: number | null }} The gate's report and exit status.
 */
function run(source) {
	const root = mkdtempSync(join(tmpdir(), 'feature-gate-'));

	try {
		const full = join(root, 'packages', 'plugins', 'widget', 'src', 'widget.resolver.ts');
		mkdirSync(dirname(full), { recursive: true });
		writeFileSync(full, source);

		const result = spawnSync(process.execPath, [GATE, root], { encoding: 'utf8' });

		return { out: `${result.stdout}${result.stderr}`, status: result.status };
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

const QUERY = '\t@Query(() => [Widget])\n\tasync widgets() {}';
const MUTATION = '\t@Mutation(() => Widget)\n\tasync createWidget() {}';

test('a gate with FeatureFlagGuard on the class passes', () => {
	const { out, status } = run(
		`@Resolver()\n@UseGuards(TenantPermissionGuard, FeatureFlagGuard)\n@FeatureFlag(FEATURE_GRAPHQL)\nexport class WidgetResolver {\n${QUERY}\n\n${MUTATION}\n}\n`
	);

	assert.match(out, /0 state a gate that no FeatureFlagGuard in their chain reads/);
	assert.equal(status, 0);
});

test('a gate with no FeatureFlagGuard anywhere fails for every operation', () => {
	const { out, status } = run(
		`@Resolver()\n@UseGuards(TenantPermissionGuard, PermissionGuard)\n@FeatureFlag(FEATURE_GRAPHQL)\nexport class WidgetResolver {\n${QUERY}\n\n${MUTATION}\n}\n`
	);

	assert.match(out, /2 state a gate that no FeatureFlagGuard in their chain reads/);
	assert.match(
		out,
		/widget\.resolver\.ts:\d+ {2}→ WidgetResolver\.widgets: the code is declared and the capability gates nothing/
	);
	assert.match(out, /WidgetResolver\.createWidget: the code is declared/);
	assert.match(out, /graphql feature gate check: FAILED/);
	assert.equal(status, 1);
});

test('a guard stated on one operation does not reach its neighbour', () => {
	const { out, status } = run(
		`@Resolver()\n@UseGuards(TenantPermissionGuard)\n@FeatureFlag(FEATURE_GRAPHQL)\nexport class WidgetResolver {\n` +
			`\t@UseGuards(FeatureFlagGuard)\n${QUERY}\n\n${MUTATION}\n}\n`
	);

	assert.match(out, /1 state a gate that no FeatureFlagGuard in their chain reads/);
	assert.match(out, /WidgetResolver\.createWidget/);
	assert.doesNotMatch(out, /WidgetResolver\.widgets:/);
	assert.equal(status, 1);
});

test('a guard that was commented out is not read as stated', () => {
	const { out, status } = run(
		`@Resolver()\n// @UseGuards(TenantPermissionGuard, FeatureFlagGuard)\n@UseGuards(TenantPermissionGuard)\n@FeatureFlag(FEATURE_GRAPHQL)\nexport class WidgetResolver {\n${QUERY}\n}\n`
	);

	assert.match(out, /WidgetResolver\.widgets: the code is declared/);
	assert.equal(status, 1);
});

test('an input type declared above the resolver does not take the resolver’s guards', () => {
	const { out, status } = run(
		'@InputType()\nexport class WidgetInput {\n\t@Field()\n\tname: string;\n}\n\n' +
			`@Resolver()\n@UseGuards(\n\tTenantPermissionGuard,\n\tFeatureFlagGuard\n)\n@FeatureFlag(FEATURE_GRAPHQL)\nexport class WidgetResolver {\n${QUERY}\n}\n`
	);

	assert.match(out, /0 state a gate that no FeatureFlagGuard in their chain reads/);
	assert.equal(status, 0);
});

test('a class whose operations are all inherited is held to the guard on the class', () => {
	const { out, status } = run(
		'@Resolver()\n@UseGuards(TenantPermissionGuard)\n@FeatureFlag(FEATURE_GRAPHQL)\nexport class WidgetResolver extends WidgetBaseResolver {}\n'
	);

	assert.match(out, /→ WidgetResolver: the code is declared and the capability gates nothing/);
	assert.equal(status, 1);
});
