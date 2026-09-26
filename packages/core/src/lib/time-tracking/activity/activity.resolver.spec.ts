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
import { IDailyActivity, PermissionsEnum, ReportGroupFilterEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../../api/cursor';
import { ConnectionRequest, GraphqlConnection } from '../../api/graphql-connection';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { ActivityController } from './activity.controller';
import { Activity } from './activity.entity';
import { ActivityModule } from './activity.module';
import { ActivityResolver, IActivityQueryInput } from './activity.resolver';
import { ActivityMapService } from './activity.map.service';
import { ActivityService } from './activity.service';

/**
 * Tracked activity over GraphQL.
 *
 * The delivered REST routes serve the activity list, the daily aggregation, the grouped report and the
 * bulk write. This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - **the two computations are root fields of their own**: the daily read folds the rows and the report
 *   nests them, so neither is a filter on the connection, and each reaches the same service method — and,
 *   for the report, the same grouping — that its route reaches;
 * - **the connection is handed the route's criterion and not the route's page.** The route fills
 *   `{ page: 0, limit: 30 }` into its query; the connection states the page itself, which is what makes
 *   `totalCount` the count of everything the narrowing selects rather than the count of one page;
 * - every field reaches the same service method its REST route reaches, with the same arguments, so a
 *   client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the class permission read off the
 *   controller** — the permission list is read from the controller's own metadata rather than retyped, and
 *   this suite pins both the parity and the concrete pair of permissions it resolves to;
 * - a duration is carried as a whole number of **seconds** and never as money, and the share the report
 *   computes is a percentage of the group it was computed over.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';
const THIRD = '00000000-0000-4000-8000-000000000012';
const EMPLOYEE = '00000000-0000-4000-8000-000000000020';
const OTHER_EMPLOYEE = '00000000-0000-4000-8000-000000000021';
const PROJECT = '00000000-0000-4000-8000-000000000030';
const SLOT = '00000000-0000-4000-8000-000000000040';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them: longest
 * first, which is the order that read hands over.
 */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		title: 'Visual Studio Code',
		description: 'Editing the resolver',
		date: '2026-03-03',
		time: '10:00:00',
		duration: 300,
		type: 'APP',
		source: 'DESKTOP',
		recordedAt: new Date('2026-03-03T10:00:00.000Z'),
		employeeId: EMPLOYEE,
		projectId: PROJECT,
		timeSlotId: SLOT,
		taskId: null,
		createdAt: new Date('2026-03-03T10:00:00.000Z'),
		updatedAt: new Date('2026-03-03T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		title: 'Figma',
		description: 'Drawing the screen',
		date: '2026-03-01',
		time: '09:00:00',
		duration: 120,
		type: 'APP',
		source: 'DESKTOP',
		recordedAt: new Date('2026-03-01T09:00:00.000Z'),
		employeeId: OTHER_EMPLOYEE,
		projectId: null,
		timeSlotId: SLOT,
		taskId: null,
		createdAt: new Date('2026-03-01T09:00:00.000Z'),
		updatedAt: new Date('2026-03-01T09:00:00.000Z')
	},
	{
		id: THIRD,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		title: 'Chrome',
		description: 'Reading the docs',
		date: '2026-03-02',
		time: '11:00:00',
		duration: 60,
		type: 'URL',
		source: 'BROWSER',
		recordedAt: new Date('2026-03-02T11:00:00.000Z'),
		employeeId: EMPLOYEE,
		projectId: PROJECT,
		timeSlotId: SLOT,
		taskId: null,
		createdAt: new Date('2026-03-02T11:00:00.000Z'),
		updatedAt: new Date('2026-03-02T11:00:00.000Z')
	}
];

/** The aggregated rows a scripted daily read answers with. */
const DAILY_ROWS: IDailyActivity[] = [
	{ sessions: 2, duration: 360, employeeId: EMPLOYEE, date: '2026-03-03', title: 'Visual Studio Code' },
	{ sessions: 1, duration: 120, employeeId: OTHER_EMPLOYEE, date: '2026-03-01', title: 'Figma' }
];

/**
 * The three nestings a scripted mapper answers with, each keyed the way the delivered mapper keys it: by
 * the engagement and the project *rows* it merged beside the report rows.
 */
const MAPPED_DAYS = [
	{
		date: '2026-03-03',
		employees: [{ employee: { id: EMPLOYEE }, projects: [{ project: { id: PROJECT }, activity: ROWS }] }]
	}
];
const MAPPED_EMPLOYEES = [
	{
		employee: { id: EMPLOYEE },
		dates: [{ date: '2026-03-03', projects: [{ project: { id: PROJECT }, activity: ROWS }] }]
	}
];
const MAPPED_PROJECTS = [
	{
		project: { id: PROJECT },
		dates: [{ date: '2026-03-03', employees: [{ employee: { id: EMPLOYEE }, activity: ROWS }] }]
	}
];

/** The resolver, over a scripted service and a scripted mapper. */
function surfaces() {
	const activityService = {
		getActivities: jest.fn().mockResolvedValue(ROWS),
		getDailyActivities: jest.fn().mockResolvedValue(DAILY_ROWS),
		getDailyActivitiesReport: jest.fn().mockResolvedValue(ROWS),
		bulkSave: jest.fn().mockResolvedValue(ROWS)
	};
	const activityMapService = {
		mapByDate: jest.fn().mockReturnValue(MAPPED_DAYS),
		mapByEmployee: jest.fn().mockReturnValue(MAPPED_EMPLOYEES),
		mapByProject: jest.fn().mockReturnValue(MAPPED_PROJECTS)
	};

	return {
		activityService,
		activityMapService,
		resolver: new ActivityResolver(activityService as never, activityMapService as never)
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
 *
 * The walk starts three levels up, at the core library, because this domain sits inside the time-tracking
 * directory: a walker rooted at the domain would miss the kernel's own root declarations and the schema
 * would not build at all.
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

/** The root fields this domain contributes, by name. */
const OWNED_QUERY_FIELDS = ['activities', 'dailyActivities', 'dailyActivitiesReport'];

/** The mutations this domain contributes, by name. */
const OWNED_MUTATION_FIELDS = ['bulkSaveActivities'];

/** The root fields of this domain, as they are actually declared. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned = operation === 'Query' ? OWNED_QUERY_FIELDS : OWNED_MUTATION_FIELDS;

	return rootFields(operation)
		.filter((field) => owned.includes(field))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one enum, so a value it must not offer can be asserted absent. */
function enumBody(name: string): string {
	return printed.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of the controller, as functions, inherited ones included. */
function handlersOf(controller: typeof ActivityController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof ActivityController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof ActivityController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof ActivityResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(ActivityResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, ActivityResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', ActivityResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(ActivityResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/**
 * The criterion the delivered reads take, as the resolver hands it over.
 *
 * The route fills its page into the same query when it calls the *list* reader, which is the one member
 * this object deliberately does not carry: see the connection block below.
 */
function criterion(overrides: Partial<IActivityQueryInput> = {}): Record<string, unknown> {
	return {
		organizationId: ORGANIZATION,
		startDate: undefined,
		endDate: undefined,
		employeeIds: undefined,
		projectIds: undefined,
		titles: undefined,
		types: undefined,
		source: undefined,
		logType: undefined,
		activityLevel: undefined,
		...overrides
	};
}

/** The list root field, called with everything the caller did not state left unstated. */
function list(
	resolver: ActivityResolver,
	query: Partial<IActivityQueryInput> = {},
	request: ConnectionRequest = {}
): Promise<GraphqlConnection<Activity>> {
	return resolver.activities(
		(query.organizationId ?? ORGANIZATION) as never,
		query.startDate,
		query.endDate,
		query.employeeIds as never,
		query.projectIds as never,
		query.titles,
		query.types,
		query.source,
		query.logType,
		query.activityLevel as never,
		request.filter as never,
		request.sort as never,
		request.page as never,
		request.first,
		request.after,
		request.last,
		request.before,
		request.limit,
		request.offset
	) as never;
}

describe('ActivityResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection and the two computations', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['activities', 'dailyActivities', 'dailyActivitiesReport'])
		);
	});

	it('declares one mutation for the one write route', () => {
		expect(rootFields('Mutation')).toEqual(expect.arrayContaining(['bulkSaveActivities']));
	});

	it('declares the reads and the write the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([...OWNED_QUERY_FIELDS].sort());
		expect(ownedRootFields('Mutation')).toEqual([...OWNED_MUTATION_FIELDS].sort());

		// The controller serves exactly four routes, and every one of them is a field above: a route the
		// surface forgot would be a capability a client cannot reach over this protocol at all.
		expect(typeof handlersOf(ActivityController)['getActivities']).toBe('function');
		expect(typeof handlersOf(ActivityController)['getDailyActivities']).toBe('function');
		expect(typeof handlersOf(ActivityController)['getDailyActivitiesReport']).toBe('function');
		expect(typeof handlersOf(ActivityController)['bulkSaveActivities']).toBe('function');
	});

	it('declares the connection, its edges, its filter and its sorts', () => {
		expect(printed).toMatch(
			/type ActivityConnection \{\s*nodes: \[Activity!\]!\s*edges: \[ActivityEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ActivityEdge \{\s*node: Activity!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ActivityFilter \{/);
		expect(printed).toMatch(/input ActivitySort \{/);
		expect(printed).toMatch(
			/enum ActivitySortField \{\s*createdAt\s*updatedAt\s*date\s*time\s*duration\s*title\s*type\s*source\s*recordedAt\s*\}/
		);
	});

	it('states the list’s arguments in one order, with the narrowing the read performs on its joins', () => {
		expect(fieldArgs('Query', 'activities')).toEqual([
			'organizationId',
			'startDate',
			'endDate',
			'employeeIds',
			'projectIds',
			'titles',
			'types',
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
		// The two computations take the same narrowing and no page at all: they fold the rows rather than
		// answer a page of them.
		expect(fieldArgs('Query', 'dailyActivities')).toEqual([
			'organizationId',
			'startDate',
			'endDate',
			'employeeIds',
			'projectIds',
			'titles',
			'types',
			'source',
			'logType',
			'activityLevel'
		]);
		expect(fieldArgs('Query', 'dailyActivitiesReport')).toEqual([
			'organizationId',
			'groupBy',
			'startDate',
			'endDate',
			'employeeIds',
			'projectIds',
			'titles',
			'types',
			'source',
			'logType',
			'activityLevel'
		]);
	});

	it('answers the two computations with their own types, and the write with the saved rows', () => {
		expect(fieldType('Query', 'dailyActivities')).toBe('[DailyActivity!]!');
		expect(fieldType('Query', 'dailyActivitiesReport')).toBe('DailyActivityReport!');
		expect(printed).toMatch(/bulkSaveActivities\(input: ActivityBulkInput!\): \[Activity!\]!\n/);
	});

	it('states the three groupings the delivered route honours, and not the one it ignores', () => {
		const grouping = enumBody('DailyActivityReportGrouping');

		expect(grouping).toMatch(/\bdate\b/);
		expect(grouping).toMatch(/\bemployee\b/);
		expect(grouping).toMatch(/\bproject\b/);
		// The delivered filter declares a fourth grouping and the delivered route does nothing with it:
		// offering it would be offering an argument whose effect is that no grouping happened.
		expect(grouping).not.toMatch(/\bclient\b/);
	});
});

describe('ActivityResolver — which members the surface exposes, and which it refuses', () => {
	it('carries the row’s own columns, with the duration in seconds and never as money', () => {
		const body = typeBody('Activity');

		for (const member of [
			'id: ID!',
			'title: String',
			'description: String',
			'date: String',
			'time: String',
			'recordedAt: DateTime',
			'employeeId: ID',
			'projectId: ID',
			'timeSlotId: ID',
			'taskId: ID',
			'deletedAt: DateTime',
			'createdAt: DateTime',
			'updatedAt: DateTime'
		]) {
			expect(body).toMatch(new RegExp(member.replace(' ', '\\s*')));
		}

		// A tracked duration is a whole number of seconds and is never an amount: a `Decimal` here would
		// claim a money column the resource does not have.
		expect(body).toMatch(/\bduration: Int\b/);
		expect(body).not.toMatch(/\bduration: Decimal\b/);
		expect(body).toMatch(/\bmetaData: JSON\b/);
	});

	it('states the unit of every duration in the SDL, because a duration without its unit is unusable', () => {
		expect(printed).toMatch(/How long the activity lasted, \*\*in seconds\*\*/);
		expect(printed).toMatch(/How long the group's activities lasted in total, \*\*in seconds\*\*/);
	});

	it('carries the document column as a document and the tracker’s extras as nothing else', () => {
		expect(inputBody('ActivityInput')).toMatch(/\bmetaData: JSON\b/);
		expect(inputBody('ActivityInput')).toMatch(/\bduration: Int\b/);
		// The envelope's members win over a row's: the delivered handler stamps all four onto every row,
		// so a row that stated them would have them overwritten.
		expect(inputBody('ActivityInput')).not.toMatch(/\borganizationId:/);
		expect(inputBody('ActivityInput')).not.toMatch(/\bemployeeId:/);
		expect(inputBody('ActivityInput')).not.toMatch(/\bprojectId:/);
		expect(inputBody('ActivityBulkInput')).toMatch(/organizationId: ID!/);
		expect(inputBody('ActivityBulkInput')).toMatch(/employeeId: ID!/);
	});

	it('carries no relation object, and carries the identifier each relation reports instead', () => {
		const body = typeBody('Activity');
		const declares = (member: string): boolean => new RegExp(`^\\s*${member}:`, 'm').test(body);

		// The delivered list read selects the engagement only when the caller may change the selected
		// employee, and never selects the project, the task or the slot; the daily aggregation joins
		// nothing into its rows. A relation member would therefore be filled on one read and absent on
		// the next, which is worse than no member at all.
		for (const member of ['employee', 'project', 'task', 'timeSlot', 'tenant', 'organization']) {
			expect(declares(member)).toBe(false);
		}

		for (const member of ['employeeId', 'projectId', 'timeSlotId', 'taskId']) {
			expect(declares(member)).toBe(true);
		}
	});

	it('carries the aggregated members the daily read computes, and none of the ones it does not', () => {
		const body = typeBody('DailyActivity');

		expect(body).toMatch(/\bsessions: Int\b/);
		expect(body).toMatch(/\bduration: Int\b/);
		expect(body).toMatch(/\bemployeeId: ID\b/);
		expect(body).toMatch(/\bdate: String\b/);
		expect(body).toMatch(/\btitle: String\b/);

		// `IDailyActivity` declares three further members and the delivered aggregation fills none of
		// them: it groups five columns, so a member for any of the three would answer null on every row.
		expect(body).not.toMatch(/\bdescription:/);
		expect(body).not.toMatch(/\bdurationPercentage:/);
		expect(body).not.toMatch(/\bchildItems:/);
	});

	it('nests the report the way the delivered mapper nests it, with the share on the row', () => {
		const body = typeBody('DailyActivityReport');

		expect(body).toMatch(/activities: \[DailyActivityReportRow!\]/);
		expect(body).toMatch(/dates: \[DailyActivityReportDate!\]/);
		expect(body).toMatch(/employees: \[DailyActivityReportEmployee!\]/);
		expect(body).toMatch(/projects: \[DailyActivityReportProject!\]/);

		// Each grouping puts a different thing at the outside, which is why the three nestings are three
		// type families rather than one recursive shape that could not say which is which.
		expect(typeBody('DailyActivityReportDate')).toMatch(/employees: \[DailyActivityReportEmployeeProjects!\]!/);
		expect(typeBody('DailyActivityReportEmployee')).toMatch(/dates: \[DailyActivityReportDateProjects!\]!/);
		expect(typeBody('DailyActivityReportProject')).toMatch(/dates: \[DailyActivityReportDateEmployees!\]!/);

		const row = typeBody('DailyActivityReportRow');
		expect(row).toMatch(/\bdurationPercentage: Float\b/);
		expect(row).toMatch(/\bduration: Int\b/);
		expect(row).toMatch(/\bprojectId: ID\b/);
		// The share is a percentage of the group it was computed over, and the SDL says which group.
		expect(printed).toMatch(/share of the tracked time of the group it is nested under, \*\*as a percentage\*\*/);
		expect(row).not.toMatch(/\bduration: Decimal\b/);
	});

	it('declares a filter over the row’s own columns and refuses the joined conditions', () => {
		const filter = inputBody('ActivityFilter');

		expect(filter).toMatch(/duration: NumberFilter/);
		expect(filter).toMatch(/recordedAt: DateTimeFilter/);
		expect(filter).toMatch(/employeeId: IDFilter/);
		expect(filter).toMatch(/timeSlotId: IDFilter/);
		expect(filter).toMatch(/and: \[ActivityFilter!\]/);
		// `logType` is a condition on the joined log rows and has no column of its own on an activity, so
		// a filter for it could only ever select the empty set: it is an argument of the root field.
		expect(filter).not.toMatch(/\blogType:/);
		expect(filter).not.toMatch(/\bemployee:/);
		expect(filter).not.toMatch(/\btimeSlot:/);
	});
});

describe('ActivityResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, activityService } = surfaces();

		const connection = await list(resolver, {}, { first: 20 });

		// The read is the one the REST list route performs, criterion included — with the route's own page
		// left out, because the connection states the page itself.
		expect(activityService.getActivities).toHaveBeenCalledWith(criterion());
		expect(connection.nodes).toHaveLength(3);
		expect(connection.totalCount).toBe(3);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[2].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('orders longest first when the caller states none, which is the order the read hands over', async () => {
		const { resolver } = surfaces();

		const connection = await list(resolver);

		expect(connection.nodes.map((node) => node.id)).toEqual([FIRST, SECOND, THIRD]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byDuration = await list(resolver, {}, { filter: { duration: { gte: 120 } } });
		expect(byDuration.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
		expect(byDuration.totalCount).toBe(2);

		const byEmployee = await list(resolver, {}, { filter: { employeeId: { eq: EMPLOYEE } } });
		expect(byEmployee.nodes.map((node) => node.id)).toEqual([FIRST, THIRD]);

		const byType = await list(resolver, {}, { filter: { type: { eq: 'URL' } } });
		expect(byType.nodes.map((node) => node.id)).toEqual([THIRD]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byDate = await list(resolver, {}, { sort: [{ field: 'createdAt', direction: 'ASC' }] });

		expect(byDate.nodes.map((node) => node.id)).toEqual([SECOND, THIRD, FIRST]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await list(resolver, {}, { first: 1 });

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await list(resolver, {}, { first: 1, after: first.pageInfo.endCursor ?? undefined });

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await list(resolver, {}, { first: 20 });
		const last = await list(resolver, {}, { last: 1, before: all.edges[2].cursor });

		expect(last.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await list(resolver, {}, { sort: [{ field: 'metaData', direction: 'ASC' }] }).catch(
			(thrown) => thrown
		);

		// The column is filterable and is deliberately not sortable: the enum states the keys a tracked
		// list is read in an order for.
		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await list(resolver, {}, { filter: { timeSlot: { eq: SLOT } } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await list(resolver, {}, { first: 5, limit: 5 }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every activity', async () => {
		const { resolver } = surfaces();

		const error = await list(resolver, {}, { first: 500 }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('ActivityResolver — one concept, two protocols, the same operations', () => {
	it('computes the days through the same service method the daily route calls', async () => {
		const { resolver, activityService } = surfaces();
		const startDate = new Date('2026-03-01T00:00:00.000Z');
		const endDate = new Date('2026-03-31T23:59:59.000Z');

		const answer = await resolver.dailyActivities(ORGANIZATION, startDate, endDate);

		expect(activityService.getDailyActivities).toHaveBeenCalledWith(criterion({ startDate, endDate }));
		expect(answer).toBe(DAILY_ROWS);
	});

	it('computes the report through the same service method its route calls, ungrouped when none is stated', async () => {
		const { resolver, activityService, activityMapService } = surfaces();

		const answer = await resolver.dailyActivitiesReport(ORGANIZATION);

		expect(activityService.getDailyActivitiesReport).toHaveBeenCalledWith(criterion());
		// No grouping is stated, so the delivered mapper is not reached at all and the rows are answered
		// as they were read — which is what the route does with a request that states no grouping.
		expect(activityMapService.mapByDate).not.toHaveBeenCalled();
		expect(activityMapService.mapByEmployee).not.toHaveBeenCalled();
		expect(activityMapService.mapByProject).not.toHaveBeenCalled();
		expect(answer.activities).toEqual(ROWS);
		expect(answer.dates).toBeUndefined();
	});

	it('nests the report by date through the mapper’s own grouping, projected to the identifiers it keyed on', async () => {
		const { resolver, activityMapService } = surfaces();

		const answer = await resolver.dailyActivitiesReport(ORGANIZATION, ReportGroupFilterEnum.date);

		expect(activityMapService.mapByDate).toHaveBeenCalledWith(ROWS);
		expect(answer).toEqual({
			dates: [
				{
					date: '2026-03-03',
					employees: [{ employeeId: EMPLOYEE, projects: [{ projectId: PROJECT, activity: ROWS }] }]
				}
			]
		});
	});

	it('nests the report by engagement, and by project, through the grouping each names', async () => {
		const { resolver, activityMapService } = surfaces();

		const byEmployee = await resolver.dailyActivitiesReport(ORGANIZATION, ReportGroupFilterEnum.employee);

		expect(activityMapService.mapByEmployee).toHaveBeenCalledWith(ROWS);
		expect(byEmployee).toEqual({
			employees: [
				{
					employeeId: EMPLOYEE,
					dates: [{ date: '2026-03-03', projects: [{ projectId: PROJECT, activity: ROWS }] }]
				}
			]
		});

		const byProject = await resolver.dailyActivitiesReport(ORGANIZATION, ReportGroupFilterEnum.project);

		expect(activityMapService.mapByProject).toHaveBeenCalledWith(ROWS);
		expect(byProject).toEqual({
			projects: [
				{
					projectId: PROJECT,
					dates: [{ date: '2026-03-03', employees: [{ employeeId: EMPLOYEE, activity: ROWS }] }]
				}
			]
		});
	});

	it('answers the rows themselves for a grouping the delivered route does not honour', async () => {
		const { resolver, activityMapService } = surfaces();

		const answer = await resolver.dailyActivitiesReport(ORGANIZATION, 'client');

		// The delivered filter declares a fourth grouping and the delivered route does nothing with it: it
		// answers the rows it read. That is the behaviour mirrored here, which is also why the schema does
		// not offer the value.
		expect(activityMapService.mapByDate).not.toHaveBeenCalled();
		expect(activityMapService.mapByProject).not.toHaveBeenCalled();
		expect(answer.activities).toEqual(ROWS);
	});

	it('files the activities through the same service method the bulk route calls', async () => {
		const { resolver, activityService } = surfaces();
		const input = {
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			projectId: PROJECT,
			activities: [{ title: 'Visual Studio Code', duration: 300, type: 'APP', date: '2026-03-03', time: '10:00:00' }]
		};

		const answer = await resolver.bulkSaveActivities(input as never);

		// The body is handed over whole, exactly as the route hands over the body it bound: the delivered
		// write reads the envelope's members off it and stamps them onto every row.
		expect(activityService.bulkSave).toHaveBeenCalledWith(input);
		expect(answer).toEqual(ROWS);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, activityService } = surfaces();
		const refusal = new Error('TIMESHEET_LOCKED: the timesheet this activity belongs to is submitted.');

		activityService.bulkSave.mockRejectedValueOnce(refusal);

		await expect(resolver.bulkSaveActivities({} as never)).rejects.toBe(refusal);
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
	{ field: 'activities', route: 'getActivities' },
	{ field: 'dailyActivities', route: 'getDailyActivities' },
	{ field: 'dailyActivitiesReport', route: 'getDailyActivitiesReport' },
	{ field: 'bulkSaveActivities', route: 'bulkSaveActivities' }
];

describe('ActivityResolver — the guard stack and the permission are the route’s, field by field', () => {
	it('states on the class the guards the controller states on its class, plus the gate', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', ActivityController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', ActivityResolver) ?? [];

		expect(controllerGuards).toEqual([TenantPermissionGuard, PermissionGuard]);
		expect(resolverGuards).toEqual([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard]);
	});

	it('resolves the class permission to the pair the controller declares', () => {
		// The resolver reads the list off the controller, and this pins what that list *is*, so a change to
		// the controller's own declaration is a change this suite reports rather than one it follows.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ActivityController)).toEqual([
			PermissionsEnum.TIME_TRACKER,
			PermissionsEnum.TIMESHEET_EDIT_TIME
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ActivityResolver)).toEqual([
			PermissionsEnum.TIME_TRACKER,
			PermissionsEnum.TIMESHEET_EDIT_TIME
		]);
	});

	it('runs every route under the controller’s chain and no permission of its own', () => {
		for (const handler of ['getActivities', 'getDailyActivities', 'getDailyActivitiesReport', 'bulkSaveActivities']) {
			// Neither handler states a permission, which is what makes the class-level list the list every
			// field has to state.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(ActivityController)[handler])).toBeUndefined();
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared.
		expect(typeof handlersOf(ActivityController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual([...guardsOfRoute(ActivityController, route), FeatureFlagGuard].sort());
		expect(permissionOfField(field)).toEqual(permissionOfRoute(ActivityController, route));
		expect(permissionOfField(field)).toEqual([PermissionsEnum.TIME_TRACKER, PermissionsEnum.TIMESHEET_EDIT_TIME]);
	});
});

describe('ActivityModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the services', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ActivityModule) ?? []) as unknown[];

		// A resolver can only inject services its own module can reach, so the module that reaches them is
		// the module that has to declare it.
		expect(providers).toContain(ActivityResolver);
		expect(providers).toContain(ActivityService);
		expect(providers).toContain(ActivityMapService);
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver declares,
 * which is the point: a spec that asserted the decorator alone would keep passing if the guard stopped
 * reading that key.
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
		getHandler: () => (ActivityResolver.prototype as never)[field],
		getClass: () => ActivityResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ActivityResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, ActivityResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ActivityResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('activities')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('activities');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('activities'))).resolves.toBe(true);
	});
});
