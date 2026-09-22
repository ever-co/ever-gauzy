/**
 * 🛑 The entity graph must load FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the entity
 * applies it if the graph is entered through the validators rather than through the entities.
 *
 * The kernel barrel follows it, and for a second cycle this resource is on: the delivered handlers this
 * domain's module declares reach the `shared` barrel, which reaches the kernel barrel, which reaches the
 * module that hosts the GraphQL resolvers — and that module reaches a controller which reads its
 * validation pipe off the `shared` barrel. Entering that barrel before the kernel is evaluated leaves the
 * pipe undefined and the suite dies at import time; loading the kernel next, in the order the application
 * itself uses, resolves it. The two lines are one guard and must stay in this order.
 */
import '../core/entities/internal';
import '../core';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { GLOBAL_MODULE_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { RecurringExpenseDeletionEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { RequestContext } from '../core/context';
import { FeatureModule } from '../feature/feature.module';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OrganizationRecurringExpenseController } from './organization-recurring-expense.controller';
import { OrganizationRecurringExpenseModule } from './organization-recurring-expense.module';
import { OrganizationRecurringExpenseResolver } from './organization-recurring-expense.resolver';
import { OrganizationRecurringExpenseService } from './organization-recurring-expense.service';
import {
	OrganizationRecurringExpenseCreateCommand,
	OrganizationRecurringExpenseDeleteCommand,
	OrganizationRecurringExpenseEditCommand
} from './commands';
import {
	OrganizationRecurringExpenseFindSplitExpenseQuery,
	OrganizationRecurringExpenseStartDateUpdateTypeQuery
} from './queries';

/**
 * The standing costs one organization carries, over GraphQL.
 *
 * The delivered REST routes serve a list, the month narrowing of that list, one row, a count, a computed
 * verdict about a proposed change to an arrangement's beginning, a computed share of each shared
 * arrangement, a create, an edit that may rewrite a whole family of rows, a removal that takes one of
 * three different amounts out, and the withdrawal and restoration of a row. This suite pins the half of
 * the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - **the month route is a filter of that connection and not a second field**, so the disjunction it
 *   applies is asserted to be expressible in the connection's own vocabulary rather than merely
 *   documented;
 * - **the permission is the absence the controller states**, field by field: this controller carries the
 *   tenant guard and no `@Permissions` at all, so no field here may state one, and the class does not
 *   carry the permission guard either;
 * - every amount the surface carries is an exact decimal and never a floating-point number — on the
 *   object type, on the computed share, on the filter and on the way into a write;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant that
 *   switched that capability off is refused the way a disabled capability's routes are — and the refusal
 *   names the field, because the guard reads a GraphQL execution context rather than crashing on one.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
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
		categoryName: 'RENT',
		value: 4000,
		currency: 'USD',
		splitExpense: true,
		parentRecurringExpenseId: ARRANGEMENT,
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
		categoryName: 'SALARY_TAXES',
		value: 900.5,
		currency: 'EUR',
		splitExpense: false,
		parentRecurringExpenseId: ARRANGEMENT,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	}
];

/** The verdict a scripted read answers, with the rows it was drawn from. */
const VERDICT = { value: 'REDUCE_CONFLICT', conflicts: [ROWS[1]] };

/**
 * The rows the scripted share read answers: the arrangement with the quotient the delivered read wrote
 * onto it, and the whole it was divided from beside it.
 */
const SHARES = [{ ...ROWS[0], value: 1000, originalValue: 4000, employeeCount: 4 }];

/** The resolver, over a scripted service, a scripted command bus and a scripted query bus. */
function surfaces() {
	const organizationRecurringExpenseService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-05-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };
	const queryBus = {
		execute: jest.fn().mockImplementation((query: unknown) =>
			Promise.resolve(query instanceof OrganizationRecurringExpenseFindSplitExpenseQuery
				? { items: SHARES, total: SHARES.length }
				: VERDICT)
		)
	};

	return {
		organizationRecurringExpenseService,
		commandBus,
		queryBus,
		resolver: new OrganizationRecurringExpenseResolver(
			organizationRecurringExpenseService as never,
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
const ownSdl = ['organization-recurring-expense.type.gql', 'organization-recurring-expense.api.gql']
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
 * The employee's own arrangements name themselves around the same words and are excluded here: one
 * resource's suite asserts its own fields, not its neighbour's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('recurringexpense'))
		.filter((field) => field.toLowerCase().includes('organization'))
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
function handlersOf(controller: typeof OrganizationRecurringExpenseController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here. On this resource both sides of that lookup are empty, which is the
 * fact the parity tests below exist to hold: a resolver that quietly required a permission the
 * controller never states would refuse callers the REST routes serve.
 */
function permissionOfRoute(controller: typeof OrganizationRecurringExpenseController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = OrganizationRecurringExpenseResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = OrganizationRecurringExpenseResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(controller: typeof OrganizationRecurringExpenseController, handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field are
 * read from the field and from the route's own metadata and compared, rather than restated here.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'organizationRecurringExpenses', route: 'findAll' },
	{ field: 'organizationRecurringExpense', route: 'findById' },
	{ field: 'organizationRecurringExpenseCount', route: 'getCount' },
	{ field: 'organizationRecurringExpenseStartDateUpdateType', route: 'findStartDateUpdateType' },
	{ field: 'organizationRecurringExpenseShares', route: 'getSplitExpensesForEmployee' },
	{ field: 'createOrganizationRecurringExpense', route: 'create' },
	{ field: 'updateOrganizationRecurringExpense', route: 'update' },
	{ field: 'deleteOrganizationRecurringExpense', route: 'delete' },
	{ field: 'softDeleteOrganizationRecurringExpense', route: 'softRemove' },
	{ field: 'recoverOrganizationRecurringExpense', route: 'softRecover' }
];

/** The write fields, whose delegations are asserted one by one below. */
const WRITES = [
	'createOrganizationRecurringExpense',
	'updateOrganizationRecurringExpense',
	'deleteOrganizationRecurringExpense',
	'softDeleteOrganizationRecurringExpense',
	'recoverOrganizationRecurringExpense'
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
		getHandler: () => (OrganizationRecurringExpenseResolver.prototype as never)[field],
		getClass: () => OrganizationRecurringExpenseResolver,
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

describe('OrganizationRecurringExpenseResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query, the count and the two computed reads', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'organizationRecurringExpenses',
				'organizationRecurringExpense',
				'organizationRecurringExpenseCount',
				'organizationRecurringExpenseStartDateUpdateType',
				'organizationRecurringExpenseShares'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createOrganizationRecurringExpense',
				'updateOrganizationRecurringExpense',
				'deleteOrganizationRecurringExpense',
				'softDeleteOrganizationRecurringExpense',
				'recoverOrganizationRecurringExpense'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([
			'organizationRecurringExpense',
			'organizationRecurringExpenseCount',
			'organizationRecurringExpenseShares',
			'organizationRecurringExpenseStartDateUpdateType',
			'organizationRecurringExpenses'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createOrganizationRecurringExpense',
			'deleteOrganizationRecurringExpense',
			'recoverOrganizationRecurringExpense',
			'softDeleteOrganizationRecurringExpense',
			'updateOrganizationRecurringExpense'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type OrganizationRecurringExpenseConnection \{\s*nodes: \[OrganizationRecurringExpense!\]!\s*edges: \[OrganizationRecurringExpenseEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type OrganizationRecurringExpenseEdge \{\s*node: OrganizationRecurringExpense!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input OrganizationRecurringExpenseFilter \{/);
		expect(printed).toMatch(/input OrganizationRecurringExpenseSort \{/);
		expect(printed).toMatch(
			/enum OrganizationRecurringExpenseSortField \{\s*createdAt\s*updatedAt\s*startDate\s*endDate\s*value\s*categoryName\s*\}/
		);
	});

	it('declares the write inputs the mutations take, and the removal input with them', () => {
		expect(printed).toMatch(/input CreateOrganizationRecurringExpenseInput \{/);
		expect(printed).toMatch(/input UpdateOrganizationRecurringExpenseInput \{/);
		expect(printed).toMatch(/input OrganizationRecurringExpenseDeleteInput \{/);
	});

	it('carries the members the delivered reads produce, and no relation it never loads', () => {
		const members = memberNames('OrganizationRecurringExpense');

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
				'splitExpense',
				'parentRecurringExpenseId',
				'deletedAt'
			])
		);
	});

	it('offers no argument it cannot honour', () => {
		expect(fieldArgs('Query', 'organizationRecurringExpenses')).not.toContain('withDeleted');
		expect(fieldArgs('Query', 'organizationRecurringExpenses')).toEqual([
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
		expect(fieldArgs('Query', 'organizationRecurringExpenseCount')).toEqual([]);
		expect(fieldType('Query', 'organizationRecurringExpenseCount')).toBe('Int');
		// The verdict read takes the two members the delivered route reads out of its `data` parameter,
		// the share read takes the path segment and the month its input carries, and the removal takes the
		// deletion input that route reads beside the identifier.
		expect(fieldArgs('Query', 'organizationRecurringExpenseStartDateUpdateType')).toEqual([
			'recurringExpenseId',
			'newStartDate'
		]);
		expect(fieldArgs('Query', 'organizationRecurringExpenseShares')).toEqual([
			'organizationId',
			'year',
			'month'
		]);
		expect(fieldArgs('Mutation', 'deleteOrganizationRecurringExpense')).toEqual(['id', 'input']);
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createOrganizationRecurringExpense', ['input']],
			['updateOrganizationRecurringExpense', ['input']],
			['deleteOrganizationRecurringExpense', ['id', 'input']],
			['softDeleteOrganizationRecurringExpense', ['id']],
			['recoverOrganizationRecurringExpense', ['id']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}
	});
});

describe('OrganizationRecurringExpenseResolver — every amount is exact, the computed share included', () => {
	it('carries the standing cost as Decimal and never as Float', () => {
		const body = typeBody('OrganizationRecurringExpense');

		expect(body).toMatch(/value: Decimal!(\n|$)/);
		expect(body).not.toMatch(/\bFloat\b/);
	});

	it('carries the divided share and the whole it came from as Decimals as well', () => {
		const body = typeBody('OrganizationRecurringExpenseShare');

		// The quotient is a computation over a range rather than a stored amount, and it travels in the
		// same exact family the amount it was computed from does: a share read as a `Float` is a share
		// that will not add up to the whole.
		expect(body).toMatch(/recurringExpense: OrganizationRecurringExpense!/);
		expect(body).toMatch(/originalValue: Decimal!(\n|$)/);
		expect(body).toMatch(/employeeCount: Int!(\n|$)/);
		expect(body).not.toMatch(/\bFloat\b/);
	});

	it('states no Float in any member this domain declares', () => {
		const declared = [
			'OrganizationRecurringExpense',
			'OrganizationRecurringExpenseEdge',
			'OrganizationRecurringExpenseConnection',
			'OrganizationRecurringExpenseStartDateUpdateType',
			'OrganizationRecurringExpenseShare',
			'OrganizationRecurringExpenseFilter',
			'OrganizationRecurringExpenseSort',
			'OrganizationRecurringExpenseSortField',
			'CreateOrganizationRecurringExpenseInput',
			'UpdateOrganizationRecurringExpenseInput',
			'OrganizationRecurringExpenseDeleteInput'
		]
			.map((name) => `${typeBody(name)}\n${inputBody(name)}`)
			.join('\n');

		expect(declared).not.toMatch(/\bFloat\b/);
		expect(ownSdl).not.toMatch(/:\s*\[?Float\b/);
	});

	it('narrows the amount through the decimal family, never through a whole-number one', () => {
		const filter = inputBody('OrganizationRecurringExpenseFilter');

		expect(filter).toMatch(/value: DecimalFilter/);
		expect(filter).not.toMatch(/value: (FloatFilter|NumberFilter)/);
		expect(filter).toMatch(/startMonth: NumberFilter/);
		expect(filter).not.toMatch(/\bFloat\b/);
	});

	it('states money in the write inputs as the exact decimal, never as a Float', () => {
		expect(inputBody('CreateOrganizationRecurringExpenseInput')).toMatch(/value: Decimal!/);
		expect(inputBody('UpdateOrganizationRecurringExpenseInput')).toMatch(/value: Decimal!/);
		expect(inputBody('CreateOrganizationRecurringExpenseInput')).toMatch(/currency: String!/);
	});

	it('answers the amount the row holds, unchanged', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.organizationRecurringExpenses();

		expect(connection.nodes[0].value).toBe(4000);
		expect(connection.nodes[1].value).toBe(900.5);
		expect(await resolver.organizationRecurringExpense(ARRANGEMENT)).toBe(ROWS[0]);
	});

	it('answers the divided share beside the whole, and computes nothing of its own', async () => {
		const { resolver } = surfaces();

		const shares = await resolver.organizationRecurringExpenseShares(ORGANIZATION, 2026, 3);

		// The quotient is the delivered read's: the field carries the row it answered and the two members
		// the read set beside it, and performs no arithmetic of its own.
		expect(shares).toHaveLength(1);
		expect(shares[0].recurringExpense.value).toBe(1000);
		expect(shares[0].originalValue).toBe(4000);
		expect(shares[0].employeeCount).toBe(4);
	});

	it('hands a write the exact digits the caller stated rather than a binary fraction', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createOrganizationRecurringExpense({
			value: '4000.25',
			currency: 'USD',
			categoryName: 'RENT',
			startDay: 1,
			startMonth: 4,
			startYear: 2026,
			startDate: new Date('2026-04-01T00:00:00.000Z')
		});

		const create = commandBus.execute.mock.calls[0][0] as OrganizationRecurringExpenseCreateCommand;

		expect(create.input).toEqual(expect.objectContaining({ value: '4000.25' }));

		await resolver.updateOrganizationRecurringExpense({
			id: ARRANGEMENT,
			value: '0.1',
			categoryName: 'RENT',
			startDay: 1,
			startMonth: 5,
			startYear: 2026
		});

		const edit = commandBus.execute.mock.calls[1][0] as OrganizationRecurringExpenseEditCommand;

		expect(edit.input).toEqual(expect.objectContaining({ value: '0.1' }));
	});
});

describe('OrganizationRecurringExpenseResolver — the connection contract, and the month route folded into it', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, organizationRecurringExpenseService } = surfaces();

		const connection = await resolver.organizationRecurringExpenses(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the criterion that route binds from its
		// `data` parameter — the organization the credential names, and no order of its own.
		expect(organizationRecurringExpenseService.findAll).toHaveBeenCalledWith({
			where: { organizationId: ORGANIZATION }
		});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ARRANGEMENT);
	});

	it('orders by the beginning of the arrangement, newest first, when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.organizationRecurringExpenses();

		expect(connection.nodes.map((node) => node.id)).toEqual([ARRANGEMENT, SUCCESSOR]);
	});

	it('answers the month route’s question through the filter, with the delivered disjunction', async () => {
		const { resolver } = surfaces();

		// The delivered month read answers the arrangements in force during the range its `data` parameter
		// carries — the delivered clients send one month's bounds — which is the disjunction below stated in
		// the connection's own vocabulary: an arrangement that begins inside the range with no end yet, or
		// one that begins no later than the range's start and ends no earlier than its end. That is what
		// makes the month route a filter of this list rather than a second root field.
		const inForce = await resolver.organizationRecurringExpenses({
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
		const later = await resolver.organizationRecurringExpenses({
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

		const beyond = await resolver.organizationRecurringExpenses({
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

		const shared = await resolver.organizationRecurringExpenses({ splitExpense: { eq: true } });
		expect(shared.nodes.map((node) => node.id)).toEqual([ARRANGEMENT]);

		const byValue = await resolver.organizationRecurringExpenses({ value: { gt: '1000' } });
		expect(byValue.nodes.map((node) => node.id)).toEqual([ARRANGEMENT]);

		const openEnded = await resolver.organizationRecurringExpenses({ endDate: { isNull: true } });
		expect(openEnded.nodes.map((node) => node.id)).toEqual([ARRANGEMENT]);

		const family = await resolver.organizationRecurringExpenses({
			parentRecurringExpenseId: { eq: ARRANGEMENT }
		});
		expect(family.totalCount).toBe(2);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byValue = await resolver.organizationRecurringExpenses(undefined, [
			{ field: 'value', direction: 'ASC' }
		]);
		expect(byValue.nodes.map((node) => node.id)).toEqual([SUCCESSOR, ARRANGEMENT]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.organizationRecurringExpenses(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([ARRANGEMENT]);

		const second = await resolver.organizationRecurringExpenses(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SUCCESSOR]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationRecurringExpenses(undefined, [{ field: 'splitExpense', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// `deletedAt` is carried on the entity and deliberately not filterable: the delivered list read
		// answers live rows only, so the condition could only ever match the empty set.
		const error = await resolver
			.organizationRecurringExpenses({ deletedAt: { isNull: false } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationRecurringExpenses(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('keeps the evaluator’s allow-list and the schema’s filter in step, member for member', async () => {
		const { resolver } = surfaces();
		const declared = [
			...inputBody('OrganizationRecurringExpenseFilter').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)
		]
			.map((match) => match[1])
			.filter((member) => !['and', 'or', 'not'].includes(member));

		for (const member of declared) {
			await expect(resolver.organizationRecurringExpenses({ [member]: {} })).resolves.toBeDefined();
		}

		const refusal = await resolver
			.organizationRecurringExpenses({ deletedAt: { isNull: false } })
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
			...bodyOf('enum', 'OrganizationRecurringExpenseSortField').matchAll(
				/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm
			)
		].map((match) => match[1]);

		expect(offered).toEqual(['createdAt', 'updatedAt', 'startDate', 'endDate', 'value', 'categoryName']);

		for (const field of offered) {
			await expect(
				resolver.organizationRecurringExpenses(undefined, [{ field, direction: 'ASC' }])
			).resolves.toBeDefined();
		}
	});
});

describe('OrganizationRecurringExpenseResolver — one ledger, two protocols, the same operations', () => {
	it('reads one row through the same service method the REST node route calls', async () => {
		const { resolver, organizationRecurringExpenseService } = surfaces();

		expect(await resolver.organizationRecurringExpense(ARRANGEMENT)).toBe(ROWS[0]);
		expect(organizationRecurringExpenseService.findOneByIdString).toHaveBeenCalledWith(ARRANGEMENT);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, organizationRecurringExpenseService } = surfaces();
		organizationRecurringExpenseService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.organizationRecurringExpense(SUCCESSOR)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, organizationRecurringExpenseService } = surfaces();

		expect(await resolver.organizationRecurringExpenseCount()).toBe(2);
		expect(organizationRecurringExpenseService.countBy).toHaveBeenCalledWith();
	});

	it('answers the verdict through the query the date-update-type route executes', async () => {
		const { resolver, queryBus } = surfaces();
		const newStartDate = new Date('2026-06-01T00:00:00.000Z');

		const verdict = await resolver.organizationRecurringExpenseStartDateUpdateType(
			ARRANGEMENT,
			newStartDate
		);
		const query = queryBus.execute.mock.calls[0][0] as OrganizationRecurringExpenseStartDateUpdateTypeQuery;

		expect(query).toBeInstanceOf(OrganizationRecurringExpenseStartDateUpdateTypeQuery);
		expect(query.input).toEqual({ recurringExpenseId: ARRANGEMENT, newStartDate });
		expect(verdict).toBe(VERDICT);
		expect(verdict.conflicts).toEqual([ROWS[1]]);
	});

	it('reads the shares through the query the per-employee route executes', async () => {
		const { resolver, queryBus } = surfaces();

		await resolver.organizationRecurringExpenseShares(ORGANIZATION, 2026, 3);

		const query = queryBus.execute.mock.calls[0][0] as OrganizationRecurringExpenseFindSplitExpenseQuery;

		// The organization is the path segment and the month is the input the delivered read builds its
		// instant from: the year and the calendar month's zero-based position, handed over as they arrived.
		expect(query).toBeInstanceOf(OrganizationRecurringExpenseFindSplitExpenseQuery);
		expect(query.orgId).toBe(ORGANIZATION);
		expect(query.findInput).toEqual({ year: 2026, month: 3 });
	});

	it('records a standing cost through the same command the REST create route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		const created = await resolver.createOrganizationRecurringExpense({
			value: '4000',
			currency: 'USD',
			categoryName: 'RENT',
			startDay: 1,
			startMonth: 4,
			startYear: 2026,
			startDate: new Date('2026-04-01T00:00:00.000Z'),
			splitExpense: true,
			organizationId: ORGANIZATION
		});

		const command = commandBus.execute.mock.calls[0][0] as OrganizationRecurringExpenseCreateCommand;

		expect(created).toBe(ROWS[0]);
		expect(command).toBeInstanceOf(OrganizationRecurringExpenseCreateCommand);
		expect(command.input).toEqual({
			value: '4000',
			currency: 'USD',
			categoryName: 'RENT',
			startDay: 1,
			startMonth: 4,
			startYear: 2026,
			startDate: new Date('2026-04-01T00:00:00.000Z'),
			splitExpense: true,
			organizationId: ORGANIZATION
		});
	});

	it('changes a standing cost through the same command the REST edit route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateOrganizationRecurringExpense({
			id: ARRANGEMENT,
			value: '4200',
			categoryName: 'RENT',
			startDay: 1,
			startMonth: 5,
			startYear: 2026
		});

		const command = commandBus.execute.mock.calls[0][0] as OrganizationRecurringExpenseEditCommand;

		expect(command).toBeInstanceOf(OrganizationRecurringExpenseEditCommand);
		expect(command.id).toBe(ARRANGEMENT);
		expect(command.input).toEqual({
			value: '4200',
			categoryName: 'RENT',
			startDay: 1,
			startMonth: 5,
			startYear: 2026
		});
	});

	it('removes a standing cost through the same command the REST removal route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		const removed = await resolver.deleteOrganizationRecurringExpense(ARRANGEMENT, {
			deletionType: RecurringExpenseDeletionEnum.ALL,
			month: 6,
			year: 2026
		});

		const command = commandBus.execute.mock.calls[0][0] as OrganizationRecurringExpenseDeleteCommand;

		// The deletion input is the member the delivered route reads out of its `data` parameter, handed
		// over as it arrived. The field answers the one fact the removal establishes, because the delivered
		// handler's own answer is a delete result, an update result or a newly opened row.
		expect(command).toBeInstanceOf(OrganizationRecurringExpenseDeleteCommand);
		expect(command.id).toBe(ARRANGEMENT);
		expect(command.deleteInput).toEqual({ deletionType: 'all', month: 6, year: 2026 });
		expect(removed).toBe(true);
	});

	it('withdraws and restores a standing cost through the service methods the inherited routes call', async () => {
		const { resolver, organizationRecurringExpenseService } = surfaces();

		const withdrawn = await resolver.softDeleteOrganizationRecurringExpense(ARRANGEMENT);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(organizationRecurringExpenseService.softRemove).toHaveBeenCalledWith(ARRANGEMENT);

		expect(await resolver.recoverOrganizationRecurringExpense(ARRANGEMENT)).toBe(ROWS[0]);
		expect(organizationRecurringExpenseService.softRecover).toHaveBeenCalledWith(ARRANGEMENT);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('RECURRING_EXPENSE_CONFLICT: a sibling stands in the gap.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(
			resolver.updateOrganizationRecurringExpense({
				id: ARRANGEMENT,
				value: '1',
				categoryName: 'RENT',
				startDay: 1,
				startMonth: 1,
				startYear: 2027
			})
		).rejects.toBe(refusal);
	});

	it('states on the edit only the members the delivered edit reads', () => {
		const body = inputBody('UpdateOrganizationRecurringExpenseInput');

		// The delivered edit body accepts a currency the delivered handler never writes, and the branch
		// that opens a successor takes the currency and the parent from the row it replaces — so neither is
		// offered.
		expect(body).toMatch(/startDay: Int!/);
		expect(body).toMatch(/value: Decimal!/);
		expect(body).not.toMatch(/currency/);
		expect(body).not.toMatch(/endDate/);
		expect(body).not.toMatch(/parentRecurringExpenseId/);
		expect(body).not.toMatch(/splitExpense/);
	});

	it('scopes every read by the organization the credential names', async () => {
		const { resolver, organizationRecurringExpenseService } = surfaces();

		await resolver.organizationRecurringExpenses();

		// Every client of the delivered list and month routes sends the organization its screen is showing,
		// and the delivered month handler cannot answer without one. The credential's own organization is
		// that same value, so the read states it rather than asking the caller for a scope decision.
		expect(organizationRecurringExpenseService.findAll).toHaveBeenCalledWith({
			where: { organizationId: ORGANIZATION }
		});
	});
});

describe('OrganizationRecurringExpenseResolver — the guard chain is the controller’s, and the permission is its absence', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OrganizationRecurringExpenseResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OrganizationRecurringExpenseController) ?? [];

		expect(controllerGuards).toEqual([TenantPermissionGuard]);
		// The one guard the resolver states beyond the controller's chain is the gate, and it is the
		// addition rather than a substitution: the controller's own guard comes first, so a caller with no
		// credential is refused as a credential problem before a tenant's switches are read.
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
		// The controller does not carry the permission guard, so the resolver does not either: a
		// permission stated on this surface would never be read, and carrying the guard without a
		// permission would refuse nothing while looking like a scope that does not exist.
		expect(resolverGuards).not.toContain(PermissionGuard);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', OrganizationRecurringExpenseResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			const declared = Reflect.getMetadata('__guards__', OrganizationRecurringExpenseController) ?? [];
			const restated = guardsOfHandler(OrganizationRecurringExpenseController, route);

			expect([...new Set([...declared, ...restated, FeatureFlagGuard])].sort()).toEqual([...stated].sort());
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationRecurringExpenseController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationRecurringExpenseResolver)).toBeUndefined();
	});

	it.each(PERMISSION_PARITY)('$field states no permission, exactly as $route does', ({ field, route }) => {
		// The delivered controller carries the tenant guard and no permission at all, on the class or on
		// any handler — so a field that required one would refuse a caller the REST route serves, which is
		// the narrowing this delivery exists to prevent.
		expect(permissionOfRoute(OrganizationRecurringExpenseController, route)).toBeUndefined();
		expect(permissionOfField(field)).toBeUndefined();
		// The guard a field states of its own is the guard its route's handler states of its own: the
		// class-level chains are compared above, and a handler that added one is caught here.
		expect(guardsOfField(field)).toEqual(guardsOfHandler(OrganizationRecurringExpenseController, route));
	});
});

describe('OrganizationRecurringExpenseResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationRecurringExpenseResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OrganizationRecurringExpenseResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('organizationRecurringExpenses'))
			.catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('organizationRecurringExpenses');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the removal and the two computed reads among them', async () => {
		for (const field of [
			'createOrganizationRecurringExpense',
			'deleteOrganizationRecurringExpense',
			'organizationRecurringExpenseShares'
		]) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('organizationRecurringExpense'))).resolves.toBe(true);
	});
});

describe('OrganizationRecurringExpenseModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, OrganizationRecurringExpenseModule) ??
			[]) as unknown[];

		expect(providers).toContain(OrganizationRecurringExpenseResolver);
		expect(providers).toContain(OrganizationRecurringExpenseService);
	});

	it('exports the service the resolver injects, and reaches the buses it dispatches through', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, OrganizationRecurringExpenseModule) ??
			[]) as unknown[];
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, OrganizationRecurringExpenseModule) ??
			[]) as Array<{ forwardRef?: () => unknown }>;
		const names = imports.map((entry) =>
			(entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry) as { name?: string }
		);

		expect(exported).toContain(OrganizationRecurringExpenseService);
		expect(names.map((entry) => entry?.name)).toContain('CqrsModule');
		expect(OrganizationRecurringExpenseResolver.length).toBe(3);
	});

	it('reaches the module that provides the guard, without importing the one the gate resolves through', () => {
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, OrganizationRecurringExpenseModule) ??
			[]) as Array<{ forwardRef?: () => unknown }>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(resolved.map((entry) => (entry as { name?: string })?.name)).toContain('RolePermissionModule');
		expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, FeatureModule)).toBe(true);
		expect(resolved).not.toContain(FeatureModule);
	});
});
