/**
 * The acknowledgement rules of `api-parity-check.mjs`, held to the shapes they must read (#10901).
 *
 * The gate runs at module level against a repository root, so each case builds a small root of its own and
 * reads the gate's report: a REST-only route that was commented out must read as not mapped (Greptile), and a
 * mirror field declared without arguments must still read as declared (CodeRabbit), for the single-route rule
 * and for the ledger rule alike.
 *
 * Run from the repository root: `node --test tools/scripts/api-parity-check.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE = join(dirname(fileURLToPath(import.meta.url)), 'api-parity-check.mjs');

/**
 * Runs the gate over a root holding exactly `files` (paths relative to `packages/plugins`).
 *
 * @param {Record<string, string>} files The fixture's sources.
 * @returns {string} The gate's report.
 */
function report(files) {
	const root = mkdtempSync(join(tmpdir(), 'api-parity-'));

	try {
		for (const [path, source] of Object.entries(files)) {
			const full = join(root, 'packages', 'plugins', path);
			mkdirSync(dirname(full), { recursive: true });
			writeFileSync(full, source);
		}

		const run = spawnSync(process.execPath, [GATE, root], { encoding: 'utf8' });

		return `${run.stdout}${run.stderr}`;
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

const controller = (resource, body) => `@Controller('/${resource}')\nexport class C {\n${body}\n}\n`;
const schema = (sdl) => `export const s = gql\`\n${sdl}\n\`;\n`;

test('a REST-only route that was commented out reads as not mapped', () => {
	const out = report({
		'returns/src/order-claim.controller.ts': controller(
			'order-claims',
			"\t// @Post(':id/close')\n\t/* @Post(':id/close') */\n\tasync close() {}"
		)
	});

	assert.match(out, /\[stale-route\] returns: POST \/order-claims\/:id\/close is acknowledged as REST-only/);
});

test('a live REST-only route with no mirror is acknowledged, not reported', () => {
	const out = report({
		'returns/src/order-exchange.controller.ts': controller(
			'order-exchanges',
			"\t@Post(':id/close')\n\tasync close() {}"
		),
		'order/src/order-change-action.controller.ts': controller(
			'order-change-actions',
			'\t@Post()\n\tasync create() {}'
		)
	});

	assert.doesNotMatch(out, /\[(?:stale-route|route-mirrored)\] [a-z]+: POST \/order-(?:exchanges|change-actions)/);
	assert.match(out, /POST \/order-exchanges\/:id\/close\s+returns — \(no closeOrderExchange\)/);
	assert.match(out, /POST \/order-change-actions\s+order — \(no createOrderChangeAction\)/);
});

test('a mirror field declared without arguments still reads as declared', () => {
	const out = report({
		'returns/src/order-exchange.controller.ts': controller(
			'order-exchanges',
			"\t@Post(':id/close')\n\tasync close() {}"
		),
		'returns/src/graphql/schema-extensions.ts': schema('type Mutation {\n\tcloseOrderExchange: Boolean!\n}')
	});

	assert.match(out, /\[route-mirrored\] returns: POST \/order-exchanges\/:id\/close .* declares closeOrderExchange/);
});

test('a ledger write field declared without arguments fails the ledger rule', () => {
	const out = report({
		'order/src/order-summary.controller.ts': controller('order-summaries', '\t@Post()\n\tasync create() {}'),
		'order/src/graphql/schema-extensions.ts': schema('type Mutation {\n\tcreateOrderSummary: OrderSummary\n}')
	});

	assert.match(out, /\[ledger-write\] order: \/order-summaries .* declares createOrderSummary/);
});
