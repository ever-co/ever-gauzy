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

// ---------------------------------------------------------------------------------------------
// Permission parity: a GraphQL root field must not ask for nothing where its REST twin asks for a permission.
// ---------------------------------------------------------------------------------------------

const tagController = (body, classDecorators = '@Permissions(PermissionsEnum.ORG_TAGS_VIEW)\n') =>
	`@Controller('/tags')\n@UseGuards(TenantPermissionGuard, PermissionGuard)\n${classDecorators}export class TagController extends CrudController<Tag> {\n${body}\n}\n`;

const tagResolver = (body, classDecorators = '') =>
	`@Resolver()\n@UseGuards(TenantPermissionGuard, PermissionGuard)\n${classDecorators}export class TagResolver {\n${body}\n}\n`;

const DELETE_ROUTE = "\t@Permissions(PermissionsEnum.ORG_TAGS_DELETE)\n\t@Delete(':id')\n\tasync delete() {}";

test('a mutation that states no permission where its REST route states one fails', () => {
	const out = report({
		'tags/src/tag.controller.ts': tagController(DELETE_ROUTE),
		'tags/src/tag.resolver.ts': tagResolver('\t@Mutation(() => Boolean)\n\tasync deleteTag() {}')
	});

	assert.match(out, /1 GraphQL root field\(s\) ask the caller for nothing/);
	assert.match(out, /tag\.resolver\.ts:\d+ {2}Mutation deleteTag \[delete\] → \/tags requires ORG_TAGS_DELETE/);
	assert.match(out, /api parity check: FAILED/);
});

test('a mutation that states the permission, or inherits it from its class, passes', () => {
	for (const resolver of [
		tagResolver(
			'\t@Permissions(PermissionsEnum.ORG_TAGS_DELETE)\n\t@Mutation(() => Boolean)\n\tasync deleteTag() {}'
		),
		tagResolver(
			'\t@Mutation(() => Boolean)\n\tasync deleteTag() {}',
			'@Permissions(PermissionsEnum.ORG_TAGS_DELETE)\n'
		)
	]) {
		const out = report({
			'tags/src/tag.controller.ts': tagController(DELETE_ROUTE),
			'tags/src/tag.resolver.ts': resolver
		});

		assert.match(out, /OK — no GraphQL root field asks for nothing/);
	}
});

test('a route the controller inherits from CrudController carries the class-level permission', () => {
	const out = report({
		'tags/src/tag.controller.ts': tagController('\t// every route is inherited'),
		'tags/src/tag.resolver.ts': tagResolver('\t@Mutation(() => Boolean)\n\tasync softDeleteTag() {}')
	});

	assert.match(out, /Mutation softDeleteTag \[softDelete\] → \/tags requires ORG_TAGS_VIEW/);
});

test('a permission that was commented out is not read as stated', () => {
	const out = report({
		'tags/src/tag.controller.ts': tagController(DELETE_ROUTE),
		'tags/src/tag.resolver.ts': tagResolver(
			'\t// @Permissions(PermissionsEnum.ORG_TAGS_DELETE)\n\t@Mutation(() => Boolean)\n\tasync deleteTag() {}'
		)
	});

	assert.match(out, /Mutation deleteTag \[delete\] → \/tags requires ORG_TAGS_DELETE/);
});

test('a resolver keeps its own class-level permission when an input type is declared above it', () => {
	const out = report({
		'tags/src/tag.controller.ts': tagController(DELETE_ROUTE),
		'tags/src/tag.resolver.ts':
			'@InputType()\nexport class TagInput {\n\t@Field()\n\tname: string;\n}\n\n' +
			tagResolver(
				'\t@Mutation(() => Boolean)\n\tasync deleteTag() {}',
				'@Permissions(PermissionsEnum.ORG_TAGS_DELETE)\n'
			)
	});

	assert.match(out, /OK — no GraphQL root field asks for nothing/);
});

test('a nested controller is not filed under the resource its prefix starts with', () => {
	const out = report({
		'registry/src/plugin-user.controller.ts':
			"@Controller('users/:userId/plugins')\n@UseGuards(TenantPermissionGuard, PermissionGuard)\n" +
			'@Permissions(PermissionsEnum.PLUGIN_VIEW)\nexport class PluginUserController {\n\t@Get()\n\tasync list() {}\n}\n',
		'users/src/user.resolver.ts': tagResolver('\t@Query(() => [User])\n\tasync users() {}')
	});

	assert.doesNotMatch(out, /Query users \[read\]/);
	assert.match(out, /OK — no GraphQL root field asks for nothing/);
});

test('a field is held to the REST read that asks for the least', () => {
	const out = report({
		'tags/src/tag.controller.ts': tagController(
			"\t@Get()\n\tasync findAll() {}\n\n\t@Permissions(PermissionsEnum.ORG_TAGS_EDIT)\n\t@Get(':id')\n\tasync findById() {}",
			''
		),
		'tags/src/tag.resolver.ts': tagResolver('\t@Query(() => Tag)\n\tasync tag() {}')
	});

	assert.match(out, /OK — no GraphQL root field asks for nothing/);
});

test('an empty @Permissions() on a field clears its class requirement, and fails where REST asks for one', () => {
	const out = report({
		'tags/src/tag.controller.ts': tagController(DELETE_ROUTE),
		'tags/src/tag.resolver.ts': tagResolver(
			'\t@Permissions()\n\t@Mutation(() => Boolean)\n\tasync deleteTag() {}',
			'@Permissions(PermissionsEnum.ORG_TAGS_DELETE)\n'
		)
	});

	assert.match(out, /Mutation deleteTag \[delete\] → \/tags requires ORG_TAGS_DELETE/);
	assert.match(out, /api parity check: FAILED/);
});

test('an empty @Permissions() on a REST route clears its class requirement, so an open field mirrors it', () => {
	const out = report({
		'tags/src/tag.controller.ts': tagController("\t@Permissions()\n\t@Delete(':id')\n\tasync delete() {}"),
		'tags/src/tag.resolver.ts': tagResolver('\t@Mutation(() => Boolean)\n\tasync deleteTag() {}')
	});

	assert.doesNotMatch(out, /Mutation deleteTag \[delete\]/);
	assert.match(out, /OK — no GraphQL root field asks for nothing/);
});
