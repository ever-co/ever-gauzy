/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../../api/cursor';
import {
	FeatureFlagGuard,
	OrganizationPermissionGuard,
	PermissionGuard,
	TenantPermissionGuard
} from '../../shared/guards';
import { TimeSlotController } from './time-slot.controller';
import { TimeSlotModule } from './time-slot.module';
import { TimeSlotResolver } from './time-slot.resolver';
import { TimeSlotService } from './time-slot.service';
import { CreateTimeSlotCommand, DeleteTimeSlotCommand, UpdateTimeSlotCommand } from './commands';

/**
 * The time slot over GraphQL.
 *
 * The delivered REST routes serve a list, one slot, a recording, an edit and a removal that spans the
 * logs a slot covers. This suite pins the half of the two-protocol doctrine that is easy to get quietly
 * wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, with the same query DTO its route binds — reduced to the members the delivered read
 *   actually consults, so an argument the read would ignore is not offered at all;
 * - **the guard chain is the controller's, field by field, the two method-level guards included**, and
 *   every field states the permission its own route runs under rather than the class's;
 * - the type carries the row's own columns and the four members the load derives from them, and carries
 *   every relation as the identifier the row holds — the delivered list read joins the employee and
 *   selects only a projection of it, and the entity has no project column at all;
 * - a count route does not exist for this resource, so the connection's own `totalCount` is where a
 *   client reads how many slots a filter selected.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const OTHER_EMPLOYEE = '00000000-0000-4000-8000-000000000004';
const PROJECT = '00000000-0000-4000-8000-000000000005';
const SLOT = '00000000-0000-4000-8000-000000000040';
const OTHER_SLOT = '00000000-0000-4000-8000-000000000041';
const THIRD_SLOT = '00000000-0000-4000-8000-000000000042';
const ACTIVITY = '00000000-0000-4000-8000-000000000050';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them — oldest
 * first, which is the order that read states — with two of them sharing a creation instant so the
 * identifier that makes the order total is exercised rather than assumed.
 */
const ROWS = [
	{
		id: SLOT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		duration: 600,
		keyboard: 120,
		mouse: 80,
		overall: 480,
		location: 12,
		startedAt: new Date('2026-03-01T10:00:00.000Z'),
		stoppedAt: new Date('2026-03-01T10:10:00.000Z'),
		percentage: 80,
		keyboardPercentage: 20,
		mousePercentage: 13.33,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_SLOT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: OTHER_EMPLOYEE,
		duration: 300,
		keyboard: 40,
		mouse: 30,
		overall: 150,
		location: 4,
		startedAt: new Date('2026-03-01T11:00:00.000Z'),
		stoppedAt: new Date('2026-03-01T11:10:00.000Z'),
		percentage: 50,
		keyboardPercentage: 13.33,
		mousePercentage: 10,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-03-01T11:00:00.000Z'),
		updatedAt: new Date('2026-03-01T11:00:00.000Z')
	},
	{
		id: THIRD_SLOT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		duration: 120,
		keyboard: 10,
		mouse: 5,
		overall: 60,
		location: 1,
		startedAt: new Date('2026-03-01T11:20:00.000Z'),
		stoppedAt: new Date('2026-03-01T11:30:00.000Z'),
		percentage: 50,
		keyboardPercentage: 8.33,
		mousePercentage: 4.17,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-03-01T11:00:00.000Z'),
		updatedAt: new Date('2026-03-01T11:00:00.000Z')
	}
];

/** The resolver, over a scripted service and a scripted command bus. */
function surfaces() {
	const timeSlotService = {
		getTimeSlots: jest.fn().mockResolvedValue(ROWS),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		timeSlotService,
		commandBus,
		resolver: new TimeSlotResolver(timeSlotService as never, commandBus as never)
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
	const root = join(__dirname, '..', '..');
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
 * Ownership is stated by name rather than pattern-matched loosely, because the word is not this
 * domain's alone: the statistics surface declares `timeTrackingTimeSlots`, whose name ends in the same
 * concept while answering with a type of its own. What makes the assertion below a statement about
 * *this* surface rather than a list of names is the sweep beside it — every root field answering with
 * a type this domain declares is swept up and held to exactly these fields, so a second surface over
 * the same rows is caught under any name.
 */
const OWNED_QUERY_FIELDS = ['timeSlot', 'timeSlots'];

/** The mutations this domain contributes, by the same reading. */
const OWNED_MUTATION_FIELDS = ['createTimeSlot', 'deleteTimeSlots', 'updateTimeSlot'];

/** The object types this domain declares, which is how the sweep below recognises its own fields. */
const OWNED_TYPES = ['TimeSlot', 'TimeSlotConnection'];

/** The root fields of this domain, as they are actually declared. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned = operation === 'Query' ? OWNED_QUERY_FIELDS : OWNED_MUTATION_FIELDS;

	return rootFields(operation).filter((field) => owned.includes(field)).sort();
}

/** The named type one root field answers with, with any list or non-null wrapper stripped. */
function answeredTypeName(operation: 'Query' | 'Mutation', field: string): string {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { type: { ofType?: unknown; name?: string } }> }
		| undefined;
	let current = root?.getFields()?.[field]?.type;

	while (current?.ofType) {
		current = current.ofType as { ofType?: unknown; name?: string };
	}

	return current?.name ?? '';
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/** The type one root field answers with, as the schema states it. */
function fieldType(operation: 'Query' | 'Mutation', field: string): string {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { type: { toString(): string } }> }
		| undefined;

	return root?.getFields()?.[field]?.type.toString() ?? '';
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type, by the same reading. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of the controller, as functions. */
function handlersOf(controller: typeof TimeSlotController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof TimeSlotController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof TimeSlotController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof TimeSlotResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission a resolver field states itself, with no fallback to the class. */
function permissionOfField(field: string): unknown {
	return Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(TimeSlotResolver)[field]);
}

/** The guards a resolver field runs under, the class chain first and the field's own after it. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TimeSlotResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(TimeSlotResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('TimeSlotResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection and the node query', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['timeSlots', 'timeSlot']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['createTimeSlot', 'updateTimeSlot', 'deleteTimeSlots'])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual(['timeSlot', 'timeSlots']);
		expect(ownedRootFields('Mutation')).toEqual(['createTimeSlot', 'deleteTimeSlots', 'updateTimeSlot']);

		// One list is one root field: neither a paginated spelling of it nor a count of the rows it
		// selects is declared, because the connection's own `totalCount` is that count and a second
		// surface for one capability is a surface that can disagree with the first. The resource has no
		// withdrawal route and no recovery route either, so neither is declared.
		for (const spelling of [
			'timeSlotsPagination',
			'timeSlotCount',
			'timeSlotsCount',
			'timeSlotsConnection',
			'softDeleteTimeSlot',
			'recoverTimeSlot',
			'timeSlotPagination'
		]) {
			expect(rootFields('Query')).not.toContain(spelling);
			expect(rootFields('Mutation')).not.toContain(spelling);
		}

		// Every root field answering with a type this domain declares is a field of this surface, and
		// there are exactly the ones the controller serves — the removal answers with a truth value, so it
		// is held by the list above rather than by this sweep.
		expect(
			rootFields('Query')
				.filter((field) => OWNED_TYPES.includes(answeredTypeName('Query', field)))
				.sort()
		).toEqual(['timeSlot', 'timeSlots']);
		expect(
			rootFields('Mutation')
				.filter((field) => OWNED_TYPES.includes(answeredTypeName('Mutation', field)))
				.sort()
		).toEqual(['createTimeSlot', 'updateTimeSlot']);

		// Every field above names a handler that exists on the controller.
		for (const handler of ['findAll', 'findById', 'create', 'update', 'deleteTimeSlot']) {
			expect(typeof handlersOf(TimeSlotController)[handler]).toBe('function');
		}
	});

	it('declares the connection, its edges, its filter and its sort', () => {
		expect(printed).toMatch(
			/type TimeSlotConnection \{\s*nodes: \[TimeSlot!\]!\s*edges: \[TimeSlotEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type TimeSlotEdge \{\s*node: TimeSlot!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input TimeSlotFilter \{/);
		expect(printed).toMatch(/input TimeSlotSort \{/);
		expect(printed).toMatch(
			/enum TimeSlotSortField \{\s*createdAt\s*updatedAt\s*startedAt\s*duration\s*keyboard\s*mouse\s*overall\s*location\s*\}/
		);
		// The activity band the route states as percentages has an input of its own, rather than being
		// folded into the filter: the delivered read converts it into the seconds the counter is stored
		// in, which is a question a filter over the counter cannot ask.
		expect(printed).toMatch(/input TimeSlotActivityLevelInput \{/);
	});

	it('answers each field with the type its own route produces', () => {
		expect(fieldType('Query', 'timeSlots')).toBe('TimeSlotConnection!');
		expect(fieldType('Query', 'timeSlot')).toBe('TimeSlot');
		expect(fieldType('Mutation', 'createTimeSlot')).toBe('TimeSlot!');
		// The delivered edit answers nothing at all for a slot that is not there, which is a null and
		// not a refusal.
		expect(fieldType('Mutation', 'updateTimeSlot')).toBe('TimeSlot');
		// The delivered handler answers a truth value, not the store's result object the REST route's
		// signature declares.
		expect(fieldType('Mutation', 'deleteTimeSlots')).toBe('Boolean!');
	});

	it('carries the row’s own columns, with the duration in seconds and the counters as counts', () => {
		const body = typeBody('TimeSlot');

		for (const member of [
			'id: ID!',
			'duration: Int!',
			'keyboard: Int!',
			'mouse: Int!',
			'location: Int!',
			'overall: Int!',
			'startedAt: DateTime!',
			'employeeId: ID!',
			'organizationId: ID',
			'tenantId: ID',
			'createdAt: DateTime',
			'updatedAt: DateTime',
			'isActive: Boolean',
			'isArchived: Boolean',
			'deletedAt: DateTime'
		]) {
			expect(body).toMatch(new RegExp(member.replace(' ', '\\s*')));
		}

		// The unit is stated because a client cannot read it off the schema: the entity counts the column
		// in seconds, and the delivered read's own activity band confirms it — a ten-minute window is six
		// hundred seconds and the band is multiplied by six.
		expect(printed).toMatch(/The seconds this window counted\. Seconds, never money/);
		// A ratio is not money, so it is a float; an amount never is.
		expect(body).toMatch(/\bpercentage: Float\b/);
		expect(body).not.toMatch(/\bDecimal\b/);
	});

	it('carries the four derived members the load computes, and states them as derived', () => {
		const body = typeBody('TimeSlot');

		// The four are declared on the entity as virtual members and filled when a row is loaded, which
		// is why they are carried — and why the filter and the sort enum leave them out.
		for (const member of ['stoppedAt', 'percentage', 'keyboardPercentage', 'mousePercentage']) {
			expect(body).toMatch(new RegExp(`\\b${member}:`));
		}

		expect(inputBody('TimeSlotFilter')).not.toMatch(/\bstoppedAt:/);
		expect(inputBody('TimeSlotFilter')).not.toMatch(/\bpercentage:/);
		expect(printed).not.toMatch(/enum TimeSlotSortField \{[^}]*stoppedAt/);
		expect(printed).not.toMatch(/enum TimeSlotSortField \{[^}]*percentage/);
	});

	it('carries no relation object, and carries the identifier each relation reports instead', () => {
		const body = typeBody('TimeSlot');

		// Whether the type declares a field by this name. Asserted as a declaration rather than as a
		// substring, because a member of a type and a word inside another member's name are not the same
		// thing: `timeSlotMinutes` contains the characters `timeSlot` and declares nothing of the sort.
		const declares = (member: string): boolean => new RegExp(`^\\s*${member}:`, 'm').test(body);

		// The delivered list read joins the employee and the logs, and selects a projection of the
		// organization and of the employee — the identifier, and the name and image of the account behind
		// it. A partly selected row is not a row a client can read anything else from, so the relations
		// are carried as the identifiers the row itself holds.
		for (const member of [
			'employee',
			'organization',
			'timeLogs',
			'screenshots',
			'activities',
			'timeSlotMinutes',
			'timeSlotSessions',
			'tags',
			'project',
			'projectId',
			'isAllowDelete'
		]) {
			expect(declares(member)).toBe(false);
		}

		expect(declares('employeeId')).toBe(true);
		expect(declares('organizationId')).toBe(true);
	});

	it('offers no argument the delivered list read would ignore', () => {
		expect(fieldArgs('Query', 'timeSlots')).toEqual([
			'organizationId',
			'startDate',
			'endDate',
			'employeeIds',
			'projectIds',
			'source',
			'logType',
			'activityLevel',
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

		// The route's DTO declares both and the delivered read consults neither, so stating one would be
		// stating something with no effect.
		expect(fieldArgs('Query', 'timeSlots')).not.toContain('taskIds');
		expect(fieldArgs('Query', 'timeSlots')).not.toContain('teamIds');
		// The delivered read consults both, and the route's own validation drops them before the read is
		// reached: a REST caller cannot state them, so this surface does not offer them.
		expect(fieldArgs('Query', 'timeSlots')).not.toContain('syncSlots');
		expect(fieldArgs('Query', 'timeSlots')).not.toContain('onlyMe');
		// No read of this resource loads a relation, so none offers one.
		expect(fieldArgs('Query', 'timeSlots')).not.toContain('relations');
		expect(fieldArgs('Query', 'timeSlot')).toEqual(['id']);

		// The tenant is stamped from the credential by the delivered removal, so the field does not
		// promise a scope the write does not take.
		expect(fieldArgs('Mutation', 'deleteTimeSlots')).toEqual(['ids', 'forceDelete', 'organizationId']);
	});

	it('declares the two write bodies, with the identifier the mutation has no path for', () => {
		expect(printed).toMatch(/input CreateTimeSlotInput \{/);
		expect(printed).toMatch(/input UpdateTimeSlotInput \{/);
		expect(printed).toMatch(/input TimeSlotActivityInput \{/);

		expect(inputBody('UpdateTimeSlotInput')).toMatch(/\bid: ID!/);
		expect(inputBody('CreateTimeSlotInput')).not.toMatch(/\bid: ID!/);

		// The edit persists exactly the body it is handed, column for column, and the delivered handler
		// never reads either of these: one is not a column of the row, and the other two are the create
		// body's own members.
		expect(inputBody('UpdateTimeSlotInput')).not.toMatch(/\bsource:/);
		expect(inputBody('UpdateTimeSlotInput')).not.toMatch(/\blogType:/);
		expect(inputBody('UpdateTimeSlotInput')).not.toMatch(/\btimeLogId:/);
		expect(inputBody('CreateTimeSlotInput')).toMatch(/\btimeLogId: ID\b/);

		// The employee, the organization and the tenant of an activity are stamped by the delivered
		// write from the credential, so an activity body states none of them.
		const activity = inputBody('TimeSlotActivityInput');
		expect(activity).toMatch(/\btitle: String\b/);
		expect(activity).toMatch(/\bduration: Int\b/);
		expect(activity).not.toMatch(/\bemployeeId:/);
		expect(activity).not.toMatch(/\borganizationId:/);
		expect(activity).not.toMatch(/\btenantId:/);
		expect(activity).not.toMatch(/\btimeSlotId:/);
	});
});

describe('TimeSlotResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, timeSlotService } = surfaces();

		const connection = await resolver.timeSlots(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the query DTO that route binds built
		// from this field's own arguments.
		expect(timeSlotService.getTimeSlots).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: undefined,
			endDate: undefined,
			employeeIds: undefined,
			projectIds: undefined,
			source: undefined,
			logType: undefined,
			activityLevel: undefined
		});
		expect(connection.nodes).toHaveLength(3);
		expect(connection.totalCount).toBe(3);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[2].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SLOT);
	});

	it('answers the read the route’s own narrowing asks for, argument for argument', async () => {
		const { resolver, timeSlotService } = surfaces();
		const startDate = new Date('2026-03-01T00:00:00.000Z');
		const endDate = new Date('2026-03-01T23:59:59.000Z');

		await resolver.timeSlots(
			ORGANIZATION,
			startDate,
			endDate,
			[EMPLOYEE],
			[PROJECT],
			['DESKTOP'],
			['TRACKED'],
			{ start: 40, end: 90 }
		);

		expect(timeSlotService.getTimeSlots).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate,
			endDate,
			employeeIds: [EMPLOYEE],
			projectIds: [PROJECT],
			source: ['DESKTOP'],
			logType: ['TRACKED'],
			activityLevel: { start: 40, end: 90 }
		});
	});

	it('orders oldest first, with the identifier as the last key, when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.timeSlots(ORGANIZATION);

		// The delivered list read orders by `createdAt` ascending, and the connection's default is that
		// same order rather than an invented one — with the identifier closing it, because the read's own
		// order is not total and two slots filed in the same millisecond still need one order between
		// them for a cursor to name a row rather than a position among equals.
		expect(connection.nodes.map((node) => node.id)).toEqual([SLOT, OTHER_SLOT, THIRD_SLOT]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byEmployee = await resolver.timeSlots(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, undefined, {
			employeeId: { eq: EMPLOYEE }
		});
		expect(byEmployee.nodes.map((node) => node.id)).toEqual([SLOT, THIRD_SLOT]);

		const byDuration = await resolver.timeSlots(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, undefined, {
			duration: { gte: 300 }
		});
		expect(byDuration.nodes.map((node) => node.id)).toEqual([SLOT, OTHER_SLOT]);

		const between = await resolver.timeSlots(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, undefined, {
			createdAt: { between: ['2026-03-01T10:00:00.000Z', '2026-03-01T11:00:00.000Z'] }
		});
		expect(between.nodes.map((node) => node.id)).toEqual([SLOT, OTHER_SLOT, THIRD_SLOT]);
	});

	it('orders by the keys the sort enum offers, and refuses a column it does not', async () => {
		const { resolver } = surfaces();

		const byDuration = await resolver.timeSlots(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, [
			{ field: 'duration', direction: 'DESC' }
		]);
		expect(byDuration.nodes.map((node) => node.id)).toEqual([SLOT, OTHER_SLOT, THIRD_SLOT]);

		const byEmployee = await resolver.timeSlots(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, [
			{ field: 'startedAt', direction: 'DESC' }
		]);
		expect(byEmployee.nodes.map((node) => node.id)).toEqual([THIRD_SLOT, OTHER_SLOT, SLOT]);

		// `stoppedAt` is a member of the row and is deliberately not sortable: it is computed when a row
		// is loaded rather than stored, so the store has no column to order by.
		const error = await resolver
			.timeSlots(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, [
				{ field: 'stoppedAt', direction: 'ASC' }
			] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// The connection evaluates a filter against the rows the read returned, and those rows carry no
		// project column at all: the entity has none, and the project a tracker attributes a slot's
		// activities to is stated on the create body rather than stored on the slot.
		const byProject = await resolver
			.timeSlots(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, undefined, {
				projectId: { eq: PROJECT }
			})
			.catch((thrown) => thrown);

		expect(isRefusal(byProject)).toBe(true);
		expect((byProject as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');

		// A derived member is not filterable either, for the same reason it is not sortable.
		const byStoppedAt = await resolver
			.timeSlots(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, undefined, {
				stoppedAt: { isNull: false }
			})
			.catch((thrown) => thrown);

		expect(isRefusal(byStoppedAt)).toBe(true);
		expect((byStoppedAt as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.timeSlots(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([SLOT]);

		const second = await resolver.timeSlots(
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{ first: 1, after: first.pageInfo.endCursor ?? undefined }
		);

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER_SLOT]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.timeSlots(ORGANIZATION);
		const last = await resolver.timeSlots(
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{ last: 1, before: all.edges[2].cursor }
		);

		expect(last.nodes.map((node) => node.id)).toEqual([OTHER_SLOT]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.timeSlots(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('TimeSlotResolver — one concept, two protocols, the same operations', () => {
	it('reads one slot through the same service method the REST route calls', async () => {
		const { resolver, timeSlotService } = surfaces();

		expect(await resolver.timeSlot(SLOT)).toBe(ROWS[0]);
		expect(timeSlotService.findOneByIdString).toHaveBeenCalledWith(SLOT);
	});

	it('answers null for a slot that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, timeSlotService } = surfaces();
		timeSlotService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.timeSlot(OTHER_SLOT)).toBeNull();
	});

	it('records a slot through the command the REST route dispatches, with the flag left at its default', async () => {
		const { resolver, commandBus } = surfaces();
		const input = {
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			projectId: PROJECT,
			startedAt: new Date('2026-03-01T10:00:00.000Z'),
			duration: 600,
			overall: 480,
			activities: [{ title: 'Editing a file', duration: 300, type: 'APP' }]
		};

		await resolver.createTimeSlot(input);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CreateTimeSlotCommand);
		expect(command.input).toBe(input);
		// The route hands its body to the command and nothing else, so the second parameter keeps the
		// value the command's own constructor gives it.
		expect(command.forceDelete).toBe(false);
	});

	it('edits a slot through the command the REST route dispatches, with the identifier the route takes from its path', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateTimeSlot({ id: SLOT, duration: 300, overall: 240, activities: [{ title: 'A call' }] });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(UpdateTimeSlotCommand);
		expect(command.id).toBe(SLOT);
		// The identifier is lifted out rather than passed beside the body: the route states it in its path,
		// and the delivered write persists the body it is handed column for column.
		expect(command.input).toEqual({
			duration: 300,
			overall: 240,
			activities: [{ title: 'A call' }]
		});
		expect(command.input).not.toHaveProperty('id');
	});

	it('answers nothing for an edit the delivered handler found no row for, rather than a refusal', async () => {
		const { resolver, commandBus } = surfaces();
		commandBus.execute.mockResolvedValueOnce(null);

		expect(await resolver.updateTimeSlot({ id: SLOT })).toBeNull();
	});

	it('removes the slots a caller names through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		commandBus.execute.mockResolvedValueOnce(true);

		expect(await resolver.deleteTimeSlots([SLOT, OTHER_SLOT], true, ORGANIZATION)).toBe(true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(DeleteTimeSlotCommand);
		// The options are the query DTO the route binds, built from this field's own arguments.
		expect(command.options).toEqual({
			ids: [SLOT, OTHER_SLOT],
			forceDelete: true,
			organizationId: ORGANIZATION
		});
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('You can not delete time slots');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteTimeSlots([SLOT])).rejects.toBe(refusal);
	});

	it('carries the activities of a recording through to the command unchanged', async () => {
		const { resolver, commandBus } = surfaces();
		const input = {
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			activities: [
				{ title: 'Editing a file', duration: 300, type: 'APP', source: 'DESKTOP', taskId: ACTIVITY },
				{ title: 'Reading a page', duration: 120, metaData: { url: 'https://example.test' } }
			]
		};

		await resolver.createTimeSlot(input);

		expect(commandBus.execute.mock.calls[0][0].input.activities).toBe(input.activities);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard chain and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here: a
 * table of permission names would agree with the resolver while disagreeing with the controller, which
 * is the failure this half of the doctrine exists to catch.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'timeSlots', route: 'findAll' },
	{ field: 'timeSlot', route: 'findById' },
	{ field: 'createTimeSlot', route: 'create' },
	{ field: 'updateTimeSlot', route: 'update' },
	{ field: 'deleteTimeSlots', route: 'deleteTimeSlot' }
];

describe('TimeSlotResolver — the guard stack and the permission are the controller’s, field by field', () => {
	it('states on the class the guards and the permissions the controller states on its class', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', TimeSlotController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', TimeSlotResolver) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard])
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TimeSlotResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, TimeSlotController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TimeSlotController)).toEqual([
			PermissionsEnum.TIME_TRACKER,
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ALL_ORG_VIEW
		]);
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared.
		expect(typeof handlersOf(TimeSlotController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(TimeSlotController, route), FeatureFlagGuard].sort()
		);
		// The field states its route's permission itself rather than inheriting the class's, so a field
		// whose route states one of its own cannot be answered under the class permission by accident.
		expect(permissionOfField(field)).toEqual(permissionOfRoute(TimeSlotController, route));
	});

	it('carries the guard the two writing routes add, on the two fields that mirror them', () => {
		// A method-level guard is part of a resolver field's chain exactly as it is part of a route's, so
		// the two writes are held to the controller-wide chain *and* to the guard their routes add.
		for (const field of ['updateTimeSlot', 'deleteTimeSlots']) {
			expect(Reflect.getMetadata('__guards__', fieldsOf(TimeSlotResolver)[field])).toEqual([
				OrganizationPermissionGuard
			]);
			expect(guardsOfField(field)).toContain(OrganizationPermissionGuard);
			expect(guardsOfRoute(TimeSlotController, field === 'updateTimeSlot' ? 'update' : 'deleteTimeSlot')).toContain(
				OrganizationPermissionGuard
			);
		}

		// The three reads and the recording declare no guard of their own, on either surface.
		for (const field of ['timeSlots', 'timeSlot', 'createTimeSlot']) {
			expect(Reflect.getMetadata('__guards__', fieldsOf(TimeSlotResolver)[field])).toBeUndefined();
		}
	});

	it('states on each field the permission its own route declares, and never a wider one', () => {
		// The two writes state the permission their routes state and not the class's — that is the whole
		// reason they are the case worth pinning: a caller that may modify time is not necessarily a
		// caller that may record it.
		expect(permissionOfField('updateTimeSlot')).toEqual([PermissionsEnum.ALLOW_MODIFY_TIME]);
		expect(permissionOfField('deleteTimeSlots')).toEqual([PermissionsEnum.ALLOW_DELETE_TIME]);
		expect(permissionOfField('updateTimeSlot')).not.toEqual([
			PermissionsEnum.TIME_TRACKER,
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ALL_ORG_VIEW
		]);

		for (const [field, route] of [
			['timeSlots', 'findAll'],
			['timeSlot', 'findById'],
			['createTimeSlot', 'create']
		] as ReadonlyArray<[string, string]>) {
			// None of the three states a permission of its own, on either surface, so all three run under
			// the controller's class-level list.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(TimeSlotController)[route])).toBeUndefined();
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.TIME_TRACKER,
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.ALL_ORG_VIEW
			]);
		}
	});
});

describe('TimeSlotModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, TimeSlotModule) ?? []) as unknown[];

		expect(providers).toContain(TimeSlotResolver);
		expect(providers).toContain(TimeSlotService);
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
		getHandler: () => (TimeSlotResolver.prototype as never)[field],
		getClass: () => TimeSlotResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TimeSlotResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it — the two writes with their own guard included.
		expect(Reflect.getMetadata(FEATURE_METADATA, TimeSlotResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TimeSlotResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('timeSlots')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('timeSlots');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('deleteTimeSlots'))).resolves.toBe(true);
	});
});
