/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ExecutionContext, NotFoundException } from '@nestjs/common';
import { GLOBAL_MODULE_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum, SequenceResetPolicy } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureModule } from '../feature/feature.module';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { SequenceController } from './sequence.controller';
import { SequenceModule } from './sequence.module';
import { SequenceResolver } from './sequence.resolver';
import { SequenceService } from './sequence.service';

/**
 * The numbering series over GraphQL.
 *
 * A series is a counter, not a document: it holds the value the next document will be numbered with
 * and the shape of the numbers it produces, and every domain that numbers a document allocates from
 * one. This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong here:
 *
 * - every capability the delivered `/api/sequences` routes serve is a root field of the one composed
 *   schema, and the list is a connection with the platform's own cursor codec behind it;
 * - every field reaches the same `SequenceService` method the REST route reaches — including the
 *   reset, whose `id`-only payload is the statement that a caller does not state the series' new
 *   counter;
 * - **the guard stack and the permission are the controller's, field by field**;
 * - **the counter is declared where it may be read and nowhere it may be written**: `nextValue` is a
 *   member of the object type and of the create input — a series has to start somewhere — and of
 *   neither the edit input nor the reset, which performs a move rather than a write;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant
 *   that switched it off is refused the way a disabled capability's routes are.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CHANNEL = '00000000-0000-4000-8000-000000000010';
const ORDER_ORG = '00000000-0000-4000-8000-000000000030';
const ORDER_CHANNEL = '00000000-0000-4000-8000-000000000031';
const RETURN_CHANNEL = '00000000-0000-4000-8000-000000000032';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them.
 *
 * Two rows share the key `ORDER` and differ by channel, which is the shape this table exists for: the
 * organization-wide counter is the one a channel without a series of its own falls back to, and the
 * channel-scoped row beside it overrides that fallback. The third is retired, so a filter on the
 * lifecycle has something to select.
 */
const ROWS = [
	{
		id: ORDER_CHANNEL,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		key: 'ORDER',
		channelId: CHANNEL,
		prefix: 'SO-',
		padding: 6,
		nextValue: 7,
		step: 1,
		resetPolicy: SequenceResetPolicy.NEVER,
		lastResetAt: null,
		description: 'Storefront orders',
		isActive: true,
		createdAt: new Date('2026-01-05T10:00:00.000Z'),
		updatedAt: new Date('2026-01-05T10:00:00.000Z')
	},
	{
		id: ORDER_ORG,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		key: 'ORDER',
		channelId: null,
		prefix: 'SO-',
		padding: 6,
		nextValue: 42,
		step: 1,
		resetPolicy: SequenceResetPolicy.MONTHLY,
		lastResetAt: new Date('2026-03-01T00:00:00.000Z'),
		description: 'Order numbering',
		isActive: true,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: RETURN_CHANNEL,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		key: 'RETURN',
		channelId: CHANNEL,
		prefix: 'RT-',
		padding: 6,
		nextValue: 3,
		step: 1,
		resetPolicy: SequenceResetPolicy.YEARLY,
		lastResetAt: null,
		description: null,
		isActive: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const sequenceService = {
		listSeries: jest.fn().mockResolvedValue(ROWS),
		findSeriesOrFail: jest.fn().mockResolvedValue(ROWS[0]),
		createSeries: jest.fn().mockResolvedValue(ROWS[0]),
		updateSeries: jest.fn().mockResolvedValue(ROWS[0]),
		resetSeries: jest.fn().mockResolvedValue({ ...ROWS[1], nextValue: 1 })
	};

	return {
		sequenceService,
		resolver: new SequenceResolver(sequenceService as unknown as SequenceService)
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
const ownSdl = ['sequence.type.gql', 'sequence.api.gql']
	.map((file) => readFileSync(join(__dirname, 'schema', file), 'utf8'))
	.join('\n');

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The type one root field answers, as the schema states it — `Int`, `Int!`, `SequenceConnection!`. */
function fieldType(operation: 'Query' | 'Mutation', field: string): string {
	const root = schema.getType(operation) as { getFields(): Record<string, { type: unknown }> } | undefined;

	return String(root?.getFields()?.[field]?.type);
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('sequence'))
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
function handlersOf(controller: typeof SequenceController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof SequenceController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = SequenceResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = SequenceResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(controller: typeof SequenceController, handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
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
	{ field: 'sequences', route: 'findAll' },
	{ field: 'sequence', route: 'findById' },
	{ field: 'createSequence', route: 'create' },
	{ field: 'updateSequence', route: 'update' },
	{ field: 'resetSequence', route: 'reset' }
];

/** The write fields, whose delegations are asserted one by one below. */
const WRITES = ['createSequence', 'updateSequence', 'resetSequence'];

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
		getHandler: () => (SequenceResolver.prototype as never)[field],
		getClass: () => SequenceResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('SequenceResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query and the one-row query', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['sequences', 'sequence']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['createSequence', 'updateSequence', 'resetSequence'])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// `17-graphql-api-specification.md` §3.3 declares this domain's complete set of root fields, and
		// §3.1 makes parity capability parity — so the surface is those five and neither a removal nor a
		// count, because the controller serves neither.
		expect(ownedRootFields('Query')).toEqual(['sequence', 'sequences']);
		expect(ownedRootFields('Mutation')).toEqual(['createSequence', 'resetSequence', 'updateSequence']);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type SequenceConnection \{\s*nodes: \[Sequence!\]!\s*edges: \[SequenceEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type SequenceEdge \{\s*node: Sequence!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input SequenceFilter \{/);
		expect(printed).toMatch(/input SequenceSort \{/);
		expect(printed).toMatch(/enum SequenceSortField \{\s*key\s*nextValue\s*resetPolicy\s*createdAt\s*updatedAt\s*\}/);
	});

	it('declares the write inputs and the restart-policy vocabulary they and the filter take', () => {
		expect(printed).toMatch(/input CreateSequenceInput \{/);
		expect(printed).toMatch(/input UpdateSequenceInput \{/);
		expect(printed).toMatch(/input SequenceResetPolicyFilter \{/);
		// The vocabulary is the series' own and closed — four periods, and the schema chapter and the
		// contracts both state them — so it is declared here rather than carried as a bare string a
		// caller could fill with anything.
		const policies = [
			...bodyOf('enum', 'SequenceResetPolicy').matchAll(/^\s+([A-Z][A-Z0-9_]*)\s*$/gm)
		].map((match) => match[1]);

		expect(policies).toEqual(['NEVER', 'YEARLY', 'MONTHLY', 'DAILY']);
	});

	it('carries the configuration and the state on the type, and no column no read produces', () => {
		const members = memberNames('Sequence');

		expect(members).toEqual(
			expect.arrayContaining([
				'id',
				'tenantId',
				'organizationId',
				'key',
				'channelId',
				'prefix',
				'padding',
				'nextValue',
				'step',
				'resetPolicy',
				'lastResetAt',
				'description',
				'isActive',
				'createdAt',
				'updatedAt'
			])
		);

		// No route of this resource withdraws a series — a series is retired through `isActive`, so the
		// counter and the documents numbered from it stay — and the delivered reads answer live rows, so
		// a member carrying the withdrawal instant could only ever be null on every row answered here.
		expect(members).not.toContain('deletedAt');

		// The counter is a whole number and not an amount: the family is the column's own, and a
		// `Decimal` here would promise a precision the column does not hold.
		expect(typeBody('Sequence')).toMatch(/nextValue: Int!/);
		expect(typeBody('Sequence')).toMatch(/padding: Int!/);
		expect(typeBody('Sequence')).toMatch(/step: Int!/);
		expect(typeBody('Sequence')).not.toMatch(/\b(Float|Decimal)\b/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered reads answer live rows only, so the connection does not offer `withDeleted`.
		expect(fieldArgs('Query', 'sequences')).not.toContain('withDeleted');
		expect(fieldArgs('Query', 'sequences')).toEqual([
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
		expect(fieldType('Query', 'sequences')).toBe('SequenceConnection!');
		expect(fieldType('Query', 'sequence')).toBe('Sequence');
		// There is no count route for this resource, so there is no count field — and no field answering
		// a question no route asks.
		expect(rootFields('Query')).not.toContain('sequenceCount');
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createSequence', ['input']],
			['updateSequence', ['input']],
			// The reset states the series and nothing else: the counter it is rewound to is the kernel's
			// decision, and a caller-stated one is the renumbering this resource's shape prevents.
			['resetSequence', ['id']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}
	});
});

describe('SequenceResolver — the counter is not a document number', () => {
	it('declares the counter on the type and on the create, and on no other write', () => {
		// A create is the one write that may state where a series starts counting: an installation
		// adopting numbering an external system already stepped has to say where to continue from.
		expect(inputBody('CreateSequenceInput')).toMatch(/nextValue: Int\n/);

		// The edit may not, and the absence is the contract rather than an omission: a counter written
		// through a configuration write renumbers documents the installation has already issued.
		expect(inputBody('UpdateSequenceInput')).not.toMatch(/nextValue/);
		expect(inputBody('UpdateSequenceInput')).not.toMatch(/lastResetAt/);

		// The reset states no value either — it is a move, and the kernel's restart has exactly one
		// destination, which is the value a period starts at.
		expect(fieldArgs('Mutation', 'resetSequence')).not.toContain('nextValue');
		expect(fieldArgs('Mutation', 'resetSequence')).toEqual(['id']);
	});

	it('states the identity once, on the create, and never on the edit', () => {
		expect(inputBody('CreateSequenceInput')).toMatch(/key: String!/);
		expect(inputBody('CreateSequenceInput')).toMatch(/channelId: ID\n/);
		// Renaming the key would leave the counter reachable under no name at all, and moving the
		// channel would hand one sales surface's numbers to another.
		expect(inputBody('UpdateSequenceInput')).not.toMatch(/key:/);
		expect(inputBody('UpdateSequenceInput')).not.toMatch(/channelId/);
	});

	it('lets a series be retired through the edit, which is why no removal is offered', () => {
		// `isActive` is the last member the printed input declares, so it is asserted without a trailing
		// newline: the declaration's own closing brace is what follows it.
		expect(inputBody('UpdateSequenceInput')).toMatch(/isActive: Boolean\s*$/);
		// A series *is* its counter: a removal answers every later allocation for its key "no series is
		// configured", and creating it again counts from one and reissues numbers the removed row had
		// already issued. The lifecycle member is the supported path.
		expect(ownedRootFields('Mutation')).not.toContain('deleteSequence');
		expect(ownedRootFields('Mutation')).not.toContain('softDeleteSequence');
		expect(ownedRootFields('Mutation')).not.toContain('recoverSequence');
	});

	it('states the configuration members the service accepts, and no state member', () => {
		expect(inputBody('CreateSequenceInput')).toMatch(/prefix: String\n/);
		expect(inputBody('CreateSequenceInput')).toMatch(/padding: Int\n/);
		expect(inputBody('CreateSequenceInput')).toMatch(/step: Int\n/);
		expect(inputBody('CreateSequenceInput')).toMatch(/resetPolicy: SequenceResetPolicy\n/);
		expect(inputBody('UpdateSequenceInput')).toMatch(/prefix: String\n/);
		expect(inputBody('UpdateSequenceInput')).toMatch(/resetPolicy: SequenceResetPolicy\n/);
		// The tenant and the organization are stamped from the credential on the write, so neither is a
		// member a caller could state.
		expect(inputBody('CreateSequenceInput')).not.toMatch(/tenantId/);
		expect(inputBody('CreateSequenceInput')).not.toMatch(/organizationId/);
		expect(inputBody('UpdateSequenceInput')).not.toMatch(/tenantId/);
		expect(inputBody('UpdateSequenceInput')).not.toMatch(/organizationId/);
		// And neither document names a floating-point or money family anywhere: a counter is a whole
		// number and this resource carries no amount.
		expect(ownSdl).not.toMatch(/:\s*\[?(Float|Decimal)\b/);
	});

	it('narrows the counter through the whole-number family, never through a money one', () => {
		const filter = inputBody('SequenceFilter');

		expect(filter).toMatch(/nextValue: NumberFilter/);
		expect(filter).toMatch(/padding: NumberFilter/);
		expect(filter).toMatch(/step: NumberFilter/);
		expect(filter).not.toMatch(/nextValue: (DecimalFilter|StringFilter)/);
		// The connection's own allow-list is the schema's other half: a field the evaluator does not
		// know is a field it refuses, so the two must name the same members.
		expect(filter).not.toMatch(/\b(Float|Decimal)\b/);
	});
});

describe('SequenceResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, sequenceService } = surfaces();

		const connection = await resolver.sequences();

		// The read is the one the REST list route performs, with the route's own defaults: the connection
		// protocol applies the narrowing the route would have bound from its query string.
		expect(sequenceService.listSeries).toHaveBeenCalledWith();
		expect(connection.nodes).toHaveLength(3);
		expect(connection.totalCount).toBe(3);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[2].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ORDER_CHANNEL);
	});

	it('orders by key when the caller states none, and makes that order total', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.sequences();

		// `ORDER` first, its channel-scoped row before the organization-wide one it falls back to, then
		// `RETURN`: the delivered read's own order, with the two members that make a cursor name a row
		// rather than a position among equals.
		expect(connection.nodes.map((node) => node.id)).toEqual([ORDER_CHANNEL, ORDER_ORG, RETURN_CHANNEL]);
	});

	it('narrows by the fields the filter declares, the organization-wide series among them', async () => {
		const { resolver } = surfaces();

		const byKey = await resolver.sequences({ key: { eq: 'ORDER' } });
		expect(byKey.nodes.map((node) => node.id)).toEqual([ORDER_CHANNEL, ORDER_ORG]);

		const byChannel = await resolver.sequences({ channelId: { eq: CHANNEL } });
		expect(byChannel.totalCount).toBe(2);

		// `channelId: null` is a scope of its own rather than "no channel configured", so the question
		// "which counter is this organization's own?" is askable.
		const organizationWide = await resolver.sequences({ channelId: { isNull: true } });
		expect(organizationWide.nodes.map((node) => node.id)).toEqual([ORDER_ORG]);

		const retired = await resolver.sequences({ isActive: { eq: false } });
		expect(retired.nodes.map((node) => node.id)).toEqual([RETURN_CHANNEL]);

		// A counter is compared as a whole number, not as text.
		const ahead = await resolver.sequences({ nextValue: { gt: 10 } });
		expect(ahead.nodes.map((node) => node.id)).toEqual([ORDER_ORG]);

		const byPolicy = await resolver.sequences({ resetPolicy: { eq: SequenceResetPolicy.MONTHLY } });
		expect(byPolicy.nodes.map((node) => node.id)).toEqual([ORDER_ORG]);

		const byPrefix = await resolver.sequences({ prefix: { ilike: 'rt-%' } });
		expect(byPrefix.nodes.map((node) => node.id)).toEqual([RETURN_CHANNEL]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byCounter = await resolver.sequences(undefined, [{ field: 'nextValue', direction: 'ASC' }]);
		expect(byCounter.nodes.map((node) => node.id)).toEqual([RETURN_CHANNEL, ORDER_CHANNEL, ORDER_ORG]);

		const byPolicy = await resolver.sequences(undefined, [{ field: 'resetPolicy', direction: 'DESC' }]);
		expect(byPolicy.nodes.map((node) => node.resetPolicy)).toEqual(['YEARLY', 'NEVER', 'MONTHLY']);
	});

	it('resumes a walk from an opaque cursor, and walks backwards as well as forwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.sequences(undefined, undefined, { first: 1 });

		expect(first.nodes.map((node) => node.id)).toEqual([ORDER_CHANNEL]);

		const second = await resolver.sequences(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([ORDER_ORG]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const last = await resolver.sequences(undefined, undefined, { last: 1 });
		expect(last.nodes.map((node) => node.id)).toEqual([RETURN_CHANNEL]);
		expect(last.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// `channelId` is a *default* sort member — it is what makes the order total — and deliberately not
		// one a caller may state: an order by identifier is not an order a numbering configuration is read
		// in, and the question that column answers is a filter.
		const error = await resolver
			.sequences(undefined, [{ field: 'channelId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// The tenant is applied to the read from the credential, so a caller stating one is refused
		// rather than quietly narrowed to its own.
		const error = await resolver.sequences({ tenantId: { eq: TENANT } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.sequences(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('keeps the evaluator’s allow-list and the schema’s filter in step, member for member', async () => {
		const { resolver } = surfaces();
		const declared = [...inputBody('SequenceFilter').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)]
			.map((match) => match[1])
			.filter((member) => !['and', 'or', 'not'].includes(member));

		// The declaration in the resolver and the input in the SDL are two renderings of one list, and a
		// member that is filterable in the schema but unknown to the evaluator is a field a client can
		// state and be refused for. An empty condition narrows nothing, so what each read below asserts is
		// only that the evaluator recognises the field.
		for (const member of declared) {
			await expect(resolver.sequences({ [member]: {} })).resolves.toBeDefined();
		}

		// The other half of the same claim is read off the refusal, which names the evaluator's whole
		// allow-list: a member it knows and the schema does not would appear here and nowhere else.
		const refusal = await resolver.sequences({ deletedAt: { isNull: true } }).catch((thrown) => thrown);
		const allowed = String((refusal as Error).message)
			.split('Allowed: ')[1]
			// The message closes the list with a sentence, so the full stop is taken off before the members
			// are read: it is punctuation rather than part of the last name.
			.replace(/\.\s*$/, '')
			.split(',')
			.map((member) => member.trim())
			.sort();

		expect(allowed).toEqual([...declared].sort());
	});

	it('accepts every key the sort enum offers, and only those', async () => {
		const { resolver } = surfaces();
		const offered = [...bodyOf('enum', 'SequenceSortField').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm)].map(
			(match) => match[1]
		);

		expect(offered).toEqual(['key', 'nextValue', 'resetPolicy', 'createdAt', 'updatedAt']);

		for (const field of offered) {
			await expect(resolver.sequences(undefined, [{ field, direction: 'ASC' }])).resolves.toBeDefined();
		}
	});
});

describe('SequenceResolver — one resource, two protocols, the same operations', () => {
	it('reads one series through the same service method the REST node route calls', async () => {
		const { resolver, sequenceService } = surfaces();

		// The scoped read is the service's: the field states the identifier and nothing else, so the
		// organization and the tenant are applied where every other read of this domain applies them.
		expect(await resolver.sequence(ORDER_ORG)).toBe(ROWS[0]);
		expect(sequenceService.findSeriesOrFail).toHaveBeenCalledWith(ORDER_ORG);
	});

	it('answers null for a series that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, sequenceService } = surfaces();
		sequenceService.findSeriesOrFail.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.sequence(RETURN_CHANNEL)).toBeNull();
	});

	it('opens a series through the same service method the REST create route calls', async () => {
		const { resolver, sequenceService } = surfaces();

		await resolver.createSequence({
			key: 'ORDER',
			channelId: CHANNEL,
			prefix: 'SO-',
			padding: 6,
			nextValue: 1,
			step: 1,
			resetPolicy: SequenceResetPolicy.MONTHLY,
			description: 'Storefront orders'
		});

		// The payload the caller stated reaches the write as it arrived: the identity the allocation will
		// resolve the series by, the shape of the numbers, and the value it starts counting from.
		expect(sequenceService.createSeries).toHaveBeenCalledWith({
			key: 'ORDER',
			channelId: CHANNEL,
			prefix: 'SO-',
			padding: 6,
			nextValue: 1,
			step: 1,
			resetPolicy: SequenceResetPolicy.MONTHLY,
			description: 'Storefront orders'
		});
	});

	it('changes a series through the same service method the REST edit route reaches, with the path identifier', async () => {
		const { resolver, sequenceService } = surfaces();

		await resolver.updateSequence({ id: ORDER_ORG, prefix: 'ORD-', isActive: false });

		// The identifier the route reads from the path and the body beside it, handed to the one write
		// this resource serves — the service is what refuses a stated counter, so both protocols reach
		// that refusal rather than a second copy of it.
		expect(sequenceService.updateSeries).toHaveBeenCalledWith(ORDER_ORG, {
			prefix: 'ORD-',
			isActive: false
		});
	});

	it('restarts a series through the same service method the REST reset route calls, with no payload', async () => {
		const { resolver, sequenceService } = surfaces();

		const restarted = await resolver.resetSequence(ORDER_ORG);

		expect(sequenceService.resetSeries).toHaveBeenCalledWith(ORDER_ORG);
		// The answer is the stored row, so a caller reads where the counter now stands rather than
		// assuming the move happened.
		expect(restarted.nextValue).toBe(1);
	});

	it('answers the restart’s refusal rather than inventing an answer', async () => {
		const { resolver, sequenceService } = surfaces();
		const refusal = new Error(
			"PRECONDITION_REQUIRED: no restart is due for the series 'ORDER' — its reset policy is NEVER, so it never restarts."
		);

		sequenceService.resetSeries.mockRejectedValueOnce(refusal);

		await expect(resolver.resetSequence(ORDER_ORG)).rejects.toBe(refusal);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, sequenceService } = surfaces();
		const refusal = new BadRequestException(
			"UNIQUE_CONSTRAINT_VIOLATION: a numbering series for 'ORDER' organization-wide already exists."
		);

		sequenceService.createSeries.mockRejectedValueOnce(refusal);

		const error = await resolver.createSequence({ key: 'ORDER' }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
	});
});

describe('SequenceResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', SequenceResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', SequenceController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The one guard the resolver states beyond the controller's chain is the gate, and it is the
		// addition rather than a substitution: the two the controller states come first, so a caller with
		// no credential is refused as a credential problem before a tenant's switches are read.
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', SequenceResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			const declared = Reflect.getMetadata('__guards__', SequenceController) ?? [];
			const restated = guardsOfHandler(SequenceController, route);

			// The gate is the one guard beyond that set, and it is declared on the class rather than on
			// any field, so every route here runs under it.
			expect([...new Set([...declared, ...restated, FeatureFlagGuard])].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, SequenceResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, SequenceController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, SequenceController)).toEqual([
			PermissionsEnum.SEQUENCES_VIEW
		]);
	});

	it.each(PERMISSION_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		const fieldPermissions = Reflect.getMetadata(PERMISSIONS_METADATA, SequenceResolver.prototype[field]) ?? [];
		const routePermissions = permissionOfRoute(SequenceController, route) ?? [];

		expect(fieldPermissions).toEqual(routePermissions);
		// The guard a field states of its own is the guard its route's handler states of its own: the
		// class-level chains are compared above, and a handler that added one is caught here.
		expect(guardsOfField(field)).toEqual(guardsOfHandler(SequenceController, route));
	});

	it('carries the view permission on the reads and the edit permission on the writes', () => {
		// An administrator's reads are one capability and their writes another: `SEQUENCES_VIEW` is what
		// an auditor holds, and `SEQUENCES_EDIT` is what an operator who may change how this installation
		// numbers its documents holds. Every field states the permission its own route states.
		expect(permissionOfField('sequences')).toEqual([PermissionsEnum.SEQUENCES_VIEW]);
		expect(permissionOfField('sequence')).toEqual([PermissionsEnum.SEQUENCES_VIEW]);

		for (const field of WRITES) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.SEQUENCES_EDIT]);
		}
	});
});

describe('SequenceResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, SequenceResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', SequenceResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('sequences')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('sequences');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the restart among them', async () => {
		// Nothing on this surface is exempt: the door that switches the capability back on is the REST
		// route, which this code does not gate.
		for (const field of ['createSequence', 'updateSequence', 'resetSequence']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('sequence'))).resolves.toBe(true);
	});
});

describe('SequenceModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, SequenceModule) ?? []) as unknown[];

		expect(providers).toContain(SequenceResolver);
		expect(providers).toContain(SequenceService);
	});

	it('exports the service the resolver injects, and that service is the whole of its dependencies', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else — and every write this
		// resource serves reaches a service method rather than dispatching a command, which is why the
		// command bus is not among them.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, SequenceModule) ?? []) as unknown[];

		expect(exported).toContain(SequenceService);
		expect(SequenceResolver.length).toBe(1);
	});

	it('reaches the module that provides the guards, without importing the one the gate resolves through', () => {
		// The two guards the resolver shares with the controller are providers of whichever module
		// declares the handler they protect, so this module has to reach the permission service they look
		// the caller's grants up in — the API boot fails on an unresolved dependency without it.
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, SequenceModule) ?? []) as Array<{
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
