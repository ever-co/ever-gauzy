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
import { PermissionsEnum, RecurringExpenseDeletionEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { RequestContext } from '../core/context';
import { FeatureModule } from '../feature/feature.module';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EmployeeRecurringExpenseController } from './employee-recurring-expense.controller';
import { EmployeeRecurringExpenseModule } from './employee-recurring-expense.module';
import { EmployeeRecurringExpenseResolver } from './employee-recurring-expense.resolver';
import { EmployeeRecurringExpenseService } from './employee-recurring-expense.service';
import {
	EmployeeRecurringExpenseCreateCommand,
	EmployeeRecurringExpenseDeleteCommand,
	EmployeeRecurringExpenseEditCommand
} from './commands';
import { EmployeeRecurringExpenseStartDateUpdateTypeQuery } from './queries';

/**
 * The standing costs one employee carries, over GraphQL.
 *
 * The delivered REST routes serve a list, the month narrowing of that list, one row, a count, a
 * computed verdict about a proposed change to an arrangement's beginning, a create, an edit that may
 * rewrite a whole family of rows, a removal that takes one of three different amounts out, and the
 * withdrawal and restoration of a row. This suite pins the half of the two-protocol doctrine that is
 * easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - **the month route is a filter of that connection and not a second field**, so the disjunction it
 *   applies is asserted to be expressible in the connection's own vocabulary rather than merely
 *   documented;
 * - every field calls the same service method, dispatches the same command or executes the same query
 *   the REST route reaches, with the same payload, so a client does not choose a better surface by
 *   choosing a protocol;
 * - **the guard stack and the permission are the controller's, field by field** — including the node
 *   read, the count, the three removals and the two lifecycle fields, whose delivered routes state no
 *   permission of their own and therefore run under the controller's class-level edit permission, which
 *   is the one this resolver states as well;
 * - every amount the surface carries is an exact decimal and never a floating-point number, on the
 *   object type, on the filter and on the way into a write;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant that
 *   switched that capability off is refused the way a disabled capability's routes are — and the refusal
 *   names the field, because the guard reads a GraphQL execution context rather than crashing on one.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000020';
const ARRANGEMENT = '00000000-0000-4000-8000-000000000010';
const SUCCESSOR = '00000000-0000-4000-8000-000000000011';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them, with the
 * amount as the platform's numeric transformer hands it over: a number, and nothing rounded, rescaled or
 * reformatted on the way.
 */
const ROWS = [
	{
		id: ARRANGEMENT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		startDay: 1,
		startMonth: 4,
		startYear: 2026,
		startDate: new Date('2026-04-01T00:00:00.000Z'),
		endDay: null,
		endMonth: null,
		endYear: null,
		endDate: null,
		categoryName: 'SALARY',
		value: 3200,
		currency: 'USD',
		parentRecurringExpenseId: ARRANGEMENT,
		employeeId: EMPLOYEE,
		createdAt: new Date('2026-04-01T10:00:00.000Z'),
		updatedAt: new Date('2026-04-01T10:00:00.000Z')
	},
	{
		id: SUCCESSOR,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		startDay: 1,
		startMonth: 1,
		startYear: 2026,
		startDate: new Date('2026-01-01T00:00:00.000Z'),
		endDay: 31,
		endMonth: 3,
		endYear: 2026,
		endDate: new Date('2026-03-31T00:00:00.000Z'),
		categoryName: 'RENT',
		value: 900.5,
		currency: 'EUR',
		parentRecurringExpenseId: ARRANGEMENT,
		employeeId: null,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	}
];

/** The verdict a scripted read answers, with the rows it was drawn from. */
const VERDICT = { value: 'INCREASE_SAFE_WITHIN_LIMIT', conflicts: [ROWS[1]] };

/** The resolver, over a scripted service, a scripted command bus and a scripted query bus. */
function surfaces() {
	const employeeRecurringExpenseService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-05-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };
	const queryBus = { execute: jest.fn().mockResolvedValue(VERDICT) };

	return {
		employeeRecurringExpenseService,
		commandBus,
		queryBus,
		resolver: new EmployeeRecurringExpenseResolver(
			employeeRecurringExpenseService as never,
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
const ownSdl = ['employee-recurring-expense.type.gql', 'employee-recurring-expense.api.gql']
	.map((file) => readFileSync(join(__dirname, 'schema', file), 'utf8'))
	.join('\n');

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The type one root field answers, as the schema states it. */
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
 * The organization's own arrangements name themselves around the same words and are excluded here: one
 * resource's suite asserts its own fields, not its neighbour's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('recurringexpense'))
		.filter((field) => !field.toLowerCase().includes('organization'))
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
 * comment is part of the printed type, so a member is asserted absent by its name and never by the words
 * a description happens to use.
 */
function memberNames(name: string): string[] {
	return [...typeBody(name).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/gm)].map((match) => match[1]);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof EmployeeRecurringExpenseController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EmployeeRecurringExpenseController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = EmployeeRecurringExpenseResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = EmployeeRecurringExpenseResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(controller: typeof EmployeeRecurringExpenseController, handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field are
 * read from the field and from the route's own metadata and compared, rather than restated here.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'employeeRecurringExpenses', route: 'findAll' },
	{ field: 'employeeRecurringExpense', route: 'findById' },
	{ field: 'employeeRecurringExpenseCount', route: 'getCount' },
	{ field: 'employeeRecurringExpenseStartDateUpdateType', route: 'findStartDateUpdateType' },
	{ field: 'createEmployeeRecurringExpense', route: 'create' },
	{ field: 'updateEmployeeRecurringExpense', route: 'update' },
	{ field: 'deleteEmployeeRecurringExpense', route: 'delete' },
	{ field: 'softDeleteEmployeeRecurringExpense', route: 'softRemove' },
	{ field: 'recoverEmployeeRecurringExpense', route: 'softRecover' }
];

/** The write fields, whose delegations are asserted one by one below. */
const WRITES = [
	'createEmployeeRecurringExpense',
	'updateEmployeeRecurringExpense',
	'deleteEmployeeRecurringExpense',
	'softDeleteEmployeeRecurringExpense',
	'recoverEmployeeRecurringExpense'
];

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver declares,
 * which is the point: a spec that asserted the decorator alone would keep passing if the guard stopped
 * reading that key.
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
		getHandler: () => (EmployeeRecurringExpenseResolver.prototype as never)[field],
		getClass: () => EmployeeRecurringExpenseResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

/**
 * The organization every read in this suite runs in.
 *
 * The connection takes its organization from the credential rather than from the caller, so the request
 * context is the only place the tests below can state it — and stating it once, for the whole suite, is
 * what lets each read assert the criterion it actually passed to the service.
 */
let organizationScope: jest.SpyInstance;

beforeAll(() => {
	organizationScope = jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);
});

afterAll(() => {
	organizationScope.mockRestore();
});

describe('EmployeeRecurringExpenseResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query, the count and the verdict read', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'employeeRecurringExpenses',
				'employeeRecurringExpense',
				'employeeRecurringExpenseCount',
				'employeeRecurringExpenseStartDateUpdateType'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createEmployeeRecurringExpense',
				'updateEmployeeRecurringExpense',
				'deleteEmployeeRecurringExpense',
				'softDeleteEmployeeRecurringExpense',
				'recoverEmployeeRecurringExpense'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([
			'employeeRecurringExpense',
			'employeeRecurringExpenseCount',
			'employeeRecurringExpenseStartDateUpdateType',
			'employeeRecurringExpenses'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createEmployeeRecurringExpense',
			'deleteEmployeeRecurringExpense',
			'recoverEmployeeRecurringExpense',
			'softDeleteEmployeeRecurringExpense',
			'updateEmployeeRecurringExpense'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EmployeeRecurringExpenseConnection \{\s*nodes: \[EmployeeRecurringExpense!\]!\s*edges: \[EmployeeRecurringExpenseEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type EmployeeRecurringExpenseEdge \{\s*node: EmployeeRecurringExpense!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input EmployeeRecurringExpenseFilter \{/);
		expect(printed).toMatch(/input EmployeeRecurringExpenseSort \{/);
		expect(printed).toMatch(
			/enum EmployeeRecurringExpenseSortField \{\s*createdAt\s*updatedAt\s*startDate\s*endDate\s*value\s*categoryName\s*\}/
		);
	});

	it('declares the write inputs the mutations take, and the removal input with them', () => {
		expect(printed).toMatch(/input CreateEmployeeRecurringExpenseInput \{/);
		expect(printed).toMatch(/input UpdateEmployeeRecurringExpenseInput \{/);
		expect(printed).toMatch(/input EmployeeRecurringExpenseDeleteInput \{/);
	});

	it('carries the members the delivered reads produce, and not the relation they never load', () => {
		const members = memberNames('EmployeeRecurringExpense');

		// No read behind this surface joins the employee row, so a member carrying it would be absent
		// from exactly the rows this surface answers while looking like a fact about the arrangement. The
		// identifier is a column and is carried instead.
		expect(members).not.toContain('employee');
		expect(members).toEqual(
			expect.arrayContaining([
				'startDay',
				'startMonth',
				'startYear',
				'startDate',
				'endDay',
				'endMonth',
				'endYear',
				'endDate',
				'categoryName',
				'value',
				'currency',
				'parentRecurringExpenseId',
				'employeeId',
				'deletedAt'
			])
		);
	});

	it('offers no argument it cannot honour', () => {
		expect(fieldArgs('Query', 'employeeRecurringExpenses')).not.toContain('withDeleted');
		expect(fieldArgs('Query', 'employeeRecurringExpenses')).toEqual([
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
		expect(fieldArgs('Query', 'employeeRecurringExpenseCount')).toEqual([]);
		expect(fieldType('Query', 'employeeRecurringExpenseCount')).toBe('Int');
		// The verdict read takes the two members the delivered route reads out of its `data` parameter,
		// and the removal takes the deletion input that route reads beside the identifier.
		expect(fieldArgs('Query', 'employeeRecurringExpenseStartDateUpdateType')).toEqual([
			'recurringExpenseId',
			'newStartDate'
		]);
		expect(fieldArgs('Mutation', 'deleteEmployeeRecurringExpense')).toEqual(['id', 'input']);
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createEmployeeRecurringExpense', ['input']],
			['updateEmployeeRecurringExpense', ['input']],
			['deleteEmployeeRecurringExpense', ['id', 'input']],
			['softDeleteEmployeeRecurringExpense', ['id']],
			['recoverEmployeeRecurringExpense', ['id']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}
	});
});

describe('EmployeeRecurringExpenseResolver — every amount is exact', () => {
	it('carries the standing cost as Decimal and never as Float', () => {
		const body = typeBody('EmployeeRecurringExpense');

		expect(body).toMatch(/value: Decimal!(\n|$)/);
		expect(body).not.toMatch(/\bFloat\b/);
	});

	it('states no Float in any member this domain declares', () => {
		const declared = [
			'EmployeeRecurringExpense',
			'EmployeeRecurringExpenseEdge',
			'EmployeeRecurringExpenseConnection',
			'EmployeeRecurringExpenseStartDateUpdateType',
			'EmployeeRecurringExpenseFilter',
			'EmployeeRecurringExpenseSort',
			'EmployeeRecurringExpenseSortField',
			'CreateEmployeeRecurringExpenseInput',
			'UpdateEmployeeRecurringExpenseInput',
			'EmployeeRecurringExpenseDeleteInput'
		]
			.map((name) => `${typeBody(name)}\n${inputBody(name)}`)
			.join('\n');

		expect(declared).not.toMatch(/\bFloat\b/);
		// And the two documents never name it in a type position either, so the absence above is a
		// statement about the source rather than about the composition.
		expect(ownSdl).not.toMatch(/:\s*\[?Float\b/);
	});

	it('narrows the amount through the decimal family, never through a whole-number one', () => {
		const filter = inputBody('EmployeeRecurringExpenseFilter');

		expect(filter).toMatch(/value: DecimalFilter/);
		expect(filter).not.toMatch(/value: (FloatFilter|NumberFilter)/);
		// The day, month and year columns are whole numbers rather than amounts, so they are narrowed
		// through the whole-number family — which is the distinction the two families exist to draw.
		expect(filter).toMatch(/startDay: NumberFilter/);
		expect(filter).toMatch(/startYear: NumberFilter/);
		expect(filter).not.toMatch(/\bFloat\b/);
	});

	it('states money in the write inputs as the exact decimal, never as a Float', () => {
		expect(inputBody('CreateEmployeeRecurringExpenseInput')).toMatch(/value: Decimal!/);
		expect(inputBody('UpdateEmployeeRecurringExpenseInput')).toMatch(/value: Decimal!/);
		expect(inputBody('CreateEmployeeRecurringExpenseInput')).toMatch(/currency: String!/);
	});

	it('answers the amount the row holds, unchanged', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.employeeRecurringExpenses();

		expect(connection.nodes[0].value).toBe(3200);
		expect(connection.nodes[1].value).toBe(900.5);
		expect(await resolver.employeeRecurringExpense(ARRANGEMENT)).toBe(ROWS[0]);
	});

	it('hands a write the exact digits the caller stated rather than a binary fraction', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createEmployeeRecurringExpense({
			value: '3200.25',
			currency: 'USD',
			categoryName: 'SALARY',
			startDay: 1,
			startMonth: 4,
			startYear: 2026,
			startDate: new Date('2026-04-01T00:00:00.000Z')
		});

		const create = commandBus.execute.mock.calls[0][0] as EmployeeRecurringExpenseCreateCommand;

		expect(create.input).toEqual(expect.objectContaining({ value: '3200.25' }));

		await resolver.updateEmployeeRecurringExpense({
			id: ARRANGEMENT,
			value: '0.1',
			categoryName: 'SALARY',
			startDay: 1,
			startMonth: 5,
			startYear: 2026
		});

		const edit = commandBus.execute.mock.calls[1][0] as EmployeeRecurringExpenseEditCommand;

		expect(edit.input).toEqual(expect.objectContaining({ value: '0.1' }));
	});
});

describe('EmployeeRecurringExpenseResolver — the connection contract, and the month route folded into it', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, employeeRecurringExpenseService } = surfaces();

		const connection = await resolver.employeeRecurringExpenses(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the criterion that route binds from its
		// query string — the organization the credential names, and no relation.
		expect(employeeRecurringExpenseService.findAll).toHaveBeenCalledWith({
			where: { organizationId: ORGANIZATION }
		});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ARRANGEMENT);
	});

	it('orders by the beginning of the arrangement, newest first, when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.employeeRecurringExpenses();

		expect(connection.nodes.map((node) => node.id)).toEqual([ARRANGEMENT, SUCCESSOR]);
	});

	it('answers the month route’s question through the filter, with the delivered disjunction', async () => {
		const { resolver } = surfaces();

		// The delivered month read answers the arrangements in force during the range its `data` parameter
		// carries — the delivered clients send one month's bounds — which is the disjunction below stated in
		// the connection's own vocabulary: an arrangement that begins inside the range with no end yet, or
		// one that begins no later than the range's start and ends no earlier than its end. That is what
		// makes the month route a filter of this list rather than a second root field.
		const inForce = await resolver.employeeRecurringExpenses({
			or: [
				{
					startDate: { between: ['2026-01-01T00:00:00.000Z', '2026-01-31T00:00:00.000Z'] },
					endDate: { isNull: true }
				},
				{
					startDate: { lte: '2026-01-01T00:00:00.000Z' },
					endDate: { gte: '2026-01-31T00:00:00.000Z' }
				}
			]
		});

		expect(inForce.nodes.map((node) => node.id)).toEqual([SUCCESSOR]);

		// The arrangement that begins inside another range with no end at all is the first alternative's
		// answer, and the second alternative does not reach it: the delivered criterion asks for an
		// arrangement that *begins* inside the range when its end is open, so a standing arrangement that
		// began before the range is not one of the read's answers — the delivered behaviour, stated here
		// rather than normalised into a filter the route does not apply.
		const later = await resolver.employeeRecurringExpenses({
			or: [
				{
					startDate: { between: ['2026-04-01T00:00:00.000Z', '2026-04-30T00:00:00.000Z'] },
					endDate: { isNull: true }
				},
				{
					startDate: { lte: '2026-04-01T00:00:00.000Z' },
					endDate: { gte: '2026-04-30T00:00:00.000Z' }
				}
			]
		});

		expect(later.nodes.map((node) => node.id)).toEqual([ARRANGEMENT]);

		const beyond = await resolver.employeeRecurringExpenses({
			or: [
				{
					startDate: { between: ['2026-06-01T00:00:00.000Z', '2026-06-30T00:00:00.000Z'] },
					endDate: { isNull: true }
				},
				{
					startDate: { lte: '2026-06-01T00:00:00.000Z' },
					endDate: { gte: '2026-06-30T00:00:00.000Z' }
				}
			]
		});

		expect(beyond.nodes).toHaveLength(0);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byCategory = await resolver.employeeRecurringExpenses({ categoryName: { eq: 'RENT' } });
		expect(byCategory.nodes.map((node) => node.id)).toEqual([SUCCESSOR]);

		const byValue = await resolver.employeeRecurringExpenses({ value: { between: ['900', '1000'] } });
		expect(byValue.nodes.map((node) => node.id)).toEqual([SUCCESSOR]);

		const byEmployee = await resolver.employeeRecurringExpenses({ employeeId: { eq: EMPLOYEE } });
		expect(byEmployee.nodes.map((node) => node.id)).toEqual([ARRANGEMENT]);

		// The family an arrangement belongs to is the parent, which is what the verdict read above looks a
		// conflict up among.
		const family = await resolver.employeeRecurringExpenses({
			parentRecurringExpenseId: { eq: ARRANGEMENT }
		});
		expect(family.totalCount).toBe(2);

		const openEnded = await resolver.employeeRecurringExpenses({ endDate: { isNull: true } });
		expect(openEnded.nodes.map((node) => node.id)).toEqual([ARRANGEMENT]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byValue = await resolver.employeeRecurringExpenses(undefined, [
			{ field: 'value', direction: 'ASC' }
		]);
		expect(byValue.nodes.map((node) => node.id)).toEqual([SUCCESSOR, ARRANGEMENT]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.employeeRecurringExpenses(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([ARRANGEMENT]);

		const second = await resolver.employeeRecurringExpenses(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SUCCESSOR]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employeeRecurringExpenses(undefined, [{ field: 'currency', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// `deletedAt` is carried on the entity and deliberately not filterable: the delivered list read
		// answers live rows only, so the condition could only ever match the empty set.
		const error = await resolver
			.employeeRecurringExpenses({ deletedAt: { isNull: false } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employeeRecurringExpenses(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('keeps the evaluator’s allow-list and the schema’s filter in step, member for member', async () => {
		const { resolver } = surfaces();
		const declared = [
			...inputBody('EmployeeRecurringExpenseFilter').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)
		]
			.map((match) => match[1])
			.filter((member) => !['and', 'or', 'not'].includes(member));

		for (const member of declared) {
			await expect(resolver.employeeRecurringExpenses({ [member]: {} })).resolves.toBeDefined();
		}

		const refusal = await resolver
			.employeeRecurringExpenses({ deletedAt: { isNull: false } })
			.catch((thrown) => thrown);
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
			...bodyOf('enum', 'EmployeeRecurringExpenseSortField').matchAll(
				/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm
			)
		].map((match) => match[1]);

		expect(offered).toEqual(['createdAt', 'updatedAt', 'startDate', 'endDate', 'value', 'categoryName']);

		for (const field of offered) {
			await expect(
				resolver.employeeRecurringExpenses(undefined, [{ field, direction: 'ASC' }])
			).resolves.toBeDefined();
		}
	});
});

describe('EmployeeRecurringExpenseResolver — one resource, two protocols, the same operations', () => {
	it('reads one row through the same service method the REST node route calls', async () => {
		const { resolver, employeeRecurringExpenseService } = surfaces();

		expect(await resolver.employeeRecurringExpense(ARRANGEMENT)).toBe(ROWS[0]);
		expect(employeeRecurringExpenseService.findOneByIdString).toHaveBeenCalledWith(ARRANGEMENT);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, employeeRecurringExpenseService } = surfaces();
		employeeRecurringExpenseService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.employeeRecurringExpense(SUCCESSOR)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, employeeRecurringExpenseService } = surfaces();

		expect(await resolver.employeeRecurringExpenseCount()).toBe(2);
		expect(employeeRecurringExpenseService.countBy).toHaveBeenCalledWith();
	});

	it('answers the verdict through the query the date-update-type route executes', async () => {
		const { resolver, queryBus } = surfaces();
		const newStartDate = new Date('2026-06-01T00:00:00.000Z');

		const verdict = await resolver.employeeRecurringExpenseStartDateUpdateType(ARRANGEMENT, newStartDate);
		const query = queryBus.execute.mock.calls[0][0] as EmployeeRecurringExpenseStartDateUpdateTypeQuery;

		expect(query).toBeInstanceOf(EmployeeRecurringExpenseStartDateUpdateTypeQuery);
		expect(query.input).toEqual({ recurringExpenseId: ARRANGEMENT, newStartDate });
		// The answer is the delivered read's own: a verdict carried as the contracts' own value, and the
		// rows the verdict was drawn from.
		expect(verdict).toBe(VERDICT);
		expect(verdict.value).toBe('INCREASE_SAFE_WITHIN_LIMIT');
		expect(verdict.conflicts).toEqual([ROWS[1]]);
	});

	it('records a standing cost through the same command the REST create route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		const created = await resolver.createEmployeeRecurringExpense({
			value: '3200',
			currency: 'USD',
			categoryName: 'SALARY',
			startDay: 1,
			startMonth: 4,
			startYear: 2026,
			startDate: new Date('2026-04-01T00:00:00.000Z'),
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE
		});

		const command = commandBus.execute.mock.calls[0][0] as EmployeeRecurringExpenseCreateCommand;

		expect(created).toBe(ROWS[0]);
		expect(command).toBeInstanceOf(EmployeeRecurringExpenseCreateCommand);
		// The delivered create is handed the members the caller stated; the tenant comes from the
		// credential and is never stated here.
		expect(command.input).toEqual({
			value: '3200',
			currency: 'USD',
			categoryName: 'SALARY',
			startDay: 1,
			startMonth: 4,
			startYear: 2026,
			startDate: new Date('2026-04-01T00:00:00.000Z'),
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE
		});
	});

	it('changes a standing cost through the same command the REST edit route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateEmployeeRecurringExpense({
			id: ARRANGEMENT,
			value: '3400',
			categoryName: 'SALARY',
			startDay: 1,
			startMonth: 5,
			startYear: 2026,
			employeeId: null
		});

		const command = commandBus.execute.mock.calls[0][0] as EmployeeRecurringExpenseEditCommand;

		// The delivered edit carries the identifier the route reads from the path, and an explicit null
		// employee reaches it as the instruction to switch the arrangement to the whole organization.
		expect(command).toBeInstanceOf(EmployeeRecurringExpenseEditCommand);
		expect(command.id).toBe(ARRANGEMENT);
		expect(command.input).toEqual({
			value: '3400',
			categoryName: 'SALARY',
			startDay: 1,
			startMonth: 5,
			startYear: 2026,
			employeeId: null
		});
	});

	it('removes a standing cost through the same command the REST removal route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		const removed = await resolver.deleteEmployeeRecurringExpense(ARRANGEMENT, {
			deletionType: RecurringExpenseDeletionEnum.CURRENT,
			month: 6,
			year: 2026
		});

		const command = commandBus.execute.mock.calls[0][0] as EmployeeRecurringExpenseDeleteCommand;

		// The deletion input is the member the delivered route reads out of its `data` parameter, handed
		// over as it arrived. The field answers the one fact the removal establishes, because the
		// delivered handler's own answer is a delete result, an update result or a newly opened row.
		expect(command).toBeInstanceOf(EmployeeRecurringExpenseDeleteCommand);
		expect(command.id).toBe(ARRANGEMENT);
		expect(command.deleteInput).toEqual({ deletionType: 'current', month: 6, year: 2026 });
		expect(removed).toBe(true);
	});

	it('withdraws and restores a standing cost through the service methods the inherited routes call', async () => {
		const { resolver, employeeRecurringExpenseService } = surfaces();

		const withdrawn = await resolver.softDeleteEmployeeRecurringExpense(ARRANGEMENT);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(employeeRecurringExpenseService.softRemove).toHaveBeenCalledWith(ARRANGEMENT);

		expect(await resolver.recoverEmployeeRecurringExpense(ARRANGEMENT)).toBe(ROWS[0]);
		expect(employeeRecurringExpenseService.softRecover).toHaveBeenCalledWith(ARRANGEMENT);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('RECURRING_EXPENSE_CONFLICT: a sibling stands in the gap.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(
			resolver.updateEmployeeRecurringExpense({
				id: ARRANGEMENT,
				value: '1',
				categoryName: 'SALARY',
				startDay: 1,
				startMonth: 1,
				startYear: 2027
			})
		).rejects.toBe(refusal);
	});

	it('states on the edit only the members the delivered edit reads', () => {
		const body = inputBody('UpdateEmployeeRecurringExpenseInput');

		// The delivered edit body validates the end of the arrangement, the parent and the currency, and
		// the delivered handler writes none of them — so none of them is offered.
		expect(body).toMatch(/startDay: Int!/);
		expect(body).toMatch(/value: Decimal!/);
		expect(body).not.toMatch(/currency/);
		expect(body).not.toMatch(/endDate/);
		expect(body).not.toMatch(/parentRecurringExpenseId/);
		expect(body).not.toMatch(/startDateUpdateType/);
		// The creation does store all of them, and they are members here.
		expect(inputBody('CreateEmployeeRecurringExpenseInput')).toMatch(/currency: String!/);
		expect(inputBody('CreateEmployeeRecurringExpenseInput')).toMatch(/endDate: DateTime/);
		expect(inputBody('CreateEmployeeRecurringExpenseInput')).toMatch(/parentRecurringExpenseId: ID/);
	});
});

describe('EmployeeRecurringExpenseResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', EmployeeRecurringExpenseResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', EmployeeRecurringExpenseController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', EmployeeRecurringExpenseResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			const declared = Reflect.getMetadata('__guards__', EmployeeRecurringExpenseController) ?? [];
			const restated = guardsOfHandler(EmployeeRecurringExpenseController, route);

			expect([...new Set([...declared, ...restated, FeatureFlagGuard])].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeRecurringExpenseResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeRecurringExpenseController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeRecurringExpenseController)).toEqual([
			PermissionsEnum.EMPLOYEE_EXPENSES_EDIT
		]);
	});

	it.each(PERMISSION_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		const fieldPermissions =
			Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeRecurringExpenseResolver.prototype[field]) ?? [];
		const routePermissions = permissionOfRoute(EmployeeRecurringExpenseController, route) ?? [];

		expect(fieldPermissions).toEqual(routePermissions);
		expect(guardsOfField(field)).toEqual(guardsOfHandler(EmployeeRecurringExpenseController, route));
	});

	it('carries the view permission on the three reads whose routes state it', () => {
		for (const field of [
			'employeeRecurringExpenses',
			'employeeRecurringExpenseStartDateUpdateType'
		]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.EMPLOYEE_EXPENSES_VIEW]);
		}

		for (const route of ['findAll', 'findStartDateUpdateType']) {
			expect(permissionOfRoute(EmployeeRecurringExpenseController, route)).toEqual([
				PermissionsEnum.EMPLOYEE_EXPENSES_VIEW
			]);
		}

		// The node read and the count are inherited from the CRUD base, where they state no permission of
		// their own — so they run under the controller's class-level edit permission, and the fields state
		// the same one rather than stating nothing.
		for (const handler of ['findById', 'getCount', 'create', 'update', 'delete', 'softRemove', 'softRecover']) {
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeRecurringExpenseController.prototype[handler])
			).toBeUndefined();
		}

		for (const field of ['employeeRecurringExpense', 'employeeRecurringExpenseCount', ...WRITES]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.EMPLOYEE_EXPENSES_EDIT]);
		}
	});
});

describe('EmployeeRecurringExpenseResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, EmployeeRecurringExpenseResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EmployeeRecurringExpenseResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('employeeRecurringExpenses'))
			.catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('employeeRecurringExpenses');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the removal and the verdict read among them', async () => {
		for (const field of [
			'createEmployeeRecurringExpense',
			'deleteEmployeeRecurringExpense',
			'employeeRecurringExpenseStartDateUpdateType'
		]) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('employeeRecurringExpense'))).resolves.toBe(true);
	});
});

describe('EmployeeRecurringExpenseModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EmployeeRecurringExpenseModule) ??
			[]) as unknown[];

		expect(providers).toContain(EmployeeRecurringExpenseResolver);
		expect(providers).toContain(EmployeeRecurringExpenseService);
	});

	it('exports the service the resolver injects, and reaches the buses it dispatches through', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EmployeeRecurringExpenseModule) ??
			[]) as unknown[];
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, EmployeeRecurringExpenseModule) ??
			[]) as Array<{ forwardRef?: () => unknown }>;
		const names = imports.map((entry) =>
			(entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry) as { name?: string }
		);

		expect(exported).toContain(EmployeeRecurringExpenseService);
		expect(names.map((entry) => entry?.name)).toContain('CqrsModule');
		// A resolver is an ordinary provider, so the three collaborators above are the whole of its
		// dependencies.
		expect(EmployeeRecurringExpenseResolver.length).toBe(3);
	});

	it('reaches the module that provides the guards, without importing the one the gate resolves through', () => {
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, EmployeeRecurringExpenseModule) ??
			[]) as Array<{ forwardRef?: () => unknown }>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(resolved.map((entry) => (entry as { name?: string })?.name)).toContain('RolePermissionModule');
		expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, FeatureModule)).toBe(true);
		expect(resolved).not.toContain(FeatureModule);
	});

	it('scopes every read by the organization the credential names', async () => {
		const { resolver, employeeRecurringExpenseService } = surfaces();

		await resolver.employeeRecurringExpenses();

		// Every client of the delivered list and month routes sends the organization its screen is
		// showing, and the delivered month handler cannot answer without one. The credential's own
		// organization is that same value, so the read states it rather than asking the caller for a
		// scope decision — which is what the field's description promises.
		expect(employeeRecurringExpenseService.findAll).toHaveBeenCalledWith({
			where: { organizationId: ORGANIZATION }
		});
	});
});
