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
import { PARAM_ARGS_METADATA } from '@nestjs/graphql';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import {
	EmployeeTrackedDataGuard,
	FeatureFlagGuard,
	PermissionGuard,
	TenantPermissionGuard
} from '../../shared/guards';
import { ProfileActivityResolver } from './profile-activity.resolver';
import { StatisticController } from './statistic.controller';
import { StatisticModule } from './statistic.module';
import { StatisticResolver } from './statistic.resolver';
import { StatisticService } from './statistic.service';

/**
 * The time-tracking statistic domain over GraphQL.
 *
 * The delivered REST surface serves seven reads under `/timesheet/statistics` — four counts and three
 * ranked lists — one of them, the task list, over a `POST` that is nevertheless a read. This suite pins
 * the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and none of them is a
 *   resource: there is no connection, no node field, no count field and no mutation, because the
 *   controller serves no `GET /:id`, no `GET /count` and no write at all;
 * - every field reaches the same `StatisticService` method its route calls, with the same request the
 *   route binds — the same members and no substituted default, so a client does not choose a better
 *   surface by choosing a protocol;
 * - **the guard chain and the permission are the controller's, read from the controller's own
 *   metadata**: every one of the seven routes inherits the class-level list, and every field states
 *   that same list, which is what the field-by-field parity below compares rather than restates;
 * - the argument names the schema declares are the argument names the resolver binds, so a field can
 *   never answer while quietly dropping what its caller stated;
 * - every computed answer is declared with the members its own read fills — a duration in seconds and
 *   never money, a percentage that says what it is a percentage of, a count as `Int`, and a relation
 *   the read does not fill carried as the identifier that always travels;
 * - **the gate holds**: a switched-off `FEATURE_GRAPHQL` refuses a field with the query protocol's own
 *   404, and a switched-on one serves it.
 */

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const PROJECT = '00000000-0000-4000-8000-000000000004';
const TASK = '00000000-0000-4000-8000-000000000005';
const TEAM = '00000000-0000-4000-8000-000000000006';
const TIME_LOG = '00000000-0000-4000-8000-000000000007';
const TIME_SLOT = '00000000-0000-4000-8000-000000000008';
const SCREENSHOT = '00000000-0000-4000-8000-000000000009';

const START = new Date('2026-08-01T00:00:00.000Z');
const END = new Date('2026-08-08T00:00:00.000Z');
const TODAY_START = new Date('2026-08-05T00:00:00.000Z');
const TODAY_END = new Date('2026-08-06T00:00:00.000Z');

/** The account projection the delivered reads answer beside a member, a log and a slot. */
const ACCOUNT = { name: 'Ada Lovelace', imageUrl: 'https://files.test/ada.png' };

/** What the counts read answers: two counts, two activity percentages and two durations in seconds. */
const COUNTS = {
	employeesCount: 3,
	projectsCount: 2,
	weekActivities: 72.35,
	weekDuration: 144000,
	todayActivities: 65.5,
	todayDuration: 28800
};

/** What the members read answers, with the weekly split and the account it fills itself. */
const MEMBERS = [
	{
		id: EMPLOYEE,
		isOnline: true,
		isAway: false,
		weekTime: { employeeId: EMPLOYEE, duration: 144000, overall: 72.4 },
		todayTime: { employeeId: EMPLOYEE, duration: 28800, overall: 65.5 },
		weekHours: [{ day: 1, duration: 28800 }],
		user: ACCOUNT
	}
];

/** What the projects read answers, one project per ranked row. */
const PROJECTS = [{ id: PROJECT, name: 'Gauzy', duration: 90000, durationPercentage: 62.5 }];

/** What the tasks read answers, durations included as the delivered aggregation leaves them. */
const TASKS = [
	{
		id: TASK,
		title: 'Ship the statistics surface',
		duration: 5400,
		todayDuration: 1800,
		durationPercentage: 3.75,
		updatedAt: new Date('2026-08-05T09:00:00.000Z')
	}
];

/** What the manual-times read answers, with both projections it fills from its own read. */
const MANUAL_TIMES = [
	{
		id: TIME_LOG,
		startedAt: START,
		duration: 3600,
		employeeId: EMPLOYEE,
		user: ACCOUNT,
		project: { name: 'Gauzy', imageUrl: 'https://files.test/gauzy.png' }
	}
];

/** What the time-slot read answers: the engagement, its account, and its slots with their screenshots. */
const EMPLOYEE_SLOTS = [
	{
		id: EMPLOYEE,
		isOnline: true,
		isAway: false,
		startedAt: END,
		user: ACCOUNT,
		timeSlots: [
			{
				id: TIME_SLOT,
				startedAt: START,
				stoppedAt: END,
				duration: 600,
				keyboard: 120,
				mouse: 80,
				overall: 200,
				employeeId: EMPLOYEE,
				screenshots: [
					{
						id: SCREENSHOT,
						file: 'shots/1.png',
						thumb: 'thumbs/1.png',
						thumbUrl: 'https://files.test/thumbs/1.png'
					}
				]
			}
		]
	}
];

/** What the activities read answers, one ranked title per row. */
const ACTIVITIES = [{ title: 'Editing code', sessions: 12, duration: 5400, durationPercentage: 42.5 }];

/** The resolver, over a scripted service. */
function surfaces() {
	const statisticService = {
		getCounts: jest.fn().mockResolvedValue(COUNTS),
		getMembers: jest.fn().mockResolvedValue(MEMBERS),
		getProjects: jest.fn().mockResolvedValue(PROJECTS),
		getTasks: jest.fn().mockResolvedValue(TASKS),
		manualTimes: jest.fn().mockResolvedValue(MANUAL_TIMES),
		getEmployeeTimeSlots: jest.fn().mockResolvedValue(EMPLOYEE_SLOTS),
		getActivities: jest.fn().mockResolvedValue(ACTIVITIES)
	};

	return {
		statisticService,
		resolver: new StatisticResolver(statisticService as never)
	};
}

/**
 * The composed schema, as text: this domain's own documents plus every kernel and domain document the
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

/**
 * The one root field the sibling profile-activity document declares, which shares this domain's prefix.
 *
 * Excluded here because that document mirrors the second controller and is asserted by its own suite:
 * naming it rather than widening the filter is what keeps a field this domain loses a failure instead
 * of a quietly shorter list.
 */
const SIBLING_FIELD = 'timeTrackingProfileActivity';

/** The root fields this domain's own document contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.startsWith('timeTracking') && field !== SIBLING_FIELD)
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type, which the activity band is declared as. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The description printed above one member, which is where a member's unit and denominator are stated. */
function descriptionOf(typeName: string, member: string): string {
	const match = new RegExp(`"""([\\s\\S]*?)"""\\s*\\n\\s*${member}\\b`).exec(typeBody(typeName));

	return match?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof StatisticController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof StatisticController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof StatisticController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under, read the way the guard reads it. */
function permissionOfField(field: string): unknown {
	const fields = StatisticResolver.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, StatisticResolver)
	);
}

/**
 * The guards one resolver field runs under, the class chain first.
 *
 * The field's own list is **appended to** the class's rather than preferred over it, which is what the
 * guard context creator does with the two: `ContextCreator.createContext` concatenates the class's
 * `__guards__` metadata and the handler's, so a field that states a guard of its own runs under the
 * class's guards *and* that one. Reading the field's list alone would under-report the chain for
 * exactly the fields this half of the doctrine exists to check — the six whose route carries
 * `EmployeeTrackedDataGuard` on the handler rather than on the controller — and would report a chain
 * neither surface runs under.
 */
function guardsOfField(field: string): unknown[] {
	const fields = StatisticResolver.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', StatisticResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fields[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/**
 * The argument names one field binds, as the resolver's own parameter metadata states them.
 *
 * Read from the metadata rather than from the method signature, because the signature's names are not
 * what the runtime binds: an `@Args` name that disagreed with the schema's would leave the parameter
 * undefined with nothing failing anywhere, so the two readings are compared below.
 */
function boundArgs(field: string): string[] {
	const metadata = (Reflect.getMetadata(PARAM_ARGS_METADATA, StatisticResolver, field) ?? {}) as Record<
		string,
		{ data?: string }
	>;

	return Object.values(metadata)
		.map((argument) => argument?.data)
		.filter((name): name is string => Boolean(name))
		.sort();
}

describe('StatisticResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares one root field per delivered read, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([
			'timeTrackingActivities',
			'timeTrackingCounts',
			'timeTrackingManualTimes',
			'timeTrackingMembers',
			'timeTrackingProjects',
			'timeTrackingTasks',
			'timeTrackingTimeSlots'
		]);
	});

	it('declares no write, because the controller serves none', () => {
		// The one `POST` route is a read whose filter travels in its body; it is a query here, so this
		// domain contributes nothing to `Mutation` at all.
		expect(ownedRootFields('Mutation')).toEqual([]);
	});

	it('declares no connection, no node field and no count field, because the answers are computations', () => {
		expect(printed).not.toMatch(/type TimeTrackingConnection/);
		expect(ownedRootFields('Query')).not.toContain('timeTrackingStatistic');
		expect(ownedRootFields('Query')).not.toContain('timeTrackingCount');
		expect(rootFields('Query')).not.toContain('timeTrackingStatistic');
	});

	it('answers each field with the type declared for it', () => {
		expect(fieldType('Query', 'timeTrackingCounts')).toBe('TimeTrackingCounts!');
		expect(fieldType('Query', 'timeTrackingMembers')).toBe('[TimeTrackingMemberStatistic!]!');
		expect(fieldType('Query', 'timeTrackingProjects')).toBe('[TimeTrackingProjectStatistic!]!');
		expect(fieldType('Query', 'timeTrackingTasks')).toBe('[TimeTrackingTaskStatistic!]!');
		expect(fieldType('Query', 'timeTrackingManualTimes')).toBe('[TimeTrackingManualTimeStatistic!]!');
		expect(fieldType('Query', 'timeTrackingTimeSlots')).toBe('[TimeTrackingTimeSlotStatistic!]!');
		expect(fieldType('Query', 'timeTrackingActivities')).toBe('[TimeTrackingActivityStatistic!]!');
	});

	it('states the organization every read resolves through, and the range each read defaults', () => {
		// The organization has no default in any delivered read, so it is required on every field.
		for (const field of ownedRootFields('Query')) {
			expect(fieldArgs('Query', field)).toContain('organizationId');
			expect(printed).toMatch(new RegExp(`${field}\\([^)]*organizationId: ID!`));
		}

		// The counts field carries the today period beside the range, because the two are different
		// periods rather than one paginated one.
		expect(fieldArgs('Query', 'timeTrackingCounts')).toEqual(
			expect.arrayContaining([
				'organizationId',
				'startDate',
				'endDate',
				'todayStart',
				'todayEnd',
				'employeeIds',
				'projectIds',
				'teamIds',
				'activityLevel',
				'logType',
				'source',
				'onlyMe'
			])
		);
	});

	it('offers only the arguments each delivered read actually consults', () => {
		// The members read consults neither the activity band nor `onlyMe`, so neither is offered.
		expect(fieldArgs('Query', 'timeTrackingMembers')).not.toContain('activityLevel');
		expect(fieldArgs('Query', 'timeTrackingMembers')).not.toContain('onlyMe');
		expect(fieldArgs('Query', 'timeTrackingMembers')).not.toContain('taskIds');

		// The counts read consults no task selector: its two counts are over logs and slots.
		expect(fieldArgs('Query', 'timeTrackingCounts')).not.toContain('taskIds');
		expect(fieldArgs('Query', 'timeTrackingCounts')).not.toContain('organizationTeamId');

		// The task read is the one read that takes a task selector, a team beside the team list, a
		// truncation, and the two members that make it compute a range of its own.
		expect(fieldArgs('Query', 'timeTrackingTasks')).toEqual(
			expect.arrayContaining(['taskIds', 'organizationTeamId', 'take', 'defaultRange', 'unitOfTime'])
		);

		// The projects, manual-times, time-slots and activities reads take the range, the three
		// selectors and `onlyMe`, and nothing else.
		for (const field of [
			'timeTrackingProjects',
			'timeTrackingManualTimes',
			'timeTrackingTimeSlots',
			'timeTrackingActivities'
		]) {
			expect(fieldArgs('Query', field).sort()).toEqual(
				['organizationId', 'startDate', 'endDate', 'employeeIds', 'projectIds', 'teamIds', 'onlyMe'].sort()
			);
		}
	});

	it('binds every argument the SDL declares, field by field', () => {
		for (const field of ownedRootFields('Query')) {
			expect(boundArgs(field)).toEqual([...fieldArgs('Query', field)].sort());
		}
	});
});

describe('StatisticResolver — every computed answer is declared as its read answers it', () => {
	it('declares the counts as two counts, two percentages and two durations in seconds', () => {
		const body = typeBody('TimeTrackingCounts');

		expect(body).toMatch(/employeesCount: Int!/);
		expect(body).toMatch(/projectsCount: Int!/);
		expect(body).toMatch(/weekActivities: Float!/);
		expect(body).toMatch(/todayActivities: Float!/);
		expect(descriptionOf('TimeTrackingCounts', 'weekDuration')).toContain('Seconds');
		expect(descriptionOf('TimeTrackingCounts', 'todayActivities')).toContain('percentage');
	});

	it('declares the member answer with the members its read fills, and no more', () => {
		const body = typeBody('TimeTrackingMemberStatistic');

		expect(body).toMatch(/id: ID!/);
		expect(body).toMatch(/isOnline: Boolean/);
		expect(body).toMatch(/weekTime: TimeTrackingMemberTime/);
		expect(body).toMatch(/todayTime: TimeTrackingMemberTime/);
		expect(body).toMatch(/weekHours: \[TimeTrackingMemberWeekHour!\]!/);
		expect(body).toMatch(/user: TimeTrackingUserSummary/);
		// The delivered read deletes the account identifier after it has resolved the account, so a row
		// never carries it and this surface does not declare it.
		expect(body).not.toContain('user_id');
	});

	it('declares a member’s day split as a store day number and a duration in seconds', () => {
		expect(typeBody('TimeTrackingMemberWeekHour')).toMatch(/day: Int/);
		expect(descriptionOf('TimeTrackingMemberWeekHour', 'duration')).toContain('Seconds');
	});

	it('declares each ranked answer with its own share of the period stated as a percentage', () => {
		expect(descriptionOf('TimeTrackingProjectStatistic', 'durationPercentage')).toContain('share');
		expect(descriptionOf('TimeTrackingActivityStatistic', 'durationPercentage')).toContain('share');
		expect(descriptionOf('TimeTrackingTaskStatistic', 'durationPercentage')).toContain('share');

		// The share is of the whole period, not of the five answers beside it — which is the difference
		// between a dashboard's ranked list and a distribution, and is stated in the SDL.
		expect(descriptionOf('TimeTrackingProjectStatistic', 'durationPercentage')).toContain(
			'every project of the organization'
		);
	});

	it('declares a task’s answer honestly, including the durations the aggregation can leave absent', () => {
		const body = typeBody('TimeTrackingTaskStatistic');

		expect(body).toMatch(/title: String!/);
		expect(body).toMatch(/duration: Float\n/);
		expect(body).toMatch(/durationPercentage: Float!/);
		expect(body).toMatch(/updatedAt: DateTime/);
	});

	it('declares a manual log’s engagement as its identifier, and the two projections its read fills', () => {
		const body = typeBody('TimeTrackingManualTimeStatistic');

		expect(body).toMatch(/employeeId: ID!/);
		expect(body).toMatch(/user: TimeTrackingUserSummary/);
		expect(body).toMatch(/project: TimeTrackingProjectSummary/);
		// One of the two reads behind this answer fills the engagement itself and the other only its
		// identifier, so no engagement row is declared here.
		expect(body).not.toMatch(/employee: /);
	});

	it('declares a slot with the columns both reads project, and its engagement as an identifier', () => {
		const body = typeBody('TimeTrackingTimeSlot');

		expect(body).toMatch(/startedAt: DateTime/);
		expect(body).toMatch(/stoppedAt: DateTime/);
		expect(body).toMatch(/overall: Float/);
		expect(body).toMatch(/employeeId: ID/);
		expect(body).toMatch(/screenshots: \[TimeTrackingScreenshot!\]!/);
		// The logs of a slot are loaded by one read and not selected by the other, so they are not a
		// member here: a member that is filled on one store and empty on the other is worse than none.
		expect(body).not.toContain('timeLogs');
	});

	it('declares no money anywhere, because a tracked second is not an amount', () => {
		for (const type of [
			'timeTrackingCounts',
			'timeTrackingMembers',
			'timeTrackingProjects',
			'timeTrackingTasks',
			'timeTrackingManualTimes',
			'timeTrackingTimeSlots',
			'timeTrackingActivities'
		]) {
			expect(fieldType('Query', type)).not.toContain('Decimal');
		}

		for (const name of [
			'TimeTrackingCounts',
			'TimeTrackingMemberStatistic',
			'TimeTrackingMemberTime',
			'TimeTrackingMemberWeekHour',
			'TimeTrackingUserSummary',
			'TimeTrackingProjectStatistic',
			'TimeTrackingTaskStatistic',
			'TimeTrackingManualTimeStatistic',
			'TimeTrackingProjectSummary',
			'TimeTrackingTimeSlotStatistic',
			'TimeTrackingTimeSlot',
			'TimeTrackingScreenshot',
			'TimeTrackingActivityStatistic'
		]) {
			expect(typeBody(name)).not.toContain('Decimal');
		}
	});

	it('declares the activity band its reads narrow by as two named bounds rather than a document', () => {
		const body = inputBody('TimeTrackingActivityLevelInput');

		// An input type rather than a `JSON` blob: the delivered read consults exactly these two members,
		// so exactly these two are the shape a caller states. Both are required, because a band with one
		// end is not a band.
		expect(body).toMatch(/start: Int!/);
		expect(body).toMatch(/end: Int!/);
		expect(body).not.toContain('start: Int\n');
		expect(body).not.toContain('end: Int\n');
	});
});

describe('StatisticResolver — one concept, two protocols, the same operations', () => {
	it('counts through the same service method the counts route calls, with the same request', async () => {
		const { resolver, statisticService } = surfaces();

		const answer = await resolver.timeTrackingCounts(
			ORGANIZATION,
			START,
			END,
			TODAY_START,
			TODAY_END,
			[EMPLOYEE],
			[PROJECT],
			[TEAM],
			{ start: 10, end: 90 },
			['MANUAL'],
			['DESKTOP'],
			true
		);

		expect(answer).toBe(COUNTS);
		expect(statisticService.getCounts).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: START,
			endDate: END,
			todayStart: TODAY_START,
			todayEnd: TODAY_END,
			employeeIds: [EMPLOYEE],
			projectIds: [PROJECT],
			teamIds: [TEAM],
			activityLevel: { start: 10, end: 90 },
			logType: ['MANUAL'],
			source: ['DESKTOP'],
			onlyMe: true
		});
	});

	it('reads the members through the same service method the members route calls', async () => {
		const { resolver, statisticService } = surfaces();

		const answer = await resolver.timeTrackingMembers(ORGANIZATION, START, END, TODAY_START, TODAY_END);

		expect(answer).toBe(MEMBERS);
		expect(statisticService.getMembers).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: START,
			endDate: END,
			todayStart: TODAY_START,
			todayEnd: TODAY_END
		});
	});

	it('reads the projects through the same service method the projects route calls', async () => {
		const { resolver, statisticService } = surfaces();

		const answer = await resolver.timeTrackingProjects(ORGANIZATION, START, END, [EMPLOYEE], [PROJECT], [TEAM], true);

		expect(answer).toBe(PROJECTS);
		expect(statisticService.getProjects).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: START,
			endDate: END,
			employeeIds: [EMPLOYEE],
			projectIds: [PROJECT],
			teamIds: [TEAM],
			onlyMe: true
		});
	});

	it('reads the tasks through the same service method the task route calls, POST included', async () => {
		const { resolver, statisticService } = surfaces();

		const answer = await resolver.timeTrackingTasks(
			ORGANIZATION,
			START,
			END,
			TODAY_START,
			TODAY_END,
			[EMPLOYEE],
			[PROJECT],
			[TASK],
			[TEAM],
			TEAM,
			5,
			true,
			'month',
			false
		);

		expect(answer).toBe(TASKS);
		expect(statisticService.getTasks).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: START,
			endDate: END,
			todayStart: TODAY_START,
			todayEnd: TODAY_END,
			employeeIds: [EMPLOYEE],
			projectIds: [PROJECT],
			taskIds: [TASK],
			teamIds: [TEAM],
			organizationTeamId: TEAM,
			take: 5,
			defaultRange: true,
			unitOfTime: 'month',
			onlyMe: false
		});
	});

	it('substitutes no default of its own: what the caller omits stays omitted', async () => {
		const { resolver, statisticService } = surfaces();

		await resolver.timeTrackingTasks(ORGANIZATION);
		const request = statisticService.getTasks.mock.calls[0][0];

		// The delivered read's own defaults — the whole history without `defaultRange`, the read's own
		// unit when it computes one, no truncation — are what apply, and only they.
		expect(request.defaultRange).toBeUndefined();
		expect(request.unitOfTime).toBeUndefined();
		expect(request.take).toBeUndefined();
		expect(request.onlyMe).toBeUndefined();
		expect(request.startDate).toBeUndefined();
	});

	it('reads the manual time logs through the same service method the manual-times route calls', async () => {
		const { resolver, statisticService } = surfaces();

		const answer = await resolver.timeTrackingManualTimes(ORGANIZATION, START, END, [EMPLOYEE], [PROJECT], [TEAM]);

		expect(answer).toBe(MANUAL_TIMES);
		expect(statisticService.manualTimes).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: START,
			endDate: END,
			employeeIds: [EMPLOYEE],
			projectIds: [PROJECT],
			teamIds: [TEAM]
		});
	});

	it('reads the time slots through the same service method the time-slots route calls', async () => {
		const { resolver, statisticService } = surfaces();

		const answer = await resolver.timeTrackingTimeSlots(ORGANIZATION, START, END, [EMPLOYEE], [PROJECT], [TEAM], true);

		expect(answer).toBe(EMPLOYEE_SLOTS);
		expect(statisticService.getEmployeeTimeSlots).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: START,
			endDate: END,
			employeeIds: [EMPLOYEE],
			projectIds: [PROJECT],
			teamIds: [TEAM],
			onlyMe: true
		});
	});

	it('reads the activities through the same service method the activities route calls', async () => {
		const { resolver, statisticService } = surfaces();

		const answer = await resolver.timeTrackingActivities(ORGANIZATION, START, END, [EMPLOYEE], [PROJECT], [TEAM]);

		expect(answer).toBe(ACTIVITIES);
		expect(statisticService.getActivities).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: START,
			endDate: END,
			employeeIds: [EMPLOYEE],
			projectIds: [PROJECT],
			teamIds: [TEAM]
		});
	});

	it('lets a refusal travel unchanged rather than turning it into an empty answer', async () => {
		const { resolver, statisticService } = surfaces();
		const refusal = new Error('TIMESHEET_STATISTIC_FORBIDDEN: the caller may not read this organization.');
		statisticService.getActivities.mockRejectedValueOnce(refusal);

		await expect(resolver.timeTrackingActivities(ORGANIZATION)).rejects.toBe(refusal);
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
	{ field: 'timeTrackingCounts', route: 'getCountsStatistics' },
	{ field: 'timeTrackingMembers', route: 'getMembersStatistics' },
	{ field: 'timeTrackingProjects', route: 'getProjectsStatistics' },
	{ field: 'timeTrackingTasks', route: 'getTasksStatistics' },
	{ field: 'timeTrackingManualTimes', route: 'getManualTimesStatistics' },
	{ field: 'timeTrackingTimeSlots', route: 'getEmployeeTimeSlotsStatistics' },
	{ field: 'timeTrackingActivities', route: 'getActivitiesStatistics' }
];

describe('StatisticResolver — the guard stack and the permission are the controller’s, field by field', () => {
	it('states on the class the guards and the permission the controller states on its class', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', StatisticController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', StatisticResolver) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard])
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StatisticResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, StatisticController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StatisticResolver)).toEqual([
			PermissionsEnum.ADMIN_DASHBOARD_VIEW,
			PermissionsEnum.TIME_TRACKER,
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ALL_ORG_VIEW
		]);
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(StatisticController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(StatisticController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(StatisticController, route));
	});

	it('gates six of the seven routes on the handler, which is the placement the six fields mirror', () => {
		// A control, and not a restatement of the expectation: the comparison above is exact in both
		// directions, so six routes that lost the guard and six fields that lost it with them would
		// compare equal and read as parity. This pins the side the guard is supposed to exist on, so
		// dropping it from the routes is reported here rather than silently matched. The task route is
		// the one exception, and it is named rather than described: the desktop timer's task picker
		// needs that read to start tracking, so a guard there would be a defect of its own.
		const gated = ROUTE_PARITY.filter(({ route }) =>
			guardsOfRoute(StatisticController, route).includes(EmployeeTrackedDataGuard)
		).map(({ route }) => route);

		expect(gated).toEqual([
			'getCountsStatistics',
			'getMembersStatistics',
			'getProjectsStatistics',
			'getManualTimesStatistics',
			'getEmployeeTimeSlotsStatistics',
			'getActivitiesStatistics'
		]);

		// And the guard is on the handler rather than on the controller, which is what makes it possible
		// for one of the seven routes to be exempt at all.
		expect(Reflect.getMetadata('__guards__', StatisticController)).not.toContain(EmployeeTrackedDataGuard);
	});

	it('states on every field the permission its own route inherits, and never a narrower one', () => {
		const stated = Object.fromEntries(ROUTE_PARITY.map(({ field }) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTE_PARITY.map(({ field, route }) => [field, permissionOfRoute(StatisticController, route)])
		);

		expect(stated).toEqual(expected);

		// The controller states the list on the class and on no handler, so every route's permission is
		// the class's — which is why the resolver may state the same list once and still be exact.
		for (const { route } of ROUTE_PARITY) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(StatisticController)[route])).toBeUndefined();
		}
	});

	it('carries the gate on the class, beside the controller’s own guards and in their order', () => {
		// The chain is the controller's, in the order the controller states it, with the gate appended
		// rather than inserted: the gate reads the request's tenant and organization to resolve the
		// capability, so a gate that ran before the tenant guard would resolve it for no scope at all.
		expect(Reflect.getMetadata('__guards__', StatisticResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});
});

describe('StatisticModule — the two resolvers are declared where their service is reachable', () => {
	it('declares both resolvers as providers of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, StatisticModule) ?? []) as unknown[];

		// A resolver is an ordinary provider and can only inject what its own module reaches, so the
		// module that provides `StatisticService` is the module that has to declare them.
		expect(providers).toContain(StatisticResolver);
		expect(providers).toContain(ProfileActivityResolver);
		expect(providers).toContain(StatisticService);
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
		getHandler: () => (StatisticResolver.prototype as never)[field],
		getClass: () => StatisticResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('StatisticResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, StatisticResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', StatisticResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('timeTrackingCounts')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('timeTrackingCounts');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('timeTrackingActivities'))).resolves.toBe(true);
	});
});
