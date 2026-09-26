/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { buildSchema, printSchema } from 'graphql';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ContactController } from './contact.controller';
import { ContactModule } from './contact.module';
import { ContactResolver } from './contact.resolver';
import { ContactService } from './contact.service';

/**
 * The customer record over GraphQL.
 *
 * The delivered REST routes serve a contact list, one contact, the count, the creation, the edit,
 * the removal, the soft removal and the recovery — the eight capabilities this controller is mounted
 * with, since it declares one route of its own and inherits the rest from the CRUD base. This suite
 * pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST
 *   resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method the REST route reaches, so a client does not choose
 *   a better surface by choosing a protocol;
 * - **the guard is the controller's guard and no permission is stated**, because the delivered
 *   controller states none on any of its routes: a resolver that demanded one would refuse a caller
 *   the REST route serves;
 * - a contact that is not there is `null` on the one-row field rather than a refusal, and the edit
 *   reads the row back because the delivered route answers the store's update result and not a row;
 * - **no relation is a field and none is a filter.** The three links this row takes part in are
 *   declared on the other side of a 1:1, so no identifier for one of them travels with a contact
 *   row; the type carries what always travels and the party is reached from the row that owns the
 *   foreign key.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CONTACT = '00000000-0000-4000-8000-000000000040';
const OTHER_CONTACT = '00000000-0000-4000-8000-000000000041';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: CONTACT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Ada Lovelace',
		firstName: 'Ada',
		lastName: 'Lovelace',
		country: 'GB',
		city: 'London',
		address: '12 Analytical Engine Way',
		postcode: 'EC1A 1BB',
		latitude: 51.501,
		longitude: -0.141,
		isActive: true,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_CONTACT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Grace Hopper',
		firstName: 'Grace',
		lastName: 'Hopper',
		country: 'US',
		city: 'Arlington',
		address: '1 Compiler Lane',
		postcode: '22201',
		latitude: 38.881,
		longitude: -77.105,
		isActive: true,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const contactService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: null })
	};

	return { contactService, resolver: new ContactResolver(contactService as never) };
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
 * The composed schema, as text: the domain's own documents plus the kernel's, exactly the set the
 * boot loader globs and the composition pass asserts.
 */
function composedSchema(): string {
	const directories = [join(__dirname, 'schema'), join(__dirname, '..', 'graphql', 'schema')];

	const documents = directories.flatMap((directory) =>
		readdirSync(directory)
			.filter((name) => name.endsWith('.gql'))
			.map((name) => readFileSync(join(directory, name), 'utf8'))
	);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The members of one object type this schema declares, as a client reads them. */
function objectFields(name: string): string[] {
	const type = schema.getType(name) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(type?.getFields() ?? {});
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/** The handlers of the controller, as functions, inherited ones included. */
function handlersOf(controller: typeof ContactController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so a field is held to its own route's metadata rather than to
 * a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof ContactController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof ContactController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof ContactResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(ContactResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, ContactResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', ContactResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(ContactResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('ContactResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the contact connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['contacts', 'contact', 'contactCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createContact',
				'updateContact',
				'deleteContact',
				'softDeleteContact',
				'recoverContact'
			])
		);
	});

	it('declares no bulk mutation and no by-address query, because no route serves one', () => {
		// The specification's row names `bulkCreateContacts` and `contactByEmail`; this controller serves
		// neither, and a field with no capability behind it is a promise rather than a surface.
		expect(rootFields('Mutation')).not.toEqual(expect.arrayContaining(['bulkCreateContacts']));
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['contactByEmail']));
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(
			/type ContactConnection \{\s*nodes: \[Contact!\]!\s*edges: \[ContactEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ContactEdge \{\s*node: Contact!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ContactFilter \{/);
		expect(printed).toMatch(/input ContactSort \{/);
		expect(printed).toMatch(/enum ContactSortField \{/);
	});

	it('declares the write inputs the two write mutations take', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(/input CreateContactInput \{/);
		expect(printed).toMatch(/input UpdateContactInput \{/);
		expect(printed).toMatch(/id: ID!\n/);
	});

	it('answers the count through a field of its own and the paginated list through the connection', () => {
		const printed = printSchema(schema);

		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the
		// inherited count route counts the caller's own rows. So the count is a root field — nullable,
		// because an aggregate the resource has no answer for must not be answered as a zero — and it
		// takes no argument, the route's narrowing being a `where` fragment no schema can state.
		expect(printed).toMatch(/contactCount: Int\n/);
		expect(printed).not.toMatch(/contactCount: Int!/);
		expect(fieldArgs('Query', 'contactCount')).toEqual([]);

		// `GET /pagination` is the same rows the list route answers, sliced: the page is what the
		// connection answers with, so a second field for it would be a second surface that could
		// disagree with this one.
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['contactsPagination']));
		expect(fieldArgs('Query', 'contacts')).toEqual([
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset',
			'withDeleted',
		]);
	});

	it('offers no argument it cannot honour', () => {
		// The read hands its options to `findAll`, which carries `withDeleted` to the store on both dialects, so the connection offers it — the same visibility the REST list route inherits from `BaseQueryDTO`.
		expect(printSchema(schema)).toMatch(/contacts\([^)]*withDeleted/);
	});
});

describe('ContactResolver — the type carries what always travels, and no relation', () => {
	it('carries the entity’s own members', () => {
		expect(objectFields('Contact')).toEqual(
			expect.arrayContaining([
				'id',
				'tenantId',
				'organizationId',
				'name',
				'firstName',
				'lastName',
				'country',
				'city',
				'address',
				'address2',
				'postcode',
				'latitude',
				'longitude',
				'regionCode',
				'fax',
				'fiscalInformation',
				'website',
				'isActive',
				'createdAt',
				'updatedAt',
				'deletedAt'
			])
		);
	});

	it('declares no relation field, because no identifier for one travels with this row', () => {
		// All three links are declared on the other side of a 1:1 — this table holds no foreign key for
		// any of them — and the delivered read joins none of them, so a field here would answer null on
		// every row this surface serves.
		expect(objectFields('Contact')).not.toEqual(
			expect.arrayContaining(['organizationContact', 'employee', 'candidate'])
		);
		expect(printSchema(schema)).not.toMatch(/organizationContact: OrganizationContact/);
	});

	it('declares no relation filter either, for the same reason', async () => {
		const { resolver } = surfaces();

		const error = await resolver.contacts({ organizationContact: { eq: CONTACT } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('carries the coordinate pair as `Float` and no money member at all', () => {
		const printed = printSchema(schema);

		// Coordinates are not amounts, which is the one thing that makes a `Float` right here: every
		// money value in this schema is a `Decimal`, and this resource carries none.
		expect(printed).toMatch(/latitude: Float/);
		expect(printed).toMatch(/longitude: Float/);
		expect(printed).not.toMatch(/latitude: Decimal/);
	});
});

describe('ContactResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, contactService } = surfaces();

		const connection = await resolver.contacts(undefined, undefined, undefined, 20);

		expect(contactService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(CONTACT);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.contacts({ name: { ilike: 'grace%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([OTHER_CONTACT]);

		const byCity = await resolver.contacts({ city: { eq: 'London' } });
		expect(byCity.nodes.map((node) => node.id)).toEqual([CONTACT]);
	});

	it('orders by the keys the sort enum offers, newest first by default', async () => {
		const { resolver } = surfaces();

		const byDefault = await resolver.contacts(undefined, undefined, undefined, 20);
		expect(byDefault.nodes.map((node) => node.id)).toEqual([CONTACT, OTHER_CONTACT]);

		const descending = await resolver.contacts(undefined, [{ field: 'name', direction: 'DESC' }]);
		expect(descending.nodes.map((node) => node.id)).toEqual([OTHER_CONTACT, CONTACT]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.contacts(undefined, undefined, undefined, 1);

		const second = await resolver.contacts(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER_CONTACT]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.contacts(undefined, [{ field: 'fiscalInformation', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.contacts(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every row', async () => {
		const { resolver } = surfaces();

		const error = await resolver.contacts(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('ContactResolver — one concept, two protocols, the same operations', () => {
	it('reads one contact through the same service method the REST route calls', async () => {
		const { resolver, contactService } = surfaces();

		expect(await resolver.contact(CONTACT)).toBe(ROWS[0]);
		expect(contactService.findOneByIdString).toHaveBeenCalledWith(CONTACT);
	});

	it('answers null for a contact that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, contactService } = surfaces();
		contactService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.contact(OTHER_CONTACT)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, contactService } = surfaces();

		expect(await resolver.contactCount()).toBe(2);
		// The inherited route hands `countBy` the `where` fragment it bound from its query string and
		// asks for no narrowing of its own when the caller states none — which is the call this field
		// makes, because the connection protocol has no argument that fragment could arrive in.
		expect(contactService.countBy).toHaveBeenCalledWith();
	});

	it('records a contact through the same service method the REST route calls', async () => {
		const { resolver, contactService } = surfaces();

		await resolver.createContact({
			organizationId: ORGANIZATION,
			name: 'Ada Lovelace',
			firstName: 'Ada',
			lastName: 'Lovelace',
			city: 'London',
			latitude: 51.501,
			longitude: -0.141
		});

		// The tenant is the credential's and is stamped by the service, so a caller states which
		// organization the row is filed under and never which tenant it is written into.
		expect(contactService.create).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			name: 'Ada Lovelace',
			firstName: 'Ada',
			lastName: 'Lovelace',
			city: 'London',
			latitude: 51.501,
			longitude: -0.141
		});
	});

	it('edits through the same service method the REST route calls, with the identifier as the criterion', async () => {
		const { resolver, contactService } = surfaces();

		await resolver.updateContact({ id: CONTACT, city: 'Cambridge' });

		// The identifier is the criterion and is not repeated in the payload, which is the shape the
		// route itself has, and a member the caller leaves out is left as it is.
		expect(contactService.update).toHaveBeenCalledWith(CONTACT, { city: 'Cambridge' });
		// The row the write produced is read back, because the delivered route answers the store's own
		// update result rather than a row.
		expect(contactService.findOneByIdString).toHaveBeenCalledWith(CONTACT);
	});

	it('relies on the delivered write before the read back, so a missing contact is a miss rather than a write', async () => {
		const { resolver, contactService } = surfaces();
		contactService.update.mockRejectedValueOnce(new NotFoundException());

		await expect(resolver.updateContact({ id: OTHER_CONTACT, city: 'x' })).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(contactService.findOneByIdString).not.toHaveBeenCalled();
	});

	it('removes a contact through the same service method the REST route calls', async () => {
		const { resolver, contactService } = surfaces();

		expect(await resolver.deleteContact(CONTACT)).toBe(true);
		expect(contactService.delete).toHaveBeenCalledWith(CONTACT);
	});

	it('withdraws a contact softly and puts it back through the same two service methods', async () => {
		const { resolver, contactService } = surfaces();

		const withdrawn = await resolver.softDeleteContact(CONTACT);
		expect(contactService.softRemove).toHaveBeenCalledWith(CONTACT);
		expect(withdrawn.id).toBe(CONTACT);

		const restored = await resolver.recoverContact(CONTACT);
		expect(contactService.softRecover).toHaveBeenCalledWith(CONTACT);
		expect(restored.id).toBe(CONTACT);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, contactService } = surfaces();
		const refusal = new Error('CONTACT_IN_USE: this contact still backs a live party.');

		contactService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteContact(CONTACT)).rejects.toBe(refusal);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard chain and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here:
 * a table of permission names would agree with the resolver while disagreeing with the controller,
 * which is the failure this half of the doctrine exists to catch.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'contacts', route: 'findAll' },
	{ field: 'contact', route: 'findById' },
	{ field: 'contactCount', route: 'getCount' },
	{ field: 'createContact', route: 'create' },
	{ field: 'updateContact', route: 'update' },
	{ field: 'deleteContact', route: 'delete' },
	{ field: 'softDeleteContact', route: 'softRemove' },
	{ field: 'recoverContact', route: 'softRecover' }
];

describe('ContactResolver — the guard stack is the controller’s, field by field', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ContactResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ContactController) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		// The controller states no route-level permission on any of its routes, so neither surface
		// carries the permission guard: two scopes for one concept is what the two-protocol rule
		// forbids, and a permission here would refuse a caller the REST route serves.
		expect(controllerGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
		expect(resolverGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
	});

	it('states no permission on the resolver and none on the controller', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ContactResolver)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ContactController)).toBeUndefined();

		for (const { field } of ROUTE_PARITY) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(ContactResolver)[field])).toBeUndefined();
			expect(permissionOfField(field)).toBeUndefined();
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(ContactController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(ContactController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(ContactController, route));
	});

	it('holds the two lifecycle fields to the inherited routes they mirror', () => {
		// The soft removal and the recovery are inherited from the CRUD base, where the controller's
		// tenant guard is the whole of their scope. They are real routes of this resource — an override
		// would be needed to remove them, and none is declared — so they are mirrored rather than left
		// out, and they carry no permission because their routes carry none.
		for (const [field, route] of [
			['softDeleteContact', 'softRemove'],
			['recoverContact', 'softRecover']
		] as ReadonlyArray<[string, string]>) {
			expect(typeof handlersOf(ContactController)[route]).toBe('function');
			expect(Reflect.getMetadata('__guards__', handlersOf(ContactController)[route])).toBeUndefined();
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(ContactController)[route])).toBeUndefined();
			expect(Reflect.getMetadata('__guards__', fieldsOf(ContactResolver)[field])).toBeUndefined();
		}
	});
});

describe('ContactModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ContactModule) ?? []) as unknown[];

		expect(providers).toContain(ContactResolver);
		expect(providers).toContain(ContactService);
	});

	it('exports the service the resolver injects', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, ContactModule) ?? []) as unknown[];

		expect(exported).toContain(ContactService);
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller’s scope.
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
		getHandler: () => (ContactResolver.prototype as never)[field],
		getClass: () => ContactResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ContactResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, ContactResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ContactResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('contacts')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('contacts');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('contacts'))).resolves.toBe(true);
	});
});
