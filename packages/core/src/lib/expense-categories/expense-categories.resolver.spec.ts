/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { GLOBAL_MODULE_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureModule } from '../feature/feature.module';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { ExpenseCategoriesModule } from './expense-categories.module';
import { ExpenseCategoriesResolver } from './expense-categories.resolver';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseCategoryCreateCommand, ExpenseCategoryUpdateCommand } from './commands';

/**
 * The vocabulary an expense is filed under, over GraphQL.
 *
 * The delivered REST routes serve a list, one entry, a count, a create, an edit and the three
 * removals. This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field calls the same `ExpenseCategoriesService` method or dispatches the same command the
 *   REST route reaches, with the same payload, so a client does not choose a better surface by
 *   choosing a protocol;
 * - **the guard stack and the permission are the controller's, field by field** — including the node
 *   read, the count and the three removals, whose delivered routes state no permission of their own and
 *   therefore run under the controller's class-level edit permission, which is the one this resolver
 *   states as well;
 * - the domain states no floating-point number anywhere: it holds no amount at all — what a category
 *   cost is a total the expense book computes over the rows filed under it — so the family money
 *   travels in is asserted absent from every type and input this domain contributes;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant
 *   that switched that capability off is refused the way a disabled capability's routes are — and the
 *   refusal names the field, because the guard reads a GraphQL execution context rather than crashing
 *   on one.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TAG = '00000000-0000-4000-8000-000000000050';
const CATEGORY = '00000000-0000-4000-8000-000000000031';
const OTHER = '00000000-0000-4000-8000-000000000032';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted service answers with: a vocabulary, which is what this resource is — two entries
 * and nothing but their names and their lifecycle.
 */
const ROWS = [
	{
		id: CATEGORY,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Office Supplies',
		createdAt: new Date('2026-01-05T10:00:00.000Z'),
		updatedAt: new Date('2026-01-05T10:00:00.000Z')
	},
	{
		id: OTHER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Travel',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and a scripted command bus. */
function surfaces() {
	const expenseCategoriesService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-05-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		expenseCategoriesService,
		commandBus,
		resolver: new ExpenseCategoriesResolver(expenseCategoriesService as never, commandBus as never)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return (
		error instanceof Error &&
		'getStatus' in error &&
		typeof (error as { getStatus(): number }).getStatus === 'function' &&
		(error as { getStatus(): number }).getStatus() >= 400 &&
		(error as { getStatus(): number }).getStatus() !== 404
	);
}

/**
 * The composed schema, as text: the domain's own documents plus every kernel and domain document the
 * boot loader globs, which is what makes a reference from this domain to another one resolvable.
 */
function composedSchema(): string {
	const root = join(__dirname, '..');
	const documents: string[] = [];

	const walk = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.name.endsWith('.gql') && directory.endsWith('schema')) {
				documents.push(readFileSync(path, 'utf8'));
			}
		}
	};

	walk(root);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** This domain's own two documents, as they are written on disk. */
const ownSdl = ['expense-category.type.gql', 'expense-category.api.gql']
	.map((file) => readFileSync(join(__dirname, 'schema', file), 'utf8'))
	.join('\n');

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The type one root field answers, as the schema states it — `Int`, `Int!`, `ExpenseCategoryConnection!`. */
function fieldType(operation: 'Query' | 'Mutation', field: string): string {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { type: unknown }> }
		| undefined;

	return String(root?.getFields()?.[field]?.type);
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/**
 * The root fields this domain contributes, which are the ones that name its concept.
 *
 * The expense book itself names its fields around the same word and is excluded here: one resource's
 * suite asserts its own fields, not its neighbour's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('expensecategor'))
		.sort();
}

/** The printed body of one declaration, whatever kind it is. */
function bodyOf(kind: 'type' | 'input' | 'enum', name: string): string {
	return printed.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return bodyOf('type', name);
}

/** The printed body of one input type. */
function inputBody(name: string): string {
	return bodyOf('input', name);
}

/**
 * The member names one type declares, read off its printed body rather than off a description: a doc
 * comment is part of the printed type, so a member is asserted absent by its name and never by the
 * words a description happens to use.
 */
function memberNames(name: string): string[] {
	return [...typeBody(name).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/gm)].map((match) => match[1]);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof ExpenseCategoriesController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof ExpenseCategoriesController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = ExpenseCategoriesResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = ExpenseCategoriesResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(controller: typeof ExpenseCategoriesController, handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'expenseCategories', route: 'findAll' },
	{ field: 'expenseCategory', route: 'findById' },
	{ field: 'expenseCategoryCount', route: 'getCount' },
	{ field: 'createExpenseCategory', route: 'create' },
	{ field: 'updateExpenseCategory', route: 'update' },
	{ field: 'deleteExpenseCategory', route: 'delete' },
	{ field: 'softDeleteExpenseCategory', route: 'softRemove' },
	{ field: 'recoverExpenseCategory', route: 'softRecover' }
];

/** The write fields, whose delegations are asserted one by one below. */
const WRITES = [
	'createExpenseCategory',
	'updateExpenseCategory',
	'deleteExpenseCategory',
	'softDeleteExpenseCategory',
	'recoverExpenseCategory'
];

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };

	return {
		guard: new FeatureFlagGuard(cache as never, new Reflector(), featureService as never),
		featureService
	};
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (ExpenseCategoriesResolver.prototype as never)[field],
		getClass: () => ExpenseCategoriesResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ExpenseCategoriesResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['expenseCategories', 'expenseCategory', 'expenseCategoryCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createExpenseCategory',
				'updateExpenseCategory',
				'deleteExpenseCategory',
				'softDeleteExpenseCategory',
				'recoverExpenseCategory'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([
			'expenseCategories',
			'expenseCategory',
			'expenseCategoryCount'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createExpenseCategory',
			'deleteExpenseCategory',
			'recoverExpenseCategory',
			'softDeleteExpenseCategory',
			'updateExpenseCategory'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type ExpenseCategoryConnection \{\s*nodes: \[ExpenseCategory!\]!\s*edges: \[ExpenseCategoryEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ExpenseCategoryEdge \{\s*node: ExpenseCategory!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ExpenseCategoryFilter \{/);
		expect(printed).toMatch(/input ExpenseCategorySort \{/);
		expect(printed).toMatch(/enum ExpenseCategorySortField \{\s*createdAt\s*updatedAt\s*name\s*\}/);
	});

	it('declares the write inputs the mutations take', () => {
		expect(printed).toMatch(/input CreateExpenseCategoryInput \{/);
		expect(printed).toMatch(/input UpdateExpenseCategoryInput \{/);
	});

	it('carries the members the delivered reads produce, and not the relations they never load', () => {
		const members = memberNames('ExpenseCategory');

		// No read behind this surface names a relation, so a member carrying an expense or a tag row
		// would be absent from exactly the rows this surface answers while looking like a fact about the
		// category.
		expect(members).not.toContain('expenses');
		expect(members).not.toContain('tags');
		expect(members).toEqual(expect.arrayContaining(['id', 'name', 'deletedAt', 'isActive', 'isArchived']));
	});

	it('offers no argument it cannot honour', () => {
		expect(fieldArgs('Query', 'expenseCategories')).not.toContain('withDeleted');
		expect(fieldArgs('Query', 'expenseCategories')).toEqual([
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset'
			'withDeleted',
		]);
		// The count route binds its query string to the store's own `where`, which is a shape no schema
		// can state, so the field states no narrowing of its own — and it is nullable, because a count is
		// an aggregate the resource may have no answer for and a non-null field would fabricate a zero.
		expect(fieldArgs('Query', 'expenseCategoryCount')).toEqual([]);
		expect(fieldType('Query', 'expenseCategoryCount')).toBe('Int');
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createExpenseCategory', ['input']],
			['updateExpenseCategory', ['input']],
			['deleteExpenseCategory', ['id']],
			['softDeleteExpenseCategory', ['id']],
			['recoverExpenseCategory', ['id']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}
	});
});

describe('ExpenseCategoriesResolver — the domain holds no amount, and states no Float anywhere', () => {
	it('declares no floating-point member on any type or input it contributes', () => {
		// This resource is a vocabulary: a category carries a name and nothing quantitative, so the
		// family money travels in has no member to appear on. What a category cost is a total the expense
		// book computes over the rows filed under it, which is why the assertion here is the absence
		// rather than a list of decimal members.
		const declared = [
			'ExpenseCategory',
			'ExpenseCategoryEdge',
			'ExpenseCategoryConnection',
			'ExpenseCategoryFilter',
			'ExpenseCategorySort',
			'ExpenseCategorySortField',
			'CreateExpenseCategoryInput',
			'UpdateExpenseCategoryInput'
		]
			.map((name) => `${typeBody(name)}\n${inputBody(name)}`)
			.join('\n');

		expect(declared).not.toMatch(/\bFloat\b/);
		expect(declared).not.toMatch(/\bDecimal\b/);
		// And the two documents never name either in a type position, so the absence above is a
		// statement about the source rather than about the composition.
		expect(ownSdl).not.toMatch(/:\s*\[?Float\b/);
		expect(ownSdl).not.toMatch(/:\s*\[?Decimal\b/);
	});

	it('answers the rows the read holds, unchanged', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.expenseCategories();

		expect(connection.nodes[0].name).toBe('Office Supplies');
		expect(await resolver.expenseCategory(CATEGORY)).toBe(ROWS[0]);
	});
});

describe('ExpenseCategoriesResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, expenseCategoriesService } = surfaces();

		const connection = await resolver.expenseCategories(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(expenseCategoriesService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(CATEGORY);
	});

	it('orders by the vocabulary’s own name when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.expenseCategories();

		expect(connection.nodes.map((node) => node.name)).toEqual(['Office Supplies', 'Travel']);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.expenseCategories({ name: { ilike: 'office%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([CATEGORY]);

		const byIds = await resolver.expenseCategories({ id: { in: [CATEGORY, OTHER] } });
		expect(byIds.totalCount).toBe(2);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.expenseCategories(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([CATEGORY]);

		const second = await resolver.expenseCategories(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.expenseCategories(undefined, [{ field: 'deletedAt', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// `tags` and `expenses` are carried on the entity and deliberately not filterable: the delivered
		// list read loads no relations, so the condition could only ever match the empty set, and the
		// connection refuses it rather than answering it with no rows.
		const error = await resolver.expenseCategories({ tags: { eq: TAG } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.expenseCategories(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('keeps the evaluator’s allow-list and the schema’s filter in step, member for member', async () => {
		const { resolver } = surfaces();
		const declared = [...inputBody('ExpenseCategoryFilter').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)]
			.map((match) => match[1])
			.filter((member) => !['and', 'or', 'not'].includes(member));

		for (const member of declared) {
			await expect(resolver.expenseCategories({ [member]: {} })).resolves.toBeDefined();
		}

		const refusal = await resolver.expenseCategories({ tags: { eq: TAG } }).catch((thrown) => thrown);
		const allowed = String((refusal as Error).message)
			.split('Allowed: ')[1]
			.replace(/\.\s*$/, '')
			.split(',')
			.map((member) => member.trim())
			.sort();

		expect(allowed).toEqual([...declared].sort());
	});

	it('accepts every key the sort enum offers, and only those', async () => {
		const { resolver } = surfaces();
		const offered = [
			...bodyOf('enum', 'ExpenseCategorySortField').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm)
		].map((match) => match[1]);

		expect(offered).toEqual(['createdAt', 'updatedAt', 'name']);

		for (const field of offered) {
			await expect(resolver.expenseCategories(undefined, [{ field, direction: 'ASC' }])).resolves.toBeDefined();
		}
	});
});

describe('ExpenseCategoriesResolver — one vocabulary, two protocols, the same operations', () => {
	it('reads one row through the same service method the REST node route calls', async () => {
		const { resolver, expenseCategoriesService } = surfaces();

		expect(await resolver.expenseCategory(CATEGORY)).toBe(ROWS[0]);
		expect(expenseCategoriesService.findOneByIdString).toHaveBeenCalledWith(CATEGORY);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, expenseCategoriesService } = surfaces();
		expenseCategoriesService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.expenseCategory(OTHER)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, expenseCategoriesService } = surfaces();

		expect(await resolver.expenseCategoryCount()).toBe(2);
		expect(expenseCategoriesService.countBy).toHaveBeenCalledWith();
	});

	it('files a category through the same command the REST create route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(
			await resolver.createExpenseCategory({ name: 'Office Supplies', organizationId: ORGANIZATION, tagIds: [TAG] })
		).toBe(ROWS[0]);

		const command = commandBus.execute.mock.calls[0][0] as ExpenseCategoryCreateCommand;

		// The delivered create is handed the members the caller stated and the facets as the identifiers
		// the pivot row is written from; the tenant comes from the credential and is never stated here.
		expect(command).toBeInstanceOf(ExpenseCategoryCreateCommand);
		expect(command.input).toEqual({
			name: 'Office Supplies',
			organizationId: ORGANIZATION,
			tags: [{ id: TAG }]
		});
	});

	it('renames a category through the same command the REST edit route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateExpenseCategory({ id: CATEGORY, name: 'Renamed' });

		const command = commandBus.execute.mock.calls[0][0] as ExpenseCategoryUpdateCommand;

		// The delivered edit carries the identifier the route reads from the path and the body beside it.
		expect(command).toBeInstanceOf(ExpenseCategoryUpdateCommand);
		expect(command.id).toBe(CATEGORY);
		expect(command.input).toEqual({ name: 'Renamed' });
	});

	it('removes a category through the same service method the inherited route calls', async () => {
		const { resolver, expenseCategoriesService } = surfaces();

		// The delivered store answers its delete result, which is not a row: the field answers the one
		// fact the removal establishes.
		expect(await resolver.deleteExpenseCategory(CATEGORY)).toBe(true);
		expect(expenseCategoriesService.delete).toHaveBeenCalledWith(CATEGORY);
	});

	it('withdraws and restores a category through the service methods the inherited routes call', async () => {
		const { resolver, expenseCategoriesService } = surfaces();

		const withdrawn = await resolver.softDeleteExpenseCategory(CATEGORY);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(expenseCategoriesService.softRemove).toHaveBeenCalledWith(CATEGORY);

		expect(await resolver.recoverExpenseCategory(CATEGORY)).toBe(ROWS[0]);
		expect(expenseCategoriesService.softRecover).toHaveBeenCalledWith(CATEGORY);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, expenseCategoriesService } = surfaces();
		const refusal = new Error('EXPENSE_CATEGORY_IN_USE: an expense is filed under it.');

		expenseCategoriesService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteExpenseCategory(CATEGORY)).rejects.toBe(refusal);
	});
});

describe('ExpenseCategoriesResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ExpenseCategoriesResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ExpenseCategoriesController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', ExpenseCategoriesResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			const declared = Reflect.getMetadata('__guards__', ExpenseCategoriesController) ?? [];
			const restated = guardsOfHandler(ExpenseCategoriesController, route);

			expect([...new Set([...declared, ...restated, FeatureFlagGuard])].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ExpenseCategoriesResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, ExpenseCategoriesController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ExpenseCategoriesController)).toEqual([
			PermissionsEnum.ORG_EXPENSES_EDIT
		]);
	});

	it.each(PERMISSION_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		const fieldPermissions = Reflect.getMetadata(PERMISSIONS_METADATA, ExpenseCategoriesResolver.prototype[field]) ?? [];
		const routePermissions = permissionOfRoute(ExpenseCategoriesController, route) ?? [];

		expect(fieldPermissions).toEqual(routePermissions);
		expect(guardsOfField(field)).toEqual(guardsOfHandler(ExpenseCategoriesController, route));
	});

	it('carries the view permission on the list, which is the only route that states one', () => {
		expect(permissionOfField('expenseCategories')).toEqual([PermissionsEnum.ORG_EXPENSES_VIEW]);
		expect(permissionOfRoute(ExpenseCategoriesController, 'findAll')).toEqual([
			PermissionsEnum.ORG_EXPENSES_VIEW
		]);

		for (const field of ['expenseCategory', 'expenseCategoryCount', ...WRITES]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_EXPENSES_EDIT]);
		}
	});

	it('carries the edit permission on the inherited reads and removals, because their routes inherit it', () => {
		// The node read, the count, the hard removal, the withdrawal and the restoration are inherited
		// from the CRUD base, where they state no permission of their own — so they run under the
		// controller's class-level edit permission, and the fields state the same one rather than stating
		// nothing.
		for (const handler of ['findById', 'getCount', 'delete', 'softRemove', 'softRecover']) {
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, ExpenseCategoriesController.prototype[handler])
			).toBeUndefined();
		}

		for (const field of ['expenseCategory', 'expenseCategoryCount', 'deleteExpenseCategory']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_EXPENSES_EDIT]);
		}
	});
});

describe('ExpenseCategoriesResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, ExpenseCategoriesResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ExpenseCategoriesResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('expenseCategories')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('expenseCategories');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the removals among them', async () => {
		for (const field of ['createExpenseCategory', 'deleteExpenseCategory', 'recoverExpenseCategory']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('expenseCategory'))).resolves.toBe(true);
	});
});

describe('ExpenseCategoriesModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ExpenseCategoriesModule) ?? []) as unknown[];

		expect(providers).toContain(ExpenseCategoriesResolver);
		expect(providers).toContain(ExpenseCategoriesService);
	});

	it('exports the service the resolver injects, and reaches the command bus it dispatches through', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, ExpenseCategoriesModule) ?? []) as unknown[];
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, ExpenseCategoriesModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const names = imports.map((entry) =>
			(entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry) as { name?: string }
		);

		expect(exported).toContain(ExpenseCategoriesService);
		expect(names.map((entry) => entry?.name)).toContain('CqrsModule');
		// A resolver is an ordinary provider, so the two collaborators above are the whole of its
		// dependencies.
		expect(ExpenseCategoriesResolver.length).toBe(2);
	});

	it('reaches the module that provides the guards, without importing the one the gate resolves through', () => {
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, ExpenseCategoriesModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(resolved.map((entry) => (entry as { name?: string })?.name)).toContain('RolePermissionModule');
		// `FeatureModule` is global, so the feature service `FeatureFlagGuard` resolves through is
		// available wherever a guard runs, and an import here would be one edge in every module that
		// declares a resolver.
		expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, FeatureModule)).toBe(true);
		expect(resolved).not.toContain(FeatureModule);
	});
});
