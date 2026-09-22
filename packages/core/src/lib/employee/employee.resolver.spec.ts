/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { RequestContext } from '../core/context';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EmployeeController } from './employee.controller';
import { EmployeeModule } from './employee.module';
import { EmployeeResolver } from './employee.resolver';
import { EmployeeService } from './employee.service';
import {
	EmployeeBulkCreateCommand,
	EmployeeCreateCommand,
	EmployeeGetCommand,
	EmployeeUpdateCommand,
	WorkingEmployeeGetCommand
} from './commands';

/**
 * The employee over GraphQL.
 *
 * The delivered REST routes serve three different reads of this resource — the tenant's engagements,
 * one organization's working roster over a range, and one organization's members — one engagement, a
 * count, a count of the working roster, two creates (one of them bulk), two edits of two different
 * shapes, and the three removal routes. This suite pins the half of the two-protocol doctrine that is
 * easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and each of the three
 *   lists is a connection with the platform's own cursor codec behind it, so a cursor obtained over
 *   REST resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — including the node query, whose route declares an *empty* permission list of its own and
 *   therefore does not run under the controller's class-level edit permission, and the three routes
 *   whose handlers state a permission that is not the class's;
 * - **the node query's scope is the handler's, restated rather than approximated**: a caller that may
 *   not change the selected employee is answered its own engagement whatever identifier it names, and
 *   a caller with none is refused;
 * - **each of the three lists declares the vocabulary its own projection carries**, so no filter is
 *   advertised over a column the delivered read never selected;
 * - no relation is a field, and each one is carried as the identifier that always travels.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const ACCOUNT = '00000000-0000-4000-8000-000000000003';
const FIRST = '00000000-0000-4000-8000-000000000060';
const SECOND = '00000000-0000-4000-8000-000000000061';
const OWN_EMPLOYEE = '00000000-0000-4000-8000-000000000062';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		userId: ACCOUNT,
		short_description: 'Engineer',
		description: 'Builds the thing',
		startedWorkOn: new Date('2026-03-01T10:00:00.000Z'),
		endWork: null,
		billRateValue: 120,
		minimumBillingRate: 100,
		billRateCurrency: 'USD',
		employeeLevel: 'Senior',
		isActive: true,
		isArchived: false,
		isOnline: true,
		isAway: false,
		isTrackingEnabled: true,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		userId: null,
		short_description: 'Designer',
		description: 'Draws the thing',
		startedWorkOn: new Date('2026-02-01T10:00:00.000Z'),
		endWork: new Date('2026-02-28T10:00:00.000Z'),
		billRateValue: 90,
		minimumBillingRate: 80,
		billRateCurrency: 'EUR',
		employeeLevel: 'Junior',
		isActive: true,
		isArchived: false,
		isOnline: false,
		isAway: true,
		isTrackingEnabled: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and a scripted command bus. */
function surfaces() {
	const employeeService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		findWorkingEmployeesCount: jest.fn().mockResolvedValue({ total: ROWS.length }),
		findMembers: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemovedById: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecoverById: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: null })
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		employeeService,
		commandBus,
		resolver: new EmployeeResolver(employeeService as never, commandBus as never)
	};
}

/**
 * The caller's own engagement, and whether it may change the selected employee.
 *
 * The node query reads both out of the request context, which is what the delivered handler reads
 * them out of, so the suite states them the way the handler sees them rather than reaching into the
 * resolver.
 */
function caller(maySelectAny: boolean, ownEmployeeId: string | null): void {
	jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(maySelectAny);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(ownEmployeeId);
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

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/**
 * The type one root field answers with, as the schema states it.
 *
 * Read from the built schema rather than matched as text, because the name of a field is not the name
 * of a *place*: `employeeCount` is a root field here and `EmployeeStatisticsSplitExpense.employeeCount`
 * is a count of people in a sibling domain, so a text match on the name would decide this assertion
 * from the wrong declaration.
 */
function fieldType(operation: 'Query' | 'Mutation', field: string): string {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { type: { toString(): string } }> }
		| undefined;

	return root?.getFields()?.[field]?.type.toString() ?? '';
}

/**
 * The root fields this domain contributes.
 *
 * Ownership is stated by name rather than pattern-matched loosely, because the word is not this
 * domain's alone: `employeeTasks` and `employeeDailyPlans` belong to the task surface, which reads
 * the employee from this domain's own `employee(id)`, and `organizationContactsByEmployee` belongs to
 * the party surface for the same reason. What is left is this resource's own vocabulary: the three
 * reads, the two counts and the seven writes.
 */
const OWNED_QUERY_FIELDS = [
	'employee',
	'employeeCount',
	'employeeMembers',
	'employees',
	'workingEmployeeCount',
	'workingEmployees'
];

/** The mutations this domain contributes, by the same reading. */
const OWNED_MUTATION_FIELDS = [
	'createEmployee',
	'createEmployeesBulk',
	'deleteEmployee',
	'recoverEmployee',
	'softDeleteEmployee',
	'updateEmployee',
	'updateEmployeeProfile'
];

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

/** The printed body of one input type, so a member it must not carry can be asserted absent. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof EmployeeController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EmployeeController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EmployeeController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof EmployeeResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', EmployeeResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(EmployeeResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('EmployeeResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the three reads, the one engagement and the two counts', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'employees',
				'employee',
				'employeeCount',
				'workingEmployees',
				'workingEmployeeCount',
				'employeeMembers'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createEmployee',
				'createEmployeesBulk',
				'updateEmployee',
				'updateEmployeeProfile',
				'deleteEmployee',
				'softDeleteEmployee',
				'recoverEmployee'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([...OWNED_QUERY_FIELDS].sort());
		expect(ownedRootFields('Mutation')).toEqual([...OWNED_MUTATION_FIELDS].sort());

		// Three lists are three delivered reads, and each is one root field: neither the paginated
		// spelling of any of them nor a second name for the same rows is declared, because a second
		// surface for one capability is a surface that can disagree with the first.
		for (const spelling of [
			'employeesPagination',
			'workingEmployeesPagination',
			'employeeMembersPagination',
			'employeesConnection'
		]) {
			expect(rootFields('Query')).not.toContain(spelling);
		}

		// Every field above names a handler that exists on the controller, inherited ones included.
		for (const handler of [
			'findAll',
			'findById',
			'getCount',
			'findAllWorkingEmployees',
			'findAllWorkingEmployeesCount',
			'getMembers',
			'create',
			'createBulk',
			'update',
			'updateProfile',
			'delete',
			'softRemove',
			'softRecover'
		]) {
			expect(typeof handlersOf(EmployeeController)[handler]).toBe('function');
		}
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EmployeeConnection \{\s*nodes: \[Employee!\]!\s*edges: \[EmployeeEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type EmployeeEdge \{\s*node: Employee!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input EmployeeFilter \{/);
		expect(printed).toMatch(/input EmployeeSort \{/);
		expect(printed).toMatch(/enum EmployeeSortField \{/);
		// The two narrower reads declare a vocabulary of their own rather than borrowing the list's.
		expect(printed).toMatch(/input WorkingEmployeeFilter \{/);
		expect(printed).toMatch(/enum WorkingEmployeeSortField \{/);
		expect(printed).toMatch(/input EmployeeMemberFilter \{/);
		expect(printed).toMatch(/enum EmployeeMemberSortField \{/);
	});

	it('answers each count through a nullable field of its own', () => {
		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the count
		// route counts the caller's own rows. Nullable, because an aggregate the resource has no answer
		// for must not be answered as a zero.
		expect(fieldType('Query', 'employeeCount')).toBe('Int');
		expect(fieldArgs('Query', 'employeeCount')).toEqual([]);
	});

	it('states on the working count the arguments its own route requires, and states why', () => {
		// The one count route this platform serves that is not a count of the caller's own rows: the
		// delivered handler reads the organization and the range out of the request and hands them to a
		// predicate, so a field with no argument would answer a different question from its route.
		expect(fieldType('Query', 'workingEmployeeCount')).toBe('Int');
		expect(fieldArgs('Query', 'workingEmployeeCount')).toEqual(['organizationId', 'startDate', 'endDate']);
		expect(fieldType('Query', 'workingEmployeeCount')).not.toBe('Int!');
	});

	it('states every connection field’s arguments in one order', () => {
		expect(fieldArgs('Query', 'employees')).toEqual([
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
		expect(fieldArgs('Query', 'workingEmployees')).toEqual([
			'organizationId',
			'startDate',
			'endDate',
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
		expect(fieldArgs('Query', 'employeeMembers')).toEqual([
			'organizationId',
			'organizationTeamId',
			'organizationProjectId',
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

	it('answers the bulk route’s rows as the list the handler created', () => {
		expect(printed).toMatch(/createEmployeesBulk\(input: \[CreateEmployeeInput!\]!\): \[Employee!\]!\n/);
	});

	it('states the lifecycle writes as three separate fields', () => {
		// Removal, withdrawal and recovery are three operations: a client that could not tell them apart
		// could not tell whether the rows attributed to an employee survived its removal.
		expect(printed).toMatch(/deleteEmployee\(id: ID!, organizationId: ID\): Boolean!\n/);
		expect(printed).toMatch(/softDeleteEmployee\(id: ID!, organizationId: ID\): Employee!\n/);
		expect(printed).toMatch(/recoverEmployee\(id: ID!, organizationId: ID\): Employee!\n/);
	});
});

describe('EmployeeResolver — which members the surface exposes, and which it refuses', () => {
	it('carries the columns the delivered answer carries, with money as an exact decimal', () => {
		const body = typeBody('Employee');

		for (const member of [
			'id: ID!',
			'startedWorkOn: DateTime',
			'endWork: DateTime',
			'employeeLevel: String',
			'userId: ID',
			'contactId: ID',
			'organizationPositionId: ID',
			'tenantId: ID',
			'organizationId: ID',
			'deletedAt: DateTime',
			'createdAt: DateTime',
			'updatedAt: DateTime'
		]) {
			expect(body).toMatch(new RegExp(member.replace(' ', '\\s*')));
		}

		// A rate is money per unit of time and is stored in a numeric column, so it is an exact decimal
		// and never a float — the same reason the amounts are.
		for (const member of [
			'billRateValue',
			'minimumBillingRate',
			'averageIncome',
			'averageBonus',
			'averageExpenses',
			'totalWorkHours',
			'totalJobs',
			'jobSuccess'
		]) {
			expect(body).toMatch(new RegExp(`\\b${member}: Decimal\\b`));
		}

		// `reWeeklyLimit` is a whole number of hours rather than an amount.
		expect(body).toMatch(/\breWeeklyLimit: Int\b/);
	});

	it('carries no relation object, and carries the identifier each relation reports instead', () => {
		const body = typeBody('Employee');

		// Whether the type declares a field by this name. Asserted as a declaration rather than as a
		// substring, because a member of a type and a word inside another member's name are not the same
		// thing: `show_average_expenses` contains the characters `expenses:` and declares no expense.
		const declares = (member: string): boolean => new RegExp(`^\\s*${member}:`, 'm').test(body);

		// The delivered reads join nothing, so a relation member would be absent on every row answered
		// here — and one that were filled by merge would be filled on one of the three reads and empty on
		// the other two, which is worse.
		for (const member of [
			'user',
			'contact',
			'candidate',
			'organizationPosition',
			'organization',
			'tenant',
			'teams',
			'projects',
			'sprints',
			'modules',
			'availabilities',
			'estimations',
			'timesheets',
			'timeLogs',
			'timeSlots',
			'timeSlotSessions',
			'invoiceItems',
			'settings',
			'expenses',
			'goals',
			'leads',
			'awards',
			'phoneNumbers',
			'dailyPlans',
			'favorites',
			'tags',
			'skills',
			'organizationDepartments',
			'organizationEmploymentTypes',
			'organizationContacts',
			'timeOffPolicies',
			'timeOffRequests',
			'tasks',
			'equipmentSharings',
			'assignedComments',
			'customFields'
		]) {
			expect(declares(member)).toBe(false);
		}

		// What always travels is the foreign key, and the comment beside each names where the row behind
		// it is read from.
		for (const member of ['userId', 'contactId', 'organizationPositionId']) {
			expect(declares(member)).toBe(true);
		}
	});

	it('carries no member for the account’s own columns, which the list read does not select', () => {
		const body = typeBody('Employee');
		const declares = (member: string): boolean => new RegExp(`^\\s*${member}:`, 'm').test(body);

		// The paginated spelling of the list and the members read select the account's name, address and
		// image beside the row; `GET /`, which the `employees` connection mirrors, does not. A member for
		// any of them would be present on one of this domain's three list fields and absent on the other
		// two.
		for (const member of ['name', 'firstName', 'lastName', 'email', 'imageUrl', 'timeZone']) {
			expect(declares(member)).toBe(false);
		}
	});

	it('carries no member for a virtual column the store does not have', () => {
		const body = typeBody('Employee');

		// Both are declared on the entity as virtual members; neither delivered read fills them, so a
		// field for either would answer null on every row.
		expect(body).not.toMatch(/\bfullName:/);
		expect(body).not.toMatch(/\bisDeleted:/);
	});

	it('declares a filter per read, each carrying exactly its own projection', () => {
		const list = inputBody('EmployeeFilter');
		const working = inputBody('WorkingEmployeeFilter');
		const members = inputBody('EmployeeMemberFilter');

		// The list's vocabulary is the row's own columns.
		expect(list).toMatch(/startedWorkOn: DateTimeFilter/);
		expect(list).toMatch(/billRateValue: DecimalFilter/);
		expect(list).toMatch(/userId: IDFilter/);
		expect(list).toMatch(/deletedAt: DateTimeFilter/);

		// The working read selects no level, no hiring dates and no archive stamp, so none is filterable
		// there — a filter over a column the read never selected would match by absence.
		expect(working).toMatch(/startedWorkOn: DateTimeFilter/);
		expect(working).not.toMatch(/\bemployeeLevel:/);
		expect(working).not.toMatch(/\bofferDate:/);
		expect(working).not.toMatch(/\bdeletedAt:/);

		// The members read projects six columns, so its vocabulary is the narrowest of the three.
		expect(members).toMatch(/userId: IDFilter/);
		expect(members).not.toMatch(/\bstartedWorkOn:/);
		expect(members).not.toMatch(/\bbillRateValue:/);
		// No relation is filterable anywhere: the rows carry the identifier and nothing behind it.
		expect(list).not.toMatch(/\buser:/);
		expect(list).not.toMatch(/\btags:/);
		expect(list).not.toMatch(/\bsettings:/);
	});

	it('declares the two write inputs the two edit routes take, and never the account’s password on the way out', () => {
		expect(printed).toMatch(/input CreateEmployeeInput \{/);
		expect(printed).toMatch(/input UpdateEmployeeInput \{/);
		expect(printed).toMatch(/input UpdateEmployeeProfileInput \{/);
		expect(printed).toMatch(/input EmployeeUserInput \{/);

		// The address identifies an account, so the create requires it; the engagement's own identifier is
		// required by the edits.
		expect(inputBody('EmployeeUserInput')).toMatch(/email: String!/);
		expect(inputBody('UpdateEmployeeInput')).toMatch(/id: ID!/);
		expect(inputBody('UpdateEmployeeProfileInput')).toMatch(/id: ID!/);

		// The password is a member on the way in only: the delivered write hashes it, and the answer is
		// the engagement's projection, which has no digest in it.
		expect(inputBody('CreateEmployeeInput')).toMatch(/password: String/);
		expect(typeBody('Employee')).not.toMatch(/\bpassword:/);

		// The profile body carries none of the administrative columns, which is what makes it a narrower
		// statement than the edit rather than the same one under a second name.
		const profile = inputBody('UpdateEmployeeProfileInput');
		expect(profile).not.toMatch(/\bisActive:/);
		expect(profile).not.toMatch(/\bshow_billrate:/);
		expect(inputBody('UpdateEmployeeInput')).toMatch(/isActive: Boolean/);
		expect(inputBody('UpdateEmployeeInput')).toMatch(/show_billrate: Boolean/);
	});
});

describe('EmployeeResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, employeeService } = surfaces();

		const connection = await resolver.employees(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, criterion included.
		expect(employeeService.findAll).toHaveBeenCalledWith({ where: { user: { isActive: true, isArchived: false } } });
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.employees();

		expect(connection.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows by the fields the filter declares, and refuses the ones it does not', async () => {
		const { resolver } = surfaces();

		const byLevel = await resolver.employees({ employeeLevel: { eq: 'Senior' } });
		expect(byLevel.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byEndWork = await resolver.employees({ endWork: { isNull: true } });
		expect(byEndWork.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byRate = await resolver.employees({ billRateValue: { gte: '100' } });
		expect(byRate.nodes.map((node) => node.id)).toEqual([FIRST]);

		// A relation is not filterable, because the rows carry no relation to narrow by.
		const error = await resolver.employees({ user: { name: { eq: 'Ada' } } }).catch((thrown) => thrown);
		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers, and refuses a column it does not', async () => {
		const { resolver } = surfaces();

		const byLevel = await resolver.employees(undefined, [{ field: 'employeeLevel', direction: 'ASC' }]);
		expect(byLevel.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);

		const byRate = await resolver
			.employees(undefined, [{ field: 'billRateValue', direction: 'DESC' }] as never)
			.catch((thrown) => thrown);

		// The column is filterable and is deliberately not sortable: the enum states the keys a roster is
		// read in an order for, and the refusal names what is on offer.
		expect(isRefusal(byRate)).toBe(true);
		expect((byRate as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.employees(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.employees(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.employees(undefined, undefined, undefined, 20);
		const last = await resolver.employees(undefined, undefined, { last: 1, before: all.edges[1].cursor });

		expect(last.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employees(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every engagement', async () => {
		const { resolver } = surfaces();

		const error = await resolver.employees(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});

	it('answers the working roster through the command the delivered route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		commandBus.execute.mockResolvedValueOnce({ items: ROWS, total: ROWS.length });

		const startDate = new Date('2026-03-01T00:00:00.000Z');
		const endDate = new Date('2026-03-31T23:59:59.000Z');
		const connection = await resolver.workingEmployees(ORGANIZATION, startDate, endDate, undefined, undefined, undefined, 20);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(WorkingEmployeeGetCommand);
		expect(command.input).toEqual({ organizationId: ORGANIZATION, forRange: { startDate, endDate } });
		expect(connection.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);

		// A range neither bound of which is stated is the call the route makes when its `data` parameter
		// carries no range at all.
		commandBus.execute.mockResolvedValueOnce({ items: ROWS, total: ROWS.length });
		await resolver.workingEmployees(ORGANIZATION);

		expect(commandBus.execute.mock.calls[1][0].input).toEqual({
			organizationId: ORGANIZATION,
			forRange: undefined
		});
	});

	it('narrows the working roster by its own vocabulary, not the list’s', async () => {
		const { resolver, commandBus } = surfaces();
		commandBus.execute.mockResolvedValueOnce({ items: ROWS, total: ROWS.length });

		const connection = await resolver.workingEmployees(ORGANIZATION, undefined, undefined, {
			isOnline: { eq: true }
		});

		expect(connection.nodes.map((node) => node.id)).toEqual([FIRST]);

		// A column the working read does not select is refused rather than answered by absence.
		commandBus.execute.mockResolvedValueOnce({ items: ROWS, total: ROWS.length });
		const error = await resolver
			.workingEmployees(ORGANIZATION, undefined, undefined, { employeeLevel: { eq: 'Senior' } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('answers the members through the same service method the delivered route calls', async () => {
		const { resolver, employeeService } = surfaces();

		const connection = await resolver.employeeMembers(ORGANIZATION, undefined, undefined, undefined, undefined, undefined, 20);

		expect(employeeService.findMembers).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			organizationTeamId: undefined,
			organizationProjectId: undefined
		});
		expect(connection.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows the members by their own projection and refuses the rest', async () => {
		const { resolver } = surfaces();

		expect((await resolver.employeeMembers(ORGANIZATION, undefined, undefined, { isAway: { eq: true } })).nodes.map((node) => node.id)).toEqual([
			SECOND
		]);

		const error = await resolver
			.employeeMembers(ORGANIZATION, undefined, undefined, { startedWorkOn: { isNull: false } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('EmployeeResolver — one concept, two protocols, the same operations', () => {
	it('reads the engagement the caller names when it may change the selected employee', async () => {
		caller(true, null);
		const { resolver, commandBus } = surfaces();

		expect(await resolver.employee(FIRST)).toBe(ROWS[0]);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EmployeeGetCommand);
		// The criteria are the delivered handler's, withdrawal included: an administration screen that
		// could not read a withdrawn engagement could not recover it.
		expect(command.input).toEqual({ where: { id: FIRST }, withDeleted: true });
	});

	it('answers the caller’s own engagement when it may not, whatever identifier it names', async () => {
		caller(false, OWN_EMPLOYEE);
		const { resolver, commandBus } = surfaces();
		commandBus.execute.mockResolvedValueOnce(ROWS[0]);

		await resolver.employee(SECOND);

		expect(commandBus.execute.mock.calls[0][0].input).toEqual({ where: { id: OWN_EMPLOYEE }, withDeleted: true });
	});

	it('refuses a caller with no engagement of its own, which is the route’s own refusal', async () => {
		caller(false, null);
		const { resolver, commandBus } = surfaces();

		const error = await resolver.employee(FIRST).catch((thrown) => thrown);

		expect(error).toBeInstanceOf(ForbiddenException);
		expect((error as Error).message).toContain('You do not have permission to view this employee.');
		// The refusal is raised before the read, so a caller that may not read is never served a row.
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it('answers null for an engagement that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		caller(true, null);
		const { resolver, commandBus } = surfaces();
		commandBus.execute.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.employee(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, employeeService } = surfaces();

		expect(await resolver.employeeCount()).toBe(2);
		expect(employeeService.countBy).toHaveBeenCalledWith();
	});

	it('counts the working roster through the same service method its route calls', async () => {
		const { resolver, employeeService } = surfaces();
		const startDate = new Date('2026-03-01T00:00:00.000Z');

		expect(await resolver.workingEmployeeCount(ORGANIZATION, startDate, undefined)).toBe(2);
		expect(employeeService.findWorkingEmployeesCount).toHaveBeenCalledWith(ORGANIZATION, {
			startDate,
			endDate: undefined
		});
	});

	it('answers null when the working count answers nothing, rather than a fabricated zero', async () => {
		const { resolver, employeeService } = surfaces();
		employeeService.findWorkingEmployeesCount.mockResolvedValueOnce(undefined as never);

		expect(await resolver.workingEmployeeCount(ORGANIZATION)).toBeNull();
	});

	it('files an engagement through the command the create route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createEmployee({
			organizationId: ORGANIZATION,
			userId: ACCOUNT,
			employeeLevel: 'Senior',
			organizationPositionId: OWN_EMPLOYEE,
			tagIds: [TENANT]
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EmployeeCreateCommand);
		// The relations are stated as the identifiers the delivered write is written from.
		expect(command.input).toEqual({
			organizationId: ORGANIZATION,
			userId: ACCOUNT,
			user: undefined,
			password: undefined,
			startedWorkOn: undefined,
			endWork: undefined,
			short_description: undefined,
			description: undefined,
			anonymousBonus: undefined,
			employeeLevel: 'Senior',
			organizationPosition: { id: OWN_EMPLOYEE },
			tags: [{ id: TENANT }]
		});
	});

	it('files several engagements through the bulk command, one payload per row', async () => {
		const { resolver, commandBus } = surfaces();
		commandBus.execute.mockResolvedValueOnce(ROWS);

		expect(
			await resolver.createEmployeesBulk([
				{ organizationId: ORGANIZATION, userId: ACCOUNT },
				{ organizationId: ORGANIZATION, employeeLevel: 'Junior' }
			])
		).toBe(ROWS);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EmployeeBulkCreateCommand);
		expect(command.input).toHaveLength(2);
		expect(command.input[0]).toEqual(expect.objectContaining({ organizationId: ORGANIZATION, userId: ACCOUNT }));
		expect(command.input[1]).toEqual(expect.objectContaining({ employeeLevel: 'Junior' }));
	});

	it('edits an engagement through the command the update route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateEmployee({ id: FIRST, employeeLevel: 'Lead', isActive: false });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EmployeeUpdateCommand);
		expect(command.id).toBe(FIRST);
		// A member the caller did not state is not in the payload at all rather than being written as a
		// default: the delivered handler merges what is stated over the row it read, so a member that was
		// absent from the request stays absent from the write.
		expect(command.input).toEqual(
			expect.objectContaining({ id: FIRST, employeeLevel: 'Lead', isActive: false })
		);
		expect(command.input).not.toHaveProperty('description');
	});

	it('edits the caller’s own profile through the same command its route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateEmployeeProfile({ id: FIRST, billRateValue: 150, linkedInUrl: 'https://example.test/ada' });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EmployeeUpdateCommand);
		expect(command.id).toBe(FIRST);
		expect(command.input).toEqual(
			expect.objectContaining({ id: FIRST, billRateValue: 150, linkedInUrl: 'https://example.test/ada' })
		);
		// The identifier member and the two relation identifiers are lifted out rather than passed beside
		// the relations the write persists.
		expect(command.input).not.toHaveProperty('tagIds');
	});

	it('removes an engagement through the same service method the delete route calls', async () => {
		const { resolver, employeeService } = surfaces();

		expect(await resolver.deleteEmployee(FIRST, ORGANIZATION)).toBe(true);
		expect(employeeService.delete).toHaveBeenCalledWith(FIRST, { where: { organizationId: ORGANIZATION } });
	});

	it('withdraws and restores an engagement through the same two service methods', async () => {
		const { resolver, employeeService } = surfaces();

		const withdrawn = await resolver.softDeleteEmployee(FIRST, ORGANIZATION);
		expect(employeeService.softRemovedById).toHaveBeenCalledWith(FIRST, { organizationId: ORGANIZATION });
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);

		const restored = await resolver.recoverEmployee(FIRST, ORGANIZATION);
		expect(employeeService.softRecoverById).toHaveBeenCalledWith(FIRST, { organizationId: ORGANIZATION });
		expect(restored.deletedAt).toBeNull();
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, employeeService } = surfaces();
		const refusal = new Error('EMPLOYEE_STILL_REFERENCED: a time log still points at this engagement.');

		employeeService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteEmployee(FIRST)).rejects.toBe(refusal);
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
	{ field: 'employees', route: 'findAll' },
	{ field: 'employee', route: 'findById' },
	{ field: 'employeeCount', route: 'getCount' },
	{ field: 'workingEmployees', route: 'findAllWorkingEmployees' },
	{ field: 'workingEmployeeCount', route: 'findAllWorkingEmployeesCount' },
	{ field: 'employeeMembers', route: 'getMembers' },
	{ field: 'createEmployee', route: 'create' },
	{ field: 'createEmployeesBulk', route: 'createBulk' },
	{ field: 'updateEmployee', route: 'update' },
	{ field: 'updateEmployeeProfile', route: 'updateProfile' },
	{ field: 'deleteEmployee', route: 'delete' },
	{ field: 'softDeleteEmployee', route: 'softRemove' },
	{ field: 'recoverEmployee', route: 'softRecover' }
];

describe('EmployeeResolver — the guard stack and the permission are the route’s, field by field', () => {
	it('states on the class the guards and the permission the controller states on its class', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', EmployeeController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', EmployeeResolver) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard]));
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeController)
		);
		expect(permissionOfField('createEmployee')).toEqual([PermissionsEnum.ORG_EMPLOYEES_EDIT]);
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(EmployeeController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual([...guardsOfRoute(EmployeeController, route), FeatureFlagGuard].sort());
		expect(permissionOfField(field)).toEqual(permissionOfRoute(EmployeeController, route));
	});

	it('states on each field the permission its own route declares, and never a wider one', () => {
		expect(permissionOfField('employees')).toEqual([PermissionsEnum.ORG_EMPLOYEES_VIEW]);
		expect(permissionOfField('employeeCount')).toEqual([PermissionsEnum.ORG_EMPLOYEES_VIEW]);
		expect(permissionOfField('workingEmployees')).toEqual([
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
			PermissionsEnum.SELECT_EMPLOYEE
		]);
		expect(permissionOfField('workingEmployeeCount')).toEqual([
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
			PermissionsEnum.SELECT_EMPLOYEE
		]);
		expect(permissionOfField('employeeMembers')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.ORG_MEMBERS_VIEW
		]);
		expect(permissionOfField('updateEmployeeProfile')).toEqual([PermissionsEnum.PROFILE_EDIT]);
		expect(permissionOfField('deleteEmployee')).toEqual([PermissionsEnum.ORG_EMPLOYEES_EDIT]);
	});

	it('declares the node query’s empty permission list, because its route declares an empty one', () => {
		// The delivered `GET /:id` states `@Permissions()` with no members, which *overrides* the
		// controller's class-level edit permission rather than inheriting it — an empty array is not the
		// same statement to the guard as no decorator at all, and only one of the two is the route's. The
		// field states the route's, so the resolver is not narrower than the route it mirrors.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EmployeeController)['findById'])).toEqual([]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeResolver)['employee'])).toEqual([]);
		expect(permissionOfField('employee')).toEqual([]);

		// The scope the route enforces in its handler is not a permission and is not turned into one: it
		// is restated in the resolver, and this suite pins it above.
		expect(permissionOfField('employee')).not.toEqual([PermissionsEnum.ORG_EMPLOYEES_EDIT]);
	});

	it('holds the three lifecycle fields to the inherited-or-overridden routes they mirror', () => {
		// Two of the three routes are the controller's own overrides and one is inherited from the CRUD
		// base; all three run under the class-level edit permission, which is what the fields state.
		for (const [field, route] of [
			['deleteEmployee', 'delete'],
			['softDeleteEmployee', 'softRemove'],
			['recoverEmployee', 'softRecover']
		] as ReadonlyArray<[string, string]>) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EmployeeController)[route])).toBeUndefined();
			expect(permissionOfRoute(EmployeeController, route)).toEqual([PermissionsEnum.ORG_EMPLOYEES_EDIT]);
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_EMPLOYEES_EDIT]);
		}
	});
});

describe('EmployeeModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EmployeeModule) ?? []) as unknown[];

		expect(providers).toContain(EmployeeResolver);
		expect(providers).toContain(EmployeeService);
	});

	it('re-exports what the resolver injects beside the service', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else — which for this resolver is
		// the service and the command bus its five dispatches resolve through.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EmployeeModule) ?? []) as unknown[];

		expect(exported).toContain(EmployeeService);
		expect(exported.map((entry) => (entry as { name?: string })?.name)).toEqual(
			expect.arrayContaining(['CqrsModule'])
		);
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
		getHandler: () => (EmployeeResolver.prototype as never)[field],
		getClass: () => EmployeeResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EmployeeResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it — including the node query, whose own permission list is empty.
		expect(Reflect.getMetadata(FEATURE_METADATA, EmployeeResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EmployeeResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('employees')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('employees');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('employees'))).resolves.toBe(true);
	});
});
