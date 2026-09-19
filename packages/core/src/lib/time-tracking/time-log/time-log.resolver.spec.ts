/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum, ReportGroupFilterEnum, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../../api/cursor';
import { RequestContext } from '../../core/context';
import {
	FeatureFlagGuard,
	OrganizationPermissionGuard,
	PermissionGuard,
	TenantBaseGuard,
	TenantPermissionGuard
} from '../../shared/guards';
import { TimeLogController } from './time-log.controller';
import { TimeLogModule } from './time-log.module';
import { TimeLogResolver } from './time-log.resolver';
import { TimeLogService } from './time-log.service';
import { IGetConflictTimeLogCommand } from './commands';

/**
 * The time log over GraphQL.
 *
 * The delivered REST routes serve one list, one row, the conflicts of a window, eight computed
 * answers over the tracked time — a daily report in four groupings, the day-by-day chart, the owed
 * amounts and their chart, the weekly report, the time-limit report and the two budget limits — and
 * three writes. This suite pins the half of the two-protocol doctrine that is easy to get quietly
 * wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST
 *   resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches — with the same options, built from the field's own arguments, because this surface has
 *   no query string to bind them from;
 * - **the guard chain is the controller's and every field's permission is its own route's** — read
 *   from the controller's metadata rather than restated here. The class carries `TenantBaseGuard`,
 *   which is the guard the delivered controller carries and deliberately **not** `TenantPermissionGuard`
 *   — the two are different guards and only one of them is the route's;
 * - **the three writes carry the guard and the permission their handlers state**, which are not the
 *   class's: each adds `OrganizationPermissionGuard` and one `ALLOW_*` permission, and a field that
 *   inherited the class grant instead would let a caller record time it may not record;
 * - the three members a hand-recorded body is written from are restated, because the delivered pipe
 *   and the delivered body's own transform decide them: the employee is the caller's own unless the
 *   caller may choose one, and a create is always a `MANUAL` log from the browser timer;
 * - every duration says its unit, every amount is an exact decimal and no relation is a field: each
 *   relation is carried as the identifier that always travels, because the reads behind this domain's
 *   fields select different subsets of the rows they nest.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const OTHER_EMPLOYEE = '00000000-0000-4000-8000-000000000004';
const PROJECT = '00000000-0000-4000-8000-000000000005';
const TASK = '00000000-0000-4000-8000-000000000006';
const CLIENT = '00000000-0000-4000-8000-000000000007';
const FIRST = '00000000-0000-4000-8000-000000000060';
const SECOND = '00000000-0000-4000-8000-000000000061';

/**
 * The rows a scripted list read answers with, in the order the delivered read returns them: the read
 * fixes `startedAt` ascending on both of its stores, so the fixtures are already in that order and
 * the connection's default order has something to agree with.
 */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		projectId: PROJECT,
		taskId: TASK,
		organizationContactId: CLIENT,
		logType: TimeLogType.MANUAL,
		source: TimeLogSourceEnum.WEB_TIMER,
		description: 'Wrote the resolver',
		duration: 3600,
		isBillable: true,
		isEdited: false,
		startedAt: new Date('2026-03-01T09:00:00.000Z'),
		stoppedAt: new Date('2026-03-01T10:00:00.000Z'),
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		logType: TimeLogType.TRACKED,
		source: TimeLogSourceEnum.DESKTOP,
		description: 'Read the controller',
		duration: 1800,
		isBillable: false,
		isEdited: true,
		startedAt: new Date('2026-03-01T11:00:00.000Z'),
		stoppedAt: new Date('2026-03-01T11:30:00.000Z'),
		createdAt: new Date('2026-03-01T11:30:00.000Z'),
		updatedAt: new Date('2026-03-01T11:30:00.000Z')
	}
];

/** The daily report grouped by date, as the delivered handler answers it. */
const DAILY_REPORT = [
	{
		date: '2026-03-01',
		logs: [
			{
				project: { id: PROJECT },
				employeeLogs: [
					{
						employee: { id: EMPLOYEE },
						sum: 3600,
						activity: 42.5,
						tasks: [
							{
								task: { id: TASK },
								description: 'Wrote the resolver',
								duration: 3600,
								client: { id: CLIENT }
							}
						]
					}
				]
			}
		],
		sum: 3600,
		activity: 42.5
	}
];

/** The daily chart, keyed by the four log types the delivered calculation breaks a day into. */
const DAILY_CHART = [
	{
		date: '2026-03-01',
		value: {
			[TimeLogType.TRACKED]: 0.5,
			[TimeLogType.MANUAL]: 1,
			[TimeLogType.IDLE]: 0,
			[TimeLogType.RESUMED]: 0.2
		}
	}
];

/** The owed-amount report, one line per employee per day. */
const OWED_REPORT = [
	{
		date: '2026-03-01',
		employees: [{ employee: { id: EMPLOYEE }, duration: 3600, amount: 120.5 }]
	}
];

/** The owed-amount chart, one figure per day. */
const OWED_CHART = [{ date: '2026-03-01', value: 120.5 }];

/**
 * The weekly report, with the delivered answer's `dates` map: the first day carries a group and the
 * second carries the bare number the delivered calculation writes for a day nothing was recorded on.
 */
const WEEKLY_REPORT = [
	{
		employee: { id: EMPLOYEE },
		dates: {
			'2026-03-01': { sum: 3600, logs: ROWS },
			'2026-03-02': 0
		},
		sum: 3600,
		activity: 42.5
	}
];

/** The time-limit report, whose percentage the delivered calculation renders to two decimals. */
const TIME_LIMIT_REPORT = [
	{
		date: '2026-03-01',
		employees: [{ employee: { id: EMPLOYEE }, duration: 3600, durationPercentage: '20.00', limit: 18000 }]
	}
];

/** The project budget limit, whose project row the read selected six columns of. */
const PROJECT_BUDGET = [
	{
		project: { id: PROJECT, name: 'Apollo', imageUrl: null, membersCount: 3 },
		budgetType: 'hours',
		budget: 100,
		spent: 42.5,
		remainingBudget: 57.5,
		spentPercentage: 42.5
	}
];

/** The client budget limit, on the same terms. */
const CLIENT_BUDGET = [
	{
		organizationContact: { id: CLIENT, name: 'Acme' },
		budgetType: 'cost',
		budget: 5000,
		spent: 1200.5,
		remainingBudget: 3799.5,
		spentPercentage: 24.01
	}
];

/** The resolver, over a scripted service and a scripted command bus. */
function surfaces() {
	const timeLogService = {
		getTimeLogs: jest.fn().mockResolvedValue(ROWS),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		getDailyReport: jest.fn().mockResolvedValue(DAILY_REPORT),
		getDailyReportCharts: jest.fn().mockResolvedValue(DAILY_CHART),
		getOwedAmountReport: jest.fn().mockResolvedValue(OWED_REPORT),
		getOwedAmountReportCharts: jest.fn().mockResolvedValue(OWED_CHART),
		getWeeklyReport: jest.fn().mockResolvedValue(WEEKLY_REPORT),
		getTimeLimit: jest.fn().mockResolvedValue(TIME_LIMIT_REPORT),
		getProjectBudgetLimit: jest.fn().mockResolvedValue(PROJECT_BUDGET),
		getClientBudgetLimit: jest.fn().mockResolvedValue(CLIENT_BUDGET),
		addManualTime: jest.fn().mockResolvedValue(ROWS[0]),
		updateManualTime: jest.fn().mockResolvedValue(ROWS[0]),
		deleteTimeLogs: jest.fn().mockResolvedValue({ affected: ROWS.length })
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS) };

	return {
		timeLogService,
		commandBus,
		resolver: new TimeLogResolver(timeLogService as never, commandBus as never)
	};
}

/**
 * The caller as the delivered pipe and the delivered reads see it.
 *
 * `CHANGE_SELECTED_EMPLOYEE` decides whether a hand-recorded body keeps the employee the caller
 * stated or is rewritten to the caller's own, and both the pipe and this resolver read it off the
 * request context — so the suite states it the way the pipe sees it rather than reaching into the
 * resolver.
 */
function caller(mayChooseEmployee: boolean, ownEmployeeId: string | null = OTHER_EMPLOYEE): void {
	jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(mayChooseEmployee);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(ownEmployeeId);
}

/** Every spy a test put on the request context is its own, so no test decides another one’s caller. */
afterEach(() => jest.restoreAllMocks());

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
 * The names this domain’s root fields are built from: the resource itself, the two budgets and the
 * three writes.
 *
 * Anchored at the start rather than matched loosely, because the word is not this domain’s alone:
 * `timeTrackingManualTimes` belongs to the tracking-statistic surface and merely contains
 * `ManualTime`, and `timeLogs` is a member of two other domains’ types rather than a root field of
 * theirs. Anchoring is what makes “and no more” a statement about this domain instead of about the
 * whole schema.
 */
const OWNED_ROOT_FIELD = /^(timeLog|projectBudgetLimit|clientBudgetLimit|addManualTime|updateManualTime|deleteTimeLogs)/;

/**
 * The root fields this domain contributes, read off the concept’s own names.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => OWNED_ROOT_FIELD.test(field))
		.sort();
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

/** The printed body of one input type, so a member it must not carry can be asserted absent. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof TimeLogController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof TimeLogController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof TimeLogController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof TimeLogResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule as its route. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(TimeLogResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, TimeLogResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TimeLogResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(TimeLogResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/**
 * The nine queries below the node read, and the type each answers.
 *
 * Every one of them is a computation or a selection the connection protocol cannot state — an
 * interval overlap, a per-day aggregation, a rate applied to a duration, a budget spent against it —
 * so each is a root field of its own and each answers a type declared for it rather than a `JSON`
 * document. The list is asserted member for member because a field that answered a document would be
 * a field no client could select from.
 */
const COMPUTED_ANSWERS: ReadonlyArray<readonly [string, string]> = [
	['timeLogConflicts', 'TimeLog'],
	['timeLogDailyReport', 'TimeLogDailyReportEntry'],
	['timeLogDailyReportChart', 'TimeLogDailyReportChartPoint'],
	['timeLogOwedAmountReport', 'TimeLogOwedAmountReportEntry'],
	['timeLogOwedAmountReportChart', 'TimeLogOwedAmountReportChartPoint'],
	['timeLogWeeklyReport', 'TimeLogWeeklyReport'],
	['timeLogTimeLimitReport', 'TimeLogTimeLimitReportEntry'],
	['projectBudgetLimit', 'ProjectBudgetLimit'],
	['clientBudgetLimit', 'ClientBudgetLimit']
];

describe('TimeLogResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the list, the node read, the nine computed answers and the two budgets', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'timeLogs',
				'timeLog',
				'timeLogConflicts',
				'timeLogDailyReport',
				'timeLogDailyReportChart',
				'timeLogOwedAmountReport',
				'timeLogOwedAmountReportChart',
				'timeLogWeeklyReport',
				'timeLogTimeLimitReport',
				'projectBudgetLimit',
				'clientBudgetLimit'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['addManualTime', 'updateManualTime', 'deleteTimeLogs'])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([
			'clientBudgetLimit',
			'projectBudgetLimit',
			'timeLog',
			'timeLogConflicts',
			'timeLogDailyReport',
			'timeLogDailyReportChart',
			'timeLogOwedAmountReport',
			'timeLogOwedAmountReportChart',
			'timeLogTimeLimitReport',
			'timeLogWeeklyReport',
			'timeLogs'
		]);
		expect(ownedRootFields('Mutation')).toEqual(['addManualTime', 'deleteTimeLogs', 'updateManualTime']);

		// The controller serves one list, so the surface states it once: neither a paginated spelling
		// of it nor a second name for the same rows is declared, because a second surface for one
		// capability is a surface that can disagree with the first.
		for (const spelling of ['timeLogsPagination', 'timeLogList', 'timeLogsConnection', 'timeLogCount']) {
			expect(rootFields('Query')).not.toContain(spelling);
		}

		// Every field above names a handler that exists on the controller.
		for (const handler of [
			'getLogs',
			'findById',
			'getConflict',
			'getDailyReport',
			'getDailyReportChartData',
			'getOwedAmountReport',
			'getOwedAmountReportChartData',
			'getWeeklyReport',
			'getTimeLimitReport',
			'getProjectBudgetLimit',
			'clientBudgetLimit',
			'addManualTime',
			'updateManualTime',
			'deleteTimeLog'
		]) {
			expect(typeof handlersOf(TimeLogController)[handler]).toBe('function');
		}
	});

	it('declares the connection, its edges, its filter and its sort', () => {
		expect(printed).toMatch(
			/type TimeLogConnection \{\s*nodes: \[TimeLog!\]!\s*edges: \[TimeLogEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type TimeLogEdge \{\s*node: TimeLog!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input TimeLogFilter \{/);
		expect(printed).toMatch(/input TimeLogSort \{/);
		expect(printed).toMatch(
			/enum TimeLogSortField \{\s*startedAt\s*stoppedAt\s*duration\s*createdAt\s*updatedAt\s*logType\s*source\s*isBillable\s*\}/
		);
	});

	it('answers each computed field with a type declared for it, and never with a document', () => {
		for (const [field, type] of COMPUTED_ANSWERS) {
			expect(fieldType('Query', field)).toBe(`[${type}!]!`);
			expect(printed).toContain(`type ${type} {`);
		}

		// None of the nine answers a `JSON` document: the shapes are known, and a document would be a
		// field no client could select a member from.
		for (const [field] of COMPUTED_ANSWERS) {
			expect(fieldType('Query', field)).not.toContain('JSON');
		}
	});

	it('states every connection field’s arguments in one order, which is the order the tests call them in', () => {
		expect(fieldArgs('Query', 'timeLogs')).toEqual([
			'organizationId',
			'startDate',
			'endDate',
			'employeeIds',
			'teamIds',
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

		// The node read takes one argument and the conflict read the five its own route binds.
		expect(fieldArgs('Query', 'timeLog')).toEqual(['id']);
		expect(fieldArgs('Query', 'timeLogConflicts')).toEqual([
			'startDate',
			'endDate',
			'employeeId',
			'organizationId',
			'ignoreId'
		]);
	});

	it('offers no argument it cannot honour', () => {
		// The read loads a relation only when a caller names one, and no type here carries a relation
		// object, so no field offers `relations`; the list read neither groups by a calendar nor reads a
		// time zone, so it offers neither of those either.
		expect(printed).not.toMatch(/timeLogs\([^)]*relations/);
		expect(printed).not.toMatch(/timeLogs\([^)]*timeZone/);
		expect(printed).not.toMatch(/timeLogs\([^)]*groupBy/);
		expect(printed).not.toMatch(/timeLogs\([^)]*withDeleted/);
		expect(printed).not.toMatch(/timeLogConflicts\([^)]*relations/);
	});

	it('states the three writes as three fields answering the row the write produced', () => {
		expect(printed).toMatch(/addManualTime\(input: CreateManualTimeLogInput!\): TimeLog!\n/);
		expect(printed).toMatch(/updateManualTime\(input: UpdateManualTimeLogInput!\): TimeLog!\n/);
		expect(printed).toMatch(/deleteTimeLogs\(input: DeleteTimeLogsInput!\): Boolean!\n/);
	});

	it('declares the three write bodies, and never the members the delivered body stamps for itself', () => {
		expect(printed).toMatch(/input CreateManualTimeLogInput \{/);
		expect(printed).toMatch(/input UpdateManualTimeLogInput \{/);
		expect(printed).toMatch(/input DeleteTimeLogsInput \{/);

		expect(inputBody('CreateManualTimeLogInput')).toMatch(/organizationId: ID!/);
		expect(inputBody('CreateManualTimeLogInput')).toMatch(/employeeId: ID!/);
		expect(inputBody('CreateManualTimeLogInput')).toMatch(/startedAt: DateTime!/);
		expect(inputBody('CreateManualTimeLogInput')).toMatch(/stoppedAt: DateTime!/);
		expect(inputBody('UpdateManualTimeLogInput')).toMatch(/id: ID!/);
		expect(inputBody('DeleteTimeLogsInput')).toMatch(/logIds: \[ID!\]!/);
		expect(inputBody('DeleteTimeLogsInput')).toMatch(/organizationId: ID!/);

		// The delivered create stamps both of these for itself — `MANUAL` and `BROWSER` — whatever a
		// body carries, so an input offering them would offer two values the write ignores.
		expect(inputBody('CreateManualTimeLogInput')).not.toMatch(/\blogType:/);
		expect(inputBody('CreateManualTimeLogInput')).not.toMatch(/\bsource:/);
		expect(inputBody('UpdateManualTimeLogInput')).not.toMatch(/\blogType:/);

		// The tenant is never a member: the writes stamp it from the credential.
		expect(inputBody('CreateManualTimeLogInput')).not.toMatch(/\btenantId:/);
		expect(inputBody('DeleteTimeLogsInput')).not.toMatch(/\btenantId:/);
	});

	it('states the activity window as the pair of bounds its read evaluates', () => {
		expect(inputBody('TimeLogActivityLevelInput')).toMatch(/start: Int!/);
		expect(inputBody('TimeLogActivityLevelInput')).toMatch(/end: Int!/);
	});
});

describe('TimeLogResolver — which members the surface exposes, and which it refuses', () => {
	it('carries the columns the delivered answer carries, with every duration in seconds', () => {
		const body = typeBody('TimeLog');

		for (const member of [
			'id: ID!',
			'startedAt: DateTime',
			'stoppedAt: DateTime',
			'editedAt: DateTime',
			'logType: String',
			'source: String',
			'description: String',
			'isBillable: Boolean',
			'isRunning: Boolean',
			'isEdited: Boolean',
			'archivedAt: DateTime',
			'deletedAt: DateTime',
			'createdAt: DateTime',
			'updatedAt: DateTime'
		]) {
			expect(body).toMatch(new RegExp(member.replace(' ', '\\s*')));
		}

		// A duration is a whole number of seconds and is never an amount, so it is an `Int` and never
		// a `Decimal` — and the member says so, which is what makes the unit readable from the schema.
		expect(body).toMatch(/\bduration: Int\b/);
		expect(body).not.toMatch(/\bduration: Decimal/);
		expect(body).toMatch(/in seconds/);
	});

	it('carries no relation object, and carries the identifier each relation reports instead', () => {
		const body = typeBody('TimeLog');

		// Whether the type declares a field by this name. Asserted as a declaration rather than as a
		// substring, because a member of a type and a word inside another member's name are not the
		// same thing.
		const declares = (member: string): boolean => new RegExp(`^\\s*${member}:`, 'm').test(body);

		// The reads behind this domain's fields select different subsets of the rows they nest — a few
		// columns of a project on the list read, another handful of the employee on an owed-amount read
		// — so a relation member would be filled on one field and empty on the others.
		for (const member of [
			'employee',
			'project',
			'task',
			'organizationContact',
			'organizationTeam',
			'timesheet',
			'timeSlots',
			'tags',
			'organization',
			'tenant'
		]) {
			expect(declares(member)).toBe(false);
		}

		// What always travels is the foreign key, and the comment beside each names where the row
		// behind it is read from.
		for (const member of [
			'employeeId',
			'timesheetId',
			'projectId',
			'taskId',
			'organizationContactId',
			'organizationTeamId'
		]) {
			expect(declares(member)).toBe(true);
		}
	});

	it('carries the report rows as identifiers too, and the weekly logs as the four columns its read selected', () => {
		expect(typeBody('TimeLogDailyReportEntry')).toMatch(/\bemployeeId: ID\b/);
		expect(typeBody('TimeLogDailyReportEntry')).toMatch(/\bprojectId: ID\b/);
		expect(typeBody('TimeLogDailyReportEntry')).toMatch(/\bclientId: ID\b/);
		expect(typeBody('TimeLogDailyReportGroup')).toMatch(/\bemployeeId: ID\b/);
		expect(typeBody('TimeLogDailyReportTask')).toMatch(/\btaskId: ID\b/);
		expect(typeBody('TimeLogDailyReportTask')).toMatch(/\bclientId: ID\b/);
		expect(typeBody('TimeLogOwedAmountReportEmployee')).toMatch(/\bemployeeId: ID\b/);
		expect(typeBody('TimeLogTimeLimitReportEmployee')).toMatch(/\bemployeeId: ID\b/);
		expect(typeBody('ProjectBudgetLimit')).toMatch(/\bprojectId: ID!/);
		expect(typeBody('ClientBudgetLimit')).toMatch(/\borganizationContactId: ID!/);

		// The weekly read projects four columns of a log, so the type states exactly those.
		expect(typeBody('TimeLogWeeklyReportLog')).toMatch(/\bid: ID!/);
		expect(typeBody('TimeLogWeeklyReportLog')).toMatch(/\bemployeeId: ID\b/);
		expect(typeBody('TimeLogWeeklyReportLog')).toMatch(/\bstartedAt: DateTime\b/);
		expect(typeBody('TimeLogWeeklyReportLog')).toMatch(/\bstoppedAt: DateTime\b/);
		expect(typeBody('TimeLogWeeklyReportLog')).not.toMatch(/\blogType:/);
	});

	it('is recursive where its answer is recursive, so all four groupings are one type', () => {
		const entry = typeBody('TimeLogDailyReportEntry');

		expect(entry).toMatch(/\blogs: \[TimeLogDailyReportEntry!\]!/);
		expect(entry).toMatch(/\bemployeeLogs: \[TimeLogDailyReportGroup!\]!/);
		expect(entry).toMatch(/\bprojectLogs: \[TimeLogDailyReportGroup!\]!/);
		expect(typeBody('TimeLogDailyReportGroup')).toMatch(
			/\btasks: \[TimeLogDailyReportTask!\]!/
		);
	});

	it('carries every money member as `Decimal` and never as `Float`', () => {
		// Every one of these is money: it is added up out of `numeric` columns whose wire format is an
		// exact decimal, and a binary fraction cannot hold a cent exactly.
		expect(typeBody('TimeLogOwedAmountReportEmployee')).toMatch(/\bamount: Decimal!/);
		expect(typeBody('TimeLogOwedAmountReportChartPoint')).toMatch(/\bvalue: Decimal!/);
		expect(typeBody('ProjectBudgetLimit')).toMatch(/\bbudget: Decimal!/);
		expect(typeBody('ProjectBudgetLimit')).toMatch(/\bspent: Decimal!/);
		expect(typeBody('ProjectBudgetLimit')).toMatch(/\bremainingBudget: Decimal!/);
		expect(typeBody('ClientBudgetLimit')).toMatch(/\bbudget: Decimal!/);
		expect(typeBody('ClientBudgetLimit')).toMatch(/\bspent: Decimal!/);
		expect(typeBody('ClientBudgetLimit')).toMatch(/\bremainingBudget: Decimal!/);

		// The charts of the tracked hours are hours and not money, so they are `Float`, and no duration
		// anywhere is an amount.
		expect(typeBody('TimeLogDurationBreakdown')).toMatch(/\btracked: Float!/);
		expect(typeBody('TimeLogDurationBreakdown')).toMatch(/\bresumed: Float!/);
		expect(typeBody('TimeLogTimeLimitReportEmployee')).not.toMatch(/\bduration: Decimal/);
		expect(typeBody('TimeLogTimeLimitReportEntry')).not.toMatch(/\bduration: Decimal/);
	});

	it('declares a filter carrying exactly the columns the delivered list read returns', () => {
		const filter = inputBody('TimeLogFilter');

		expect(filter).toMatch(/startedAt: DateTimeFilter/);
		expect(filter).toMatch(/duration: NumberFilter/);
		expect(filter).toMatch(/logType: StringFilter/);
		expect(filter).toMatch(/isEdited: BooleanFilter/);
		expect(filter).toMatch(/employeeId: IDFilter/);
		expect(filter).toMatch(/deletedAt: DateTimeFilter/);
		expect(filter).toMatch(/and: \[TimeLogFilter!\]/);
		expect(filter).toMatch(/or: \[TimeLogFilter!\]/);
		expect(filter).toMatch(/not: TimeLogFilter/);

		// No relation is filterable anywhere: the rows carry the identifier and nothing behind it.
		expect(filter).not.toMatch(/\bemployee: /);
		expect(filter).not.toMatch(/\bproject: /);
		expect(filter).not.toMatch(/\btimeSlots: /);
		expect(filter).not.toMatch(/\btags: /);
	});
});

describe('TimeLogResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, timeLogService } = surfaces();

		const connection = await resolver.timeLogs(
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			20
		);

		// The read is the one the REST list route performs, with the members it scopes by.
		expect(timeLogService.getTimeLogs).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: undefined,
			endDate: undefined,
			employeeIds: undefined,
			teamIds: undefined,
			activityLevel: undefined
		});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('passes the range, the selectors and the activity window through to the delivered read', async () => {
		const { resolver, timeLogService } = surfaces();
		const startDate = new Date('2026-03-01T00:00:00.000Z');
		const endDate = new Date('2026-03-02T00:00:00.000Z');
		const activityLevel = { start: 10, end: 90 };

		await resolver.timeLogs(
			ORGANIZATION,
			startDate,
			endDate,
			[EMPLOYEE],
			[TENANT],
			activityLevel,
			undefined,
			undefined,
			undefined,
			20
		);

		expect(timeLogService.getTimeLogs).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate,
			endDate,
			employeeIds: [EMPLOYEE],
			teamIds: [TENANT],
			activityLevel
		});
	});

	it('orders the way the delivered read does when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.timeLogs(ORGANIZATION);

		// The delivered read fixes `startedAt` ascending on both of its stores, so the connection
		// reproduces that order rather than inventing one — and the fixtures are in the read's own
		// order, which is what makes this assertion the parity rather than a coincidence.
		expect(connection.nodes.map((node) => node.id)).toEqual(ROWS.map((row) => row.id));
		expect(connection.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows by the fields the filter declares, and refuses the ones it does not', async () => {
		const { resolver } = surfaces();

		const byType = await resolver.timeLogs(
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{ logType: { eq: TimeLogType.MANUAL } }
		);
		expect(byType.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byEdited = await resolver.timeLogs(
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{ isEdited: { eq: true } }
		);
		expect(byEdited.nodes.map((node) => node.id)).toEqual([SECOND]);

		const byDuration = await resolver.timeLogs(
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{ duration: { gte: 3600 } }
		);
		expect(byDuration.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byStart = await resolver.timeLogs(
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{ startedAt: { lt: new Date('2026-03-01T10:00:00.000Z') } }
		);
		expect(byStart.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byProject = await resolver.timeLogs(
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{ projectId: { in: [PROJECT] } }
		);
		expect(byProject.nodes.map((node) => node.id)).toEqual([FIRST]);

		// A relation is not filterable, because the rows carry no relation to narrow by.
		const error = await resolver
			.timeLogs(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, {
				employee: { id: { eq: EMPLOYEE } }
			})
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers, and refuses a column it does not', async () => {
		const { resolver } = surfaces();

		const byDuration = await resolver.timeLogs(
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			[{ field: 'duration', direction: 'DESC' }]
		);
		expect(byDuration.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);

		const byType = await resolver.timeLogs(
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			[{ field: 'logType', direction: 'ASC' }]
		);
		expect(byType.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);

		// The column is filterable and is deliberately not sortable: the enum states the keys a
		// timesheet is read in an order for, and the refusal names what is on offer.
		const refusal = await resolver
			.timeLogs(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, [
				{ field: 'description', direction: 'ASC' }
			] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();

		const first = await resolver.timeLogs(
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			1
		);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(CursorCodec.decode(first.pageInfo.endCursor ?? '').id).toBe(FIRST);

		const second = await resolver.timeLogs(
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{ first: 1, after: first.pageInfo.endCursor ?? undefined }
		);

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.timeLogs(
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			20
		);
		const last = await resolver.timeLogs(
			ORGANIZATION,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{ last: 1, before: all.edges[1].cursor }
		);

		expect(last.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.timeLogs(
				ORGANIZATION,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				5,
				undefined,
				undefined,
				undefined,
				5
			)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every log of the organization', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.timeLogs(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 500)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('TimeLogResolver — one concept, two protocols, the same operations', () => {
	it('reads one log through the same service method the node route calls', async () => {
		const { resolver, timeLogService } = surfaces();

		expect(await resolver.timeLog(FIRST)).toBe(ROWS[0]);
		expect(timeLogService.findOneByIdString).toHaveBeenCalledWith(FIRST, { relations: [] });
	});

	it('answers null for a log that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, timeLogService } = surfaces();
		timeLogService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.timeLog(SECOND)).toBeNull();
	});

	it('answers the conflicts of a window through the command its route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		const startDate = new Date('2026-03-01T09:00:00.000Z');
		const endDate = new Date('2026-03-01T12:00:00.000Z');

		expect(await resolver.timeLogConflicts(startDate, endDate, EMPLOYEE, ORGANIZATION, [FIRST])).toBe(ROWS);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(IGetConflictTimeLogCommand);
		expect(command.input).toEqual({
			startDate,
			endDate,
			employeeId: EMPLOYEE,
			organizationId: ORGANIZATION,
			ignoreId: [FIRST]
		});

		// A caller that names no row to leave out states none, which is the shape the route's own
		// query string has in that case — rather than the same request with an absent member on it.
		await resolver.timeLogConflicts(startDate, endDate, EMPLOYEE, ORGANIZATION);

		expect(commandBus.execute.mock.calls[1][0].input).toEqual({
			startDate,
			endDate,
			employeeId: EMPLOYEE,
			organizationId: ORGANIZATION
		});
	});

	it('answers the daily report through the same service method its route calls, with the same grouping', async () => {
		const { resolver, timeLogService } = surfaces();
		const startDate = new Date('2026-03-01T00:00:00.000Z');
		const endDate = new Date('2026-03-02T00:00:00.000Z');
		const activityLevel = { start: 10, end: 90 };

		const answer = await resolver.timeLogDailyReport(
			ORGANIZATION,
			ReportGroupFilterEnum.date,
			startDate,
			endDate,
			[EMPLOYEE],
			[PROJECT],
			[TASK],
			[TENANT],
			[TimeLogSourceEnum.WEB_TIMER],
			[TimeLogType.MANUAL],
			TENANT,
			true,
			activityLevel,
			'Europe/Berlin'
		);

		expect(timeLogService.getDailyReport).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate,
			endDate,
			employeeIds: [EMPLOYEE],
			projectIds: [PROJECT],
			taskIds: [TASK],
			teamIds: [TENANT],
			source: [TimeLogSourceEnum.WEB_TIMER],
			logType: [TimeLogType.MANUAL],
			timesheetId: TENANT,
			isEdited: true,
			activityLevel,
			timeZone: 'Europe/Berlin',
			groupBy: ReportGroupFilterEnum.date
		});

		// The answer's tree is the delivered tree with each nested row carried as its identifier: this
		// grouping carries the date at the top and the project one level below it, which is the
		// delivered by-date grouping's own shape.
		const [day] = answer;
		expect(day.date).toBe('2026-03-01');
		expect(day.projectId).toBeUndefined();
		expect(day.sum).toBe(3600);
		expect(day.logs).toHaveLength(1);
		expect(day.logs[0].projectId).toBe(PROJECT);
		expect(day.logs[0].employeeLogs[0].employeeId).toBe(EMPLOYEE);
		expect(day.logs[0].employeeLogs[0].tasks[0]).toEqual({
			taskId: TASK,
			description: 'Wrote the resolver',
			duration: 3600,
			clientId: CLIENT
		});
	});

	it('answers the daily chart through the same service method its route calls, with the unit stated', async () => {
		const { resolver, timeLogService } = surfaces();

		const answer = await resolver.timeLogDailyReportChart(
			ORGANIZATION,
			undefined, // startDate
			undefined, // endDate
			undefined, // employeeIds
			undefined, // projectIds
			undefined, // taskIds
			undefined, // teamIds
			undefined, // source
			undefined, // logType
			undefined, // timesheetId
			undefined, // isEdited
			undefined, // activityLevel
			'UTC' // timeZone
		);

		expect(timeLogService.getDailyReportCharts).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: undefined,
			endDate: undefined,
			employeeIds: undefined,
			projectIds: undefined,
			taskIds: undefined,
			teamIds: undefined,
			source: undefined,
			logType: undefined,
			timesheetId: undefined,
			isEdited: undefined,
			activityLevel: undefined,
			timeZone: 'UTC'
		});

		// The delivered map is keyed by the four log types; the type states them as four members whose
		// values are hours.
		expect(answer).toEqual([
			{ date: '2026-03-01', value: { tracked: 0.5, manual: 1, idle: 0, resumed: 0.2 } }
		]);
	});

	it('answers the owed amounts through the same service method its route calls, as money and seconds', async () => {
		const { resolver, timeLogService } = surfaces();

		const answer = await resolver.timeLogOwedAmountReport(
			ORGANIZATION,
			undefined, // startDate
			undefined, // endDate
			undefined, // employeeIds
			undefined, // projectIds
			undefined, // taskIds
			undefined, // teamIds
			undefined, // source
			undefined, // logType
			undefined, // timesheetId
			undefined, // isEdited
			undefined, // activityLevel
			'UTC' // timeZone
		);

		expect(timeLogService.getOwedAmountReport).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: undefined,
			endDate: undefined,
			employeeIds: undefined,
			projectIds: undefined,
			taskIds: undefined,
			teamIds: undefined,
			source: undefined,
			logType: undefined,
			timesheetId: undefined,
			isEdited: undefined,
			activityLevel: undefined,
			timeZone: 'UTC'
		});
		expect(answer).toEqual([
			{ date: '2026-03-01', employees: [{ employeeId: EMPLOYEE, duration: 3600, amount: 120.5 }] }
		]);
	});

	it('answers the owed-amount chart through the same service method its route calls', async () => {
		const { resolver, timeLogService } = surfaces();

		const answer = await resolver.timeLogOwedAmountReportChart(ORGANIZATION);

		expect(timeLogService.getOwedAmountReportCharts).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: undefined,
			endDate: undefined,
			employeeIds: undefined,
			projectIds: undefined,
			taskIds: undefined,
			teamIds: undefined,
			source: undefined,
			logType: undefined,
			timesheetId: undefined,
			isEdited: undefined,
			activityLevel: undefined,
			timeZone: undefined
		});
		expect(answer).toEqual([{ date: '2026-03-01', value: 120.5 }]);
	});

	it('answers the weekly report through the same service method its route calls, with its days as a list', async () => {
		const { resolver, timeLogService } = surfaces();

		const answer = await resolver.timeLogWeeklyReport(
			ORGANIZATION,
			undefined, // startDate
			undefined, // endDate
			undefined, // employeeIds
			undefined, // projectIds
			undefined, // taskIds
			undefined, // teamIds
			undefined, // source
			undefined, // logType
			undefined, // timesheetId
			undefined, // isEdited
			undefined, // activityLevel
			'UTC' // timeZone
		);

		expect(timeLogService.getWeeklyReport).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: undefined,
			endDate: undefined,
			employeeIds: undefined,
			projectIds: undefined,
			taskIds: undefined,
			teamIds: undefined,
			source: undefined,
			logType: undefined,
			timesheetId: undefined,
			isEdited: undefined,
			activityLevel: undefined,
			timeZone: 'UTC'
		});

		const [week] = answer;
		expect(week.employeeId).toBe(EMPLOYEE);
		expect(week.sum).toBe(3600);
		// Every day of the range is an entry, in the range's own order: the delivered map's bare zero
		// is a day nothing was recorded on, and it is read as one.
		expect(week.dates.map((day) => day.date)).toEqual(['2026-03-01', '2026-03-02']);
		expect(week.dates[1]).toEqual({ date: '2026-03-02', sum: 0, logs: [] });
		// Each log of a day is projected to the four columns the weekly read selected.
		expect(week.dates[0].logs[0]).toEqual({
			id: FIRST,
			employeeId: EMPLOYEE,
			startedAt: ROWS[0].startedAt,
			stoppedAt: ROWS[0].stoppedAt
		});
		expect(Object.keys(week.dates[0].logs[0]).sort()).toEqual([
			'employeeId',
			'id',
			'startedAt',
			'stoppedAt'
		]);
	});

	it('answers the time limits through the same service method its route calls, with the period passed through', async () => {
		const { resolver, timeLogService } = surfaces();

		const answer = await resolver.timeLogTimeLimitReport(
			ORGANIZATION,
			undefined, // startDate
			undefined, // endDate
			undefined, // employeeIds
			undefined, // projectIds
			undefined, // taskIds
			undefined, // teamIds
			undefined, // source
			undefined, // logType
			undefined, // timesheetId
			undefined, // isEdited
			undefined, // activityLevel
			'UTC', // timeZone
			'week' // duration
		);

		expect(timeLogService.getTimeLimit).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: undefined,
			endDate: undefined,
			employeeIds: undefined,
			projectIds: undefined,
			taskIds: undefined,
			teamIds: undefined,
			source: undefined,
			logType: undefined,
			timesheetId: undefined,
			isEdited: undefined,
			activityLevel: undefined,
			timeZone: 'UTC',
			duration: 'week'
		});
		// The percentage travels as the delivered calculation rendered it, and is never rounded here.
		expect(answer).toEqual([
			{
				date: '2026-03-01',
				employees: [{ employeeId: EMPLOYEE, duration: 3600, durationPercentage: '20.00', limit: 18000 }]
			}
		]);
	});

	it('answers the project budgets through the same service method its route calls', async () => {
		const { resolver, timeLogService } = surfaces();
		const startDate = new Date('2026-03-01T00:00:00.000Z');
		const endDate = new Date('2026-03-02T00:00:00.000Z');

		expect(await resolver.projectBudgetLimit(ORGANIZATION, startDate, endDate, [EMPLOYEE], [PROJECT])).toBe(
			PROJECT_BUDGET
		);
		expect(timeLogService.getProjectBudgetLimit).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate,
			endDate,
			employeeIds: [EMPLOYEE],
			projectIds: [PROJECT]
		});
	});

	it('answers the client budgets through the same service method its route calls', async () => {
		const { resolver, timeLogService } = surfaces();

		expect(await resolver.clientBudgetLimit(ORGANIZATION)).toBe(CLIENT_BUDGET);
		expect(timeLogService.getClientBudgetLimit).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: undefined,
			endDate: undefined,
			employeeIds: undefined,
			projectIds: undefined
		});
	});

	it('records time through the same service method the create route calls, as the delivered body reads it', async () => {
		const { resolver, timeLogService } = surfaces();
		// The delivered pipe rewrites the employee unless the caller may choose one, so the suite
		// states a caller that may — the write this test is about is the body, not the scope.
		caller(true);
		const startedAt = new Date('2026-03-01T09:00:00.000Z');
		const stoppedAt = new Date('2026-03-01T10:00:00.000Z');

		expect(
			await resolver.addManualTime({
				organizationId: ORGANIZATION,
				employeeId: EMPLOYEE,
				startedAt,
				stoppedAt,
				description: 'By hand'
			})
		).toBe(ROWS[0]);

		// Both members the delivered body stamps for itself are stated, and they are the values the
		// delivered transform and the delivered handler default to.
		expect(timeLogService.addManualTime).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			startedAt,
			stoppedAt,
			description: 'By hand',
			logType: TimeLogType.MANUAL,
			source: TimeLogSourceEnum.WEB_TIMER
		});
	});

	it('records a caller that may not choose an employee against itself, which is the delivered pipe', async () => {
		const { resolver, timeLogService } = surfaces();
		caller(false, OTHER_EMPLOYEE);
		const startedAt = new Date('2026-03-01T09:00:00.000Z');
		const stoppedAt = new Date('2026-03-01T10:00:00.000Z');

		await resolver.addManualTime({ organizationId: ORGANIZATION, employeeId: EMPLOYEE, startedAt, stoppedAt });

		expect(timeLogService.addManualTime.mock.calls[0][0].employeeId).toBe(OTHER_EMPLOYEE);

		// A caller that may choose one keeps the employee it stated.
		caller(true, OTHER_EMPLOYEE);
		await resolver.addManualTime({ organizationId: ORGANIZATION, employeeId: EMPLOYEE, startedAt, stoppedAt });

		expect(timeLogService.addManualTime.mock.calls[1][0].employeeId).toBe(EMPLOYEE);
	});

	it('edits a log through the same service method the update route calls, with the identifier in both places', async () => {
		const { resolver, timeLogService } = surfaces();
		// The update runs the same employee pipe the create runs, so the caller is stated the same way.
		caller(true);
		const startedAt = new Date('2026-03-01T09:30:00.000Z');
		const stoppedAt = new Date('2026-03-01T10:30:00.000Z');

		await resolver.updateManualTime({
			id: FIRST,
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			startedAt,
			stoppedAt,
			reason: 'Corrected'
		});

		expect(timeLogService.updateManualTime).toHaveBeenCalledWith(FIRST, {
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			startedAt,
			stoppedAt,
			reason: 'Corrected'
		});

		// The update body carries neither a log type nor a source, because the delivered body does
		// not, so the two members the row already has are left as they are.
		expect(timeLogService.updateManualTime.mock.calls[0][1]).not.toHaveProperty('logType');
		expect(timeLogService.updateManualTime.mock.calls[0][1]).not.toHaveProperty('source');
	});

	it('removes logs through the same service method the delete route calls', async () => {
		const { resolver, timeLogService } = surfaces();

		expect(await resolver.deleteTimeLogs({ logIds: [FIRST, SECOND], organizationId: ORGANIZATION })).toBe(true);

		// An absent flag is read as `false`, which is the delivered body's own transform and the
		// delivered handler's own default.
		expect(timeLogService.deleteTimeLogs).toHaveBeenCalledWith({
			logIds: [FIRST, SECOND],
			organizationId: ORGANIZATION,
			forceDelete: false
		});

		await resolver.deleteTimeLogs({ logIds: [FIRST], organizationId: ORGANIZATION, forceDelete: true });

		expect(timeLogService.deleteTimeLogs.mock.calls[1][0].forceDelete).toBe(true);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, timeLogService } = surfaces();
		const refusal = new Error('TIME_LOG_NOT_MANAGED: the caller does not manage this employee.');

		timeLogService.deleteTimeLogs.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteTimeLogs({ logIds: [FIRST], organizationId: ORGANIZATION })).rejects.toBe(
			refusal
		);
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
	{ field: 'timeLogs', route: 'getLogs' },
	{ field: 'timeLog', route: 'findById' },
	{ field: 'timeLogConflicts', route: 'getConflict' },
	{ field: 'timeLogDailyReport', route: 'getDailyReport' },
	{ field: 'timeLogDailyReportChart', route: 'getDailyReportChartData' },
	{ field: 'timeLogOwedAmountReport', route: 'getOwedAmountReport' },
	{ field: 'timeLogOwedAmountReportChart', route: 'getOwedAmountReportChartData' },
	{ field: 'timeLogWeeklyReport', route: 'getWeeklyReport' },
	{ field: 'timeLogTimeLimitReport', route: 'getTimeLimitReport' },
	{ field: 'projectBudgetLimit', route: 'getProjectBudgetLimit' },
	{ field: 'clientBudgetLimit', route: 'clientBudgetLimit' },
	{ field: 'addManualTime', route: 'addManualTime' },
	{ field: 'updateManualTime', route: 'updateManualTime' },
	{ field: 'deleteTimeLogs', route: 'deleteTimeLog' }
];

describe('TimeLogResolver — the guard stack and the permission are the route’s, field by field', () => {
	it('states on the class the guards and the permission the controller states on its class', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', TimeLogController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', TimeLogResolver) ?? [];

		// The delivered controller carries `TenantBaseGuard`, and deliberately not the permission-aware
		// tenant guard its neighbours carry: the two are different guards, and only one of them is this
		// resource's. A resolver that guessed the wrong one would refuse callers this controller serves.
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantBaseGuard, PermissionGuard]));
		expect(controllerGuards).not.toContain(TenantPermissionGuard);
		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantBaseGuard, PermissionGuard, FeatureFlagGuard])
		);
		expect(resolverGuards).not.toContain(TenantPermissionGuard);

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TimeLogResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, TimeLogController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TimeLogResolver)).toEqual([
			PermissionsEnum.TIME_TRACKER,
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ALL_ORG_VIEW
		]);
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared.
		expect(typeof handlersOf(TimeLogController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because
		// it is not a scope: every other guard of the field's chain is the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(TimeLogController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(TimeLogController, route));
	});

	it('carries the organization guard and the single permission each write’s own handler states', () => {
		// The three writes are the only handlers of this controller that state anything of their own:
		// each adds `OrganizationPermissionGuard` and replaces the class grant with one `ALLOW_*`.
		for (const [field, route, permission] of [
			['addManualTime', 'addManualTime', PermissionsEnum.ALLOW_MANUAL_TIME],
			['updateManualTime', 'updateManualTime', PermissionsEnum.ALLOW_MODIFY_TIME],
			['deleteTimeLogs', 'deleteTimeLog', PermissionsEnum.ALLOW_DELETE_TIME]
		] as ReadonlyArray<[string, string, PermissionsEnum]>) {
			expect(Reflect.getMetadata('__guards__', handlersOf(TimeLogController)[route])).toEqual([
				OrganizationPermissionGuard
			]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(TimeLogController)[route])).toEqual([
				permission
			]);

			expect(guardsOfField(field)).toContain(OrganizationPermissionGuard);
			expect(permissionOfField(field)).toEqual([permission]);
			// The class grant is overridden rather than inherited, on both surfaces.
			expect(permissionOfField(field)).not.toEqual(Reflect.getMetadata(PERMISSIONS_METADATA, TimeLogController));
		}
	});

	it('leaves every read under the class grant, because not one read handler states its own', () => {
		for (const route of [
			'getLogs',
			'findById',
			'getConflict',
			'getDailyReport',
			'getDailyReportChartData',
			'getOwedAmountReport',
			'getOwedAmountReportChartData',
			'getWeeklyReport',
			'getTimeLimitReport',
			'getProjectBudgetLimit',
			'clientBudgetLimit'
		]) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(TimeLogController)[route])).toBeUndefined();
			expect(Reflect.getMetadata('__guards__', handlersOf(TimeLogController)[route])).toBeUndefined();
		}

		expect(permissionOfField('timeLogs')).toEqual([
			PermissionsEnum.TIME_TRACKER,
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ALL_ORG_VIEW
		]);
		expect(permissionOfField('timeLog')).toEqual(permissionOfRoute(TimeLogController, 'findById'));
		expect(permissionOfField('projectBudgetLimit')).toEqual(
			permissionOfRoute(TimeLogController, 'getProjectBudgetLimit')
		);
	});
});

describe('TimeLogModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, TimeLogModule) ?? []) as unknown[];

		expect(providers).toContain(TimeLogResolver);
		expect(providers).toContain(TimeLogService);
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
		getHandler: () => (TimeLogResolver.prototype as never)[field],
		getClass: () => TimeLogResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TimeLogResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the
		// class, so every field is behind it — the three writes included.
		expect(Reflect.getMetadata(FEATURE_METADATA, TimeLogResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TimeLogResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('timeLogs')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('timeLogs');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('timeLogs'))).resolves.toBe(true);
	});
});
