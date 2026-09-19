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
import { CqrsModule } from '@nestjs/cqrs';
import { buildSchema, printSchema } from 'graphql';
import { ContactType, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OrganizationContactController } from './organization-contact.controller';
import { OrganizationContactModule } from './organization-contact.module';
import { OrganizationContactResolver } from './organization-contact.resolver';
import { OrganizationContactService } from './organization-contact.service';

/**
 * The party row over GraphQL.
 *
 * The delivered REST routes serve a party list, one party, the count, the parties of one employee,
 * the creation, the edit, the employee assignment, the removal, the soft removal and the recovery.
 * This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST
 *   resumes here and a refusal is the query protocol's own code;
 * - every field calls the same service method or dispatches the same command the REST route calls,
 *   with the payload the delivered handler reads, so a client does not choose a better surface by
 *   choosing a protocol;
 * - **the guard chain and the permission are the controller's, field by field** — including the
 *   fields whose routes carry no permission at all, so a resolver that demanded one would refuse a
 *   caller the REST route serves;
 * - **the relations the delivered reads do not join are identifiers and not fields**: the type
 *   carries `contactId` and `imageId`, which always travel with the row, and the collections are
 *   neither fields nor filters because the list read joins none of them;
 * - the employee look-up is a root field of its own rather than a `members` filter, because the read
 *   behind it joins the pivot the list does not and answers a projection of the row.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const PARTY = '00000000-0000-4000-8000-000000000050';
const OTHER_PARTY = '00000000-0000-4000-8000-000000000051';
const CONTACT = '00000000-0000-4000-8000-000000000040';
const EMPLOYEE = '00000000-0000-4000-8000-000000000060';
const PROJECT = '00000000-0000-4000-8000-000000000070';
const TAG = '00000000-0000-4000-8000-000000000080';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: PARTY,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Acme Trading',
		primaryEmail: 'billing@acme.test',
		contactType: ContactType.CLIENT,
		status: 'ACTIVE',
		partyKind: 'COMPANY',
		creditLimit: 5000,
		loyaltyPoints: 0,
		contactId: CONTACT,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_PARTY,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Ada Lovelace',
		primaryEmail: 'ada@example.test',
		contactType: ContactType.CUSTOMER,
		status: 'GUEST',
		partyKind: 'INDIVIDUAL',
		creditLimit: null,
		loyaltyPoints: 0,
		contactId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const organizationContactService = {
		findAllOrganizationContacts: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findById: jest.fn().mockResolvedValue(ROWS[0]),
		findByEmployee: jest.fn().mockResolvedValue([{ id: PARTY, name: 'Acme Trading', imageUrl: null }]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: null })
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		organizationContactService,
		commandBus,
		resolver: new OrganizationContactResolver(organizationContactService as never, commandBus as never)
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
function handlersOf(controller: typeof OrganizationContactController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so a field is held to its own route's metadata rather than to
 * a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof OrganizationContactController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OrganizationContactController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof OrganizationContactResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(OrganizationContactResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationContactResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', OrganizationContactResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(OrganizationContactResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('OrganizationContactResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the party connection, the one-row query, the count and the employee look-up', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'organizationContacts',
				'organizationContact',
				'organizationContactsByEmployee',
				'organizationContactCount'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createOrganizationContact',
				'updateOrganizationContact',
				'updateOrganizationContactsByEmployee',
				'deleteOrganizationContact',
				'softDeleteOrganizationContact',
				'recoverOrganizationContact'
			])
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(
			/type OrganizationContactConnection \{\s*nodes: \[OrganizationContact!\]!\s*edges: \[OrganizationContactEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type OrganizationContactEdge \{\s*node: OrganizationContact!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input OrganizationContactFilter \{/);
		expect(printed).toMatch(/input OrganizationContactSort \{/);
		expect(printed).toMatch(/enum OrganizationContactSortField \{/);
		expect(printed).toMatch(/enum ContactType \{/);
		expect(printed).toMatch(/input ContactTypeFilter \{/);
	});

	it('declares the write inputs the mutations take', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(/input CreateOrganizationContactInput \{/);
		expect(printed).toMatch(/input UpdateOrganizationContactInput \{/);
		expect(printed).toMatch(/input ContactDetailInput \{/);
		expect(printed).toMatch(/input UpdateOrganizationContactsByEmployeeInput \{/);
	});

	it('carries the two relation identifiers and no relation or collection field', () => {
		const fields = objectFields('OrganizationContact');

		// The identifiers are the columns this row itself carries, so they travel with every read of
		// the row. The rows beside them are joined only by the reads whose caller names them, so a field
		// for one would be absent on exactly the answers this surface serves.
		expect(fields).toEqual(expect.arrayContaining(['contactId', 'imageId']));
		expect(fields).not.toEqual(
			expect.arrayContaining(['contact', 'image', 'projects', 'invoices', 'payments', 'tags', 'members'])
		);
		expect(printSchema(schema)).not.toMatch(/contact: Contact\n/);
	});

	it('carries every amount as `Decimal` and never as `Float`', () => {
		const printed = printSchema(schema);

		for (const member of ['budget', 'creditLimit', 'creditUsed', 'loyaltyPoints']) {
			expect(printed).toMatch(new RegExp(`${member}: Decimal`));
			expect(printed).not.toMatch(new RegExp(`${member}: Float`));
		}
	});

	it('answers the count through a field of its own and the paginated list through the connection', () => {
		const printed = printSchema(schema);

		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the count
		// route counts the caller's own rows. So the count is a root field — nullable, because an
		// aggregate the resource has no answer for must not be answered as a zero — and it takes no
		// argument, the route's narrowing being a `where` fragment no schema can state.
		expect(printed).toMatch(/organizationContactCount: Int\n/);
		expect(printed).not.toMatch(/organizationContactCount: Int!/);
		expect(fieldArgs('Query', 'organizationContactCount')).toEqual([]);

		// `GET /pagination` is the same rows the list route answers, sliced: the page is what the
		// connection answers with, so a second field for it would be a second surface that could
		// disagree with this one.
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['organizationContactsPagination']));
		expect(fieldArgs('Query', 'organizationContacts')).toEqual([
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
	});

	it('answers the parties of one employee through a root field of its own and not through a members filter', () => {
		const printed = printSchema(schema);

		// The read behind the look-up joins the member pivot and answers a three-column projection of
		// the row; the list read joins neither. A `members` filter on the connection would therefore be
		// evaluated against rows carrying no members and would select nothing at all.
		expect(printed).toMatch(
			/organizationContactsByEmployee\(employeeId: ID!, organizationId: ID!, contactType: ContactType\): \[OrganizationContact!\]!/
		);
		expect(printed).not.toMatch(/members: IDFilter/);
		expect(printed).toMatch(/contactType: ContactTypeFilter/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(printSchema(schema)).not.toMatch(/organizationContacts\([^)]*withDeleted/);
	});
});

describe('OrganizationContactResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, organizationContactService } = surfaces();

		const connection = await resolver.organizationContacts(undefined, undefined, undefined, 20);

		// The same read the list route performs, with the same absence of narrowing: the route hands the
		// service the `relations` and the `findInput` its `data` parameter carries, and this surface has
		// no query string to bind.
		expect(organizationContactService.findAllOrganizationContacts).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(PARTY);
	});

	it('narrows by the fields the filter declares, enum, decimal and text alike', async () => {
		const { resolver } = surfaces();

		const byType = await resolver.organizationContacts({ contactType: { eq: ContactType.CUSTOMER } });
		expect(byType.nodes.map((node) => node.id)).toEqual([OTHER_PARTY]);

		const byStatus = await resolver.organizationContacts({ status: { eq: 'ACTIVE' } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([PARTY]);

		const byCredit = await resolver.organizationContacts({ creditLimit: { gte: 1000 } });
		expect(byCredit.nodes.map((node) => node.id)).toEqual([PARTY]);
	});

	it('orders by the keys the sort enum offers, newest first by default', async () => {
		const { resolver } = surfaces();

		const byDefault = await resolver.organizationContacts(undefined, undefined, undefined, 20);
		expect(byDefault.nodes.map((node) => node.id)).toEqual([PARTY, OTHER_PARTY]);

		const descending = await resolver.organizationContacts(undefined, [{ field: 'name', direction: 'DESC' }]);
		expect(descending.nodes.map((node) => node.id)).toEqual([OTHER_PARTY, PARTY]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.organizationContacts(undefined, undefined, undefined, 1);

		const second = await resolver.organizationContacts(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER_PARTY]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationContacts(undefined, [{ field: 'contactId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare, a collection included', async () => {
		const { resolver } = surfaces();

		const error = await resolver.organizationContacts({ members: { eq: EMPLOYEE } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationContacts(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every row', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationContacts(undefined, undefined, undefined, 500)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('OrganizationContactResolver — one concept, two protocols, the same operations', () => {
	it('reads one party through the service method the REST node route calls, with its own default', async () => {
		const { resolver, organizationContactService } = surfaces();

		expect(await resolver.organizationContact(PARTY)).toBe(ROWS[0]);
		// The route joins the relations its `data` parameter names and none otherwise, so the field asks
		// the same read for the same empty relation list.
		expect(organizationContactService.findById).toHaveBeenCalledWith(PARTY, []);
	});

	it('answers null for a party that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, organizationContactService } = surfaces();
		organizationContactService.findById.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.organizationContact(OTHER_PARTY)).toBeNull();
	});

	it('reads the parties of one employee through the method the employee route calls, with its options', async () => {
		const { resolver, organizationContactService } = surfaces();

		const parties = await resolver.organizationContactsByEmployee(EMPLOYEE, ORGANIZATION, ContactType.CLIENT);

		expect(parties).toEqual([expect.objectContaining({ id: PARTY })]);
		// The employee is the path segment and the organization and the contact type are the query
		// parameters the read is scoped and narrowed by; the tenant comes from the credential.
		expect(organizationContactService.findByEmployee).toHaveBeenCalledWith(EMPLOYEE, {
			organizationId: ORGANIZATION,
			contactType: ContactType.CLIENT
		});

		await resolver.organizationContactsByEmployee(EMPLOYEE, ORGANIZATION);

		expect(organizationContactService.findByEmployee).toHaveBeenLastCalledWith(EMPLOYEE, {
			organizationId: ORGANIZATION,
			contactType: undefined
		});
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, organizationContactService } = surfaces();

		expect(await resolver.organizationContactCount()).toBe(2);
		// The route hands `countBy` the `where` fragment it bound from its query string and asks for no
		// narrowing of its own when the caller states none — which is the call this field makes, because
		// the connection protocol has no argument that fragment could arrive in.
		expect(organizationContactService.countBy).toHaveBeenCalledWith();
	});

	it('records a party through the command the REST route dispatches, with the members its handler reads', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createOrganizationContact({
			organizationId: ORGANIZATION,
			name: 'Acme Trading',
			primaryEmail: 'billing@acme.test',
			contactType: ContactType.CLIENT,
			budget: 10000,
			contact: { name: 'Acme Trading', city: 'London' },
			memberIds: [EMPLOYEE],
			projectIds: [PROJECT],
			tagIds: [TAG]
		});

		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		const command = commandBus.execute.mock.calls[0][0];
		expect(command.constructor.name).toBe('OrganizationContactCreateCommand');
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			name: 'Acme Trading',
			primaryEmail: 'billing@acme.test',
			contactType: ContactType.CLIENT,
			budget: 10000,
			// The detail row is stored with the party in the one call the handler makes.
			contact: { name: 'Acme Trading', city: 'London' },
			// A related row is carried as the identifier the pivot is written from, never as the row
			// beside it.
			members: [{ id: EMPLOYEE }],
			projects: [{ id: PROJECT }],
			tags: [{ id: TAG }]
		});
	});

	it('leaves a relation list the caller did not state undefined rather than empty', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createOrganizationContact({ organizationId: ORGANIZATION, name: 'Acme Trading' });

		// An empty list is the instruction to clear the book, and the handler reads "no members stated"
		// as "derive them from the projects" — a different request from saying nothing about them.
		const payload = commandBus.execute.mock.calls[0][0].input;
		expect(payload.members).toBeUndefined();
		expect(payload.projects).toBeUndefined();
		expect(payload.tags).toBeUndefined();
		expect(payload.contact).toBeUndefined();
	});

	it('edits a party through the command the REST route dispatches, naming the identifier as the route does', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateOrganizationContact({
			id: PARTY,
			organizationId: ORGANIZATION,
			name: 'Acme Trading Ltd',
			primaryPhone: '+44 20 7946 0000'
		});

		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		const command = commandBus.execute.mock.calls[0][0];
		expect(command.constructor.name).toBe('OrganizationContactUpdateCommand');
		expect(command.id).toBe(PARTY);
		// The handler reads the body's members and upserts under the command's identifier, so the
		// payload carries the facts and the identifier stays the criterion.
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			name: 'Acme Trading Ltd',
			primaryPhone: '+44 20 7946 0000'
		});
		expect(command.input.id).toBeUndefined();
	});

	it('moves parties into and out of one employee’s book through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		commandBus.execute.mockResolvedValueOnce(true);

		expect(
			await resolver.updateOrganizationContactsByEmployee({
				organizationId: ORGANIZATION,
				memberId: EMPLOYEE,
				addedEntityIds: [PARTY],
				removedEntityIds: [OTHER_PARTY]
			})
		).toBe(true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command.constructor.name).toBe('OrganizationContactEditByEmployeeCommand');
		// The employee is named by its identifier and handed over as the row that identifier names,
		// which is the shape the delivered command reads.
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			member: { id: EMPLOYEE },
			addedEntityIds: [PARTY],
			removedEntityIds: [OTHER_PARTY]
		});
	});

	it('removes a party through the same service method the REST route calls', async () => {
		const { resolver, organizationContactService } = surfaces();

		expect(await resolver.deleteOrganizationContact(PARTY)).toBe(true);
		expect(organizationContactService.delete).toHaveBeenCalledWith(PARTY);
	});

	it('withdraws a party softly and puts it back through the same two service methods', async () => {
		const { resolver, organizationContactService } = surfaces();

		const withdrawn = await resolver.softDeleteOrganizationContact(PARTY);
		expect(organizationContactService.softRemove).toHaveBeenCalledWith(PARTY);
		expect(withdrawn.id).toBe(PARTY);

		const restored = await resolver.recoverOrganizationContact(PARTY);
		expect(organizationContactService.softRecover).toHaveBeenCalledWith(PARTY);
		expect(restored.id).toBe(PARTY);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, organizationContactService } = surfaces();
		const refusal = new Error('CONTACT_REFERENCED: this party is named by a live order.');

		organizationContactService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteOrganizationContact(PARTY)).rejects.toBe(refusal);
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
	{ field: 'organizationContacts', route: 'findAll' },
	{ field: 'organizationContact', route: 'findById' },
	{ field: 'organizationContactsByEmployee', route: 'findByEmployee' },
	{ field: 'organizationContactCount', route: 'getCount' },
	{ field: 'createOrganizationContact', route: 'create' },
	{ field: 'updateOrganizationContact', route: 'update' },
	{ field: 'updateOrganizationContactsByEmployee', route: 'updateByEmployee' },
	{ field: 'deleteOrganizationContact', route: 'delete' },
	{ field: 'softDeleteOrganizationContact', route: 'softRemove' },
	{ field: 'recoverOrganizationContact', route: 'softRecover' }
];

describe('OrganizationContactResolver — the guard stack is the controller’s, field by field', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OrganizationContactResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OrganizationContactController) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		// The controller states the permission guard per route rather than on the class, so neither
		// surface demands a permission the other does not before the route's own guard runs.
		expect(controllerGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
		expect(resolverGuards).not.toEqual(expect.arrayContaining([PermissionGuard]));
	});

	it('states no permission on either class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationContactResolver)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationContactController)).toBeUndefined();
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(OrganizationContactController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(OrganizationContactController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(OrganizationContactController, route));
	});

	it('carries the read permission on the count and the edit permissions on the writes', () => {
		const proto = fieldsOf(OrganizationContactResolver);

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto['organizationContactCount'])).toEqual([
			PermissionsEnum.ORG_CONTACT_VIEW
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto['organizationContactCount'])).not.toContain(
			PermissionsEnum.ORG_CONTACT_EDIT
		);

		for (const field of ['createOrganizationContact', 'updateOrganizationContact']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[field])).toEqual([PermissionsEnum.ORG_CONTACT_EDIT]);
		}

		// The employee assignment is the employee domain's own operation and carries the permission its
		// route carries, which is not this resource's edit permission.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto['updateOrganizationContactsByEmployee'])).toEqual([
			PermissionsEnum.ORG_EMPLOYEES_EDIT
		]);
	});

	it('permits the reads and the lifecycle pair exactly as far as their routes do, and no further', () => {
		const proto = fieldsOf(OrganizationContactResolver);

		// The node read, the employee look-up and the two lifecycle moves are delivered without a
		// permission of their own — the lifecycle pair is inherited from the CRUD base, where the
		// controller's tenant guard is the whole of its scope. A resolver that demanded one here would
		// refuse a caller the REST route serves.
		for (const field of [
			'organizationContact',
			'organizationContactsByEmployee',
			'deleteOrganizationContact',
			'softDeleteOrganizationContact',
			'recoverOrganizationContact'
		]) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[field])).toBeUndefined();
			expect(Reflect.getMetadata('__guards__', proto[field])).toBeUndefined();
		}
	});

	it('answers the connection under the list route’s chain while recording the paginated route’s own permission', () => {
		// Two delivered routes fold into the one connection: the list route carries no permission and
		// the paginated route carries the read permission. The field states the list route's chain,
		// because a connection carrying the paginated route's permission would refuse a caller the list
		// route serves — the one disagreement the doctrine names as a defect. The paginated route's own
		// permission is asserted here so the asymmetry is recorded rather than hidden.
		expect(permissionOfField('organizationContacts')).toEqual(
			permissionOfRoute(OrganizationContactController, 'findAll')
		);
		expect(permissionOfField('organizationContacts')).toBeUndefined();
		expect(
			Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(OrganizationContactController)['pagination'])
		).toEqual([PermissionsEnum.ORG_CONTACT_VIEW]);
		expect(typeof handlersOf(OrganizationContactController)['pagination']).toBe('function');
	});
});

describe('OrganizationContactModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, OrganizationContactModule) ??
			[]) as unknown[];

		expect(providers).toContain(OrganizationContactResolver);
		expect(providers).toContain(OrganizationContactService);
	});

	it('exports the service and the command bus the resolver injects', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else — and the command bus is
		// imported here, not provided here, which is why it has to be exported explicitly.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, OrganizationContactModule) ?? []) as unknown[];

		expect(exported).toContain(OrganizationContactService);
		expect(exported).toContain(CqrsModule);
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
		getHandler: () => (OrganizationContactResolver.prototype as never)[field],
		getClass: () => OrganizationContactResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OrganizationContactResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationContactResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OrganizationContactResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('organizationContacts')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('organizationContacts');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('organizationContacts'))).resolves.toBe(true);
	});
});
