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
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { CustomTrackingController } from './custom-tracking.controller';
import { CustomTrackingModule } from './custom-tracking.module';
import { CustomTrackingResolver } from './custom-tracking.resolver';
import { CustomTrackingService } from './custom-tracking.service';

/**
 * Custom tracking over GraphQL.
 *
 * The delivered REST routes serve two writes — one payload and a list of them — and four reads of what
 * the writes stored: the sessions of an organization, one slot's tracking, one session identifier, and
 * what is active right now. This suite pins the half of the two-protocol doctrine that is easy to get
 * quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and **none of them is a
 *   connection**, because none of them is a list of a resource this platform stores: a session is decoded
 *   out of a document column and the rows that are stored belong to the slot domain;
 * - every field reaches the same service method its route reaches, **with the same arguments** — including
 *   the two flags the delivered query DTO defaults, the two the identifier route leaves unstated, and the
 *   threshold floor the active route applies;
 * - **the guard chain is the controller's and every field states the class permission read off the
 *   controller**, and this suite pins both the parity and the concrete triple it resolves to;
 * - a decoded session's instants are carried as the text the tracker wrote, its payload's decoded form is
 *   carried as the opaque document it is, and every duration is a whole number of **seconds**;
 * - a slot that holds no tracking is an answer and a slot that is not there is `null`, which are two
 *   different facts.
 */

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000020';
const OTHER_EMPLOYEE = '00000000-0000-4000-8000-000000000021';
const SLOT = '00000000-0000-4000-8000-000000000040';
const PROJECT = '00000000-0000-4000-8000-000000000030';
const SESSION = 'session-8f4c1a';

/** The payload a scripted read hands back, encoded and decoded. */
const PAYLOAD = {
	timestamp: '2026-03-03T10:00:00.000Z',
	encodedData: 'H4sIAAAA',
	decodedData: { envelope: { sessionId: SESSION } }
};

/** The slot summary a scripted read hands back. */
const SLOT_SUMMARY = { startedAt: new Date('2026-03-03T10:00:00.000Z'), duration: 600 };

/** The log rows a scripted read hands back. */
const TIME_LOGS = [
	{
		id: '00000000-0000-4000-8000-000000000050',
		startedAt: new Date('2026-03-03T10:00:00.000Z'),
		stoppedAt: new Date('2026-03-03T10:10:00.000Z'),
		duration: 600,
		logType: 'TRACKED',
		source: 'DESKTOP',
		employeeId: EMPLOYEE,
		projectId: PROJECT
	}
];

/** The sessions a scripted read hands back, in the shape the delivered reads answer with. */
const SESSIONS = [
	{
		sessionId: SESSION,
		timeLogs: TIME_LOGS,
		session: {
			sessionId: SESSION,
			startTime: '2026-03-03T10:00:00.000Z',
			lastActivity: '2026-03-03T10:09:00.000Z',
			createdAt: '2026-03-03T10:00:00.000Z',
			updatedAt: '2026-03-03T10:09:00.000Z',
			payloads: [PAYLOAD]
		},
		timeSlots: [{ timeSlotId: SLOT, timeSlot: SLOT_SUMMARY }]
	}
];

/** The summary the sessions read adds its rows up to. */
const SESSIONS_SUMMARY = {
	totalSessions: 1,
	totalTimeSlots: 1,
	dateRange: { start: SLOT_SUMMARY.startedAt, end: SLOT_SUMMARY.startedAt }
};

/** The outcome a scripted submission hands back. */
const SUBMISSION = {
	success: true,
	sessionId: SESSION,
	timeSlotId: SLOT,
	message: 'Tracking data processed successfully',
	session: SESSIONS[0].session
};

/** The resolver, over a scripted service. */
function surfaces() {
	const customTrackingService = {
		submitTrackingData: jest.fn().mockResolvedValue(SUBMISSION),
		submitBulkTrackingData: jest
			.fn()
			.mockResolvedValue({ results: [{ ...SUBMISSION, index: 0 }], summary: { total: 1, successful: 1, failed: 0 } }),
		getTrackingSessions: jest
			.fn()
			.mockResolvedValue({ sessions: SESSIONS, summary: SESSIONS_SUMMARY }),
		getTimeSlotTrackingData: jest.fn().mockResolvedValue({
			timeSlotId: SLOT,
			hasTrackingData: true,
			timeSlot: { startedAt: SLOT_SUMMARY.startedAt, duration: 600, timeLogs: TIME_LOGS },
			trackingSessions: [SESSIONS[0].session]
		}),
		getSessionsBySessionId: jest.fn().mockResolvedValue(SESSIONS),
		getActiveSessions: jest.fn().mockResolvedValue(SESSIONS)
	};

	return {
		customTrackingService,
		resolver: new CustomTrackingResolver(customTrackingService as never)
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
const OWNED_QUERY_FIELDS = [
	'activeTrackingSessions',
	'timeSlotTrackingData',
	'trackingSessions',
	'trackingSessionsBySessionId'
];

/** The mutations this domain contributes, by name. */
const OWNED_MUTATION_FIELDS = ['submitBulkTrackingData', 'submitTrackingData'];

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

/**
 * A member declaration as a pattern, with the list brackets escaped and the spacing left free.
 *
 * The brackets are escaped rather than matched as written: an unescaped `[TrackingSessionPayload!]` is a
 * character class, which is a pattern that matches a string it was never meant to describe.
 */
function member(member: string): RegExp {
	return new RegExp(member.replace(/[[\]]/g, '\\$&').replace(' ', '\\s*'));
}

/** The handlers of the controller, as functions, inherited ones included. */
function handlersOf(controller: typeof CustomTrackingController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof CustomTrackingController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof CustomTrackingController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof CustomTrackingResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(CustomTrackingResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, CustomTrackingResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', CustomTrackingResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(CustomTrackingResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('CustomTrackingResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the four computed reads', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'trackingSessions',
				'timeSlotTrackingData',
				'trackingSessionsBySessionId',
				'activeTrackingSessions'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['submitTrackingData', 'submitBulkTrackingData'])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([...OWNED_QUERY_FIELDS].sort());
		expect(ownedRootFields('Mutation')).toEqual([...OWNED_MUTATION_FIELDS].sort());

		// The controller serves exactly six routes, and every one of them is a field above.
		for (const handler of [
			'submitTrackingData',
			'submitBulkTrackingData',
			'getTrackingSessions',
			'getTimeSlotTrackingData',
			'getSessionsBySessionId',
			'getActiveSessions'
		]) {
			expect(typeof handlersOf(CustomTrackingController)[handler]).toBe('function');
		}
	});

	it('declares no connection, because there is no resource here to page', () => {
		// A connection is a resource's list. The resource this domain writes into is the slot, which the
		// slot domain serves; what this domain answers is decoded out of a document column, so every read
		// states its own criterion and its own shape instead of paging a list.
		expect(printed).not.toMatch(/type [A-Za-z]*Tracking[A-Za-z]*Connection\b/);
		expect(printed).not.toMatch(/type [A-Za-z]*TrackingSession[A-Za-z]*Edge\b/);
		for (const field of OWNED_QUERY_FIELDS) {
			expect(fieldType('Query', field)).not.toContain('Connection');
		}
	});

	it('states every read’s arguments in one order, with the flags the delivered query defaults', () => {
		expect(fieldArgs('Query', 'trackingSessions')).toEqual([
			'organizationId',
			'startDate',
			'endDate',
			'employeeIds',
			'projectIds',
			'sessionId',
			'groupBySession',
			'includeDecodedData'
		]);
		expect(fieldArgs('Query', 'timeSlotTrackingData')).toEqual(['timeSlotId']);
		expect(fieldArgs('Query', 'trackingSessionsBySessionId')).toEqual(['sessionId', 'startDate', 'endDate']);
		expect(fieldArgs('Query', 'activeTrackingSessions')).toEqual(['employeeId', 'activityThresholdMinutes']);
	});

	it('answers each read with its own shape, and states the miss as a field that may have none', () => {
		expect(fieldType('Query', 'trackingSessions')).toBe('CustomTrackingSessions!');
		expect(fieldType('Query', 'timeSlotTrackingData')).toBe('CustomTrackingTimeSlotData');
		expect(fieldType('Query', 'trackingSessionsBySessionId')).toBe('[CustomTrackingSessionResponse!]!');
		expect(fieldType('Query', 'activeTrackingSessions')).toBe('[CustomTrackingSessionResponse!]!');
		expect(printed).toMatch(/submitTrackingData\(input: CustomTrackingSubmissionInput!\): CustomTrackingSubmission!\n/);
		expect(printed).toMatch(/submitBulkTrackingData\(input: CustomTrackingBulkInput!\): CustomTrackingBulkSubmission!\n/);
	});

	it('states the floor the active read applies rather than accepting a threshold it would clamp', () => {
		expect(printed).toMatch(/a value below one is read as \*\*one\*\*/);
	});
});

describe('CustomTrackingResolver — which members the surface exposes, and which it refuses', () => {
	it('models a decoded session member for member, with its instants as the tracker’s own text', () => {
		const session = typeBody('TrackingSession');

		for (const declared of [
			'sessionId: String!',
			'startTime: String!',
			'lastActivity: String!',
			'createdAt: String!',
			'updatedAt: String!',
			'payloads: [TrackingSessionPayload!]!'
		]) {
			expect(session).toMatch(member(declared));
		}

		// They are members of the decoded document rather than columns of a row, and the platform stores
		// them as it decoded them: re-typing them as instants would be inventing a conversion the
		// delivered answers do not perform.
		expect(session).not.toMatch(/\bstartTime: DateTime/);
	});

	it('carries the decoded payload as the opaque document it is, and the encoded one verbatim', () => {
		const payload = typeBody('TrackingSessionPayload');

		expect(payload).toMatch(/\btimestamp: String!/);
		expect(payload).toMatch(/\bencodedData: String!/);
		// The one honest use of `JSON` here: the document's shape belongs to whichever tracker produced
		// it, is versioned by that tracker rather than by this platform, and cannot be declared here.
		expect(payload).toMatch(/\bdecodedData: JSON\b/);
		expect(payload).not.toMatch(/\bdecodedData: String\b/);
	});

	it('models the session answer member for member, including the two the reads do not fill', () => {
		const response = typeBody('CustomTrackingSessionResponse');

		for (const declared of [
			'sessionId: String!',
			'timeSlotId: ID',
			'timeSlot: CustomTrackingTimeSlotSummary',
			'timeLogs: [CustomTrackingTimeLog!]!',
			'session: TrackingSession!',
			'timeSlots: [CustomTrackingTimeSlotEntry!]'
		]) {
			expect(response).toMatch(member(declared));
		}

		expect(typeBody('CustomTrackingTimeSlotEntry')).toMatch(/timeSlotId: ID!/);
		expect(typeBody('CustomTrackingTimeSlotSummary')).toMatch(/startedAt: DateTime!/);
	});

	it('models the log rows as a projection of a resource another domain owns', () => {
		const log = typeBody('CustomTrackingTimeLog');

		expect(log).toMatch(/\bid: ID!/);
		expect(log).toMatch(/\bduration: Int!/);
		expect(log).toMatch(/\blogType: String\b/);
		expect(log).toMatch(/\bprojectId: ID\b/);
		// A duration is never money, and the resource's whole row — its label pivot and its nested
		// relations — is the log domain's to declare rather than this surface's to repeat.
		expect(log).not.toMatch(/\bduration: Decimal\b/);
		expect(log).not.toMatch(/\btags:/);
	});

	it('models the two write answers and the summaries they carry', () => {
		const submission = typeBody('CustomTrackingSubmission');

		expect(submission).toMatch(/\bsuccess: Boolean!/);
		expect(submission).toMatch(/\bsessionId: String!/);
		expect(submission).toMatch(/\btimeSlotId: ID!/);
		expect(submission).toMatch(/\bmessage: String!/);
		expect(submission).toMatch(/\bsession: TrackingSession\b/);

		const result = typeBody('CustomTrackingBulkResult');
		expect(result).toMatch(/\bindex: Int!/);
		expect(result).toMatch(/\berror: String\b/);

		expect(typeBody('CustomTrackingBulkSummary')).toMatch(/\btotal: Int!/);
		expect(typeBody('CustomTrackingBulkSummary')).toMatch(/\bsuccessful: Int!/);
		expect(typeBody('CustomTrackingBulkSummary')).toMatch(/\bfailed: Int!/);
	});

	it('carries the two summaries as two types, because they add up different things', () => {
		expect(typeBody('CustomTrackingSessions')).toMatch(/sessions: \[CustomTrackingSessionResponse!\]!/);
		expect(typeBody('CustomTrackingSessions')).toMatch(/summary: TrackingSessionSummary!/);

		const summary = typeBody('TrackingSessionSummary');
		expect(summary).toMatch(/\btotalSessions: Int!/);
		expect(summary).toMatch(/\btotalTimeSlots: Int!/);
		expect(summary).toMatch(/\bdateRange: TrackingSessionDateRange\b/);
		expect(typeBody('TrackingSessionDateRange')).toMatch(/\bstart: DateTime!/);
	});

	it('states the instant a submission belongs to as required, because the delivered write refuses its absence', () => {
		const input = inputBody('CustomTrackingSubmissionInput');

		expect(input).toMatch(/\borganizationId: ID!/);
		expect(input).toMatch(/\bpayload: String!/);
		expect(input).toMatch(/\bstartTime: DateTime!/);
		expect(input).toMatch(/\bemployeeId: ID\b/);
		expect(inputBody('CustomTrackingBulkInput')).toMatch(/list: \[CustomTrackingSubmissionInput!\]!/);
	});

	it('states the unit of every duration in the SDL', () => {
		expect(printed).toMatch(/How long the slot lasted, \*\*in seconds\*\*/);
		expect(printed).toMatch(/How long the log lasted, \*\*in seconds\*\*/);
	});
});

describe('CustomTrackingResolver — one concept, two protocols, the same operations', () => {
	it('submits one payload through the same service method the route calls', async () => {
		const { resolver, customTrackingService } = surfaces();
		const input = {
			organizationId: ORGANIZATION,
			payload: 'H4sIAAAA',
			startTime: new Date('2026-03-03T10:00:00.000Z'),
			employeeId: EMPLOYEE
		};

		const answer = await resolver.submitTrackingData(input);

		expect(customTrackingService.submitTrackingData).toHaveBeenCalledWith(input);
		expect(answer).toBe(SUBMISSION);
	});

	it('submits a list through the same service method the bulk route calls, with the list it bound', async () => {
		const { resolver, customTrackingService } = surfaces();
		const list = [
			{ organizationId: ORGANIZATION, payload: 'H4sIAAAA', startTime: new Date('2026-03-03T10:00:00.000Z') },
			{ organizationId: ORGANIZATION, payload: 'H4sIAAAB', startTime: new Date('2026-03-03T10:10:00.000Z') }
		];

		const answer = await resolver.submitBulkTrackingData({ list });

		// The route binds a body whose one member is the list and hands that member over: the envelope is
		// not part of the call, and this field states the same member for the same reason.
		expect(customTrackingService.submitBulkTrackingData).toHaveBeenCalledWith(list);
		expect(answer.summary).toEqual({ total: 1, successful: 1, failed: 0 });
	});

	it('reads the sessions through the same service method its route calls, with the delivered defaults', async () => {
		const { resolver, customTrackingService } = surfaces();

		const answer = await resolver.trackingSessions(ORGANIZATION);

		// The two flags are stated rather than left undefined, because the delivered query DTO declares
		// them: an absent flag means "fold the sessions" and "carry the encoded form only" on the route,
		// and a flag that meant the opposite here would answer different rows for the same question.
		expect(customTrackingService.getTrackingSessions).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate: undefined,
			endDate: undefined,
			employeeIds: undefined,
			projectIds: undefined,
			sessionId: undefined,
			groupBySession: true,
			includeDecodedData: false
		});
		expect(answer).toEqual({ sessions: SESSIONS, summary: SESSIONS_SUMMARY });
	});

	it('carries the caller’s own flags through when it states them', async () => {
		const { resolver, customTrackingService } = surfaces();
		const startDate = new Date('2026-03-01T00:00:00.000Z');
		const endDate = new Date('2026-03-31T23:59:59.000Z');

		await resolver.trackingSessions(
			ORGANIZATION,
			startDate,
			endDate,
			[EMPLOYEE],
			[PROJECT],
			SESSION,
			false,
			true
		);

		expect(customTrackingService.getTrackingSessions).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			startDate,
			endDate,
			employeeIds: [EMPLOYEE],
			projectIds: [PROJECT],
			sessionId: SESSION,
			groupBySession: false,
			includeDecodedData: true
		});
	});

	it('reads one slot through the same service method its route calls', async () => {
		const { resolver, customTrackingService } = surfaces();

		const answer = await resolver.timeSlotTrackingData(SLOT);

		expect(customTrackingService.getTimeSlotTrackingData).toHaveBeenCalledWith(SLOT);
		expect(answer?.hasTrackingData).toBe(true);
		expect(answer?.timeSlot?.duration).toBe(600);
	});

	it('answers null for a slot that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, customTrackingService } = surfaces();
		customTrackingService.getTimeSlotTrackingData.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.timeSlotTrackingData(SLOT)).toBeNull();
	});

	it('answers a slot that holds no tracking as an answer rather than as a miss', async () => {
		const { resolver, customTrackingService } = surfaces();
		const empty = { timeSlotId: SLOT, hasTrackingData: false, message: 'No custom tracking data found for this TimeSlot' };
		customTrackingService.getTimeSlotTrackingData.mockResolvedValueOnce(empty);

		// The two facts are different: a slot with no tracking is a row that exists, and answering it as a
		// miss would tell a caller its slot had been removed.
		expect(await resolver.timeSlotTrackingData(SLOT)).toBe(empty);
	});

	it('reads one session identifier through the same service method its route calls, absences included', async () => {
		const { resolver, customTrackingService } = surfaces();
		const startDate = new Date('2026-03-01T00:00:00.000Z');
		const endDate = new Date('2026-03-31T23:59:59.000Z');

		const answer = await resolver.trackingSessionsBySessionId(SESSION, startDate, endDate);

		// The two leading absences are the route's own: the delivered method reads the tenant and the
		// organization from the credential when it is handed neither, and the scope of a read is never a
		// caller's to state.
		expect(customTrackingService.getSessionsBySessionId).toHaveBeenCalledWith(
			SESSION,
			undefined,
			undefined,
			startDate,
			endDate
		);
		expect(answer).toBe(SESSIONS);
	});

	it('reads the call’s own range as undefined when the caller states none', async () => {
		const { resolver, customTrackingService } = surfaces();

		await resolver.trackingSessionsBySessionId(SESSION);

		expect(customTrackingService.getSessionsBySessionId).toHaveBeenCalledWith(
			SESSION,
			undefined,
			undefined,
			undefined,
			undefined
		);
	});

	it('reads the active sessions through the same service method its route calls, with the route’s own default', async () => {
		const { resolver, customTrackingService } = surfaces();

		await resolver.activeTrackingSessions(EMPLOYEE);

		// The route reads a default of thirty minutes when the caller states none, and hands the method
		// the larger of that value and one.
		expect(customTrackingService.getActiveSessions).toHaveBeenCalledWith(EMPLOYEE, 30);
	});

	it('floors the threshold at one minute rather than passing a value the route would clamp', async () => {
		const { resolver, customTrackingService } = surfaces();

		await resolver.activeTrackingSessions(undefined, 0);
		expect(customTrackingService.getActiveSessions).toHaveBeenLastCalledWith(undefined, 1);

		await resolver.activeTrackingSessions(undefined, -15);
		expect(customTrackingService.getActiveSessions).toHaveBeenLastCalledWith(undefined, 1);

		// A value above the floor is passed through untouched.
		await resolver.activeTrackingSessions(EMPLOYEE, 5);
		expect(customTrackingService.getActiveSessions).toHaveBeenLastCalledWith(EMPLOYEE, 5);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, customTrackingService } = surfaces();
		const refusal = new Error('VALIDATION_FAILED: Invalid start Time');

		customTrackingService.submitTrackingData.mockRejectedValueOnce(refusal);

		await expect(
			resolver.submitTrackingData({ organizationId: ORGANIZATION, payload: 'H4sIAAAA', startTime: new Date() })
		).rejects.toBe(refusal);
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
	{ field: 'submitTrackingData', route: 'submitTrackingData' },
	{ field: 'submitBulkTrackingData', route: 'submitBulkTrackingData' },
	{ field: 'trackingSessions', route: 'getTrackingSessions' },
	{ field: 'timeSlotTrackingData', route: 'getTimeSlotTrackingData' },
	{ field: 'trackingSessionsBySessionId', route: 'getSessionsBySessionId' },
	{ field: 'activeTrackingSessions', route: 'getActiveSessions' }
];

describe('CustomTrackingResolver — the guard stack and the permission are the route’s, field by field', () => {
	it('states on the class the guards the controller states on its class, plus the gate', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', CustomTrackingController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', CustomTrackingResolver) ?? [];

		expect(controllerGuards).toEqual([TenantPermissionGuard, PermissionGuard]);
		expect(resolverGuards).toEqual([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard]);
	});

	it('resolves the class permission to the triple the controller declares', () => {
		// The resolver reads the list off the controller, and this pins what that list *is*, so a change to
		// the controller's own declaration is a change this suite reports rather than one it follows.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CustomTrackingController)).toEqual([
			PermissionsEnum.TIME_TRACKER,
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ALL_ORG_VIEW
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CustomTrackingResolver)).toEqual([
			PermissionsEnum.TIME_TRACKER,
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ALL_ORG_VIEW
		]);
	});

	it('runs every route under the controller’s chain and no permission of its own', () => {
		for (const handler of [
			'submitTrackingData',
			'submitBulkTrackingData',
			'getTrackingSessions',
			'getTimeSlotTrackingData',
			'getSessionsBySessionId',
			'getActiveSessions'
		]) {
			// Neither handler states a permission, which is what makes the class-level list the list every
			// field has to state.
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(CustomTrackingController)[handler])).toBeUndefined();
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared.
		expect(typeof handlersOf(CustomTrackingController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual([
			...guardsOfRoute(CustomTrackingController, route),
			FeatureFlagGuard
		].sort());
		expect(permissionOfField(field)).toEqual(permissionOfRoute(CustomTrackingController, route));
		expect(permissionOfField(field)).toEqual([
			PermissionsEnum.TIME_TRACKER,
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ALL_ORG_VIEW
		]);
	});
});

describe('CustomTrackingModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, CustomTrackingModule) ?? []) as unknown[];

		// A resolver can only inject services its own module can reach, so the module that reaches them is
		// the module that has to declare it.
		expect(providers).toContain(CustomTrackingResolver);
		expect(providers).toContain(CustomTrackingService);
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
		getHandler: () => (CustomTrackingResolver.prototype as never)[field],
		getClass: () => CustomTrackingResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('CustomTrackingResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, CustomTrackingResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', CustomTrackingResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('trackingSessions')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('trackingSessions');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('trackingSessions'))).resolves.toBe(true);
	});
});
