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
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureModule } from '../feature/feature.module';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OrganizationVendorController } from './organization-vendor.controller';
import { OrganizationVendorModule } from './organization-vendor.module';
import { OrganizationVendorResolver } from './organization-vendor.resolver';
import { OrganizationVendorService } from './organization-vendor.service';

/**
 * The suppliers an expense is recorded against, over GraphQL.
 *
 * The delivered REST routes serve a list, one row, a count, a create, an edit, a removal that refuses a
 * supplier an expense already names, and the withdrawal and restoration of a row. This suite pins the half
 * of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes here
 *   and a refusal is the query protocol's own code;
 * - **the removal calls the master's own rule rather than the store's delete**, which is what keeps the
 *   expense book's identifiers resolvable: a resolver that reached for `delete` would remove a supplier
 *   the REST route protects;
 * - **the permission is the absence the controller states**, field by field: this controller carries the
 *   tenant guard and no `@Permissions` at all, so no field here may state one, and the class does not
 *   carry the permission guard either;
 * - every amount the surface carries — the minimum order value — is an exact decimal and never a
 *   floating-point number, on the object type, on the filter and on the way into a write;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant that
 *   switched that capability off is refused the way a disabled capability's routes are — and the refusal
 *   names the field, because the guard reads a GraphQL execution context rather than crashing on one.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CONTACT = '00000000-0000-4000-8000-000000000040';
const TERM = '00000000-0000-4000-8000-000000000070';
const REGIME = '00000000-0000-4000-8000-000000000071';
const VENDOR = '00000000-0000-4000-8000-000000000030';
const OTHER = '00000000-0000-4000-8000-000000000031';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted service answers with, with the minimum order value as the platform's numeric
 * transformer hands it over: a number, and nothing rounded, rescaled or reformatted on the way.
 */
const ROWS = [
	{
		id: VENDOR,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Airline',
		email: 'billing@airline.example.test',
		phone: '+1000000000',
		website: 'https://airline.example.test',
		code: 'AIR-01',
		currency: 'USD',
		paymentTermsDays: 30,
		paymentTermId: TERM,
		leadTimeDays: 3,
		minimumOrderAmount: 250.5,
		contactId: CONTACT,
		taxRegimeId: REGIME,
		metadata: { portal: 'https://portal.airline.example.test' },
		createdAt: new Date('2026-01-05T10:00:00.000Z'),
		updatedAt: new Date('2026-01-05T10:00:00.000Z')
	},
	{
		id: OTHER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Railway',
		code: null,
		currency: null,
		paymentTermsDays: null,
		paymentTermId: null,
		leadTimeDays: 10,
		minimumOrderAmount: null,
		contactId: null,
		taxRegimeId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const organizationVendorService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		deleteVendor: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-05-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return {
		organizationVendorService,
		resolver: new OrganizationVendorResolver(organizationVendorService as never)
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
const ownSdl = ['organization-vendor.type.gql', 'organization-vendor.api.gql']
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
		.filter((field) => field.toLowerCase().includes('organizationvendor'))
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

/** The member names one type declares, read off its printed body rather than off a description. */
function memberNames(name: string): string[] {
	return [...typeBody(name).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/gm)].map((match) => match[1]);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OrganizationVendorController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * On this resource both sides of that lookup are empty, which is the fact the parity tests below exist to
 * hold: a resolver that quietly required a permission the controller never states would refuse callers the
 * REST routes serve.
 */
function permissionOfRoute(controller: typeof OrganizationVendorController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = OrganizationVendorResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = OrganizationVendorResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(controller: typeof OrganizationVendorController, handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

/** Every root field and the delivered route it mirrors. */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'organizationVendors', route: 'findAll' },
	{ field: 'organizationVendor', route: 'findById' },
	{ field: 'organizationVendorCount', route: 'getCount' },
	{ field: 'createOrganizationVendor', route: 'create' },
	{ field: 'updateOrganizationVendor', route: 'update' },
	{ field: 'deleteOrganizationVendor', route: 'delete' },
	{ field: 'softDeleteOrganizationVendor', route: 'softRemove' },
	{ field: 'recoverOrganizationVendor', route: 'softRecover' }
];

/** The write fields, whose delegations are asserted one by one below. */
const WRITES = [
	'createOrganizationVendor',
	'updateOrganizationVendor',
	'deleteOrganizationVendor',
	'softDeleteOrganizationVendor',
	'recoverOrganizationVendor'
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
		getHandler: () => (OrganizationVendorResolver.prototype as never)[field],
		getClass: () => OrganizationVendorResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OrganizationVendorResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['organizationVendors', 'organizationVendor', 'organizationVendorCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createOrganizationVendor',
				'updateOrganizationVendor',
				'deleteOrganizationVendor',
				'softDeleteOrganizationVendor',
				'recoverOrganizationVendor'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([
			'organizationVendor',
			'organizationVendorCount',
			'organizationVendors'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createOrganizationVendor',
			'deleteOrganizationVendor',
			'recoverOrganizationVendor',
			'softDeleteOrganizationVendor',
			'updateOrganizationVendor'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type OrganizationVendorConnection \{\s*nodes: \[OrganizationVendor!\]!\s*edges: \[OrganizationVendorEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type OrganizationVendorEdge \{\s*node: OrganizationVendor!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input OrganizationVendorFilter \{/);
		expect(printed).toMatch(/input OrganizationVendorSort \{/);
		expect(printed).toMatch(/enum OrganizationVendorSortField \{\s*createdAt\s*updatedAt\s*name\s*code\s*\}/);
	});

	it('declares the write inputs the mutations take', () => {
		expect(printed).toMatch(/input CreateOrganizationVendorInput \{/);
		expect(printed).toMatch(/input UpdateOrganizationVendorInput \{/);
	});

	it('carries the members the delivered reads produce, and not the expenses they never load', () => {
		const members = memberNames('OrganizationVendor');

		// No read behind this surface joins the expenses a supplier stands behind, so a member carrying
		// them would be absent from exactly the rows this surface answers while looking like a fact about
		// the supplier. What was paid to one is the expense book's question.
		expect(members).not.toContain('expenses');
		expect(members).not.toContain('tags');
		expect(members).toEqual(
			expect.arrayContaining([
				'name',
				'code',
				'currency',
				'paymentTermsDays',
				'paymentTermId',
				'leadTimeDays',
				'minimumOrderAmount',
				'contactId',
				'taxRegimeId',
				'metadata',
				'deletedAt'
			])
		);
	});

	it('offers no argument it cannot honour', () => {
		expect(fieldArgs('Query', 'organizationVendors')).not.toContain('withDeleted');
		expect(fieldArgs('Query', 'organizationVendors')).toEqual([
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
		expect(fieldArgs('Query', 'organizationVendorCount')).toEqual([]);
		expect(fieldType('Query', 'organizationVendorCount')).toBe('Int');
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createOrganizationVendor', ['input']],
			['updateOrganizationVendor', ['input']],
			['deleteOrganizationVendor', ['id']],
			['softDeleteOrganizationVendor', ['id']],
			['recoverOrganizationVendor', ['id']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}
	});
});

describe('OrganizationVendorResolver — every amount is exact', () => {
	it('carries the minimum order value as Decimal and never as Float', () => {
		const body = typeBody('OrganizationVendor');

		expect(body).toMatch(/minimumOrderAmount: Decimal(\n|$)/);
		expect(body).not.toMatch(/\bFloat\b/);
	});

	it('states no Float in any member this domain declares', () => {
		const declared = [
			'OrganizationVendor',
			'OrganizationVendorEdge',
			'OrganizationVendorConnection',
			'OrganizationVendorFilter',
			'OrganizationVendorSort',
			'OrganizationVendorSortField',
			'CreateOrganizationVendorInput',
			'UpdateOrganizationVendorInput'
		]
			.map((name) => `${typeBody(name)}\n${inputBody(name)}`)
			.join('\n');

		expect(declared).not.toMatch(/\bFloat\b/);
		expect(ownSdl).not.toMatch(/:\s*\[?Float\b/);
	});

	it('narrows the minimum through the decimal family, never through a whole-number one', () => {
		const filter = inputBody('OrganizationVendorFilter');

		expect(filter).toMatch(/minimumOrderAmount: DecimalFilter/);
		expect(filter).not.toMatch(/minimumOrderAmount: (FloatFilter|NumberFilter)/);
		// The two term columns are whole numbers of days and a lead time is a number of days: they are
		// narrowed through the whole-number family, which is the distinction the two families exist to draw.
		expect(filter).toMatch(/paymentTermsDays: NumberFilter/);
		expect(filter).toMatch(/leadTimeDays: NumberFilter/);
		expect(filter).not.toMatch(/\bFloat\b/);
	});

	it('states the minimum in the write inputs as the exact decimal, never as a Float', () => {
		expect(inputBody('CreateOrganizationVendorInput')).toMatch(/minimumOrderAmount: Decimal(\n|$)/);
		expect(inputBody('UpdateOrganizationVendorInput')).toMatch(/minimumOrderAmount: Decimal(\n|$)/);
	});

	it('carries the currency as the row’s own three-letter code', () => {
		// The vendor-level currency is a default a product term overrides, so it is nullable — and it is a
		// code rather than a formatted figure either way.
		expect(typeBody('OrganizationVendor')).toMatch(/currency: String(\n|$)/);
		expect(inputBody('CreateOrganizationVendorInput')).toMatch(/currency: String(\n|$)/);
	});

	it('answers the amount the row holds, unchanged', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.organizationVendors();

		expect(connection.nodes[0].minimumOrderAmount).toBe(250.5);
		expect(connection.nodes[1].minimumOrderAmount).toBeNull();
		expect(await resolver.organizationVendor(VENDOR)).toBe(ROWS[0]);
	});

	it('hands a write the exact digits the caller stated rather than a binary fraction', async () => {
		const { resolver, organizationVendorService } = surfaces();

		await resolver.createOrganizationVendor({ name: 'Airline', minimumOrderAmount: '250.5' });

		expect(organizationVendorService.create).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Airline', minimumOrderAmount: '250.5' })
		);

		await resolver.updateOrganizationVendor({ id: VENDOR, name: 'Airline', minimumOrderAmount: '0.1' });

		expect(organizationVendorService.create).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: VENDOR, minimumOrderAmount: '0.1' })
		);
	});
});

describe('OrganizationVendorResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, organizationVendorService } = surfaces();

		const connection = await resolver.organizationVendors(undefined, undefined, undefined, 20);

		expect(organizationVendorService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(VENDOR);
	});

	it('orders by the master’s own name when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.organizationVendors();

		expect(connection.nodes.map((node) => node.name)).toEqual(['Airline', 'Railway']);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizationVendors({ name: { ilike: 'air%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([VENDOR]);

		const byCode = await resolver.organizationVendors({ code: { eq: 'AIR-01' } });
		expect(byCode.nodes.map((node) => node.id)).toEqual([VENDOR]);

		const byMinimum = await resolver.organizationVendors({
			minimumOrderAmount: { between: ['250', '260'] }
		});
		expect(byMinimum.nodes.map((node) => node.id)).toEqual([VENDOR]);

		const byTerm = await resolver.organizationVendors({ paymentTermId: { eq: TERM } });
		expect(byTerm.nodes.map((node) => node.id)).toEqual([VENDOR]);

		const byContact = await resolver.organizationVendors({ contactId: { eq: CONTACT } });
		expect(byContact.nodes.map((node) => node.id)).toEqual([VENDOR]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizationVendors(undefined, [{ field: 'name', direction: 'DESC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([OTHER, VENDOR]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.organizationVendors(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([VENDOR]);

		const second = await resolver.organizationVendors(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationVendors(undefined, [{ field: 'minimumOrderAmount', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// `expenses` is carried on the entity and deliberately not filterable: the delivered list read loads
		// no relations, so the condition could only ever match the empty set.
		const error = await resolver.organizationVendors({ expenses: { eq: VENDOR } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationVendors(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('keeps the evaluator’s allow-list and the schema’s filter in step, member for member', async () => {
		const { resolver } = surfaces();
		const declared = [...inputBody('OrganizationVendorFilter').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)]
			.map((match) => match[1])
			.filter((member) => !['and', 'or', 'not'].includes(member));

		for (const member of declared) {
			await expect(resolver.organizationVendors({ [member]: {} })).resolves.toBeDefined();
		}

		const refusal = await resolver.organizationVendors({ expenses: { eq: VENDOR } }).catch((thrown) => thrown);
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
			...bodyOf('enum', 'OrganizationVendorSortField').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm)
		].map((match) => match[1]);

		expect(offered).toEqual(['createdAt', 'updatedAt', 'name', 'code']);

		for (const field of offered) {
			await expect(resolver.organizationVendors(undefined, [{ field, direction: 'ASC' }])).resolves.toBeDefined();
		}
	});
});

describe('OrganizationVendorResolver — one master, two protocols, the same operations', () => {
	it('reads one row through the same service method the REST node route calls', async () => {
		const { resolver, organizationVendorService } = surfaces();

		expect(await resolver.organizationVendor(VENDOR)).toBe(ROWS[0]);
		expect(organizationVendorService.findOneByIdString).toHaveBeenCalledWith(VENDOR);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, organizationVendorService } = surfaces();
		organizationVendorService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.organizationVendor(OTHER)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, organizationVendorService } = surfaces();

		expect(await resolver.organizationVendorCount()).toBe(2);
		expect(organizationVendorService.countBy).toHaveBeenCalledWith();
	});

	it('records a supplier through the same service method the inherited creation route calls', async () => {
		const { resolver, organizationVendorService } = surfaces();

		expect(
			await resolver.createOrganizationVendor({
				name: 'Airline',
				email: 'billing@airline.example.test',
				code: 'AIR-01',
				currency: 'USD',
				paymentTermId: TERM,
				minimumOrderAmount: '250.5',
				organizationId: ORGANIZATION
			})
		).toBe(ROWS[0]);

		// The delivered creation binds the row itself, so the members the caller stated are the members the
		// write receives; the tenant comes from the credential and is never stated here.
		expect(organizationVendorService.create).toHaveBeenCalledWith({
			name: 'Airline',
			email: 'billing@airline.example.test',
			code: 'AIR-01',
			currency: 'USD',
			paymentTermId: TERM,
			minimumOrderAmount: '250.5',
			organizationId: ORGANIZATION
		});
	});

	it('changes a supplier through the same write the REST edit route reaches, with the path identifier', async () => {
		const { resolver, organizationVendorService } = surfaces();

		await resolver.updateOrganizationVendor({ id: VENDOR, name: 'Airline Group', leadTimeDays: 5 });

		// The delivered edit is the platform's own upsert: the identifier the route reads from the path and
		// the body beside it, handed to the same write the creation uses.
		expect(organizationVendorService.create).toHaveBeenCalledWith({
			name: 'Airline Group',
			leadTimeDays: 5,
			id: VENDOR
		});
	});

	it('removes a supplier through the master’s own rule, which refuses one an expense names', async () => {
		const { resolver, organizationVendorService } = surfaces();

		expect(await resolver.deleteOrganizationVendor(VENDOR)).toBe(true);

		// The route calls the master's own removal, which counts the expenses that point at the supplier and
		// refuses while any does — so the field calls that rule rather than the store's delete, which would
		// remove a row the expense book depends on.
		expect(organizationVendorService.deleteVendor).toHaveBeenCalledWith(VENDOR);
	});

	it('surfaces the master’s refusal of a supplier an expense names', async () => {
		const { resolver, organizationVendorService } = surfaces();
		const refusal = new Error("This Vendor can't be deleted because it is used in expense records");

		organizationVendorService.deleteVendor.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteOrganizationVendor(VENDOR)).rejects.toBe(refusal);
	});

	it('withdraws and restores a supplier through the service methods the inherited routes call', async () => {
		const { resolver, organizationVendorService } = surfaces();

		const withdrawn = await resolver.softDeleteOrganizationVendor(VENDOR);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(organizationVendorService.softRemove).toHaveBeenCalledWith(VENDOR);

		expect(await resolver.recoverOrganizationVendor(VENDOR)).toBe(ROWS[0]);
		expect(organizationVendorService.softRecover).toHaveBeenCalledWith(VENDOR);
	});
});

describe('OrganizationVendorResolver — the guard chain is the controller’s, and the permission is its absence', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OrganizationVendorResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OrganizationVendorController) ?? [];

		expect(controllerGuards).toEqual([TenantPermissionGuard]);
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
		// The controller does not carry the permission guard, so the resolver does not either.
		expect(resolverGuards).not.toContain(PermissionGuard);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', OrganizationVendorResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			const declared = Reflect.getMetadata('__guards__', OrganizationVendorController) ?? [];
			const restated = guardsOfHandler(OrganizationVendorController, route);

			expect([...new Set([...declared, ...restated, FeatureFlagGuard])].sort()).toEqual([...stated].sort());
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationVendorController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationVendorResolver)).toBeUndefined();
	});

	it.each(PERMISSION_PARITY)('$field states no permission, exactly as $route does', ({ field, route }) => {
		expect(permissionOfRoute(OrganizationVendorController, route)).toBeUndefined();
		expect(permissionOfField(field)).toBeUndefined();
		expect(guardsOfField(field)).toEqual(guardsOfHandler(OrganizationVendorController, route));
	});
});

describe('OrganizationVendorResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationVendorResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OrganizationVendorResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('organizationVendors')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('organizationVendors');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the guarded removal among them', async () => {
		for (const field of ['createOrganizationVendor', 'deleteOrganizationVendor', 'softDeleteOrganizationVendor']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('organizationVendor'))).resolves.toBe(true);
	});
});

describe('OrganizationVendorModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, OrganizationVendorModule) ??
			[]) as unknown[];

		expect(providers).toContain(OrganizationVendorResolver);
		expect(providers).toContain(OrganizationVendorService);
	});

	it('exports the service the resolver injects, which is the whole of its dependencies', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, OrganizationVendorModule) ??
			[]) as unknown[];

		expect(exported).toContain(OrganizationVendorService);
		// Every field of this resource reaches a service method, which is why the command bus is not among
		// the resolver's dependencies.
		expect(OrganizationVendorResolver.length).toBe(1);
	});

	it('reaches the module that provides the guard, without importing the one the gate resolves through', () => {
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, OrganizationVendorModule) ??
			[]) as Array<{ forwardRef?: () => unknown }>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(resolved.map((entry) => (entry as { name?: string })?.name)).toContain('RolePermissionModule');
		expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, FeatureModule)).toBe(true);
		expect(resolved).not.toContain(FeatureModule);
	});
});
