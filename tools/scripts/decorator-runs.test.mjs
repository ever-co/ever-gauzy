/**
 * The reader of `decorator-runs.mjs`, held to the shapes it must read.
 *
 * Two gates build on it (`graphql-feature-gate-check.mjs`, `api-parity-check.mjs`), and a reader that silently
 * attaches a decorator to the wrong class or member is how a gate stops measuring without going red.
 *
 * Run from the repository root: `node --test tools/scripts/decorator-runs.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decoratedClasses, guardsOf, parenthesisBalance, states } from './decorator-runs.mjs';

const SOURCE = `import { UseGuards } from '@nestjs/common';

@InputType()
export class WidgetInput {
	@Field()
	name: string;
}

/**
 * @Resolver() in a comment is not a decorator.
 */
@Resolver(() => Widget)
@UseGuards(
	TenantPermissionGuard,
	FeatureFlagGuard
)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.WIDGETS_VIEW)
export class WidgetResolver extends WidgetBase {
	constructor(private readonly widgets: WidgetService) {}

	/** The list. */
	@Query(() => [Widget], { name: 'widgets', description: 'a (parenthesised) note' })
	@UseGuards(PermissionGuard)
	async list(
		@Args('filter', { nullable: true }) filter?: WidgetFilter
	): Promise<Widget[]> {
		return [];
	}

	// @Permissions(PermissionsEnum.WIDGETS_DELETE)
	@Mutation(() => Boolean)
	public async deleteWidget(@Args('id') id: string): Promise<boolean> {
		return true;
	}
}
`;

test('every class keeps its own decorator run', () => {
	const classes = decoratedClasses(SOURCE);

	assert.deepEqual(
		classes.map((declared) => declared.name),
		['WidgetInput', 'WidgetResolver']
	);
	assert.ok(states(classes[0].decorators, 'InputType'));
	assert.ok(!states(classes[0].decorators, 'Resolver'));
	assert.ok(states(classes[1].decorators, 'Resolver'));
	assert.match(classes[1].declaration, /extends WidgetBase/);
});

test('a decorator that spans lines is read whole, and a guard chain is read from it', () => {
	const [, resolver] = decoratedClasses(SOURCE);

	assert.deepEqual(guardsOf(resolver.decorators), ['TenantPermissionGuard', 'FeatureFlagGuard']);
});

test('a member keeps the decorators above it, and a parenthesis inside a string does not end the run', () => {
	const [, resolver] = decoratedClasses(SOURCE);
	const list = resolver.members.find((member) => member.name === 'list');

	assert.ok(list);
	assert.equal(list.decorators.length, 2);
	assert.ok(states(list.decorators, 'Query'));
	assert.deepEqual(guardsOf(list.decorators), ['PermissionGuard']);
});

test('a decorator that was commented out is not read', () => {
	const [, resolver] = decoratedClasses(SOURCE);
	const remove = resolver.members.find((member) => member.name === 'deleteWidget');

	assert.ok(remove);
	assert.ok(states(remove.decorators, 'Mutation'));
	assert.ok(!states(remove.decorators, 'Permissions'));
});

test('the line a member is reported at is the line it is declared on', () => {
	const [, resolver] = decoratedClasses(SOURCE);
	const remove = resolver.members.find((member) => member.name === 'deleteWidget');

	assert.equal(SOURCE.split('\n')[remove.line - 1].trim().startsWith('public async deleteWidget('), true);
});

test('parentheses are counted outside string literals only', () => {
	assert.equal(parenthesisBalance("@Query(() => X, { description: 'a (b' })"), 0);
	assert.equal(parenthesisBalance('@UseGuards('), 1);
	assert.equal(parenthesisBalance('@Get(`:id/(x`)'), 0);
});
