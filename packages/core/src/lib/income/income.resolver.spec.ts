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
import { IncomeController } from './income.controller';
import { IncomeModule } from './income.module';
import { IncomeResolver } from './income.resolver';
import { IncomeService } from './income.service';
import { EmployeeService } from '../employee/employee.service';
import { IncomeCreateCommand, IncomeDeleteCommand, IncomeUpdateCommand } from './commands';

/**
 * The income book over GraphQL.
 *
 * The delivered REST routes serve a list, one row, a count, the caller's own rows, a create, an edit
 * that is the platform's own upsert, a hard removal, and the withdrawal and restoration of a row. This
 * suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - **the caller's own read is a root field of its own**, because the delivered route narrows by who is
 *   asking rather than by a statement the caller makes and a filter could not express that;
 * - every field calls the same service method or dispatches the same command the REST route reaches,
 *   with the same payload, so a client does not choose a better surface by choosing a protocol;
 * - **the guard stack and the permission are the controller's, field by field** — including the
 *   withdrawal and the restoration, whose delivered routes state no permission of their own and
 *   therefore run under the controller's class-level edit permission, which is the one this resolver
 *   states as well;
 * - every amount the surface carries is an exact decimal and never a floating-point number, on the
 *   object type, on the filter and on the way into a write;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant that
 *   switched that capability off is refused the way a disabled capability's routes are — and the refusal
 *   names the field, because the guard reads a GraphQL execution context rather than crashing on one.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000020';
const CLIENT = '00000000-0000-4000-8000-000000000040';
const TAG = '00000000-0000-4000-8000-000000000050';
const INCOME = '00000000-0000-4000-8000-000000000010';
const BONUS = '00000000-0000-4000-8000-000000000011';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them, with the
 * amount as the platform's numeric transformer hands it over: a number, and nothing rounded, rescaled or
 * reformatted on the way.
 */
const ROWS = [
	{
		id: INCOME,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		amount: 1200.5,
		currency: 'USD',
		valueDate: new Date('2026-03-05T10:00:00.000Z'),
		notes: 'Retainer, March',
		isBonus: false,
		reference: 'INV-2026-03',
		clientId: CLIENT,
		employeeId: EMPLOYEE,
		createdAt: new Date('2026-03-05T10:00:00.000Z'),
		updatedAt: new Date('2026-03-05T10:00:00.000Z')
	},
	{
		id: BONUS,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		amount: 250,
		currency: 'EUR',
		valueDate: new Date('2026-02-01T10:00:00.000Z'),
		notes: 'Referral bonus',
		isBonus: true,
		reference: null,
		clientId: CLIENT,
		employeeId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over scripted services and a scripted command bus. */
function surfaces() {
	const incomeService = {
		findAllIncomes: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-05-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const employeeService = { findOneByWhereOptions: jest.fn().mockResolvedValue({ id: EMPLOYEE }) };
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		incomeService,
		employeeService,
		commandBus,
		resolver: new IncomeResolver(incomeService as never, employeeService as never, commandBus as never)
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
const ownSdl = ['income.type.gql', 'income.api.gql']
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
 * The statistics the platform computes out of these rows name their own fields and carry an income as a
 * member rather than as a root field, so nothing else in the schema names itself around this word.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('income'))
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
function handlersOf(controller: typeof IncomeController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof IncomeController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = IncomeResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = IncomeResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(controller: typeof IncomeController, handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field are
 * read from the field and from the route's own metadata and compared, rather than restated here.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'incomes', route: 'findAll' },
	{ field: 'income', route: 'findById' },
	{ field: 'incomeCount', route: 'getCount' },
	{ field: 'myIncomes', route: 'findMyIncome' },
	{ field: 'createIncome', route: 'create' },
	{ field: 'updateIncome', route: 'update' },
	{ field: 'deleteIncome', route: 'delete' },
	{ field: 'softDeleteIncome', route: 'softRemove' },
	{ field: 'recoverIncome', route: 'softRecover' }
];

/** The write fields, whose delegations are asserted one by one below. */
const WRITES = ['createIncome', 'updateIncome', 'deleteIncome', 'softDeleteIncome', 'recoverIncome'];

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
		getHandler: () => (IncomeResolver.prototype as never)[field],
		getClass: () => IncomeResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('IncomeResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query, the count and the caller’s own read', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['incomes', 'income', 'incomeCount', 'myIncomes'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createIncome',
				'updateIncome',
				'deleteIncome',
				'softDeleteIncome',
				'recoverIncome'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual(['income', 'incomeCount', 'incomes', 'myIncomes']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createIncome',
			'deleteIncome',
			'recoverIncome',
			'softDeleteIncome',
			'updateIncome'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type IncomeConnection \{\s*nodes: \[Income!\]!\s*edges: \[IncomeEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type IncomeEdge \{\s*node: Income!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input IncomeFilter \{/);
		expect(printed).toMatch(/input IncomeSort \{/);
		expect(printed).toMatch(/enum IncomeSortField \{\s*createdAt\s*updatedAt\s*valueDate\s*amount\s*\}/);
	});

	it('declares the write inputs the mutations take', () => {
		expect(printed).toMatch(/input CreateIncomeInput \{/);
		expect(printed).toMatch(/input UpdateIncomeInput \{/);
	});

	it('carries the members the delivered reads produce, and not the relations they never load', () => {
		const members = memberNames('Income');

		// No read behind this surface joins a relation, so a member carrying the client, the employee or
		// the tags would be absent from exactly the rows this surface answers while looking like a fact
		// about the income. The identifiers are columns and are carried instead.
		expect(members).not.toContain('client');
		expect(members).not.toContain('employee');
		expect(members).not.toContain('tags');
		expect(members).toEqual(
			expect.arrayContaining(['clientId', 'employeeId', 'isBonus', 'reference', 'deletedAt'])
		);
	});

	it('offers no argument it cannot honour', () => {
		expect(fieldArgs('Query', 'incomes')).not.toContain('withDeleted');
		expect(fieldArgs('Query', 'incomes')).toEqual([
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
		expect(fieldArgs('Query', 'incomeCount')).toEqual([]);
		expect(fieldType('Query', 'incomeCount')).toBe('Int');
		// The caller's own read resolves the employee from the credential, so it states only the date the
		// delivered route reads out of its `data` parameter.
		expect(fieldArgs('Query', 'myIncomes')).toEqual(['filterDate']);
		// The removal reads the employee out of its query string, so the field states it beside the id.
		expect(fieldArgs('Mutation', 'deleteIncome')).toEqual(['id', 'employeeId']);
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createIncome', ['input']],
			['updateIncome', ['input']],
			['deleteIncome', ['id', 'employeeId']],
			['softDeleteIncome', ['id']],
			['recoverIncome', ['id']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}
	});
});

describe('IncomeResolver — every amount is exact', () => {
	it('carries the amount as Decimal and never as Float', () => {
		const body = typeBody('Income');

		expect(body).toMatch(/amount: Decimal!(\n|$)/);
		expect(body).not.toMatch(/\bFloat\b/);
	});

	it('states no Float in any member this domain declares', () => {
		const declared = [
			'Income',
			'IncomeEdge',
			'IncomeConnection',
			'IncomeFilter',
			'IncomeSort',
			'IncomeSortField',
			'CreateIncomeInput',
			'UpdateIncomeInput'
		]
			.map((name) => `${typeBody(name)}\n${inputBody(name)}`)
			.join('\n');

		expect(declared).not.toMatch(/\bFloat\b/);
		expect(ownSdl).not.toMatch(/:\s*\[?Float\b/);
	});

	it('narrows the amount through the decimal family, never through a whole-number one', () => {
		const filter = inputBody('IncomeFilter');

		expect(filter).toMatch(/amount: DecimalFilter/);
		expect(filter).not.toMatch(/amount: (FloatFilter|NumberFilter)/);
		expect(filter).not.toMatch(/\bFloat\b/);
	});

	it('states money in the write inputs as the exact decimal, never as a Float', () => {
		expect(inputBody('CreateIncomeInput')).toMatch(/amount: Decimal!/);
		expect(inputBody('UpdateIncomeInput')).toMatch(/amount: Decimal!/);
		expect(inputBody('CreateIncomeInput')).toMatch(/currency: String!/);
	});

	it('carries a currency as the row’s own three-letter code and never as a formatted amount', () => {
		const body = typeBody('Income');

		expect(body).toMatch(/currency: String!/);
		expect(body).not.toMatch(/formatted|formattedAmount|displayAmount/);
	});

	it('answers the amounts the row holds, unchanged', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.incomes();

		expect(connection.nodes[0].amount).toBe(1200.5);
		expect(connection.nodes[1].amount).toBe(250);
		expect(await resolver.income(INCOME)).toBe(ROWS[0]);
	});

	it('hands a write the exact digits the caller stated rather than a binary fraction', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createIncome({ amount: '1200.5', clientId: CLIENT, currency: 'USD' });

		const create = commandBus.execute.mock.calls[0][0] as IncomeCreateCommand;

		expect(create.input).toEqual(expect.objectContaining({ amount: '1200.5' }));

		await resolver.updateIncome({ id: INCOME, amount: '0.1', clientId: CLIENT, currency: 'USD' });

		const update = commandBus.execute.mock.calls[1][0] as IncomeUpdateCommand;

		expect(update.id).toBe(INCOME);
		expect(update.entity).toEqual(expect.objectContaining({ amount: '0.1' }));
	});
});

describe('IncomeResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, incomeService } = surfaces();

		const connection = await resolver.incomes(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(incomeService.findAllIncomes).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(INCOME);
	});

	it('orders by the book’s own date, newest first, when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.incomes();

		expect(connection.nodes.map((node) => node.id)).toEqual([INCOME, BONUS]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byBonus = await resolver.incomes({ isBonus: { eq: true } });
		expect(byBonus.nodes.map((node) => node.id)).toEqual([BONUS]);

		const byCurrency = await resolver.incomes({ currency: { eq: 'EUR' } });
		expect(byCurrency.nodes.map((node) => node.id)).toEqual([BONUS]);

		// The window the paginated spelling of the list interprets is `between` here, on the amount.
		const byAmount = await resolver.incomes({ amount: { between: ['200', '300'] } });
		expect(byAmount.nodes.map((node) => node.id)).toEqual([BONUS]);

		// And on a date, which is compared as an instant rather than as its spelling.
		const byDate = await resolver.incomes({
			valueDate: { between: ['2026-02-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'] }
		});
		expect(byDate.nodes.map((node) => node.id)).toEqual([BONUS]);

		// The note pattern the paginated spelling applies is the connection's own vocabulary here.
		const byNotes = await resolver.incomes({ notes: { ilike: '%bonus' } });
		expect(byNotes.nodes.map((node) => node.id)).toEqual([BONUS]);

		const byClient = await resolver.incomes({ clientId: { eq: CLIENT } });
		expect(byClient.totalCount).toBe(2);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byAmount = await resolver.incomes(undefined, [{ field: 'amount', direction: 'ASC' }]);
		expect(byAmount.nodes.map((node) => node.id)).toEqual([BONUS, INCOME]);

		const byDate = await resolver.incomes(undefined, [{ field: 'valueDate', direction: 'ASC' }]);
		expect(byDate.nodes.map((node) => node.id)).toEqual([BONUS, INCOME]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.incomes(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([INCOME]);

		const second = await resolver.incomes(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([BONUS]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.incomes(undefined, undefined, undefined, 20);

		const last = await resolver.incomes(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([INCOME]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.incomes(undefined, [{ field: 'isBonus', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// `tags` is carried on the entity and deliberately not filterable: the delivered list read loads
		// no relations, so the condition could only ever match the empty set.
		const error = await resolver.incomes({ tags: { eq: TAG } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.incomes(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('keeps the evaluator’s allow-list and the schema’s filter in step, member for member', async () => {
		const { resolver } = surfaces();
		const declared = [...inputBody('IncomeFilter').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)]
			.map((match) => match[1])
			.filter((member) => !['and', 'or', 'not'].includes(member));

		for (const member of declared) {
			await expect(resolver.incomes({ [member]: {} })).resolves.toBeDefined();
		}

		const refusal = await resolver.incomes({ tags: { eq: TAG } }).catch((thrown) => thrown);
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
		const offered = [...bodyOf('enum', 'IncomeSortField').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm)].map(
			(match) => match[1]
		);

		expect(offered).toEqual(['createdAt', 'updatedAt', 'valueDate', 'amount']);

		for (const field of offered) {
			await expect(resolver.incomes(undefined, [{ field, direction: 'ASC' }])).resolves.toBeDefined();
		}
	});
});

describe('IncomeResolver — one book, two protocols, the same operations', () => {
	it('reads one row through the same service method the REST node route calls', async () => {
		const { resolver, incomeService } = surfaces();

		expect(await resolver.income(INCOME)).toBe(ROWS[0]);
		expect(incomeService.findOneByIdString).toHaveBeenCalledWith(INCOME);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, incomeService } = surfaces();
		incomeService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.income(BONUS)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, incomeService } = surfaces();

		expect(await resolver.incomeCount()).toBe(2);
		expect(incomeService.countBy).toHaveBeenCalledWith();
	});

	it('reads the caller’s own incomes through the read the /me route performs', async () => {
		const { resolver, incomeService, employeeService } = surfaces();
		const userId = jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');

		try {
			const rows = await resolver.myIncomes(new Date('2026-03-01T00:00:00.000Z'));

			// The delivered route looks the employee row up by the caller's user identifier, so a caller
			// without one is refused rather than answered an empty list — and the read it then performs is
			// the same one, narrowed to that employee and to the month of the date it was given.
			expect(employeeService.findOneByWhereOptions).toHaveBeenCalledWith({ userId: 'user-1' });
			expect(incomeService.findAllIncomes).toHaveBeenCalledWith(
				{ where: { employeeId: EMPLOYEE } },
				'2026-03-01T00:00:00.000Z'
			);
			expect(rows).toHaveLength(2);
		} finally {
			userId.mockRestore();
		}
	});

	it('records an income through the same command the REST create route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(
			await resolver.createIncome({
				amount: '1200.5',
				clientId: CLIENT,
				currency: 'USD',
				valueDate: new Date('2026-03-05T10:00:00.000Z'),
				notes: 'Retainer, March',
				reference: 'INV-2026-03',
				organizationId: ORGANIZATION,
				employeeId: EMPLOYEE,
				tagIds: [TAG]
			})
		).toBe(ROWS[0]);

		// The delivered create is handed the members the caller stated, the facets as the identifiers the
		// pivot row is written from, and the tenant only from the credential.
		expect((commandBus.execute.mock.calls[0][0] as IncomeCreateCommand).input).toEqual({
			amount: '1200.5',
			clientId: CLIENT,
			currency: 'USD',
			valueDate: new Date('2026-03-05T10:00:00.000Z'),
			notes: 'Retainer, March',
			reference: 'INV-2026-03',
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			tags: [{ id: TAG }]
		});
	});

	it('changes an income through the same command the REST edit route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateIncome({ id: INCOME, amount: '1300', clientId: CLIENT, currency: 'USD' });

		// The delivered edit carries the identifier the route reads from the path and the body beside it,
		// handed to the same write the create uses.
		const command = commandBus.execute.mock.calls[0][0] as IncomeUpdateCommand;

		expect(command.id).toBe(INCOME);
		expect(command.entity).toEqual({ amount: '1300', clientId: CLIENT, currency: 'USD' });
	});

	it('removes an income through the same command the REST removal route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteIncome(INCOME, EMPLOYEE)).toBe(true);

		const command = commandBus.execute.mock.calls[0][0] as IncomeDeleteCommand;

		// The employee is the query member the delivered route reads and hands to the command beside the
		// identifier; the field answers the one fact the removal establishes, because the delivered
		// handler's delete result is not a row.
		expect(command).toBeInstanceOf(IncomeDeleteCommand);
		expect(command.employeeId).toBe(EMPLOYEE);
		expect(command.incomeId).toBe(INCOME);
	});

	it('withdraws and restores an income through the service methods the inherited routes call', async () => {
		const { resolver, incomeService } = surfaces();

		const withdrawn = await resolver.softDeleteIncome(INCOME);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(incomeService.softRemove).toHaveBeenCalledWith(INCOME);

		expect(await resolver.recoverIncome(INCOME)).toBe(ROWS[0]);
		expect(incomeService.softRecover).toHaveBeenCalledWith(INCOME);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, incomeService } = surfaces();
		const refusal = new Error('INCOME_ALREADY_APPLIED: the amount is accounted for.');

		incomeService.softRemove.mockRejectedValueOnce(refusal);

		await expect(resolver.softDeleteIncome(INCOME)).rejects.toBe(refusal);
	});

	it('names no employee on the edit, because the delivered edit body carries none', () => {
		expect(inputBody('CreateIncomeInput')).toMatch(/employeeId: ID(\n|$)/);
		expect(inputBody('UpdateIncomeInput')).not.toMatch(/employeeId/);
	});
});

describe('IncomeResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', IncomeResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', IncomeController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', IncomeResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			const declared = Reflect.getMetadata('__guards__', IncomeController) ?? [];
			const restated = guardsOfHandler(IncomeController, route);

			expect([...new Set([...declared, ...restated, FeatureFlagGuard])].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, IncomeResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, IncomeController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, IncomeController)).toEqual([
			PermissionsEnum.ORG_INCOMES_EDIT
		]);
	});

	it.each(PERMISSION_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		const fieldPermissions = Reflect.getMetadata(PERMISSIONS_METADATA, IncomeResolver.prototype[field]) ?? [];
		const routePermissions = permissionOfRoute(IncomeController, route) ?? [];

		expect(fieldPermissions).toEqual(routePermissions);
		expect(guardsOfField(field)).toEqual(guardsOfHandler(IncomeController, route));
	});

	it('carries the view permission on every read, which is what every read route states', () => {
		for (const field of ['incomes', 'income', 'incomeCount', 'myIncomes']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_INCOMES_VIEW]);
		}

		for (const route of ['findAll', 'findById', 'getCount', 'findMyIncome']) {
			expect(permissionOfRoute(IncomeController, route)).toEqual([PermissionsEnum.ORG_INCOMES_VIEW]);
		}
	});

	it('carries the edit permission on every write, because none of those routes states one', () => {
		for (const handler of ['create', 'update', 'delete', 'softRemove', 'softRecover']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, IncomeController.prototype[handler])).toBeUndefined();
		}

		for (const field of WRITES) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_INCOMES_EDIT]);
		}
	});
});

describe('IncomeResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, IncomeResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', IncomeResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('incomes')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('incomes');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the removals and the caller’s own read among them', async () => {
		for (const field of ['createIncome', 'deleteIncome', 'softDeleteIncome', 'myIncomes']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('income'))).resolves.toBe(true);
	});
});

describe('IncomeModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, IncomeModule) ?? []) as unknown[];

		expect(providers).toContain(IncomeResolver);
		expect(providers).toContain(IncomeService);
	});

	it('exports the service the resolver injects, and reaches the employee and command modules it calls', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, IncomeModule) ?? []) as unknown[];
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, IncomeModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);
		const names = resolved.map((entry) => (entry as { name?: string })?.name);

		expect(exported).toContain(IncomeService);
		// The caller's own read resolves the employee through the employee service and the writes are
		// dispatched as commands, so both have to be reachable from the module that hosts the resolver.
		expect(names).toContain('EmployeeModule');
		expect(names).toContain('CqrsModule');
		expect(EmployeeService).toBeDefined();
		expect(IncomeResolver.length).toBe(3);
	});

	it('reaches the module that provides the guards, without importing the one the gate resolves through', () => {
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, IncomeModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(resolved.map((entry) => (entry as { name?: string })?.name)).toContain('RolePermissionModule');
		expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, FeatureModule)).toBe(true);
		expect(resolved).not.toContain(FeatureModule);
	});
});
