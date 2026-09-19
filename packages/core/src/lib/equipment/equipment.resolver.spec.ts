/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { EquipmentController } from './equipment.controller';
import { EquipmentModule } from './equipment.module';
import { EquipmentResolver } from './equipment.resolver';
import { EquipmentService } from './equipment.service';

/**
 * The tracked assets of an organization over GraphQL.
 *
 * The delivered REST routes serve a list, the paginated spelling of the same list, one row, a count, a
 * filing, a replacement and the two removals of the CRUD base. This suite pins the half of the
 * two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same `EquipmentService` method the REST route reaches — including the edit,
 *   whose route is the platform's own upsert — so a client does not choose a better surface by choosing
 *   a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under**, which for this resource is none on either side: the controller declares no permission on
 *   its class and none on any handler, so no field states one and the parity is the absence;
 * - the members the delivered reads cannot produce are not declared at all — the asset, the sharing
 *   collection and the facets are each joined only when a REST caller names them in `relations`;
 * - every numeric column is an exact decimal and never a floating-point number, on the object type, on
 *   the filter and on the way into a write;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant
 *   that switched that capability off is refused the way a disabled capability's routes are — and the
 *   refusal names the field, because the guard reads a GraphQL execution context rather than crashing
 *   on one.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TAG = '00000000-0000-4000-8000-000000000050';
const IMAGE = '00000000-0000-4000-8000-000000000070';
const PROJECTOR = '00000000-0000-4000-8000-000000000010';
const LAPTOP = '00000000-0000-4000-8000-000000000011';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted service answers with, in the order the delivered list method returns them, with
 * every numeric column as the platform's numeric transformer hands it over: a number, and nothing
 * rounded, rescaled or reformatted on the way.
 *
 * The array is deliberately not in name order, so the default order the connection applies is a
 * decision these tests can tell apart from the order the read happened to return.
 */
const ROWS = [
	{
		id: PROJECTOR,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Projector',
		type: 'Display',
		serialNumber: 'PJ-7',
		manufacturedYear: 2019,
		initialCost: 800.25,
		currency: 'EUR',
		maxSharePeriod: 7,
		autoApproveShare: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: LAPTOP,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Laptop',
		type: 'Computer',
		serialNumber: 'LT-1',
		manufacturedYear: 2021,
		initialCost: 1500.5,
		currency: 'USD',
		maxSharePeriod: 30,
		autoApproveShare: true,
		createdAt: new Date('2026-01-15T10:00:00.000Z'),
		updatedAt: new Date('2026-01-15T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const equipmentService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[1]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[1]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[1], deletedAt: new Date('2026-05-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[1])
	};

	return {
		equipmentService,
		resolver: new EquipmentResolver(equipmentService as never)
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
const ownSdl = ['equipment.type.gql', 'equipment.api.gql']
	.map((file) => readFileSync(join(__dirname, 'schema', file), 'utf8'))
	.join('\n');

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The type one root field answers, as the schema states it — `Int`, `Int!`, `EquipmentConnection!`. */
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
 * The sharing resource beside it names itself around the same word, so its fields are excluded here:
 * one resource's suite asserts its own fields, not its neighbours'.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('equipment'))
		.filter((field) => !field.toLowerCase().includes('equipmentsharing'))
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
function handlersOf(controller: typeof EquipmentController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EquipmentController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = EquipmentResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EquipmentController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here: a
 * table of permission names would agree with the resolver while disagreeing with the controller, which
 * is the failure this half of the doctrine exists to catch.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'equipments', route: 'findAll' },
	{ field: 'equipment', route: 'findById' },
	{ field: 'equipmentCount', route: 'getCount' },
	{ field: 'createEquipment', route: 'create' },
	{ field: 'updateEquipment', route: 'update' },
	{ field: 'deleteEquipment', route: 'delete' },
	{ field: 'softDeleteEquipment', route: 'softRemove' },
	{ field: 'recoverEquipment', route: 'softRecover' }
];

/** The write fields, whose delegations are asserted one by one below. */
const WRITES = [
	'createEquipment',
	'updateEquipment',
	'deleteEquipment',
	'softDeleteEquipment',
	'recoverEquipment'
];

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
		getHandler: () => (EquipmentResolver.prototype as never)[field],
		getClass: () => EquipmentResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EquipmentResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['equipments', 'equipment', 'equipmentCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(expect.arrayContaining(WRITES));
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one. It serves no sub-route of its own
		// beyond that spelling, which is why nothing else appears here.
		expect(ownedRootFields('Query')).toEqual(['equipment', 'equipmentCount', 'equipments']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createEquipment',
			'deleteEquipment',
			'recoverEquipment',
			'softDeleteEquipment',
			'updateEquipment'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EquipmentConnection \{\s*nodes: \[Equipment!\]!\s*edges: \[EquipmentEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type EquipmentEdge \{\s*node: Equipment!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input EquipmentFilter \{/);
		expect(printed).toMatch(/input EquipmentSort \{/);
		expect(printed).toMatch(
			/enum EquipmentSortField \{\s*createdAt\s*updatedAt\s*name\s*type\s*manufacturedYear\s*initialCost\s*\}/
		);
	});

	it('declares the two write inputs', () => {
		expect(printed).toMatch(/input CreateEquipmentInput \{/);
		expect(printed).toMatch(/input UpdateEquipmentInput \{/);
	});

	it('carries the columns the delivered reads answer, and not the relations they never join', () => {
		const members = memberNames('Equipment');

		// No read behind this surface names a relation, so a member carrying a related row would be
		// absent from exactly the rows this surface answers. The asset is the sharpest case: the entity
		// declares no `@RelationId` beside the relation either, so the row carries no identifier for it
		// and the surface offers neither the row nor the identifier.
		expect(members).not.toContain('image');
		expect(members).not.toContain('imageId');
		expect(members).not.toContain('equipmentSharings');
		expect(members).not.toContain('tags');
		expect(members).toEqual(
			expect.arrayContaining([
				'name',
				'type',
				'serialNumber',
				'manufacturedYear',
				'initialCost',
				'currency',
				'maxSharePeriod',
				'autoApproveShare',
				'deletedAt',
				'organizationId'
			])
		);

		// The currency vocabulary is the contracts' own `CurrenciesEnum`, shared with every other row
		// that states an amount, so the member is carried as its value rather than declared as an enum.
		expect(typeBody('Equipment')).toMatch(/currency: String!/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column.
		expect(typeBody('Equipment')).toMatch(/deletedAt: DateTime/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(fieldArgs('Query', 'equipments')).not.toContain('withDeleted');
		// The connection declares the query protocol's page arguments and nothing else: the narrowing
		// the paginated spelling interprets is stated in `filter`.
		expect(fieldArgs('Query', 'equipments')).toEqual([
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
		expect(fieldArgs('Query', 'equipmentCount')).toEqual([]);
		expect(fieldType('Query', 'equipmentCount')).toBe('Int');
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createEquipment', ['input']],
			['updateEquipment', ['input']],
			['deleteEquipment', ['id']],
			['softDeleteEquipment', ['id']],
			['recoverEquipment', ['id']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}
	});
});

describe('EquipmentResolver — every numeric column is exact, on the type, in the filter and into a write', () => {
	it('carries the money member as Decimal and never as Float', () => {
		const body = typeBody('Equipment');

		// Money is an exact quantity and a binary fraction cannot hold a cent: an amount a client reads
		// as a `Float` is an amount that will not add up.
		expect(body).toMatch(/initialCost: Decimal\n/);
		expect(body).not.toMatch(/\bFloat\b/);
	});

	it('carries the year and the period in the family the column stores them in', () => {
		const body = typeBody('Equipment');

		// Both are `numeric` columns read through the platform's numeric transformer, so the read
		// produces a number that may carry a fraction; a member declared `Int` would claim a precision
		// the column does not have.
		expect(body).toMatch(/manufacturedYear: Decimal\n/);
		expect(body).toMatch(/maxSharePeriod: Decimal\n/);

		// And on the way into a write, for the same reason: the digits the caller states are the digits
		// the column stores.
		expect(inputBody('CreateEquipmentInput')).toMatch(/initialCost: Decimal\n/);
		expect(inputBody('CreateEquipmentInput')).toMatch(/manufacturedYear: Decimal\n/);
		expect(inputBody('UpdateEquipmentInput')).toMatch(/initialCost: Decimal\n/);
	});

	it('narrows the numeric members through the decimal family, never through a whole-number one', () => {
		const filter = inputBody('EquipmentFilter');

		expect(filter).toMatch(/initialCost: DecimalFilter/);
		expect(filter).toMatch(/manufacturedYear: DecimalFilter/);
		expect(filter).toMatch(/maxSharePeriod: DecimalFilter/);
		expect(filter).not.toMatch(/initialCost: (FloatFilter|NumberFilter)/);
		expect(filter).not.toMatch(/\bFloat\b/);
	});

	it('states no Float in any member this domain declares', () => {
		// Every type, input and enum this domain contributes, read off the printed schema — which is what
		// a client is served, and which carries no comment that could hide a member behind prose.
		const declared = [
			'Equipment',
			'EquipmentEdge',
			'EquipmentConnection',
			'EquipmentFilter',
			'EquipmentSort',
			'EquipmentSortField',
			'CreateEquipmentInput',
			'UpdateEquipmentInput'
		]
			.map((name) => `${typeBody(name)}\n${inputBody(name)}\n${bodyOf('enum', name)}`)
			.join('\n');

		expect(declared).not.toMatch(/\bFloat\b/);
		// And the two documents never name it in a type position either, so the absence above is a
		// statement about the source rather than about the composition.
		expect(ownSdl).not.toMatch(/:\s*\[?Float\b/);
	});

	it('hands a write the exact digits the caller stated rather than a binary fraction', async () => {
		const { resolver, equipmentService } = surfaces();

		await resolver.createEquipment({
			name: 'Laptop',
			type: 'Computer',
			currency: 'USD',
			organizationId: ORGANIZATION,
			manufacturedYear: '2021',
			initialCost: '1500.50'
		});

		// The amount is passed through as it arrived: the column is `numeric` and a decimal string is
		// what it stores, so the digits a caller writes are the digits the row holds.
		expect(equipmentService.create).toHaveBeenCalledWith(
			expect.objectContaining({ manufacturedYear: '2021', initialCost: '1500.50' })
		);
	});
});

describe('EquipmentResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, equipmentService } = surfaces();

		const connection = await resolver.equipments(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(equipmentService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(LAPTOP);
	});

	it('orders by the stock list’s own name order when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.equipments();

		// The read returns the projector first; the connection's own default is the name ascending.
		expect(connection.nodes.map((node) => node.id)).toEqual([LAPTOP, PROJECTOR]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.equipments({ name: { ilike: 'proj%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([PROJECTOR]);

		const byType = await resolver.equipments({ type: { eq: 'Computer' } });
		expect(byType.nodes.map((node) => node.id)).toEqual([LAPTOP]);

		// The three numeric columns are compared through the decimal family, which is the family money
		// and a stored period are compared in.
		const byCost = await resolver.equipments({ initialCost: { between: ['1000', '2000'] } });
		expect(byCost.nodes.map((node) => node.id)).toEqual([LAPTOP]);

		const byPeriod = await resolver.equipments({ maxSharePeriod: { gt: '10' } });
		expect(byPeriod.nodes.map((node) => node.id)).toEqual([LAPTOP]);

		const byAutoApprove = await resolver.equipments({ autoApproveShare: { eq: false } });
		expect(byAutoApprove.nodes.map((node) => node.id)).toEqual([PROJECTOR]);

		const byOrganization = await resolver.equipments({ organizationId: { eq: ORGANIZATION } });
		expect(byOrganization.totalCount).toBe(2);

		// And on a date, which is compared as an instant rather than as its spelling.
		const byDate = await resolver.equipments({
			createdAt: { between: ['2026-02-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z'] }
		});
		expect(byDate.nodes.map((node) => node.id)).toEqual([PROJECTOR]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.equipments(undefined, [{ field: 'name', direction: 'DESC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([PROJECTOR, LAPTOP]);

		const byCost = await resolver.equipments(undefined, [{ field: 'initialCost', direction: 'ASC' }]);
		expect(byCost.nodes.map((node) => node.id)).toEqual([PROJECTOR, LAPTOP]);

		const byYear = await resolver.equipments(undefined, [{ field: 'manufacturedYear', direction: 'DESC' }]);
		expect(byYear.nodes.map((node) => node.id)).toEqual([LAPTOP, PROJECTOR]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.equipments(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([LAPTOP]);

		const second = await resolver.equipments(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([PROJECTOR]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.equipments(undefined, undefined, undefined, 20);

		const last = await resolver.equipments(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([LAPTOP]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.equipments(undefined, [{ field: 'serialNumber', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// `tags` is a pivot the delivered list read loads only when a REST caller names it in
		// `relations`, so the condition could only ever match the empty set, and the connection refuses
		// it rather than answering it with no rows.
		const error = await resolver.equipments({ tags: { eq: TAG } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.equipments(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('keeps the evaluator’s allow-list and the schema’s filter in step, member for member', async () => {
		const { resolver } = surfaces();
		const declared = [...inputBody('EquipmentFilter').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)]
			.map((match) => match[1])
			.filter((member) => !['and', 'or', 'not'].includes(member));

		// The declaration in the resolver and the input in the SDL are two renderings of one list, and a
		// member that is filterable in the schema but unknown to the evaluator is a field a client can
		// state and be refused for. An empty condition narrows nothing, so what each read below asserts
		// is only that the evaluator recognises the field.
		for (const member of declared) {
			await expect(resolver.equipments({ [member]: {} })).resolves.toBeDefined();
		}

		// The other half of the same claim is read off the refusal, which names the evaluator's whole
		// allow-list: a member it knows and the schema does not would appear here and nowhere else.
		const refusal = await resolver.equipments({ tags: { eq: TAG } }).catch((thrown) => thrown);
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
		const offered = [...bodyOf('enum', 'EquipmentSortField').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm)].map(
			(match) => match[1]
		);

		expect(offered).toEqual(['createdAt', 'updatedAt', 'name', 'type', 'manufacturedYear', 'initialCost']);

		// Every key the enum offers is a key the evaluator accepts, so the schema is not promising an
		// order the connection would refuse; the refusal of everything else is asserted above.
		for (const field of offered) {
			await expect(resolver.equipments(undefined, [{ field, direction: 'ASC' }])).resolves.toBeDefined();
		}
	});
});

describe('EquipmentResolver — one resource, two protocols, the same operations', () => {
	it('reads one asset through the same service method the REST node route calls', async () => {
		const { resolver, equipmentService } = surfaces();

		expect(await resolver.equipment(LAPTOP)).toBe(ROWS[1]);
		expect(equipmentService.findOneByIdString).toHaveBeenCalledWith(LAPTOP);
	});

	it('answers null for an asset that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, equipmentService } = surfaces();
		equipmentService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.equipment(PROJECTOR)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, equipmentService } = surfaces();

		expect(await resolver.equipmentCount()).toBe(2);
		expect(equipmentService.countBy).toHaveBeenCalledWith();
	});

	it('files an asset through the same service call the REST create route makes', async () => {
		const { resolver, equipmentService } = surfaces();

		expect(
			await resolver.createEquipment({
				name: 'Laptop',
				type: 'Computer',
				imageId: IMAGE,
				serialNumber: 'LT-1',
				manufacturedYear: '2021',
				initialCost: '1500.50',
				maxSharePeriod: '30',
				autoApproveShare: true,
				currency: 'USD',
				organizationId: ORGANIZATION,
				tagIds: [TAG]
			})
		).toBe(ROWS[1]);

		// The delivered create is handed the members the caller stated, the asset as the identifier the
		// foreign key holds, the facets as the identifiers the pivot row is written from, and the tenant
		// only from the credential.
		expect(equipmentService.create).toHaveBeenCalledWith({
			name: 'Laptop',
			type: 'Computer',
			image: { id: IMAGE },
			serialNumber: 'LT-1',
			manufacturedYear: '2021',
			initialCost: '1500.50',
			maxSharePeriod: '30',
			autoApproveShare: true,
			currency: 'USD',
			organizationId: ORGANIZATION,
			tags: [{ id: TAG }]
		});
	});

	it('changes an asset through the same save the REST edit route reaches, with the path identifier', async () => {
		const { resolver, equipmentService } = surfaces();

		await resolver.updateEquipment({
			id: LAPTOP,
			name: 'Laptop',
			currency: 'USD',
			organizationId: ORGANIZATION,
			initialCost: '1200.75'
		});

		// The delivered edit spreads the body beside the identifier the route reads from the path and
		// hands the result to the same save the create uses.
		expect(equipmentService.create).toHaveBeenCalledWith({
			name: 'Laptop',
			currency: 'USD',
			organizationId: ORGANIZATION,
			initialCost: '1200.75',
			id: LAPTOP
		});
	});

	it('removes an asset through the same service method the REST removal route calls', async () => {
		const { resolver, equipmentService } = surfaces();

		// The delivered store answers its delete result, which is not a row: the field answers the one
		// fact the removal establishes.
		expect(await resolver.deleteEquipment(LAPTOP)).toBe(true);
		expect(equipmentService.delete).toHaveBeenCalledWith(LAPTOP);
	});

	it('withdraws and restores an asset through the service methods the inherited routes call', async () => {
		const { resolver, equipmentService } = surfaces();

		const withdrawn = await resolver.softDeleteEquipment(LAPTOP);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(equipmentService.softRemove).toHaveBeenCalledWith(LAPTOP);

		expect(await resolver.recoverEquipment(LAPTOP)).toBe(ROWS[1]);
		expect(equipmentService.softRecover).toHaveBeenCalledWith(LAPTOP);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, equipmentService } = surfaces();
		const refusal = new Error('EQUIPMENT_STILL_SHARED: a sharing period still points at this asset.');

		equipmentService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteEquipment(LAPTOP)).rejects.toBe(refusal);
	});
});

describe('EquipmentResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', EquipmentResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', EquipmentController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		// The one guard the resolver states beyond the controller's chain is the gate, and it is the
		// addition rather than a substitution: the controller's own guard comes first, so a caller with
		// no credential is refused as a credential problem before a tenant's switches are read.
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', EquipmentResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			// The controller's chain and the resolver's are the same set, which is the whole parity
			// claim: a route that added a guard of its own would narrow REST below GraphQL and is caught
			// here. The gate is the one guard beyond that set, and it is declared on the class rather
			// than on any field, so every route here runs under it.
			expect([...guardsOfRoute(EquipmentController, route), FeatureFlagGuard].sort()).toEqual([...stated].sort());
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		// This is the resource whose parity is an absence: the controller declares no permission on its
		// class, so no route of it runs under one — and a permission restated here would be a grant the
		// REST routes do not ask for.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EquipmentController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EquipmentResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under — none, and never a grant', () => {
		for (const { field, route } of PERMISSION_PARITY) {
			expect(permissionOfField(field)).toBe(permissionOfRoute(EquipmentController, route));
			expect(permissionOfField(field)).toBeUndefined();
		}
	});

	it('declares no handler-level guard the resolver does not run under', () => {
		// A handler that guarded itself more narrowly than its class would be a route GraphQL could not
		// mirror by class-level parity alone, so the set is compared route by route above and the raw
		// handler metadata is asserted here: this controller adds none.
		for (const { route } of PERMISSION_PARITY) {
			expect(Reflect.getMetadata('__guards__', handlersOf(EquipmentController)[route])).toBeUndefined();
		}
	});
});

describe('EquipmentResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, EquipmentResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EquipmentResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('equipments')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('equipments');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the two writes and the removals among them', async () => {
		// Nothing on this surface is exempt: the door that switches the capability back on is the REST
		// route, which this code does not gate.
		for (const field of ['createEquipment', 'updateEquipment', 'deleteEquipment', 'recoverEquipment']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('equipment'))).resolves.toBe(true);
	});
});

describe('EquipmentModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EquipmentModule) ?? []) as unknown[];

		expect(providers).toContain(EquipmentResolver);
		expect(providers).toContain(EquipmentService);
	});

	it('exports the service the resolver injects, and that service is the whole of its dependencies', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else — and every write this
		// resource serves reaches a service method rather than dispatching a command, which is why the
		// command bus is not among them.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EquipmentModule) ?? []) as unknown[];

		expect(exported).toContain(EquipmentService);
		expect(EquipmentResolver.length).toBe(1);
	});

	it('reaches the module that provides the guards, without importing the one the gate resolves through', () => {
		// The guard the resolver shares with the controller is a provider of whichever module declares
		// the handler it protects, so this module has to reach the permission service it looks the
		// caller's grants up in — the API boot fails on an unresolved dependency without it.
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, EquipmentModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(resolved.map((entry) => (entry as { name?: string })?.name)).toContain('RolePermissionModule');
		// `FeatureModule` is deliberately not imported, and that is a fact about the module rather than a
		// preference: it is global, so the feature service `FeatureFlagGuard` resolves through is
		// available wherever a guard runs.
		expect(resolved.map((entry) => (entry as { name?: string })?.name)).not.toContain('FeatureModule');
	});
});
