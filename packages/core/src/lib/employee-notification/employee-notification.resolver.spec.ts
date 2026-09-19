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
import { BaseEntityEnum, EmployeeNotificationTypeEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EmployeeNotificationController } from './employee-notification.controller';
import { EmployeeNotificationModule } from './employee-notification.module';
import { EmployeeNotificationResolver } from './employee-notification.resolver';
import { EmployeeNotificationService } from './employee-notification.service';

/**
 * The notification inbox over GraphQL.
 *
 * The delivered REST routes serve a notification list, one notification, a count, a filing, an edit, an
 * outright removal, the withdrawal and restoration of a notification, and the mark-all write. This suite
 * pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method the REST route reaches, so a client does not choose a
 *   better surface by choosing a protocol;
 * - **the guard chain is the controller's and the permission is the controller's own empty statement**:
 *   both guards and an empty list are declared on the class and on no handler, so every field has to
 *   resolve to that same empty scope rather than to a permission no route states;
 * - the two employee relations the delivered read does not join are identifiers here and never fields,
 *   and the notification's own vocabulary is carried as its value rather than re-declared as an enum;
 * - **the mark-all write is a root field of its own and answers exactly what the service answered**,
 *   because its answer is a report rather than a row;
 * - a notification that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const SENDER = '00000000-0000-4000-8000-000000000003';
const RECEIVER = '00000000-0000-4000-8000-000000000004';
const PROJECT = '00000000-0000-4000-8000-000000000005';
const FIRST = '00000000-0000-4000-8000-000000000050';
const SECOND = '00000000-0000-4000-8000-000000000051';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		title: 'Assigned to you',
		message: 'You were assigned the launch checklist',
		type: 'Assignment',
		isRead: false,
		readAt: null,
		onHoldUntil: null,
		sentByEmployeeId: SENDER,
		receiverEmployeeId: RECEIVER,
		entity: 'OrganizationProject',
		entityId: PROJECT,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		title: 'Payment received',
		message: 'Your invoice was paid',
		type: 'Payment',
		isRead: true,
		readAt: new Date('2026-03-02T10:00:00.000Z'),
		onHoldUntil: null,
		sentByEmployeeId: null,
		receiverEmployeeId: RECEIVER,
		entity: 'Invoice',
		entityId: PROJECT,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	}
];

/**
 * What the mark-all write answers: a report about the write, not a row.
 *
 * The object is stated once and the suite asserts the field answers this very object, so a resolver that
 * rebuilt an equal-looking report of its own would be caught rather than passed.
 */
const MARK_ALL_ANSWER = { success: true, count: ROWS.length };

/** The resolver, over a scripted service. */
function surfaces() {
	const employeeNotificationService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		markAllAsRead: jest.fn().mockResolvedValue(MARK_ALL_ANSWER),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: null })
	};

	return {
		employeeNotificationService,
		resolver: new EmployeeNotificationResolver(employeeNotificationService as never)
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

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/**
 * The root fields this domain contributes.
 *
 * Ownership is stated rather than pattern-matched loosely: the sibling notification-settings resource
 * also spells `employeeNotification`, and its fields belong to that surface rather than this one, so
 * anything naming a setting is left to its own suite.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => /employeeNotification/i.test(field) && !/setting/i.test(field))
		.sort();
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/** The members of one object type, or the members of one input type, as the schema declares them. */
function declaredFields(name: string): string[] {
	const type = schema.getType(name) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(type?.getFields() ?? {});
}

/** The values of one enum, in the order the schema declares them. */
function enumValues(name: string): string[] {
	const type = schema.getType(name) as { getValues(): readonly { name: string }[] } | undefined;

	return (type?.getValues() ?? []).map((value) => value.name);
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type, so a member it must not carry can be asserted absent. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of the controller, as functions, inherited ones included. */
function handlersOf(controller: typeof EmployeeNotificationController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EmployeeNotificationController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EmployeeNotificationController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof EmployeeNotificationResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeNotificationResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeNotificationResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', EmployeeNotificationResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(EmployeeNotificationResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('EmployeeNotificationResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['employeeNotifications', 'employeeNotification', 'employeeNotificationCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'markAllEmployeeNotificationsAsRead',
				'createEmployeeNotification',
				'updateEmployeeNotification',
				'deleteEmployeeNotification',
				'softDeleteEmployeeNotification',
				'recoverEmployeeNotification'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual([
			'employeeNotification',
			'employeeNotificationCount',
			'employeeNotifications'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createEmployeeNotification',
			'deleteEmployeeNotification',
			'markAllEmployeeNotificationsAsRead',
			'recoverEmployeeNotification',
			'softDeleteEmployeeNotification',
			'updateEmployeeNotification'
		]);

		// Every field above names a handler that exists on the controller, inherited ones included —
		// including the two the list folds in and the mark-all route the CRUD base does not declare.
		for (const handler of [
			'findAll',
			'findById',
			'getCount',
			'pagination',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover',
			'markAllAsRead'
		]) {
			expect(typeof handlersOf(EmployeeNotificationController)[handler]).toBe('function');
		}
	});

	it('holds the mark-all route above the inherited update rather than instead of it', () => {
		// `PUT /mark-all-read` is declared by this controller and `PUT /:id` is inherited, so the two are
		// two routes and two capabilities: the declared one wins that literal path and the inherited one
		// still serves every other identifier. Both are mirrored, and neither replaces the other.
		expect(Object.prototype.hasOwnProperty.call(EmployeeNotificationController.prototype, 'markAllAsRead')).toBe(
			true
		);
		expect(Object.prototype.hasOwnProperty.call(EmployeeNotificationController.prototype, 'update')).toBe(false);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EmployeeNotificationConnection \{\s*nodes: \[EmployeeNotification!\]!\s*edges: \[EmployeeNotificationEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type EmployeeNotificationEdge \{\s*node: EmployeeNotification!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input EmployeeNotificationFilter \{/);
		expect(printed).toMatch(/input EmployeeNotificationSort \{/);
		expect(printed).toMatch(
			/enum EmployeeNotificationSortField \{\s*createdAt\s*updatedAt\s*readAt\s*onHoldUntil\s*isRead\s*title\s*type\s*\}/
		);
	});

	it('answers the count through a nullable field of its own and takes no argument it cannot honour', () => {
		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the count
		// route counts the caller's own rows. Nullable, because an aggregate the resource has no answer
		// for must not be answered as a zero.
		expect(printed).toMatch(/employeeNotificationCount: Int\n/);
		expect(printed).not.toMatch(/employeeNotificationCount: Int!/);
		expect(fieldArgs('Query', 'employeeNotificationCount')).toEqual([]);
		expect(fieldArgs('Query', 'employeeNotifications')).toEqual([
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

	it('offers the node query as a nullable field, because a row can be missing', () => {
		expect(printed).toMatch(/employeeNotification\(id: ID!\): EmployeeNotification\n/);
		// The list, by contrast, is never absent: an empty page is a connection with no nodes.
		expect(printed).toMatch(/employeeNotifications\([\s\S]*?\): EmployeeNotificationConnection!\n/);
	});

	it('declares the mark-all answer as a type of its own rather than as a row', () => {
		expect(printed).toMatch(/markAllEmployeeNotificationsAsRead: EmployeeNotificationMarkAllAsReadResult!\n/);
		expect(declaredFields('EmployeeNotificationMarkAllAsReadResult')).toEqual(['success', 'count']);
		// The write reports what it did; a resource projection here would be a second answer to a
		// question the inbox already answers, and a row identity the write does not have.
		const body = typeBody('EmployeeNotificationMarkAllAsReadResult');
		expect(body).toMatch(/success: Boolean!/);
		expect(body).toMatch(/count: Int!/);
		expect(body).not.toMatch(/\bid:/);
	});

	it('carries the identifiers of the two employee relations, and no relation object', () => {
		const body = typeBody('EmployeeNotification');

		// The delivered list read names no `relations`, so neither relation is ever joined on the rows
		// this surface answers: a member for either would be absent on every row answered here.
		expect(body).not.toContain('sentByEmployee:');
		expect(body).not.toContain('receiverEmployee:');
		// What always travels is the foreign key.
		expect(body).toMatch(/sentByEmployeeId: ID/);
		expect(body).toMatch(/receiverEmployeeId: ID/);
		// The withdrawal columns are carried because the two lifecycle routes write exactly them: without
		// `deletedAt` the answer to the write that withdrew a row could not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('carries the notification vocabulary as its value rather than re-declaring the enum', () => {
		const body = typeBody('EmployeeNotification');

		// The column stores the vocabulary's value through its transformer, and the vocabulary belongs to
		// the model the platform ships: a second declaration here could diverge from the column's.
		expect(body).toMatch(/type: String/);
		expect(printed).not.toContain('EmployeeNotificationTypeEnum');
		expect(printed).not.toMatch(/enum EmployeeNotificationType\b/);
	});

	it('declares the write inputs the two write mutations take', () => {
		expect(printed).toMatch(/input CreateEmployeeNotificationInput \{/);
		expect(printed).toMatch(/input UpdateEmployeeNotificationInput \{/);

		// The filing states who receives the notification; the edit cannot, because the two employee
		// relations are fixed when a notification is filed.
		expect(inputBody('CreateEmployeeNotificationInput')).toMatch(/receiverEmployeeId: ID/);
		expect(inputBody('CreateEmployeeNotificationInput')).toMatch(/sentByEmployeeId: ID/);
		expect(inputBody('UpdateEmployeeNotificationInput')).not.toMatch(/receiverEmployeeId/);
		expect(inputBody('UpdateEmployeeNotificationInput')).not.toMatch(/sentByEmployeeId/);
		expect(inputBody('UpdateEmployeeNotificationInput')).toMatch(/id: ID!/);

		// The read state is written by the platform when a notification is read, never by the caller
		// filing one: the delivered create takes the payload minus those two columns.
		expect(inputBody('CreateEmployeeNotificationInput')).not.toMatch(/\bisRead:/);
		expect(inputBody('CreateEmployeeNotificationInput')).not.toMatch(/\breadAt:/);
		// The edit does set it — that is how an inbox marks one notification read — and the delivered
		// update input type carries both members.
		expect(inputBody('UpdateEmployeeNotificationInput')).toMatch(/\bisRead: Boolean/);
		expect(inputBody('UpdateEmployeeNotificationInput')).toMatch(/\breadAt: DateTime/);
	});

	it('declares exactly the filterable fields and exactly the sortable ones, and no others', () => {
		// The list below is the resolver's own `EMPLOYEE_NOTIFICATION_FILTERABLE` map and
		// `EMPLOYEE_NOTIFICATION_SORTABLE` list, restated here as the assertion: the three have to agree,
		// and a member added to one of them alone fails here. The suite then holds the map itself by
		// asking the connection to evaluate every declared member below.
		expect(declaredFields('EmployeeNotificationFilter')).toEqual([
			'id',
			'title',
			'message',
			'type',
			'isRead',
			'readAt',
			'onHoldUntil',
			'sentByEmployeeId',
			'receiverEmployeeId',
			'entity',
			'entityId',
			'tenantId',
			'organizationId',
			'isActive',
			'isArchived',
			'createdAt',
			'updatedAt',
			'and',
			'or',
			'not'
		]);
		expect(enumValues('EmployeeNotificationSortField')).toEqual([
			'createdAt',
			'updatedAt',
			'readAt',
			'onHoldUntil',
			'isRead',
			'title',
			'type'
		]);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/employeeNotifications\([^)]*withDeleted/);
		// `GET /:id` binds the list route's query string; the relation members it can add are not carried
		// by this surface's type, so no argument here promises one.
		expect(fieldArgs('Query', 'employeeNotification')).toEqual(['id']);
	});
});

describe('EmployeeNotificationResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, employeeNotificationService } = surfaces();

		const connection = await resolver.employeeNotifications(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults: no `where` and
		// no `relations`.
		expect(employeeNotificationService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SECOND);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.employeeNotifications();

		// The delivered read states no order of its own, so the connection's default is the one it means:
		// `createdAt` descending, with the identifier breaking a tie.
		expect(connection.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);
	});

	it('narrows by every field the filter declares, and the filter is the one the schema states', async () => {
		const { resolver } = surfaces();

		const byType = await resolver.employeeNotifications({ type: { eq: 'Payment' } });
		expect(byType.nodes.map((node) => node.id)).toEqual([SECOND]);

		const unread = await resolver.employeeNotifications({ isRead: { eq: false } });
		expect(unread.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byReceiver = await resolver.employeeNotifications({ receiverEmployeeId: { eq: RECEIVER } });
		expect(byReceiver.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);

		const neverRead = await resolver.employeeNotifications({ readAt: { isNull: true } });
		expect(neverRead.nodes.map((node) => node.id)).toEqual([FIRST]);

		// Every member the input declares is one the evaluator knows: a field declared in the SDL and
		// absent from the resolver's map is exactly the drift the three declarations exist to prevent.
		for (const field of declaredFields('EmployeeNotificationFilter')) {
			if (['and', 'or', 'not'].includes(field)) {
				continue;
			}

			await expect(resolver.employeeNotifications({ [field]: { isNull: false } })).resolves.toBeDefined();
		}
	});

	it('refuses a filter field the resource does not declare, even one the type carries', async () => {
		const { resolver } = surfaces();

		// `archivedAt` is a column of the row and a member of the object type, and it is deliberately not
		// a filter member: the map is what the evaluator knows, and the refusal names it.
		const error = await resolver.employeeNotifications({ archivedAt: { isNull: true } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
		// A relation is not a filter path either, for the same reason it is not a member of the type.
		const relation = await resolver.employeeNotifications({ receiverEmployee: { eq: RECEIVER } }).catch((thrown) => thrown);
		expect(isRefusal(relation)).toBe(true);
		expect((relation as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by every key the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byTitle = await resolver.employeeNotifications(undefined, [{ field: 'title', direction: 'ASC' }]);
		expect(byTitle.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);

		const byReadAt = await resolver.employeeNotifications(undefined, [{ field: 'readAt', direction: 'DESC' }]);
		// An absent value is the largest value, which is the platform's own placement rule: descending,
		// the notifications that were never read come first, ahead of every present instant.
		expect(byReadAt.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);

		for (const field of enumValues('EmployeeNotificationSortField')) {
			await expect(
				resolver.employeeNotifications(undefined, [{ field, direction: 'ASC' }])
			).resolves.toBeDefined();
		}
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.employeeNotifications(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([SECOND]);

		const second = await resolver.employeeNotifications(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.employeeNotifications(undefined, undefined, undefined, 20);
		const last = await resolver.employeeNotifications(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// `message` is filterable and not sortable: the two declarations are separate, and this is what
		// says so rather than a comment claiming it.
		const error = await resolver
			.employeeNotifications(undefined, [{ field: 'message', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employeeNotifications(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('EmployeeNotificationResolver — one concept, two protocols, the same operations', () => {
	it('reads the list through the same service method the REST route calls, with the route’s own defaults', async () => {
		const { resolver, employeeNotificationService } = surfaces();

		const connection = await resolver.employeeNotifications();

		expect(employeeNotificationService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(ROWS.length);
	});

	it('reads one notification through the same service method the REST route calls', async () => {
		const { resolver, employeeNotificationService } = surfaces();

		expect(await resolver.employeeNotification(FIRST)).toBe(ROWS[0]);
		expect(employeeNotificationService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a notification that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, employeeNotificationService } = surfaces();
		employeeNotificationService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.employeeNotification(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, employeeNotificationService } = surfaces();

		expect(await resolver.employeeNotificationCount()).toBe(ROWS.length);
		expect(employeeNotificationService.countBy).toHaveBeenCalledWith();
	});

	it('reports the mark-all write through the same service method the route calls, with no receiver argument', async () => {
		const { resolver, employeeNotificationService } = surfaces();

		const answer = await resolver.markAllEmployeeNotificationsAsRead();

		// The receiver is the caller's own employee record and the service reads it from the credential:
		// an argument here would let a caller mark somebody else's inbox read.
		expect(employeeNotificationService.markAllAsRead).toHaveBeenCalledWith();
		// The field answers exactly what the service answered — the same object, not a rebuilt copy of
		// it — because the answer is a report rather than a row this surface could project.
		expect(answer).toBe(MARK_ALL_ANSWER);
		expect(Object.keys(answer).sort()).toEqual(['count', 'success']);
	});

	it('files a notification through the same service method the REST route calls', async () => {
		const { resolver, employeeNotificationService } = surfaces();
		const input = {
			title: 'Assigned to you',
			type: EmployeeNotificationTypeEnum.ASSIGNMENT,
			entity: BaseEntityEnum.OrganizationProject,
			entityId: PROJECT,
			organizationId: ORGANIZATION,
			receiverEmployeeId: RECEIVER,
			sentByEmployeeId: SENDER
		};

		expect(await resolver.createEmployeeNotification(input)).toBe(ROWS[0]);
		expect(employeeNotificationService.create).toHaveBeenCalledWith(input);
	});

	it('answers the delivered service’s own silence when the receiver has switched the kind off', async () => {
		const { resolver, employeeNotificationService } = surfaces();
		employeeNotificationService.create.mockResolvedValueOnce(undefined);

		// The service consults the receiver's settings and declines the write rather than raising: the
		// field states that plainly, and this pins that nothing is invented to carry it.
		expect(
			await resolver.createEmployeeNotification({
				entity: BaseEntityEnum.OrganizationProject,
				entityId: PROJECT,
				organizationId: ORGANIZATION,
				receiverEmployeeId: RECEIVER,
				type: EmployeeNotificationTypeEnum.ASSIGNMENT
			})
		).toBeUndefined();
	});

	it('edits a notification through the same service method the REST route calls, and reads the row back', async () => {
		const { resolver, employeeNotificationService } = surfaces();
		const input = {
			id: FIRST,
			entity: BaseEntityEnum.OrganizationProject,
			entityId: PROJECT,
			organizationId: ORGANIZATION,
			isRead: true
		};

		expect(await resolver.updateEmployeeNotification(input)).toBe(ROWS[0]);
		// The identifier travels where the delivered route carries it: the path, which the service reads
		// its row by before it writes.
		expect(employeeNotificationService.update).toHaveBeenCalledWith(FIRST, input);
		// The write answers the store's update result, so the row is read back through the read the node
		// field performs.
		expect(employeeNotificationService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('removes a notification through the same service method the REST route calls', async () => {
		const { resolver, employeeNotificationService } = surfaces();

		expect(await resolver.deleteEmployeeNotification(FIRST)).toBe(true);
		expect(employeeNotificationService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores a notification through the same service methods the REST routes call', async () => {
		const { resolver, employeeNotificationService } = surfaces();

		const withdrawn = await resolver.softDeleteEmployeeNotification(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(employeeNotificationService.softRemove).toHaveBeenCalledWith(FIRST);

		const restored = await resolver.recoverEmployeeNotification(FIRST);
		expect(restored.deletedAt).toBeNull();
		expect(employeeNotificationService.softRecover).toHaveBeenCalledWith(FIRST);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, employeeNotificationService } = surfaces();
		const refusal = new Error('EMPLOYEE_NOTIFICATION_IMMUTABLE: a filed notification cannot be re-addressed.');

		employeeNotificationService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteEmployeeNotification(FIRST)).rejects.toBe(refusal);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard chain and the permission of a field are
 * read from the field and from the route's own metadata and compared, rather than restated here: a table
 * of permission names would agree with the resolver while disagreeing with the controller, which is the
 * failure this half of the doctrine exists to catch.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'employeeNotifications', route: 'findAll' },
	{ field: 'employeeNotification', route: 'findById' },
	{ field: 'employeeNotificationCount', route: 'getCount' },
	{ field: 'markAllEmployeeNotificationsAsRead', route: 'markAllAsRead' },
	{ field: 'createEmployeeNotification', route: 'create' },
	{ field: 'updateEmployeeNotification', route: 'update' },
	{ field: 'deleteEmployeeNotification', route: 'delete' },
	{ field: 'softDeleteEmployeeNotification', route: 'softRemove' },
	{ field: 'recoverEmployeeNotification', route: 'softRecover' }
];

describe('EmployeeNotificationResolver — the guard stack and the permission are the controller’s', () => {
	it('states on the class the two guards the controller states on the class', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', EmployeeNotificationController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', EmployeeNotificationResolver) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The gate is the one addition, and it is on the class so every field below is behind it.
		expect(resolverGuards).toContain(FeatureFlagGuard);
	});

	it('states the controller’s empty permission on the class, which is a statement and not an omission', () => {
		// Both guards read this list and an empty one means "no permission required". An absent list would
		// read the same way to them and differently to a reviewer, which is why it is asserted to be an
		// empty array rather than merely falsy.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeNotificationController)).toEqual([]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeNotificationResolver)).toEqual([]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeNotificationResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeNotificationController)
		);
	});

	it('leaves every handler to the class, which is what makes the empty statement the whole scope', () => {
		// No route of this resource narrows or widens what the class states: none of them carries a
		// permission or a guard of its own, inherited ones included.
		for (const route of [
			'findAll',
			'findById',
			'getCount',
			'pagination',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover',
			'markAllAsRead'
		]) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EmployeeNotificationController)[route])).toBeUndefined();
			expect(Reflect.getMetadata('__guards__', handlersOf(EmployeeNotificationController)[route])).toBeUndefined();
		}
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', EmployeeNotificationResolver) ?? [];

		for (const route of [
			'findAll',
			'findById',
			'getCount',
			'pagination',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover',
			'markAllAsRead'
		]) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow
			// REST below GraphQL and is caught here. `pagination` has no root field of its own — it folds
			// into the connection — and it is held to the same chain as the route whose field mirrors it.
			expect([...guardsOfRoute(EmployeeNotificationController, route), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(EmployeeNotificationController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(EmployeeNotificationController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(EmployeeNotificationController, route));
	});

	it('resolves every field to the empty list, so no field is narrower than its route', () => {
		// This is the assertion the controller's empty statement exists for: a field that demanded a
		// permission no route of this resource states would make GraphQL the narrower door, and it would
		// look correct in the resolver while disagreeing with the controller.
		for (const { field } of ROUTE_PARITY) {
			expect(permissionOfField(field)).toEqual([]);
			expect(permissionOfField(field)).toEqual(permissionOfRoute(EmployeeNotificationController, 'findAll'));
		}
	});
});

describe('EmployeeNotificationModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EmployeeNotificationModule) ?? []) as unknown[];

		expect(providers).toContain(EmployeeNotificationResolver);
		expect(providers).toContain(EmployeeNotificationService);
	});

	it('exports the service the resolver injects, which is the whole of what it injects', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EmployeeNotificationModule) ?? []) as unknown[];

		expect(exported).toContain(EmployeeNotificationService);
		// The resolver's dependencies are asserted rather than assumed: a resolver is an ordinary
		// provider, so a dependency this module creates beside the service would have to be handed on.
		expect(Reflect.getMetadata('design:paramtypes', EmployeeNotificationResolver)).toEqual([
			EmployeeNotificationService
		]);
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
		getHandler: () => (EmployeeNotificationResolver.prototype as never)[field],
		getClass: () => EmployeeNotificationResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EmployeeNotificationResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it — including the ones that state no guard of their own, which is
		// what makes the gate the whole of their scope.
		expect(Reflect.getMetadata(FEATURE_METADATA, EmployeeNotificationResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EmployeeNotificationResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a read whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('employeeNotifications')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('employeeNotifications');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the mark-all write as well, which is what keeps the gate over the writes too', async () => {
		const { guard } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('markAllEmployeeNotificationsAsRead'))
			.catch((thrown) => thrown);

		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('markAllEmployeeNotificationsAsRead');
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('employeeNotifications'))).resolves.toBe(true);
	});
});
