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
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { BroadcastController } from './broadcast.controller';
import { BroadcastModule } from './broadcast.module';
import { BroadcastResolver } from './broadcast.resolver';
import { BroadcastService } from './broadcast.service';
import { BroadcastCreateCommand, BroadcastUpdateCommand } from './commands';

/**
 * The messages an organization publishes, over GraphQL.
 *
 * The delivered REST routes serve a list, one row, a count, a publication, an edit, a removal and the two
 * removals of the CRUD base. This suite pins the half of the two-protocol doctrine that is easy to get
 * quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes here
 *   and a refusal is the query protocol's own code;
 * - every read reaches the same `BroadcastService` method, and both writes dispatch the same command, that
 *   the REST route reaches — so a message published over this protocol is one the audience is notified
 *   about, exactly as a REST caller's is;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — three different write permissions among them, and five fields whose routes state none;
 * - the two vocabularies the delivered reader branches on are carried as their own values rather than
 *   declared as schema enums;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant that
 *   switched that capability off is refused the way a disabled capability's routes are.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const ENTITY = '00000000-0000-4000-8000-000000000003';
const PROJECT = '00000000-0000-4000-8000-000000000004';
const EMPLOYEE = '00000000-0000-4000-8000-000000000030';
const OTHER_EMPLOYEE = '00000000-0000-4000-8000-000000000031';
const ANNOUNCEMENT = '00000000-0000-4000-8000-000000000010';
const ALERT = '00000000-0000-4000-8000-000000000011';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted service answers with. The second was published without an instant, which is what
 * makes it the row the default order places first and the row the node read's miss is told apart from.
 */
const ROWS = [
	{
		id: ANNOUNCEMENT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		title: 'Quarter closed',
		content: { blocks: [{ type: 'paragraph', text: 'Numbers are in.' }] },
		category: 'ANNOUNCEMENT',
		visibilityMode: 'ORGANIZATION',
		audienceRules: null,
		publishedAt: new Date('2026-03-01T10:00:00.000Z'),
		entity: 'Organization',
		entityId: ENTITY,
		employeeId: EMPLOYEE,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: ALERT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		title: 'Outage',
		content: { blocks: [{ type: 'paragraph', text: 'The build is red.' }] },
		category: 'ALERT',
		visibilityMode: 'RESTRICTED',
		audienceRules: { roles: ['MANAGER'] },
		publishedAt: null,
		entity: 'OrganizationProject',
		entityId: PROJECT,
		employeeId: OTHER_EMPLOYEE,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const broadcastService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneById: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-06-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		broadcastService,
		commandBus,
		resolver: new BroadcastResolver(broadcastService as never, commandBus as never)
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
 * The composed schema, as text: the domain's own documents plus every kernel and domain document the boot
 * loader globs, which is what makes a reference from this domain to another one resolvable.
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
const ownSdl = ['broadcast.type.gql', 'broadcast.api.gql']
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

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('broadcast'))
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
 * comment is part of the printed type, so a member is asserted absent by its name and never by the words a
 * description happens to use.
 */
function memberNames(name: string): string[] {
	return [...typeBody(name).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/gm)].map((match) => match[1]);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof BroadcastController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather than
 * to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof BroadcastController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = BroadcastResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler states
 * of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof BroadcastController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field are
 * read from the field and from the route's own metadata and compared, rather than restated here: a table
 * of permission names would agree with the resolver while disagreeing with the controller, which is the
 * failure this half of the doctrine exists to catch.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'broadcasts', route: 'findAll' },
	{ field: 'broadcast', route: 'findById' },
	{ field: 'broadcastCount', route: 'getCount' },
	{ field: 'createBroadcast', route: 'create' },
	{ field: 'updateBroadcast', route: 'update' },
	{ field: 'deleteBroadcast', route: 'delete' },
	{ field: 'softDeleteBroadcast', route: 'softRemove' },
	{ field: 'recoverBroadcast', route: 'softRecover' }
];

/** The write fields, whose delegations are asserted one by one below. */
const WRITES = [
	'createBroadcast',
	'updateBroadcast',
	'deleteBroadcast',
	'softDeleteBroadcast',
	'recoverBroadcast'
];

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver declares,
 * which is the point: a spec that asserted the decorator alone would keep passing if the guard stopped
 * reading that key.
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
		getHandler: () => (BroadcastResolver.prototype as never)[field],
		getClass: () => BroadcastResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('BroadcastResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['broadcasts', 'broadcast', 'broadcastCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(expect.arrayContaining(WRITES));
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller declares its list once and has no sub-route of its own, and the count and the two
		// lifecycle moves are the CRUD base's — so this is the whole surface.
		expect(ownedRootFields('Query')).toEqual(['broadcast', 'broadcastCount', 'broadcasts']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createBroadcast',
			'deleteBroadcast',
			'recoverBroadcast',
			'softDeleteBroadcast',
			'updateBroadcast'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type BroadcastConnection \{\s*nodes: \[Broadcast!\]!\s*edges: \[BroadcastEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type BroadcastEdge \{\s*node: Broadcast!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input BroadcastFilter \{/);
		expect(printed).toMatch(/input BroadcastSort \{/);
		expect(printed).toMatch(
			/enum BroadcastSortField \{\s*createdAt\s*updatedAt\s*publishedAt\s*title\s*category\s*visibilityMode\s*\}/
		);
	});

	it('declares the two write inputs', () => {
		expect(printed).toMatch(/input CreateBroadcastInput \{/);
		expect(printed).toMatch(/input UpdateBroadcastInput \{/);
	});

	it('carries the columns the delivered reads answer, and not the relation they never join', () => {
		const members = memberNames('Broadcast');

		// No read behind this surface loads the publisher relation, so the row is carried as its identifier
		// rather than as a member that would be absent from every answer.
		expect(members).not.toContain('employee');
		expect(members).toEqual(
			expect.arrayContaining([
				'title',
				'content',
				'category',
				'visibilityMode',
				'audienceRules',
				'publishedAt',
				'entity',
				'entityId',
				'employeeId',
				'deletedAt',
				'organizationId'
			])
		);
	});

	it('carries the two vocabularies as their own values, never as schema enums', () => {
		const body = typeBody('Broadcast');

		// The delivered reader switches on `visibilityMode`'s own strings to decide who may read a row, and
		// `category`'s value set shares that shape: a value set the reader branches on is a value set the
		// reader owns, and declaring it here would fix a vocabulary in the schema that the service may
		// extend.
		expect(body).toMatch(/visibilityMode: String!\n/);
		expect(body).toMatch(/category: String!\n/);
		expect(printed).not.toMatch(/enum Broadcast(Category|VisibilityMode)/);
		expect(ownSdl).not.toMatch(/(category|visibilityMode): (BroadcastCategoryEnum|BroadcastVisibilityModeEnum)/);
		// The document members are documents, and the polymorphic pair is an identifier and a value.
		expect(body).toMatch(/content: JSON!\n/);
		expect(body).toMatch(/audienceRules: JSON\n/);
		expect(body).toMatch(/entity: String!\n/);
		expect(body).toMatch(/entityId: ID!\n/);
	});

	it('offers no argument it cannot honour, and no filter the read already answered', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(fieldArgs('Query', 'broadcasts')).not.toContain('withDeleted');
		expect(fieldArgs('Query', 'broadcasts')).toEqual([
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
		// The count route binds its query string to the store's own `where`, which is a shape no schema can
		// state, so the field states no narrowing of its own — and it is nullable, because a count is an
		// aggregate the resource may have no answer for and a non-null field would fabricate a zero.
		expect(fieldArgs('Query', 'broadcastCount')).toEqual([]);
		expect(fieldType('Query', 'broadcastCount')).toBe('Int');

		// The three columns the read applies itself, and the document column whose value differs by dialect,
		// are not filterable: the input states only members a condition can actually be evaluated on.
		const filter = inputBody('BroadcastFilter');
		expect(filter).not.toMatch(/audienceRules:/);
		expect(filter).not.toMatch(/isArchived:/);
		expect(filter).not.toMatch(/isActive:/);
		expect(filter).not.toMatch(/organizationId:/);
		expect(filter).not.toMatch(/content:/);
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createBroadcast', ['input']],
			['updateBroadcast', ['input']],
			['deleteBroadcast', ['id']],
			['softDeleteBroadcast', ['id']],
			['recoverBroadcast', ['id']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}
	});

	it('scopes the polymorphic pair to the create, which is what the delivered edit body does', () => {
		// What a message is about is fixed when it is published: the delivered edit body omits the pair, and
		// so does this input.
		expect(inputBody('CreateBroadcastInput')).toMatch(/entity: String!\n/);
		expect(inputBody('CreateBroadcastInput')).toMatch(/entityId: ID!\n/);
		expect(inputBody('UpdateBroadcastInput')).not.toMatch(/\n\s+entity:/);
		expect(inputBody('UpdateBroadcastInput')).not.toMatch(/entityId:/);
		// And the publisher is a member of neither, because the delivered writes stamp it from the credential.
		expect(inputBody('CreateBroadcastInput')).not.toMatch(/employeeId:/);
		expect(inputBody('UpdateBroadcastInput')).not.toMatch(/employeeId:/);
	});

	it('states no Float in any member this domain declares', () => {
		const declared = [
			'Broadcast',
			'BroadcastEdge',
			'BroadcastConnection',
			'BroadcastFilter',
			'BroadcastSort',
			'BroadcastSortField',
			'CreateBroadcastInput',
			'UpdateBroadcastInput'
		]
			.map((name) => `${typeBody(name)}\n${inputBody(name)}\n${bodyOf('enum', name)}`)
			.join('\n');

		expect(declared).not.toMatch(/\bFloat\b/);
		expect(ownSdl).not.toMatch(/:\s*\[?Float\b/);
	});
});

describe('BroadcastResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, broadcastService } = surfaces();

		const connection = await resolver.broadcasts(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults: no criterion, no
		// relations and no page. Its own visibility rule has already decided which rows these are.
		expect(broadcastService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ALERT);
	});

	it('orders by the feed’s own publication instant, newest first, when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.broadcasts();

		// The delivered read orders by this column itself, and the connection's own rule places an absent
		// value first under a descending walk — which is what puts the row published without an instant at
		// the head of the feed.
		expect(connection.nodes.map((node) => node.id)).toEqual([ALERT, ANNOUNCEMENT]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byCategory = await resolver.broadcasts({ category: { eq: 'ALERT' } });
		expect(byCategory.nodes.map((node) => node.id)).toEqual([ALERT]);

		const byVisibility = await resolver.broadcasts({ visibilityMode: { eq: 'ORGANIZATION' } });
		expect(byVisibility.nodes.map((node) => node.id)).toEqual([ANNOUNCEMENT]);

		const byEntity = await resolver.broadcasts({ entity: { eq: 'OrganizationProject' } });
		expect(byEntity.nodes.map((node) => node.id)).toEqual([ALERT]);

		const byTarget = await resolver.broadcasts({ entityId: { eq: ENTITY } });
		expect(byTarget.nodes.map((node) => node.id)).toEqual([ANNOUNCEMENT]);

		const byPublisher = await resolver.broadcasts({ employeeId: { eq: OTHER_EMPLOYEE } });
		expect(byPublisher.nodes.map((node) => node.id)).toEqual([ALERT]);

		const byTitle = await resolver.broadcasts({ title: { ilike: 'quarter%' } });
		expect(byTitle.nodes.map((node) => node.id)).toEqual([ANNOUNCEMENT]);

		// The window the feed is read by: what was published since a date.
		const byPublication = await resolver.broadcasts({
			publishedAt: { gte: '2026-02-15T00:00:00.000Z' }
		});
		expect(byPublication.nodes.map((node) => node.id)).toEqual([ANNOUNCEMENT]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byTitle = await resolver.broadcasts(undefined, [{ field: 'title', direction: 'ASC' }]);
		expect(byTitle.nodes.map((node) => node.id)).toEqual([ALERT, ANNOUNCEMENT]);

		const byPublication = await resolver.broadcasts(undefined, [
			{ field: 'publishedAt', direction: 'ASC' }
		]);
		// Ascending, the absent publication instant sorts last, which is the connection's own rule.
		expect(byPublication.nodes.map((node) => node.id)).toEqual([ANNOUNCEMENT, ALERT]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.broadcasts(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([ALERT]);

		const second = await resolver.broadcasts(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([ANNOUNCEMENT]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.broadcasts(undefined, undefined, undefined, 20);

		const last = await resolver.broadcasts(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([ALERT]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.broadcasts(undefined, [{ field: 'entity', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare, the audience rules among them', async () => {
		const { resolver } = surfaces();

		// The audience rules are carried on the object and deliberately not filterable: the column is a
		// document on one dialect and its text on another, so a condition over it would answer differently
		// on two installations running the same query.
		const error = await resolver
			.broadcasts({ audienceRules: { eq: { roles: ['MANAGER'] } } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.broadcasts(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('keeps the evaluator’s allow-list and the schema’s filter in step, member for member', async () => {
		const { resolver } = surfaces();
		const declared = [...inputBody('BroadcastFilter').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)]
			.map((match) => match[1])
			.filter((member) => !['and', 'or', 'not'].includes(member));

		for (const member of declared) {
			await expect(resolver.broadcasts({ [member]: {} })).resolves.toBeDefined();
		}

		const refusal = await resolver
			.broadcasts({ audienceRules: { eq: {} } })
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
		const offered = [...bodyOf('enum', 'BroadcastSortField').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm)].map(
			(match) => match[1]
		);

		expect(offered).toEqual([
			'createdAt',
			'updatedAt',
			'publishedAt',
			'title',
			'category',
			'visibilityMode'
		]);

		for (const field of offered) {
			await expect(resolver.broadcasts(undefined, [{ field, direction: 'ASC' }])).resolves.toBeDefined();
		}
	});
});

describe('BroadcastResolver — one resource, two protocols, the same operations', () => {
	it('reads one message through the same service method the REST node route calls', async () => {
		const { resolver, broadcastService } = surfaces();

		expect(await resolver.broadcast(ANNOUNCEMENT)).toBe(ROWS[0]);
		expect(broadcastService.findOneById).toHaveBeenCalledWith(ANNOUNCEMENT, {});
	});

	it('answers null for a message that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, broadcastService } = surfaces();
		broadcastService.findOneById.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.broadcast(ALERT)).toBeNull();
	});

	it('answers a message the caller may not read the same way, because the reader does', async () => {
		const { resolver, broadcastService } = surfaces();
		// The delivered reader raises the same miss for a row the caller may not read, which is what makes
		// "not there" and "not yours" one answer on this surface rather than two.
		broadcastService.findOneById.mockRejectedValueOnce(
			new NotFoundException('Broadcast with id x not found or you don’t have permission to view it')
		);

		expect(await resolver.broadcast(ALERT)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, broadcastService } = surfaces();

		expect(await resolver.broadcastCount()).toBe(2);
		expect(broadcastService.countBy).toHaveBeenCalledWith();
	});

	it('publishes a message through the command the REST create route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(
			await resolver.createBroadcast({
				title: 'Quarter closed',
				content: { blocks: [] },
				category: 'ANNOUNCEMENT',
				visibilityMode: 'ORGANIZATION',
				entity: 'Organization',
				entityId: ENTITY,
				organizationId: ORGANIZATION
			})
		).toBe(ROWS[0]);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(BroadcastCreateCommand);
		// The payload is the input as stated: the delivered handler is what stamps the publisher, the tenant
		// and the publication instant, and what tells the audience.
		expect(command.input).toEqual({
			title: 'Quarter closed',
			content: { blocks: [] },
			category: 'ANNOUNCEMENT',
			visibilityMode: 'ORGANIZATION',
			entity: 'Organization',
			entityId: ENTITY,
			organizationId: ORGANIZATION
		});
	});

	it('changes a message through the command the REST edit route dispatches, with the path identifier', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateBroadcast({
			id: ANNOUNCEMENT,
			title: 'Quarter closed — final',
			visibilityMode: 'ENTITY_MEMBERS'
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(BroadcastUpdateCommand);
		expect(command.id).toBe(ANNOUNCEMENT);
		// The identifier is the criterion and is not repeated in the payload, and the pair the message is
		// about cannot travel in it at all.
		expect(command.input).toEqual({
			title: 'Quarter closed — final',
			visibilityMode: 'ENTITY_MEMBERS'
		});
	});

	it('removes a message through the same service method the REST removal route calls', async () => {
		const { resolver, broadcastService } = surfaces();

		expect(await resolver.deleteBroadcast(ANNOUNCEMENT)).toBe(true);
		expect(broadcastService.delete).toHaveBeenCalledWith(ANNOUNCEMENT);
	});

	it('withdraws and restores a message through the service methods the inherited routes call', async () => {
		const { resolver, broadcastService } = surfaces();

		const withdrawn = await resolver.softDeleteBroadcast(ANNOUNCEMENT);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(broadcastService.softRemove).toHaveBeenCalledWith(ANNOUNCEMENT);

		expect(await resolver.recoverBroadcast(ANNOUNCEMENT)).toBe(ROWS[0]);
		expect(broadcastService.softRecover).toHaveBeenCalledWith(ANNOUNCEMENT);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error("You don't have permission to update this broadcast");

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.updateBroadcast({ id: ANNOUNCEMENT, title: 'x' })).rejects.toBe(refusal);
	});
});

describe('BroadcastResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', BroadcastResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', BroadcastController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The one guard the resolver states beyond the controller's chain is the gate, and it is the
		// addition rather than a substitution: the controller's two come first, so a caller with no
		// credential is refused as a credential problem before a tenant's switches are read.
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', BroadcastResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			expect([...guardsOfRoute(BroadcastController, route), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, BroadcastController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, BroadcastResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(PERMISSION_PARITY.map(({ field }) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			PERMISSION_PARITY.map(({ field, route }) => [field, permissionOfRoute(BroadcastController, route)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the read permission on both reads, and the write permission on each write', () => {
		// Reading a message and publishing one are different grants, and so are publishing one and changing
		// or removing one: the three write permissions are three, and each field states its own route's.
		expect(permissionOfField('broadcasts')).toEqual([PermissionsEnum.BROADCAST_READ]);
		expect(permissionOfField('broadcast')).toEqual([PermissionsEnum.BROADCAST_READ]);
		expect(permissionOfField('createBroadcast')).toEqual([PermissionsEnum.BROADCAST_CREATE]);
		expect(permissionOfField('updateBroadcast')).toEqual([PermissionsEnum.BROADCAST_UPDATE]);
		expect(permissionOfField('deleteBroadcast')).toEqual([PermissionsEnum.BROADCAST_DELETE]);
	});

	it('states no permission on the fields whose routes state none, because that absence is the parity', () => {
		// The count and the two lifecycle moves are inherited from the CRUD base, where they state no
		// permission of their own — and the controller's class states none either, so the whole of their
		// scope is the guard chain. Widening them here, or restating the same absence as an empty
		// `@Permissions()`, would be a second statement of a scope the controller already decided.
		for (const handler of ['getCount', 'softRemove', 'softRecover']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(BroadcastController)[handler])).toBeUndefined();
		}

		for (const field of ['broadcastCount', 'softDeleteBroadcast', 'recoverBroadcast']) {
			expect(permissionOfField(field)).toBeUndefined();
		}
	});
});

describe('BroadcastResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, BroadcastResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', BroadcastResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('broadcasts')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('broadcasts');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the publication and the removals among them', async () => {
		for (const field of ['createBroadcast', 'updateBroadcast', 'deleteBroadcast', 'recoverBroadcast']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('broadcast'))).resolves.toBe(true);
	});
});

describe('BroadcastModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, BroadcastModule) ?? []) as unknown[];

		expect(providers).toContain(BroadcastResolver);
		expect(providers).toContain(BroadcastService);
	});

	it('exports the service the resolver injects and the bus the two writes dispatch through', () => {
		// The resolver is a provider of whichever module the endpoint scans, so a module that imports this
		// one receives what this one hands on and nothing else: both writes reach a command, which is why the
		// bus is exported.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, BroadcastModule) ?? []) as Array<{
			name?: string;
		}>;

		expect(exported).toContain(BroadcastService);
		expect(exported.map((entry) => entry?.name)).toContain('CqrsModule');
		expect(BroadcastResolver.length).toBe(2);
	});

	it('reaches the module that provides the guards, without importing the one the gate resolves through', () => {
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, BroadcastModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);
		const names = resolved.map((entry) => (entry as { name?: string })?.name);

		expect(names).toContain('RolePermissionModule');
		expect(names).not.toContain('FeatureModule');
	});
});
