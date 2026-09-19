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
import { RequestContext } from '../core/context';
import { FeatureModule } from '../feature/feature.module';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ExpenseController } from './expense.controller';
import { ExpenseModule } from './expense.module';
import { ExpenseResolver } from './expense.resolver';
import { ExpenseService } from './expense.service';
import { EmployeeService } from '../employee/employee.service';
import { ExpenseCreateCommand, ExpenseDeleteCommand, ExpenseUpdateCommand } from './commands';
import { FindSplitExpenseQuery } from './queries';

/**
 * The expense book over GraphQL.
 *
 * The delivered REST routes serve a list, one row, a count, two split reads that answer a figure no
 * stored row holds, a create, an edit that is the platform's own upsert, a hard removal, and the
 * withdrawal and restoration of a row. This suite pins the half of the two-protocol doctrine that is
 * easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same `ExpenseService` method, dispatches the same command or executes the
 *   same query the REST route reaches, with the same payload and the same request facts, so a client
 *   does not choose a better surface by choosing a protocol;
 * - **the guard stack and the permission are the controller's, field by field** — including the
 *   withdrawal and the restoration, whose delivered routes state no permission of their own and
 *   therefore run under the controller's class-level edit permission, which is the one this resolver
 *   states as well;
 * - every amount and every rate the surface carries is an exact decimal and never a floating-point
 *   number, on the object type, on the filter and on the way into a write, and the one computed figure
 *   the surface answers — a divided share — is documented as the computation it is;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant
 *   that switched that capability off is refused the way a disabled capability's routes are — and the
 *   refusal names the field, because the guard reads a GraphQL execution context rather than crashing
 *   on one.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000020';
const VENDOR = '00000000-0000-4000-8000-000000000030';
const CATEGORY = '00000000-0000-4000-8000-000000000031';
const PROJECT = '00000000-0000-4000-8000-000000000032';
const CONTACT = '00000000-0000-4000-8000-000000000040';
const TAG = '00000000-0000-4000-8000-000000000050';
const EXPENSE = '00000000-0000-4000-8000-000000000010';
const SHARED = '00000000-0000-4000-8000-000000000011';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them, with
 * every amount as the platform's numeric transformer hands it over: a number, and nothing rounded,
 * rescaled or reformatted on the way.
 */
const ROWS = [
	{
		id: EXPENSE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		amount: 150.5,
		currency: 'USD',
		valueDate: new Date('2026-03-05T10:00:00.000Z'),
		typeOfExpense: 'TAX_DEDUCTIBLE',
		notes: 'Conference travel',
		purpose: 'Client meeting',
		taxType: 'PERCENTAGE',
		taxLabel: 'VAT',
		rateValue: 21,
		splitExpense: false,
		status: 'UNINVOICED',
		employeeId: EMPLOYEE,
		vendorId: VENDOR,
		categoryId: CATEGORY,
		projectId: PROJECT,
		organizationContactId: CONTACT,
		createdAt: new Date('2026-03-05T10:00:00.000Z'),
		updatedAt: new Date('2026-03-05T10:00:00.000Z')
	},
	{
		id: SHARED,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		amount: 100,
		currency: 'EUR',
		valueDate: new Date('2026-02-01T10:00:00.000Z'),
		typeOfExpense: 'NOT_TAX_DEDUCTIBLE',
		notes: 'Team lunch',
		purpose: 'Offsite',
		rateValue: null,
		splitExpense: true,
		status: 'PAID',
		employeeId: null,
		vendorId: VENDOR,
		categoryId: CATEGORY,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/**
 * The rows a scripted split read answers: the employee's own expense, and the organization's shared
 * one with the amount the delivered read divided and the two members it set beside it.
 */
const SPLIT_ROWS = [
	{ ...ROWS[0] },
	{ ...ROWS[1], amount: 25, originalValue: 100, employeeCount: 4 }
];

/** The resolver, over scripted services, a scripted command bus and a scripted query bus. */
function surfaces() {
	const expenseService = {
		findAllExpenses: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-05-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const employeeService = { findOneByWhereOptions: jest.fn().mockResolvedValue({ id: EMPLOYEE }) };
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };
	const queryBus = { execute: jest.fn().mockResolvedValue({ items: SPLIT_ROWS, total: SPLIT_ROWS.length }) };

	return {
		expenseService,
		employeeService,
		commandBus,
		queryBus,
		resolver: new ExpenseResolver(
			expenseService as never,
			employeeService as never,
			commandBus as never,
			queryBus as never
		)
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
const ownSdl = ['expense.type.gql', 'expense.api.gql']
	.map((file) => readFileSync(join(__dirname, 'schema', file), 'utf8'))
	.join('\n');

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The type one root field answers, as the schema states it — `Int`, `Int!`, `ExpenseConnection!`. */
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
 * Two sibling concepts name themselves around the same word and are excluded here: the category the
 * cost is filed under is `expenseCategory…`, and the standing arrangements that produce rows like these
 * are `…RecurringExpense…`. One resource's suite asserts its own fields, not its neighbours'.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('expense'))
		.filter((field) => !field.toLowerCase().includes('expensecategor'))
		.filter((field) => !field.toLowerCase().includes('recurring'))
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
function handlersOf(controller: typeof ExpenseController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof ExpenseController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = ExpenseResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = ExpenseResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(controller: typeof ExpenseController, handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here:
 * a table of permission names would agree with the resolver while disagreeing with the controller,
 * which is the failure this half of the doctrine exists to catch.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'expenses', route: 'findAll' },
	{ field: 'expense', route: 'findById' },
	{ field: 'expenseCount', route: 'getCount' },
	{ field: 'splitExpensesByEmployee', route: 'findAllSplitExpenses' },
	{ field: 'mySplitExpenses', route: 'findMyExpenseWithSplitIncluded' },
	{ field: 'createExpense', route: 'create' },
	{ field: 'updateExpense', route: 'update' },
	{ field: 'deleteExpense', route: 'delete' },
	{ field: 'softDeleteExpense', route: 'softRemove' },
	{ field: 'recoverExpense', route: 'softRecover' }
];

/** The write fields, whose delegations are asserted one by one below. */
const WRITES = ['createExpense', 'updateExpense', 'deleteExpense', 'softDeleteExpense', 'recoverExpense'];

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller's scope.
 * @returns The guard and the service it resolves through.
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
		getHandler: () => (ExpenseResolver.prototype as never)[field],
		getClass: () => ExpenseResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ExpenseResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query, the count and the two split reads', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'expenses',
				'expense',
				'expenseCount',
				'splitExpensesByEmployee',
				'mySplitExpenses'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createExpense',
				'updateExpense',
				'deleteExpense',
				'softDeleteExpense',
				'recoverExpense'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and the inherited `GET /pagination` — and the
		// two answer one question, so the surface states it once: a second root field for the paginated
		// spelling would be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual([
			'expense',
			'expenseCount',
			'expenses',
			'mySplitExpenses',
			'splitExpensesByEmployee'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createExpense',
			'deleteExpense',
			'recoverExpense',
			'softDeleteExpense',
			'updateExpense'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type ExpenseConnection \{\s*nodes: \[Expense!\]!\s*edges: \[ExpenseEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ExpenseEdge \{\s*node: Expense!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ExpenseFilter \{/);
		expect(printed).toMatch(/input ExpenseSort \{/);
		expect(printed).toMatch(
			/enum ExpenseSortField \{\s*createdAt\s*updatedAt\s*valueDate\s*amount\s*status\s*\}/
		);
	});

	it('declares the write inputs the mutations take, and the split row with them', () => {
		expect(printed).toMatch(/input CreateExpenseInput \{/);
		expect(printed).toMatch(/input UpdateExpenseInput \{/);
		expect(printed).toMatch(/type ExpenseSplitRow \{/);
	});

	it('carries the members the delivered reads produce, and not the relations they never load', () => {
		const members = memberNames('Expense');

		// No read behind this surface names a relation — the list read is handed its `relations` from a
		// query string this surface has no spelling for — so a member carrying a related row would be
		// absent from exactly the rows this surface answers. The identifiers are columns and are carried
		// instead — every document the row settles among them.
		expect(members).not.toContain('employee');
		expect(members).not.toContain('vendor');
		expect(members).not.toContain('category');
		expect(members).not.toContain('project');
		expect(members).not.toContain('organizationContact');
		expect(members).not.toContain('tags');
		expect(members).not.toContain('invoiceItems');
		expect(members).toEqual(
			expect.arrayContaining([
				'employeeId',
				'vendorId',
				'categoryId',
				'projectId',
				'organizationContactId',
				'deletedAt'
			])
		);

		// The billing vocabulary and the tax vocabulary are the contracts' own and are shared with the
		// rest of the platform, so both are carried as their values rather than declared as enums here.
		expect(typeBody('Expense')).toMatch(/status: String/);
		expect(typeBody('Expense')).toMatch(/taxType: String/);
	});

	it('declares the split row as the read answers it, with the whole and the divisor nullable', () => {
		const body = typeBody('ExpenseSplitRow');

		// The delivered read leaves a row it does not divide exactly as it found it, so on those rows
		// the whole and the divisor are absent: a non-null member would refuse them, and a figure
		// fabricated for them would be a share nobody computed.
		expect(body).toMatch(/expense: Expense!/);
		expect(body).toMatch(/originalValue: Decimal(\n|$)/);
		expect(body).toMatch(/employeeCount: Int(\n|$)/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(fieldArgs('Query', 'expenses')).not.toContain('withDeleted');
		// The connection declares the query protocol's page arguments and nothing else: the narrowing
		// the paginated spelling interprets is stated in `filter`.
		expect(fieldArgs('Query', 'expenses')).toEqual([
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset'
		]);
		// The count route binds its query string to the store's own `where`, which is a shape no schema
		// can state, so the field states no narrowing of its own — and it is nullable, because a count is
		// an aggregate the resource may have no answer for and a non-null field would fabricate a zero.
		expect(fieldArgs('Query', 'expenseCount')).toEqual([]);
		expect(fieldType('Query', 'expenseCount')).toBe('Int');
		// The employee of the per-employee split read is the path segment of its route, and the date is
		// the member that route reads out of its `data` parameter. The caller's own read resolves the
		// employee from the credential, so it takes no employee argument at all.
		expect(fieldArgs('Query', 'splitExpensesByEmployee')).toEqual(['employeeId', 'filterDate']);
		expect(fieldArgs('Query', 'mySplitExpenses')).toEqual(['filterDate']);
		// The removal reads the employee out of its query string, so the field states it beside the id.
		expect(fieldArgs('Mutation', 'deleteExpense')).toEqual(['id', 'employeeId']);
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		// A field that declared one argument while its resolver read two would resolve the argument it
		// does not declare as undefined. This table is the schema's half of that agreement; the
		// delegation tests below call each field with the arguments listed here, which is the resolver's
		// half.
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createExpense', ['input']],
			['updateExpense', ['input']],
			['deleteExpense', ['id', 'employeeId']],
			['softDeleteExpense', ['id']],
			['recoverExpense', ['id']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}
	});
});

describe('ExpenseResolver — every amount and every rate is exact', () => {
	it('carries every money member and every rate as Decimal and never as Float', () => {
		const body = typeBody('Expense');

		// Money is an exact quantity and a binary fraction cannot hold a cent: an amount a client reads
		// as a `Float` is an amount that will not add up. The tax rate is not an amount, but it is stored
		// at a scale a binary fraction cannot hold either, so it travels in the same family.
		for (const member of ['amount', 'rateValue']) {
			expect(body).toMatch(new RegExp(`${member}: Decimal!?(\\n|$)`));
		}
		expect(body).not.toMatch(/\bFloat\b/);
	});

	it('states no Float in any member this domain declares', () => {
		// Every type and input this domain contributes, read off the printed schema — which is what a
		// client is served, and which carries no comment that could hide a member behind prose.
		const declared = [
			'Expense',
			'ExpenseSplitRow',
			'ExpenseEdge',
			'ExpenseConnection',
			'ExpenseFilter',
			'ExpenseSort',
			'ExpenseSortField',
			'CreateExpenseInput',
			'UpdateExpenseInput'
		]
			.map((name) => `${typeBody(name)}\n${inputBody(name)}`)
			.join('\n');

		expect(declared).not.toMatch(/\bFloat\b/);
		// And the two documents never name it in a type position either, so the absence above is a
		// statement about the source rather than about the composition.
		expect(ownSdl).not.toMatch(/:\s*\[?Float\b/);
	});

	it('narrows the amounts through the decimal family, never through a whole-number one', () => {
		const filter = inputBody('ExpenseFilter');

		expect(filter).toMatch(/amount: DecimalFilter/);
		expect(filter).toMatch(/rateValue: DecimalFilter/);
		expect(filter).not.toMatch(/amount: (FloatFilter|NumberFilter)/);
		// The connection's own allow-list is the schema's other half: a field the evaluator does not
		// know is a field it refuses, so the two must name the same members.
		expect(filter).not.toMatch(/\bFloat\b/);
	});

	it('states money in the write inputs as the exact decimal, never as a Float', () => {
		expect(inputBody('CreateExpenseInput')).toMatch(/amount: Decimal!/);
		expect(inputBody('UpdateExpenseInput')).toMatch(/amount: Decimal!/);
		expect(inputBody('CreateExpenseInput')).toMatch(/rateValue: Decimal(\n|$)/);
		expect(inputBody('UpdateExpenseInput')).toMatch(/rateValue: Decimal(\n|$)/);
	});

	it('carries a currency as the row’s own three-letter code and never as a formatted amount', () => {
		const body = typeBody('Expense');

		expect(body).toMatch(/currency: String!/);
		expect(inputBody('CreateExpenseInput')).toMatch(/currency: String!/);
		expect(body).not.toMatch(/formatted|formattedAmount|displayAmount/);
	});

	it('answers the amounts the row holds, unchanged', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.expenses();

		// Nothing on this surface rescales, rounds or reformats a stored amount: the read's own values
		// are the answer, which is what makes a client's arithmetic and the platform's agree.
		expect(connection.nodes[0].amount).toBe(150.5);
		expect(connection.nodes[0].rateValue).toBe(21);
		expect(connection.nodes[1].amount).toBe(100);
		expect(await resolver.expense(EXPENSE)).toBe(ROWS[0]);
	});

	it('hands a write the exact digits the caller stated rather than a binary fraction', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createExpense({ amount: '150.5', currency: 'USD' });

		// The amount is passed through as it arrived: the column is `numeric` and a decimal string is
		// what it stores, so the digits a caller writes are the digits the book holds.
		const create = commandBus.execute.mock.calls[0][0] as ExpenseCreateCommand;

		expect(create).toBeInstanceOf(ExpenseCreateCommand);
		expect(create.input).toEqual(expect.objectContaining({ amount: '150.5' }));

		await resolver.updateExpense({ id: EXPENSE, amount: '0.1', currency: 'USD' });

		const update = commandBus.execute.mock.calls[1][0] as ExpenseUpdateCommand;

		expect(update).toBeInstanceOf(ExpenseUpdateCommand);
		expect(update.id).toBe(EXPENSE);
		expect(update.entity).toEqual(expect.objectContaining({ amount: '0.1' }));
	});

	it('carries the divided share as the computation it is rather than as a stored amount', async () => {
		const { resolver } = surfaces();

		const rows = await resolver.splitExpensesByEmployee(EMPLOYEE);

		// The read divides the amount of the rows the platform splits and leaves every other row as it
		// found it: the share is the figure the read computed, and the whole and the divisor are the
		// members that say what it was computed from. A row that was not divided carries neither.
		expect(rows[0].expense).toBe(SPLIT_ROWS[0]);
		expect(rows[0].originalValue).toBeUndefined();
		expect(rows[0].employeeCount).toBeUndefined();
		expect(rows[1].expense.amount).toBe(25);
		expect(rows[1].originalValue).toBe(100);
		expect(rows[1].employeeCount).toBe(4);
	});
});

describe('ExpenseResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, expenseService } = surfaces();

		const connection = await resolver.expenses(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(expenseService.findAllExpenses).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(EXPENSE);
	});

	it('orders by the book’s own date, newest cost first, when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.expenses();

		expect(connection.nodes.map((node) => node.id)).toEqual([EXPENSE, SHARED]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.expenses({ status: { eq: 'PAID' } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([SHARED]);

		const byCurrency = await resolver.expenses({ currency: { eq: 'EUR' } });
		expect(byCurrency.nodes.map((node) => node.id)).toEqual([SHARED]);

		// The window the paginated spelling of the list interprets is `between` here, on the amount.
		const byAmount = await resolver.expenses({ amount: { between: ['90', '110'] } });
		expect(byAmount.nodes.map((node) => node.id)).toEqual([SHARED]);

		// And on a date, which is compared as an instant rather than as its spelling.
		const byDate = await resolver.expenses({
			valueDate: { between: ['2026-02-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'] }
		});
		expect(byDate.nodes.map((node) => node.id)).toEqual([SHARED]);

		// The two patterns the paginated spelling applies are the connection's own vocabulary here.
		const byNotes = await resolver.expenses({ notes: { ilike: 'conference%' } });
		expect(byNotes.nodes.map((node) => node.id)).toEqual([EXPENSE]);

		const byPurpose = await resolver.expenses({ purpose: { ilike: '%offsite%' } });
		expect(byPurpose.nodes.map((node) => node.id)).toEqual([SHARED]);

		const bySplit = await resolver.expenses({ splitExpense: { eq: true } });
		expect(bySplit.nodes.map((node) => node.id)).toEqual([SHARED]);

		const byVendor = await resolver.expenses({ vendorId: { eq: VENDOR } });
		expect(byVendor.totalCount).toBe(2);

		// The rate is narrowed in the same exact family the amount is.
		const byRate = await resolver.expenses({ rateValue: { gt: '10' } });
		expect(byRate.nodes.map((node) => node.id)).toEqual([EXPENSE]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byAmount = await resolver.expenses(undefined, [{ field: 'amount', direction: 'ASC' }]);
		expect(byAmount.nodes.map((node) => node.id)).toEqual([SHARED, EXPENSE]);

		const byDate = await resolver.expenses(undefined, [{ field: 'valueDate', direction: 'ASC' }]);
		expect(byDate.nodes.map((node) => node.id)).toEqual([SHARED, EXPENSE]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.expenses(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([EXPENSE]);

		const second = await resolver.expenses(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SHARED]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.expenses(undefined, undefined, undefined, 20);

		const last = await resolver.expenses(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([EXPENSE]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.expenses(undefined, [{ field: 'currency', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// `tags` is carried on the entity and deliberately not filterable: the delivered list read loads
		// no relations, so the condition could only ever match the empty set, and the connection refuses
		// it rather than answering it with no rows.
		const error = await resolver.expenses({ tags: { eq: TAG } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.expenses(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('keeps the evaluator’s allow-list and the schema’s filter in step, member for member', async () => {
		const { resolver } = surfaces();
		const declared = [...inputBody('ExpenseFilter').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)]
			.map((match) => match[1])
			.filter((member) => !['and', 'or', 'not'].includes(member));

		// The declaration in the resolver and the input in the SDL are two renderings of one list, and a
		// member that is filterable in the schema but unknown to the evaluator is a field a client can
		// state and be refused for. An empty condition narrows nothing, so what each read below asserts
		// is only that the evaluator recognises the field.
		for (const member of declared) {
			await expect(resolver.expenses({ [member]: {} })).resolves.toBeDefined();
		}

		// The other half of the same claim is read off the refusal, which names the evaluator's whole
		// allow-list: a member it knows and the schema does not would appear here and nowhere else.
		const refusal = await resolver.expenses({ tags: { eq: TAG } }).catch((thrown) => thrown);
		const allowed = String((refusal as Error).message)
			.split('Allowed: ')[1]
			// The message closes the list with a sentence, so the full stop is taken off before the
			// members are read: it is punctuation rather than part of the last name.
			.replace(/\.\s*$/, '')
			.split(',')
			.map((member) => member.trim())
			.sort();

		expect(allowed).toEqual([...declared].sort());
	});

	it('accepts every key the sort enum offers, and only those', async () => {
		const { resolver } = surfaces();
		const offered = [...bodyOf('enum', 'ExpenseSortField').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm)].map(
			(match) => match[1]
		);

		expect(offered).toEqual(['createdAt', 'updatedAt', 'valueDate', 'amount', 'status']);

		// Every key the enum offers is a key the evaluator accepts, so the schema is not promising an
		// order the connection would refuse; the refusal of everything else is asserted above.
		for (const field of offered) {
			await expect(resolver.expenses(undefined, [{ field, direction: 'ASC' }])).resolves.toBeDefined();
		}
	});
});

describe('ExpenseResolver — one book, two protocols, the same operations', () => {
	it('reads one row through the same service method the REST node route calls', async () => {
		const { resolver, expenseService } = surfaces();

		expect(await resolver.expense(EXPENSE)).toBe(ROWS[0]);
		expect(expenseService.findOneByIdString).toHaveBeenCalledWith(EXPENSE);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, expenseService } = surfaces();
		expenseService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.expense(SHARED)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, expenseService } = surfaces();

		expect(await resolver.expenseCount()).toBe(2);
		expect(expenseService.countBy).toHaveBeenCalledWith();
	});

	it('reads one employee’s split expenses through the query the route executes', async () => {
		const { resolver, queryBus } = surfaces();

		const filterDate = new Date('2026-03-01T00:00:00.000Z');
		const rows = await resolver.splitExpensesByEmployee(EMPLOYEE, filterDate);
		const query = queryBus.execute.mock.calls[0][0] as FindSplitExpenseQuery;

		expect(query).toBeInstanceOf(FindSplitExpenseQuery);
		// The employee is the path segment and the date the read narrows by is the member the route
		// reads out of its `data` parameter — handed over in the shape that member has, which is the
		// instant's own spelling. The relations that parameter also carries is stated as none, because
		// the row type this surface answers declares no relation.
		expect(query.findInput).toEqual({ employeeId: EMPLOYEE, filterDate: filterDate.toISOString() });
		expect(rows).toHaveLength(2);
	});

	it('resolves the caller’s own employee the way the route does, then executes the same query', async () => {
		const { resolver, queryBus, employeeService } = surfaces();
		const userId = jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');

		try {
			const rows = await resolver.mySplitExpenses();

			// The delivered route looks the employee row up by the caller's user identifier, so a caller
			// without one is refused rather than answered an empty list.
			expect(employeeService.findOneByWhereOptions).toHaveBeenCalledWith({ userId: 'user-1' });
			expect((queryBus.execute.mock.calls[0][0] as FindSplitExpenseQuery).findInput).toEqual({
				employeeId: EMPLOYEE
			});
			expect(rows).toHaveLength(2);
		} finally {
			userId.mockRestore();
		}
	});

	it('records a cost through the same command the REST create route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(
			await resolver.createExpense({
				amount: '150.5',
				currency: 'USD',
				valueDate: new Date('2026-03-05T10:00:00.000Z'),
				notes: 'Conference travel',
				typeOfExpense: 'TAX_DEDUCTIBLE',
				rateValue: '21',
				organizationId: ORGANIZATION,
				employeeId: EMPLOYEE,
				vendorId: VENDOR,
				categoryId: CATEGORY,
				projectId: PROJECT,
				organizationContactId: CONTACT,
				tagIds: [TAG]
			})
		).toBe(ROWS[0]);

		// The delivered create is handed the members the caller stated, the facets as the identifiers
		// the pivot row is written from, and the tenant only from the credential.
		expect((commandBus.execute.mock.calls[0][0] as ExpenseCreateCommand).input).toEqual({
			amount: '150.5',
			currency: 'USD',
			valueDate: new Date('2026-03-05T10:00:00.000Z'),
			notes: 'Conference travel',
			typeOfExpense: 'TAX_DEDUCTIBLE',
			rateValue: '21',
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			vendorId: VENDOR,
			categoryId: CATEGORY,
			projectId: PROJECT,
			organizationContactId: CONTACT,
			tags: [{ id: TAG }]
		});
	});

	it('changes a cost through the same command the REST edit route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateExpense({ id: EXPENSE, amount: '120.75', notes: 'Corrected' });

		// The delivered edit carries the identifier the route reads from the path and the body beside it,
		// handed to the same write the create uses.
		const command = commandBus.execute.mock.calls[0][0] as ExpenseUpdateCommand;

		expect(command.id).toBe(EXPENSE);
		expect(command.entity).toEqual({ amount: '120.75', notes: 'Corrected' });
	});

	it('removes a cost through the same command the REST removal route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteExpense(EXPENSE, EMPLOYEE)).toBe(true);

		const command = commandBus.execute.mock.calls[0][0] as ExpenseDeleteCommand;

		// The employee is the query member the delivered route reads and hands to the command beside the
		// identifier; the field answers the one fact the removal establishes, because the delivered
		// handler's delete result is not a row.
		expect(command).toBeInstanceOf(ExpenseDeleteCommand);
		expect(command.employeeId).toBe(EMPLOYEE);
		expect(command.expenseId).toBe(EXPENSE);
	});

	it('withdraws and restores a cost through the service methods the inherited routes call', async () => {
		const { resolver, expenseService } = surfaces();

		const withdrawn = await resolver.softDeleteExpense(EXPENSE);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(expenseService.softRemove).toHaveBeenCalledWith(EXPENSE);

		expect(await resolver.recoverExpense(EXPENSE)).toBe(ROWS[0]);
		expect(expenseService.softRecover).toHaveBeenCalledWith(EXPENSE);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, expenseService } = surfaces();
		const refusal = new Error('ORG_EXPENSES_CANNOT_DELETE: the cost is accounted for.');

		expenseService.softRemove.mockRejectedValueOnce(refusal);

		await expect(resolver.softDeleteExpense(EXPENSE)).rejects.toBe(refusal);
	});

	it('names no employee on the edit, because the delivered edit body carries none', () => {
		// The delivered create body keeps the employee and the edit body drops it, so an input that
		// carried it here would offer a member no write of this route honours.
		expect(inputBody('CreateExpenseInput')).toMatch(/employeeId: ID(\n|$)/);
		expect(inputBody('UpdateExpenseInput')).not.toMatch(/employeeId/);
	});
});

describe('ExpenseResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ExpenseResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ExpenseController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The one guard the resolver states beyond the controller's chain is the gate, and it is the
		// addition rather than a substitution: the two the controller states come first, so a caller with
		// no credential is refused as a credential problem before a tenant's switches are read.
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', ExpenseResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			// The controller's chain and the resolver's are the same set, which is the whole parity
			// claim: a route that added a guard of its own would narrow REST below GraphQL and is caught
			// here.
			const declared = Reflect.getMetadata('__guards__', ExpenseController) ?? [];
			const restated = guardsOfHandler(ExpenseController, route);

			// The gate is the one guard beyond that set, and it is declared on the class rather than on
			// any field, so every route here runs under it.
			expect([...new Set([...declared, ...restated, FeatureFlagGuard])].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ExpenseResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, ExpenseController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ExpenseController)).toEqual([
			PermissionsEnum.ORG_EXPENSES_EDIT
		]);
	});

	it.each(PERMISSION_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		const fieldPermissions = Reflect.getMetadata(PERMISSIONS_METADATA, ExpenseResolver.prototype[field]) ?? [];
		const routePermissions = permissionOfRoute(ExpenseController, route) ?? [];

		expect(fieldPermissions).toEqual(routePermissions);
		// The guard a field states of its own is the guard its route's handler states of its own: the
		// class-level chains are compared above, and a handler that added one is caught here.
		expect(guardsOfField(field)).toEqual(guardsOfHandler(ExpenseController, route));
	});

	it('carries the view permission on every read, which is what every read route states', () => {
		for (const field of ['expenses', 'expense', 'expenseCount', 'splitExpensesByEmployee', 'mySplitExpenses']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_EXPENSES_VIEW]);
		}

		for (const route of ['findAll', 'findById', 'getCount', 'findAllSplitExpenses', 'findMyExpenseWithSplitIncluded']) {
			expect(permissionOfRoute(ExpenseController, route)).toEqual([PermissionsEnum.ORG_EXPENSES_VIEW]);
		}
	});

	it('carries the edit permission on every write, because none of those routes states one', () => {
		// The create, the edit and the removal are declared on the controller without a permission of
		// their own, and the withdrawal and the restoration are inherited from the CRUD base, which
		// states none either — so all five run under the controller's class-level edit permission, and
		// the fields state the same one rather than stating nothing. Reading "no metadata on the route"
		// as "no permission" would widen the REST route's scope on this surface only.
		for (const handler of ['create', 'update', 'delete', 'softRemove', 'softRecover']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, ExpenseController.prototype[handler])).toBeUndefined();
		}

		for (const field of WRITES) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_EXPENSES_EDIT]);
		}
	});
});

describe('ExpenseResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, ExpenseResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ExpenseResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('expenses')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('expenses');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the removals and the split reads among them', async () => {
		// Nothing on this surface is exempt: the door that switches the capability back on is the REST
		// route, which this code does not gate.
		for (const field of ['createExpense', 'deleteExpense', 'softDeleteExpense', 'mySplitExpenses']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('expense'))).resolves.toBe(true);
	});
});

describe('ExpenseModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ExpenseModule) ?? []) as unknown[];

		expect(providers).toContain(ExpenseResolver);
		expect(providers).toContain(ExpenseService);
	});

	it('exports the service the resolver injects, and reaches the employee and command modules it calls', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, ExpenseModule) ?? []) as unknown[];
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, ExpenseModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);
		const names = resolved.map((entry) => (entry as { name?: string })?.name);

		expect(exported).toContain(ExpenseService);
		// The split reads resolve the caller's employee through the employee service and dispatch a
		// query, so both have to be reachable from the module that hosts the resolver.
		expect(names).toContain('EmployeeModule');
		expect(names).toContain('CqrsModule');
		expect(EmployeeService).toBeDefined();
		// A resolver is an ordinary provider, so the four collaborators above are the whole of its
		// dependencies.
		expect(ExpenseResolver.length).toBe(4);
	});

	it('reaches the module that provides the guards, without importing the one the gate resolves through', () => {
		// The two guards the resolver shares with the controller are providers of whichever module
		// declares the handler they protect, so this module has to reach the permission service they
		// look the caller's grants up in — the API boot fails on an unresolved dependency without it.
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, ExpenseModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(resolved.map((entry) => (entry as { name?: string })?.name)).toContain('RolePermissionModule');

		// `FeatureModule` is deliberately not imported, and that is a fact about the module rather than a
		// preference: it is global, so the feature service `FeatureFlagGuard` resolves through is
		// available wherever a guard runs.
		expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, FeatureModule)).toBe(true);
		expect(resolved).not.toContain(FeatureModule);
	});
});
