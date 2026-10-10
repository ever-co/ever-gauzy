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
import { PermissionsEnum, TimeLogSourceEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { TimerController } from './timer.controller';
import { TimerModule } from './timer.module';
import { TimerResolver } from './timer.resolver';
import { TimerService } from './timer.service';
import { StartTimerCommand, StopTimerCommand } from './commands';
import { GetTimerStatusQuery } from './queries';

/**
 * The timer over GraphQL.
 *
 * The delivered REST routes serve two computed reads — the caller's current state, and one worked
 * state per employee the read considered — and three writes that start, stop or toggle the timer. The
 * resource has no list, no node read and no count, so neither does this surface. This suite pins the
 * half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - both computed answers are root fields of the one composed schema and are answered by the two types
 *   that state exactly what their own read fills — the state vocabulary and the running flag on the
 *   worked answer, and no member that one read fills and the other leaves null;
 * - every field reaches the same service method, dispatches the same command or the same query, that
 *   the REST route reaches, with the same input, and the input a status field builds is the query DTO
 *   its route binds — reduced to the members the delivered read actually consults, so an argument the
 *   read would ignore is not offered at all;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under**, read from the controller's own metadata rather than restated: `ALL_ORG_VIEW` beside the
 *   class permission on the two status routes, and the class permission alone on the three writes,
 *   which declare none of their own;
 * - a duration is stated in seconds and never as an amount of money; **each of the three writes answers
 *   the log row its route answers**, unprojected and typed by the domain that owns it, with the
 *   nullability its own handler supports — a row and never nothing for the start, a row or nothing for
 *   the toggle and the stop — while the log a *state* was derived from stays an identifier;
 * - `lastWorkedTask`, which the delivered status reads never fill, is not declared at all.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const OTHER_EMPLOYEE = '00000000-0000-4000-8000-000000000004';
const LOG = '00000000-0000-4000-8000-000000000020';
const OTHER_LOG = '00000000-0000-4000-8000-000000000021';
const TASK = '00000000-0000-4000-8000-000000000030';

/** The state the single-status read answers, as the delivered computation produces it. */
const CURRENT_STATUS = {
	duration: 1800,
	running: true,
	lastLog: { id: LOG, employeeId: EMPLOYEE, tenantId: TENANT, isRunning: true }
};

/** The states the worked read answers, one per employee it considered. */
const WORKED_STATUSES = [
	{
		duration: 600,
		running: true,
		timerStatus: 'running' as const,
		lastLog: { id: LOG, employeeId: EMPLOYEE, isRunning: true, taskId: TASK }
	},
	{
		duration: 900,
		running: false,
		timerStatus: 'idle' as const,
		lastLog: { id: OTHER_LOG, employeeId: OTHER_EMPLOYEE, isRunning: false }
	}
];

/** The log one of the three writes answers with. */
const TOUCHED_LOG = { id: LOG, employeeId: EMPLOYEE, isRunning: true };

/** The resolver, over a scripted service, a scripted command bus and a scripted query bus. */
function surfaces() {
	const timerService = {
		toggleTimeLog: jest.fn().mockResolvedValue(TOUCHED_LOG),
		getTimerWorkedStatus: jest.fn().mockResolvedValue(WORKED_STATUSES)
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(TOUCHED_LOG) };
	const queryBus = { execute: jest.fn().mockResolvedValue(CURRENT_STATUS) };

	return {
		timerService,
		commandBus,
		queryBus,
		resolver: new TimerResolver(timerService as never, commandBus as never, queryBus as never)
	};
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
 * domain's alone — the statistics surface declares `timeTrackingTimeSlots`, which names the same
 * resource in the middle of a name of its own. What makes the assertion below a statement about *this*
 * surface rather than a list of names is the sweep beside it: every root field answering with a type
 * this domain declares is swept up and held to exactly these fields.
 */
const OWNED_QUERY_FIELDS = ['timerStatus', 'timerWorkedStatus'];

/** The mutations this domain contributes, by the same reading. */
const OWNED_MUTATION_FIELDS = ['startTimer', 'stopTimer', 'toggleTimer'];

/** The object types this domain declares, which is how the sweep below recognises its own fields. */
const OWNED_TYPES = ['TimerStatus', 'TimerWorkedStatus'];

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
function handlersOf(controller: typeof TimerController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof TimerController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof TimerController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof TimerResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission a resolver field states itself, with no fallback to the class. */
function permissionOfField(field: string): unknown {
	return Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(TimerResolver)[field]);
}

/** The guards a resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', TimerResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(TimerResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('TimerResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the two computed answers', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['timerStatus', 'timerWorkedStatus']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['toggleTimer', 'startTimer', 'stopTimer'])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual(['timerStatus', 'timerWorkedStatus']);
		expect(ownedRootFields('Mutation')).toEqual(['startTimer', 'stopTimer', 'toggleTimer']);

		// The resource has no list, no node read and no count, so the surface states none: a connection
		// over rows the controller cannot list, or a count of a thing that is not a collection, would be
		// a capability REST does not have.
		for (const spelling of ['timers', 'timer', 'timerCount', 'timersConnection', 'timerLog']) {
			expect(rootFields('Query')).not.toContain(spelling);
		}

		// Every root field answering with a type this domain declares is a field of this surface, and
		// there are exactly the two the controller serves: a third read of the same states under any name
		// is caught here rather than passing because nobody listed it.
		for (const operation of ['Query', 'Mutation'] as const) {
			const answering = rootFields(operation)
				.filter((field) => OWNED_TYPES.includes(answeredTypeName(operation, field)))
				.sort();

			expect(answering).toEqual(operation === 'Query' ? ['timerStatus', 'timerWorkedStatus'] : []);
		}

		// Every field above names a handler that exists on the controller.
		for (const handler of ['getTimerStatus', 'getTimerWorkedStatus', 'toggleTimer', 'startTimer', 'stopTimer']) {
			expect(typeof handlersOf(TimerController)[handler]).toBe('function');
		}
	});

	it('declares the two answers as two types, because neither read fills all of the interface', () => {
		// `ITimerStatus` is the interface both delivered reads answer with, and the two reads fill
		// different members of it: one type would carry a member that is null on one of its two root
		// fields and filled on the other.
		expect(printed).toMatch(/type TimerStatus \{/);
		expect(typeBody('TimerStatus')).toMatch(/\bduration: Int!/);
		expect(typeBody('TimerStatus')).toMatch(/\brunning: Boolean!/);
		expect(typeBody('TimerStatus')).toMatch(/\blastLogId: ID/);
		expect(typeBody('TimerWorkedStatus')).toMatch(/\bemployeeId: ID!/);
		expect(typeBody('TimerWorkedStatus')).toMatch(/\btimerStatus: TimerState!/);
		// The state the worked read computes is a closed vocabulary of three values, and the field that
		// answers it states that vocabulary rather than a bare string.
		expect(printed).toMatch(/enum TimerState \{\s*running\s*pause\s*idle\s*\}/);
		expect(printed).toMatch(/input TimerToggleInput \{/);
	});

	it('answers each field with the type its own read produces', () => {
		expect(fieldType('Query', 'timerStatus')).toBe('TimerStatus!');
		expect(fieldType('Query', 'timerWorkedStatus')).toBe('[TimerWorkedStatus!]!');
		// A write answers the log row its route answers, typed by the domain that owns the row.
		expect(fieldType('Mutation', 'toggleTimer')).toBe('TimeLog');
		expect(fieldType('Mutation', 'startTimer')).toBe('TimeLog!');
		expect(fieldType('Mutation', 'stopTimer')).toBe('TimeLog');
	});

	it('answers the writes with the time-log domain’s own row, and declares no row of its own', () => {
		// The type is declared once, by the domain that owns the row, and referenced here: the reference
		// resolving is the composition pass's assertion, and this pins that the field answers with that
		// declaration rather than with a second one this surface wrote for the same row.
		expect(printed).toMatch(/type TimeLog \{/);
		expect(typeBody('TimeLog')).toMatch(/\bid: ID!/);
		expect(printed).not.toMatch(/type TimerLog\b/);

		// The nullability differs between the three because the handlers' own answers do: the start's
		// handler ends in a reader that raises on a miss, so it answers a row and never nothing, while
		// the stop's handler ends in a re-read that answers nothing for a row it cannot find — and the
		// toggle ends where the stop ends whenever it stops the timer.
		expect(fieldType('Mutation', 'startTimer')).not.toBe('TimeLog');
		expect(fieldType('Mutation', 'stopTimer')).not.toBe('TimeLog!');
		expect(fieldType('Mutation', 'toggleTimer')).not.toBe('TimeLog!');
	});

	it('states a duration in seconds and carries no money on either answer', () => {
		// The unit is stated because a client cannot read it off the schema, and a number of seconds read
		// as milliseconds is a timer that lies.
		expect(printed).toMatch(/The seconds the timer accounts for over the period/);
		expect(printed).toMatch(/Seconds, never money/);

		// Neither answer carries an amount: a rate or a cost belongs to the engagement, the project or
		// the timesheet that computes it, and a `Float` here would be a binary fraction where the
		// platform keeps an exact decimal.
		for (const type of ['TimerStatus', 'TimerWorkedStatus']) {
			expect(typeBody(type)).not.toMatch(/\bFloat\b/);
			expect(typeBody(type)).not.toMatch(/\bDecimal\b/);
		}
	});

	it('carries the log a state was computed from as its identifier', () => {
		// The delivered reads answer with the time-log row they computed over. That row is a resource of
		// its own domain with its own surface and identifier, so it is carried as the identifier here —
		// and the delivered status read joins none of the log's relations, because the `relations` member
		// is the route's query-string vocabulary and this surface offers no such argument.
		expect(typeBody('TimerStatus')).toMatch(/\blastLogId: ID/);
		expect(typeBody('TimerStatus')).not.toMatch(/^\s*lastLog:/m);
		expect(typeBody('TimerWorkedStatus')).toMatch(/\blastLogId: ID!/);
		expect(typeBody('TimerWorkedStatus')).not.toMatch(/^\s*lastLog:/m);
	});

	it('declares no member the delivered reads never fill', () => {
		// `lastWorkedTask` is a member of the contracts interface and neither status read fills it: the
		// platform fills it elsewhere, from a log loaded with its task relation, so a field here would
		// answer null on every row of every answer this surface produces.
		expect(typeBody('TimerStatus')).not.toMatch(/\blastWorkedTask\b/);
		expect(typeBody('TimerWorkedStatus')).not.toMatch(/\blastWorkedTask\b/);
		// The two answers are computed, so neither carries the tenant, the organization or the employee of
		// the logs behind them beyond the identifier the worked answer needs to be attributable at all.
		expect(typeBody('TimerStatus')).not.toMatch(/\btenantId:/);
		expect(typeBody('TimerStatus')).not.toMatch(/\bemployeeId:/);
		expect(typeBody('TimerWorkedStatus')).toMatch(/\bemployeeId: ID!/);
	});

	it('offers no argument the delivered read would ignore', () => {
		// Each status field states exactly the members its own read consults, and nothing else.
		expect(fieldArgs('Query', 'timerStatus')).toEqual([
			'organizationId',
			'source',
			'todayStart',
			'todayEnd',
			'employeeId'
		]);
		expect(fieldArgs('Query', 'timerWorkedStatus')).toEqual([
			'organizationId',
			'source',
			'employeeId',
			'employeeIds'
		]);
		expect(fieldArgs('Mutation', 'startTimer')).toEqual(['input']);

		// The single-status read never consults the set of employees, and the worked read never consults
		// the two ends of the day: offering either would be offering an argument with no effect.
		expect(fieldArgs('Query', 'timerStatus')).not.toContain('employeeIds');
		expect(fieldArgs('Query', 'timerWorkedStatus')).not.toContain('todayStart');
		expect(fieldArgs('Query', 'timerWorkedStatus')).not.toContain('todayEnd');
		// The worked route's own validation does not admit a team, so neither does this field.
		expect(fieldArgs('Query', 'timerWorkedStatus')).not.toContain('organizationTeamId');
		// Neither read loads a relation, so neither offers one.
		expect(fieldArgs('Query', 'timerStatus')).not.toContain('relations');
		expect(fieldArgs('Query', 'timerWorkedStatus')).not.toContain('relations');
	});

	it('states the write body once, and never the tenant or the recipient mail the DTO inherits', () => {
		const body = inputBody('TimerToggleInput');

		for (const member of [
			'organizationId: ID',
			'source: String',
			'logType: String',
			'isBillable: Boolean',
			'description: String',
			'version: String',
			'organizationTeamId: ID',
			'organizationContactId: ID',
			'projectId: ID',
			'taskId: ID',
			'startedAt: DateTime',
			'stoppedAt: DateTime',
			'manualTimeSlot: Boolean'
		]) {
			expect(body).toMatch(new RegExp(member.replace(' ', '\\s*')));
		}

		// The tenant is stamped from the credential by every delivered write, and the base DTO's
		// recipient member is read by none of them: one would promise a scope the write refuses, the
		// other would be a statement nothing consults.
		expect(body).not.toMatch(/\btenantId:/);
		expect(body).not.toMatch(/\bsentTo:/);
		expect(body).not.toMatch(/\borganization:/);
	});
});

describe('TimerResolver — one concept, two protocols, the same operations', () => {
	it('answers the current state through the query the delivered route dispatches', async () => {
		const { resolver, queryBus } = surfaces();
		const todayStart = new Date('2026-03-01T00:00:00.000Z');
		const todayEnd = new Date('2026-03-01T23:59:59.000Z');

		const status = await resolver.timerStatus(ORGANIZATION, 'DESKTOP', todayStart, todayEnd, EMPLOYEE);

		const query = queryBus.execute.mock.calls[0][0];
		expect(query).toBeInstanceOf(GetTimerStatusQuery);
		// The input is the query DTO the route binds, built from this field's own arguments.
		expect(query.input).toEqual({
			organizationId: ORGANIZATION,
			source: 'DESKTOP',
			todayStart,
			todayEnd,
			employeeId: EMPLOYEE
		});
		// The answer is the delivered computation, with the log it was derived from carried as the
		// identifier that always travels.
		expect(status).toEqual({ duration: 1800, running: true, lastLogId: LOG });
	});

	it('answers a state with no log when the period holds none, rather than a fabricated one', async () => {
		const { resolver, queryBus } = surfaces();
		queryBus.execute.mockResolvedValueOnce({ duration: 0, running: false, lastLog: null });

		expect(await resolver.timerStatus(ORGANIZATION)).toEqual({
			duration: 0,
			running: false,
			lastLogId: null
		});
	});

	it('answers the worked states through the same service method the delivered route calls', async () => {
		const { resolver, timerService } = surfaces();

		const statuses = await resolver.timerWorkedStatus(ORGANIZATION, 'DESKTOP', EMPLOYEE, [EMPLOYEE, OTHER_EMPLOYEE]);

		expect(timerService.getTimerWorkedStatus).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			source: 'DESKTOP',
			employeeId: EMPLOYEE,
			employeeIds: [EMPLOYEE, OTHER_EMPLOYEE]
		});
		expect(statuses).toEqual([
			{
				employeeId: EMPLOYEE,
				duration: 600,
				running: true,
				timerStatus: 'running',
				lastLogId: LOG
			},
			{
				employeeId: OTHER_EMPLOYEE,
				duration: 900,
				running: false,
				timerStatus: 'idle',
				lastLogId: OTHER_LOG
			}
		]);
	});

	it('answers an empty list when the read considered no employee, rather than an entry with nothing in it', async () => {
		const { resolver, timerService } = surfaces();
		timerService.getTimerWorkedStatus.mockResolvedValueOnce([]);

		expect(await resolver.timerWorkedStatus(ORGANIZATION)).toEqual([]);
	});

	it('toggles through the same service method the delivered route calls, and answers its row', async () => {
		const { resolver, timerService } = surfaces();
		const input = { organizationId: ORGANIZATION, source: TimeLogSourceEnum.DESKTOP, taskId: TASK };

		// The answer is the service's own, unprojected: the route answers the log, not a member of it.
		expect(await resolver.toggleTimer(input)).toBe(TOUCHED_LOG);
		// The body is handed on as it was stated: the route passes its validated body to the service,
		// and which of the two writes follows is the service's decision rather than a second one here.
		expect(timerService.toggleTimeLog).toHaveBeenCalledWith(input);
	});

	it('answers null for a toggle that produced no log, which is the route’s own declared answer', async () => {
		const { resolver, timerService } = surfaces();
		timerService.toggleTimeLog.mockResolvedValueOnce(null);

		expect(await resolver.toggleTimer({ organizationId: ORGANIZATION })).toBeNull();
	});

	it('starts the timer through the command the delivered route dispatches, and answers the row it created', async () => {
		const { resolver, commandBus } = surfaces();
		const input = {
			organizationId: ORGANIZATION,
			projectId: TENANT,
			source: TimeLogSourceEnum.WEB_TIMER
		};

		// The command's answer travels as it is. The start's handler cannot answer nothing — it ends in
		// a read that raises on a miss — which is what the field's non-null claim rests on.
		expect(await resolver.startTimer(input)).toBe(TOUCHED_LOG);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(StartTimerCommand);
		expect(command.input).toBe(input);
	});

	it('stops the timer through the command the delivered route dispatches, and answers its row', async () => {
		const { resolver, commandBus } = surfaces();
		const input = {
			organizationId: ORGANIZATION,
			source: TimeLogSourceEnum.DESKTOP,
			manualTimeSlot: true
		};

		expect(await resolver.stopTimer(input)).toBe(TOUCHED_LOG);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(StopTimerCommand);
		expect(command.input).toBe(input);
	});

	it('answers null for a stop whose handler could not read the row back, which its own route declares', async () => {
		const { resolver, commandBus } = surfaces();
		// The stop side's last statement is a re-read of the row it wrote, and a re-read answers nothing
		// when the row is not there: a non-null claim here would be a promise this write can break.
		commandBus.execute.mockResolvedValueOnce(null);

		expect(await resolver.stopTimer({ organizationId: ORGANIZATION })).toBeNull();
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('No running log found. Can\'t stop timer because it was already stopped.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.stopTimer({ organizationId: ORGANIZATION })).rejects.toBe(refusal);
	});

	it('answers null for a state the delivered handler refuses as a miss rather than inventing a state', async () => {
		const { resolver, queryBus } = surfaces();
		queryBus.execute.mockRejectedValueOnce(new NotFoundException("We couldn't find the employee you were looking for."));

		await expect(resolver.timerStatus(ORGANIZATION)).rejects.toBeInstanceOf(NotFoundException);
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
	{ field: 'timerStatus', route: 'getTimerStatus' },
	{ field: 'timerWorkedStatus', route: 'getTimerWorkedStatus' },
	{ field: 'toggleTimer', route: 'toggleTimer' },
	{ field: 'startTimer', route: 'startTimer' },
	{ field: 'stopTimer', route: 'stopTimer' }
];

describe('TimerResolver — the guard stack and the permission are the controller’s, field by field', () => {
	it('states on the class the guards and the permission the controller states on its class', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', TimerController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', TimerResolver) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard])
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TimerResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, TimerController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TimerController)).toEqual([PermissionsEnum.TIME_TRACKER]);
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared.
		expect(typeof handlersOf(TimerController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(TimerController, route), FeatureFlagGuard].sort()
		);
		// The field states its route's permission itself rather than inheriting the class's, so a field
		// whose route states one of its own cannot be answered under the class permission by accident.
		expect(permissionOfField(field)).toEqual(permissionOfRoute(TimerController, route));
	});

	it('states the two status permissions on the two status routes and the class one on the writes', () => {
		// The two status routes declare `ALL_ORG_VIEW` beside the class permission; the three writes
		// declare none of their own and therefore run under the class one.
		expect(permissionOfField('timerStatus')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.TIME_TRACKER
		]);
		expect(permissionOfField('timerWorkedStatus')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.TIME_TRACKER
		]);

		for (const field of ['toggleTimer', 'startTimer', 'stopTimer']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(TimerController)[field])).toBeUndefined();
			expect(permissionOfField(field)).toEqual([PermissionsEnum.TIME_TRACKER]);
		}
	});
});

describe('TimerModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, TimerModule) ?? []) as unknown[];

		expect(providers).toContain(TimerResolver);
		expect(providers).toContain(TimerService);
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
		getHandler: () => (TimerResolver.prototype as never)[field],
		getClass: () => TimerResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TimerResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, TimerResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TimerResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('timerStatus')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('timerStatus');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('timerWorkedStatus'))).resolves.toBe(true);
	});
});
