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
import { EquipmentSharingPolicyController } from './equipment-sharing-policy.controller';
import { EquipmentSharingPolicyModule } from './equipment-sharing-policy.module';
import { EquipmentSharingPolicyResolver } from './equipment-sharing-policy.resolver';
import { EquipmentSharingPolicyService } from './equipment-sharing-policy.service';

/**
 * The vocabulary a sharing period is filed under, over GraphQL.
 *
 * The delivered REST routes serve a list, the paginated spelling of the same list, one row, a count, a
 * filing, a column-wise edit and the two removals of the CRUD base. This suite pins the half of the
 * two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same `EquipmentSharingPolicyService` method the REST route reaches, with the
 *   same payload, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain and the permission pair are the controller's, field by field** — including the
 *   four fields whose routes state no pair of their own and therefore run under the controller's
 *   class-level one, which is the one they state as well;
 * - the members the delivered reads cannot produce are not declared at all;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant that
 *   switched that capability off is refused the way a disabled capability's routes are.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const LOAN = '00000000-0000-4000-8000-000000000010';
const STANDARD = '00000000-0000-4000-8000-000000000011';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted service answers with, deliberately not in name order, so the default order the
 * connection applies is a decision these tests can tell apart from the order the read happened to
 * return.
 */
const ROWS = [
	{
		id: STANDARD,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Standard loan',
		description: 'Returned at the end of the period',
		createdAt: new Date('2026-01-10T10:00:00.000Z'),
		updatedAt: new Date('2026-01-10T10:00:00.000Z')
	},
	{
		id: LOAN,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Asset loan',
		description: null,
		createdAt: new Date('2026-02-10T10:00:00.000Z'),
		updatedAt: new Date('2026-02-10T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const equipmentSharingPolicyService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-06-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return {
		equipmentSharingPolicyService,
		resolver: new EquipmentSharingPolicyResolver(equipmentSharingPolicyService as never)
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
const ownSdl = ['equipment-sharing-policy.type.gql', 'equipment-sharing-policy.api.gql']
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
		.filter((field) => field.toLowerCase().includes('equipmentsharingpolic'))
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
function handlersOf(controller: typeof EquipmentSharingPolicyController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EquipmentSharingPolicyController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = EquipmentSharingPolicyResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EquipmentSharingPolicyController, handler: string): unknown[] {
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
	{ field: 'equipmentSharingPolicies', route: 'findAll' },
	{ field: 'equipmentSharingPolicy', route: 'findById' },
	{ field: 'equipmentSharingPolicyCount', route: 'getCount' },
	{ field: 'createEquipmentSharingPolicy', route: 'create' },
	{ field: 'updateEquipmentSharingPolicy', route: 'update' },
	{ field: 'deleteEquipmentSharingPolicy', route: 'delete' },
	{ field: 'softDeleteEquipmentSharingPolicy', route: 'softRemove' },
	{ field: 'recoverEquipmentSharingPolicy', route: 'softRecover' }
];

/** The write fields, whose delegations are asserted one by one below. */
const WRITES = [
	'createEquipmentSharingPolicy',
	'updateEquipmentSharingPolicy',
	'deleteEquipmentSharingPolicy',
	'softDeleteEquipmentSharingPolicy',
	'recoverEquipmentSharingPolicy'
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
		getHandler: () => (EquipmentSharingPolicyResolver.prototype as never)[field],
		getClass: () => EquipmentSharingPolicyResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EquipmentSharingPolicyResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'equipmentSharingPolicies',
				'equipmentSharingPolicy',
				'equipmentSharingPolicyCount'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(expect.arrayContaining(WRITES));
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once. It serves no sub-route of its own beyond that spelling,
		// which is why nothing else appears here.
		expect(ownedRootFields('Query')).toEqual([
			'equipmentSharingPolicies',
			'equipmentSharingPolicy',
			'equipmentSharingPolicyCount'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createEquipmentSharingPolicy',
			'deleteEquipmentSharingPolicy',
			'recoverEquipmentSharingPolicy',
			'softDeleteEquipmentSharingPolicy',
			'updateEquipmentSharingPolicy'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EquipmentSharingPolicyConnection \{\s*nodes: \[EquipmentSharingPolicy!\]!\s*edges: \[EquipmentSharingPolicyEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type EquipmentSharingPolicyEdge \{\s*node: EquipmentSharingPolicy!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input EquipmentSharingPolicyFilter \{/);
		expect(printed).toMatch(/input EquipmentSharingPolicySort \{/);
		expect(printed).toMatch(/enum EquipmentSharingPolicySortField \{\s*createdAt\s*updatedAt\s*name\s*\}/);
	});

	it('declares the two write inputs', () => {
		expect(printed).toMatch(/input CreateEquipmentSharingPolicyInput \{/);
		expect(printed).toMatch(/input UpdateEquipmentSharingPolicyInput \{/);
	});

	it('carries the columns the delivered reads answer, and not the collection they never join', () => {
		const members = memberNames('EquipmentSharingPolicy');

		// The periods filed under a policy are a `OneToMany` the delivered list read loads only when a
		// REST caller names it in `relations`, so a member carrying them would be absent from exactly the
		// rows this surface answers.
		expect(members).not.toContain('equipmentSharings');
		expect(members).toEqual(
			expect.arrayContaining(['name', 'description', 'deletedAt', 'organizationId'])
		);

		// The name is a non-null column the delivered validation requires, and the note beside it is
		// optional.
		expect(typeBody('EquipmentSharingPolicy')).toMatch(/name: String!\n/);
		expect(typeBody('EquipmentSharingPolicy')).toMatch(/description: String\n/);
	});

	it('requires the name on the create and not on the edit, because only the create validates it', () => {
		// The two delivered routes bind the same DTO, and only the create runs a validation pipe over it:
		// the edit writes the columns the body states, so a body that omits the name keeps the row's. A
		// member stated as required on the edit would refuse a body the delivered route serves.
		expect(inputBody('CreateEquipmentSharingPolicyInput')).toMatch(/name: String!\n/);
		expect(inputBody('UpdateEquipmentSharingPolicyInput')).toMatch(/name: String\n/);
		expect(inputBody('UpdateEquipmentSharingPolicyInput')).toMatch(/id: ID!\n/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(fieldArgs('Query', 'equipmentSharingPolicies')).not.toContain('withDeleted');
		expect(fieldArgs('Query', 'equipmentSharingPolicies')).toEqual([
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
		// The count route binds its query string to the store's own `where`, which is a shape no schema can
		// state, so the field states no narrowing of its own — and it is nullable, because a count is an
		// aggregate the resource may have no answer for and a non-null field would fabricate a zero.
		expect(fieldArgs('Query', 'equipmentSharingPolicyCount')).toEqual([]);
		expect(fieldType('Query', 'equipmentSharingPolicyCount')).toBe('Int');
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createEquipmentSharingPolicy', ['input']],
			['updateEquipmentSharingPolicy', ['input']],
			['deleteEquipmentSharingPolicy', ['id']],
			['softDeleteEquipmentSharingPolicy', ['id']],
			['recoverEquipmentSharingPolicy', ['id']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}
	});

	it('states no Float in any member this domain declares', () => {
		// Nothing on this row is a quantity, so the absence is asserted rather than left to chance: a
		// member that appeared here in the floating-point family would be one no column of this row backs.
		const declared = [
			'EquipmentSharingPolicy',
			'EquipmentSharingPolicyEdge',
			'EquipmentSharingPolicyConnection',
			'EquipmentSharingPolicyFilter',
			'EquipmentSharingPolicySort',
			'EquipmentSharingPolicySortField',
			'CreateEquipmentSharingPolicyInput',
			'UpdateEquipmentSharingPolicyInput'
		]
			.map((name) => `${typeBody(name)}\n${inputBody(name)}\n${bodyOf('enum', name)}`)
			.join('\n');

		expect(declared).not.toMatch(/\bFloat\b/);
		expect(ownSdl).not.toMatch(/:\s*\[?Float\b/);
	});
});

describe('EquipmentSharingPolicyResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, equipmentSharingPolicyService } = surfaces();

		const connection = await resolver.equipmentSharingPolicies(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(equipmentSharingPolicyService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(LOAN);
	});

	it('orders by the vocabulary’s own name order when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.equipmentSharingPolicies();

		// The read returns the standard loan first; the connection's own default is the name ascending.
		expect(connection.nodes.map((node) => node.id)).toEqual([LOAN, STANDARD]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.equipmentSharingPolicies({ name: { eq: 'Asset loan' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([LOAN]);

		const byPattern = await resolver.equipmentSharingPolicies({ name: { ilike: 'standard%' } });
		expect(byPattern.nodes.map((node) => node.id)).toEqual([STANDARD]);

		// The note is a column, and a policy filed without one is found by `isNull` rather than by an
		// equality that no row can satisfy.
		const unrecorded = await resolver.equipmentSharingPolicies({ description: { isNull: true } });
		expect(unrecorded.nodes.map((node) => node.id)).toEqual([LOAN]);

		const byOrganization = await resolver.equipmentSharingPolicies({
			organizationId: { eq: ORGANIZATION }
		});
		expect(byOrganization.totalCount).toBe(2);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.equipmentSharingPolicies(undefined, [{ field: 'name', direction: 'DESC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([STANDARD, LOAN]);

		const byCreated = await resolver.equipmentSharingPolicies(undefined, [
			{ field: 'createdAt', direction: 'ASC' }
		]);
		expect(byCreated.nodes.map((node) => node.id)).toEqual([STANDARD, LOAN]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.equipmentSharingPolicies(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([LOAN]);

		const second = await resolver.equipmentSharingPolicies(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([STANDARD]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.equipmentSharingPolicies(undefined, undefined, undefined, 20);

		const last = await resolver.equipmentSharingPolicies(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([LOAN]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.equipmentSharingPolicies(undefined, [{ field: 'description', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// The periods filed under a policy are carried by the entity and deliberately not filterable: the
		// delivered list read joins no relation, so the condition could only ever match the empty set.
		const error = await resolver
			.equipmentSharingPolicies({ equipmentSharings: { eq: LOAN } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.equipmentSharingPolicies(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('keeps the evaluator’s allow-list and the schema’s filter in step, member for member', async () => {
		const { resolver } = surfaces();
		const declared = [
			...inputBody('EquipmentSharingPolicyFilter').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)
		]
			.map((match) => match[1])
			.filter((member) => !['and', 'or', 'not'].includes(member));

		for (const member of declared) {
			await expect(resolver.equipmentSharingPolicies({ [member]: {} })).resolves.toBeDefined();
		}

		const refusal = await resolver
			.equipmentSharingPolicies({ equipmentSharings: { eq: LOAN } })
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
			...bodyOf('enum', 'EquipmentSharingPolicySortField').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm)
		].map((match) => match[1]);

		expect(offered).toEqual(['createdAt', 'updatedAt', 'name']);

		for (const field of offered) {
			await expect(
				resolver.equipmentSharingPolicies(undefined, [{ field, direction: 'ASC' }])
			).resolves.toBeDefined();
		}
	});
});

describe('EquipmentSharingPolicyResolver — one resource, two protocols, the same operations', () => {
	it('reads one policy through the same service method the REST node route calls', async () => {
		const { resolver, equipmentSharingPolicyService } = surfaces();

		expect(await resolver.equipmentSharingPolicy(STANDARD)).toBe(ROWS[0]);
		expect(equipmentSharingPolicyService.findOneByIdString).toHaveBeenCalledWith(STANDARD);
	});

	it('answers null for a policy that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, equipmentSharingPolicyService } = surfaces();
		equipmentSharingPolicyService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.equipmentSharingPolicy(LOAN)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, equipmentSharingPolicyService } = surfaces();

		expect(await resolver.equipmentSharingPolicyCount()).toBe(2);
		expect(equipmentSharingPolicyService.countBy).toHaveBeenCalledWith();
	});

	it('files a policy through the same service call the REST create route makes', async () => {
		const { resolver, equipmentSharingPolicyService } = surfaces();

		expect(
			await resolver.createEquipmentSharingPolicy({
				name: 'Standard loan',
				description: 'Returned at the end of the period',
				organizationId: ORGANIZATION
			})
		).toBe(ROWS[0]);

		// The delivered create is handed the members the caller stated, and the tenant only from the
		// credential.
		expect(equipmentSharingPolicyService.create).toHaveBeenCalledWith({
			name: 'Standard loan',
			description: 'Returned at the end of the period',
			organizationId: ORGANIZATION
		});
	});

	it('changes a policy through the same service method the REST edit route calls, and reads the row back', async () => {
		const { resolver, equipmentSharingPolicyService } = surfaces();

		const updated = await resolver.updateEquipmentSharingPolicy({
			id: STANDARD,
			name: 'Standard loan (revised)',
			organizationId: ORGANIZATION
		});

		// The identifier is the criterion and is not repeated in the payload, which is the shape the route
		// itself has.
		expect(equipmentSharingPolicyService.update).toHaveBeenCalledWith(STANDARD, {
			name: 'Standard loan (revised)',
			organizationId: ORGANIZATION
		});
		// The delivered route answers the store's own update result, which is a statement about the write
		// rather than a row: the field answers the row, read back through the same service.
		expect(equipmentSharingPolicyService.findOneByIdString).toHaveBeenCalledWith(STANDARD);
		expect(updated).toBe(ROWS[0]);
	});

	it('removes a policy through the same service method the REST removal route calls', async () => {
		const { resolver, equipmentSharingPolicyService } = surfaces();

		expect(await resolver.deleteEquipmentSharingPolicy(STANDARD)).toBe(true);
		expect(equipmentSharingPolicyService.delete).toHaveBeenCalledWith(STANDARD);
	});

	it('withdraws and restores a policy through the service methods the inherited routes call', async () => {
		const { resolver, equipmentSharingPolicyService } = surfaces();

		const withdrawn = await resolver.softDeleteEquipmentSharingPolicy(STANDARD);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(equipmentSharingPolicyService.softRemove).toHaveBeenCalledWith(STANDARD);

		expect(await resolver.recoverEquipmentSharingPolicy(STANDARD)).toBe(ROWS[0]);
		expect(equipmentSharingPolicyService.softRecover).toHaveBeenCalledWith(STANDARD);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, equipmentSharingPolicyService } = surfaces();
		const refusal = new Error('EQUIPMENT_SHARING_POLICY_IN_USE: a sharing period still names this policy.');

		equipmentSharingPolicyService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteEquipmentSharingPolicy(STANDARD)).rejects.toBe(refusal);
	});
});

describe('EquipmentSharingPolicyResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', EquipmentSharingPolicyResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', EquipmentSharingPolicyController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The one guard the resolver states beyond the controller's chain is the gate, and it is the
		// addition rather than a substitution: the controller's two come first, so a caller with no
		// credential is refused as a credential problem before a tenant's switches are read.
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', EquipmentSharingPolicyResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			expect([...guardsOfRoute(EquipmentSharingPolicyController, route), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states on the class the permission pair the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EquipmentSharingPolicyResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, EquipmentSharingPolicyController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EquipmentSharingPolicyController)).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT
		]);
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(
			PERMISSION_PARITY.map(({ field }) => [field, permissionOfField(field)])
		);
		const expected = Object.fromEntries(
			PERMISSION_PARITY.map(({ field, route }) => [
				field,
				permissionOfRoute(EquipmentSharingPolicyController, route)
			])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the view pair on the list, which is the only route that states it', () => {
		expect(permissionOfField('equipmentSharingPolicies')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.EQUIPMENT_SHARING_POLICY_VIEW
		]);
		expect(permissionOfRoute(EquipmentSharingPolicyController, 'findAll')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.EQUIPMENT_SHARING_POLICY_VIEW
		]);
	});

	it('carries the add permission on the create, and never the edit pair on it', () => {
		// The add permission is the one grant the create route holds that its edit sibling does not, so
		// folding the two writes together under the class pair would widen who may file a policy.
		expect(permissionOfField('createEquipmentSharingPolicy')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.EQUIPMENT_SHARING_POLICY_ADD
		]);
		expect(permissionOfRoute(EquipmentSharingPolicyController, 'create')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.EQUIPMENT_SHARING_POLICY_ADD
		]);
	});

	it('carries the class-level pair on the inherited reads and the two lifecycle fields, because their routes inherit it', () => {
		// The node read, the count, the withdrawal and the restoration are inherited from the CRUD base,
		// where they state no permission of their own — so they run under the controller's class-level
		// pair, and the fields state the same one rather than stating nothing. Reading "no metadata on the
		// route" as "no permission" would widen the REST route's scope on this surface only.
		for (const handler of ['findById', 'getCount', 'softRemove', 'softRecover']) {
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EquipmentSharingPolicyController)[handler])
			).toBeUndefined();
		}

		for (const field of [
			'equipmentSharingPolicy',
			'equipmentSharingPolicyCount',
			'softDeleteEquipmentSharingPolicy',
			'recoverEquipmentSharingPolicy'
		]) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT
			]);
		}
	});
});

describe('EquipmentSharingPolicyResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, EquipmentSharingPolicyResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EquipmentSharingPolicyResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('equipmentSharingPolicies'))
			.catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('equipmentSharingPolicies');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the removals among them', async () => {
		for (const field of ['createEquipmentSharingPolicy', 'deleteEquipmentSharingPolicy']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('equipmentSharingPolicy'))).resolves.toBe(true);
	});
});

describe('EquipmentSharingPolicyModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EquipmentSharingPolicyModule) ??
			[]) as unknown[];

		expect(providers).toContain(EquipmentSharingPolicyResolver);
		expect(providers).toContain(EquipmentSharingPolicyService);
	});

	it('exports the service the resolver injects, and that service is the whole of its dependencies', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EquipmentSharingPolicyModule) ??
			[]) as unknown[];

		expect(exported).toContain(EquipmentSharingPolicyService);
		expect(EquipmentSharingPolicyResolver.length).toBe(1);
	});

	it('reaches the module that provides the guards, without importing the one the gate resolves through', () => {
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, EquipmentSharingPolicyModule) ??
			[]) as Array<{ forwardRef?: () => unknown }>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);
		const names = resolved.map((entry) => (entry as { name?: string })?.name);

		expect(names).toContain('RolePermissionModule');
		expect(names).not.toContain('FeatureModule');
	});
});
