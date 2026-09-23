/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum, RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EquipmentSharingController } from './equipment-sharing.controller';
import { EquipmentSharingModule } from './equipment-sharing.module';
import { EquipmentSharingResolver } from './equipment-sharing.resolver';
import { EquipmentSharingService } from './equipment-sharing.service';
import {
	EquipmentSharingCreateCommand,
	EquipmentSharingStatusCommand,
	EquipmentSharingUpdateCommand
} from './commands';

/**
 * The sharing periods of an organization's equipment over GraphQL.
 *
 * The delivered REST routes serve a list, the paginated spelling of the same list, one row, a count, two
 * reads that join the employee and team pivots, a filing, an edit, the two lifecycle decisions and the
 * two removals of the CRUD base. This suite pins the half of the two-protocol doctrine that is easy to
 * get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema; the list and the two
 *   pivot reads are connections with the platform's own cursor codec behind them, so a cursor obtained
 *   over REST resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — including the five fields whose routes state none, which is the case where "no
 *   permission" is the parity rather than an omission;
 * - a row is a period: the window members are what say whether it is in force, and the status is carried
 *   as the vocabulary's own value rather than as a schema enum;
 * - the two sub-route reads are root fields of their own because their rows carry memberships the list
 *   read's rows cannot, and the memberships are the ones those reads join;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant that
 *   switched that capability off is refused the way a disabled capability's routes are.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EQUIPMENT = '00000000-0000-4000-8000-000000000010';
const POLICY = '00000000-0000-4000-8000-000000000020';
const EMPLOYEE = '00000000-0000-4000-8000-000000000030';
const OTHER_EMPLOYEE = '00000000-0000-4000-8000-000000000031';
const TEAM = '00000000-0000-4000-8000-000000000040';
const USER = '00000000-0000-4000-8000-000000000050';
const OTHER_USER = '00000000-0000-4000-8000-000000000051';
const APPROVED_PERIOD = '00000000-0000-4000-8000-000000000060';
const FILED_PERIOD = '00000000-0000-4000-8000-000000000061';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted service answers with.
 *
 * The filed period's window was never recorded, which is what makes it the row the default order places
 * first and the row an `isNull` question finds. Both rows carry the two memberships, because the two
 * reads that produce rows carrying them are the ones the sub-route fields call.
 */
const ROWS = [
	{
		id: APPROVED_PERIOD,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Field kit',
		shareRequestDay: new Date('2026-01-05T10:00:00.000Z'),
		shareStartDay: new Date('2026-02-01T10:00:00.000Z'),
		shareEndDay: new Date('2026-04-01T10:00:00.000Z'),
		status: RequestApprovalStatusTypesEnum.APPROVED,
		equipmentId: EQUIPMENT,
		equipmentSharingPolicyId: POLICY,
		createdByUserId: USER,
		employees: [{ id: EMPLOYEE }],
		teams: [{ id: TEAM }],
		createdAt: new Date('2026-01-05T10:00:00.000Z'),
		updatedAt: new Date('2026-01-05T10:00:00.000Z')
	},
	{
		id: FILED_PERIOD,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Studio camera',
		shareRequestDay: new Date('2026-03-01T10:00:00.000Z'),
		shareStartDay: null,
		shareEndDay: new Date('2026-05-01T10:00:00.000Z'),
		status: RequestApprovalStatusTypesEnum.REQUESTED,
		equipmentId: EQUIPMENT,
		equipmentSharingPolicyId: null,
		createdByUserId: OTHER_USER,
		employees: [{ id: OTHER_EMPLOYEE }],
		teams: [],
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const equipmentSharingService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		findEquipmentSharingsByOrganizationId: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findEquipmentSharingsByEmployeeId: jest.fn().mockResolvedValue({ items: [ROWS[0]], total: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-06-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		equipmentSharingService,
		commandBus,
		resolver: new EquipmentSharingResolver(equipmentSharingService as never, commandBus as never)
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

/** This domain's own two documents, as they are written on disk. */
const ownSdl = ['equipment-sharing.type.gql', 'equipment-sharing.api.gql']
	.map((file) => readFileSync(join(__dirname, 'schema', file), 'utf8'))
	.join('\n');

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The type one root field answers, as the schema states it. */
function fieldType(operation: 'Query' | 'Mutation', field: string): string {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { type: unknown }> }
		| undefined;

	return String(root?.getFields()?.[field]?.type);
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/**
 * The root fields this domain contributes, which are the ones that name its concept.
 *
 * The policy resource beside it names itself around the same two words, so its fields are excluded
 * here: one resource's suite asserts its own fields, not its neighbours'.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('equipmentsharing'))
		.filter((field) => !field.toLowerCase().includes('equipmentsharingpolic'))
		.sort();
}

/** The printed body of one declaration, whatever kind it is. */
function bodyOf(kind: 'type' | 'input' | 'enum', name: string): string {
	return printed.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return bodyOf('type', name);
}

/** The printed body of one input type. */
function inputBody(name: string): string {
	return bodyOf('input', name);
}

/**
 * The member names one type declares, read off its printed body rather than off a description: a doc
 * comment is part of the printed type, so a member is asserted absent by its name and never by the
 * words a description happens to use.
 */
function memberNames(name: string): string[] {
	return [...typeBody(name).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/gm)].map((match) => match[1]);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof EquipmentSharingController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EquipmentSharingController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = EquipmentSharingResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/**
 * The guards one route actually runs under: the controller's chain together with whatever the handler
 * states of its own.
 *
 * The union rather than the concatenation, because several handlers of this controller restate the
 * permission guard their class already carries, and what parity asserts is the scope a route runs under
 * rather than the number of times a guard is listed.
 */
function guardsOfRoute(controller: typeof EquipmentSharingController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here: a
 * table of permission names would agree with the resolver while disagreeing with the controller, which
 * is the failure this half of the doctrine exists to catch.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'equipmentSharings', route: 'findAll' },
	{ field: 'equipmentSharing', route: 'findById' },
	{ field: 'equipmentSharingCount', route: 'getCount' },
	{ field: 'equipmentSharingsByOrganization', route: 'findEquipmentSharingsByOrganizationId' },
	{ field: 'equipmentSharingsByEmployee', route: 'findEquipmentSharingsByEmployeeId' },
	{ field: 'createEquipmentSharing', route: 'createEquipmentSharing' },
	{ field: 'updateEquipmentSharing', route: 'update' },
	{ field: 'approveEquipmentSharing', route: 'equipmentSharingsRequestApproval' },
	{ field: 'refuseEquipmentSharing', route: 'equipmentSharingsRequestRefuse' },
	{ field: 'deleteEquipmentSharing', route: 'delete' },
	{ field: 'softDeleteEquipmentSharing', route: 'softRemove' },
	{ field: 'recoverEquipmentSharing', route: 'softRecover' }
];

/** The write fields, whose delegations are asserted one by one below. */
const WRITES = [
	'createEquipmentSharing',
	'updateEquipmentSharing',
	'approveEquipmentSharing',
	'refuseEquipmentSharing',
	'deleteEquipmentSharing',
	'softDeleteEquipmentSharing',
	'recoverEquipmentSharing'
];

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller's scope.
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
		getHandler: () => (EquipmentSharingResolver.prototype as never)[field],
		getClass: () => EquipmentSharingResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EquipmentSharingResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the three list reads, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'equipmentSharings',
				'equipmentSharing',
				'equipmentSharingCount',
				'equipmentSharingsByOrganization',
				'equipmentSharingsByEmployee'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(expect.arrayContaining(WRITES));
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once. The two reads that join the employee and team pivots
		// are fields of their own, and every write route has its own field.
		expect(ownedRootFields('Query')).toEqual([
			'equipmentSharing',
			'equipmentSharingCount',
			'equipmentSharings',
			'equipmentSharingsByEmployee',
			'equipmentSharingsByOrganization'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'approveEquipmentSharing',
			'createEquipmentSharing',
			'deleteEquipmentSharing',
			'recoverEquipmentSharing',
			'refuseEquipmentSharing',
			'softDeleteEquipmentSharing',
			'updateEquipmentSharing'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EquipmentSharingConnection \{\s*nodes: \[EquipmentSharing!\]!\s*edges: \[EquipmentSharingEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type EquipmentSharingEdge \{\s*node: EquipmentSharing!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input EquipmentSharingFilter \{/);
		expect(printed).toMatch(/input EquipmentSharingSort \{/);
		expect(printed).toMatch(
			/enum EquipmentSharingSortField \{\s*createdAt\s*updatedAt\s*name\s*shareRequestDay\s*shareStartDay\s*shareEndDay\s*status\s*\}/
		);
	});

	it('declares the two write inputs', () => {
		expect(printed).toMatch(/input CreateEquipmentSharingInput \{/);
		expect(printed).toMatch(/input UpdateEquipmentSharingInput \{/);
	});

	it('carries the row’s own columns and not the relations the list read never joins', () => {
		const members = memberNames('EquipmentSharing');

		// The two relations the row owns are joined only by the two sub-route reads, so this surface
		// carries their identifiers rather than the rows: a member carrying a related row would be
		// absent from exactly the rows the connection answers.
		expect(members).not.toContain('equipment');
		expect(members).not.toContain('equipmentSharingPolicy');
		expect(members).toEqual(
			expect.arrayContaining([
				'name',
				'shareRequestDay',
				'shareStartDay',
				'shareEndDay',
				'status',
				'equipmentId',
				'equipmentSharingPolicyId',
				'employees',
				'teams',
				'createdByUserId',
				'deletedAt'
			])
		);

		// The two memberships are the members the two sub-route reads exist to answer, and they are
		// nullable because the list connection's rows are not joined.
		expect(typeBody('EquipmentSharing')).toMatch(/employees: \[Employee!\]\n/);
		expect(typeBody('EquipmentSharing')).toMatch(/teams: \[OrganizationTeam!\]\n/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(fieldArgs('Query', 'equipmentSharings')).not.toContain('withDeleted');
		// Each list field declares the query protocol's page arguments and the path segment it mirrors,
		// and nothing else.
		expect(fieldArgs('Query', 'equipmentSharings')).toEqual([
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
		expect(fieldArgs('Query', 'equipmentSharingsByOrganization')[0]).toBe('organizationId');
		expect(fieldArgs('Query', 'equipmentSharingsByEmployee')[0]).toBe('employeeId');
		// The count route binds its query string to the store's own `where`, which is a shape no schema
		// can state, so the field states no narrowing of its own — and it is nullable, because a count is
		// an aggregate the resource may have no answer for and a non-null field would fabricate a zero.
		expect(fieldArgs('Query', 'equipmentSharingCount')).toEqual([]);
		expect(fieldType('Query', 'equipmentSharingCount')).toBe('Int');
	});

	it('declares the arguments each write route carries, so a field states what its resolver reads', () => {
		const WRITE_ARGS: ReadonlyArray<[string, string[]]> = [
			['createEquipmentSharing', ['organizationId', 'input']],
			['updateEquipmentSharing', ['input']],
			['approveEquipmentSharing', ['id']],
			['refuseEquipmentSharing', ['id']],
			['deleteEquipmentSharing', ['id']],
			['softDeleteEquipmentSharing', ['id']],
			['recoverEquipmentSharing', ['id']]
		];

		for (const [field, args] of WRITE_ARGS) {
			expect(fieldArgs('Mutation', field)).toEqual(args);
		}
	});
});

describe('EquipmentSharingResolver — a row is a period, and the status is the vocabulary’s own value', () => {
	it('carries the three interval members, each as the instant it is', () => {
		const body = typeBody('EquipmentSharing');

		expect(body).toMatch(/shareRequestDay: DateTime\n/);
		expect(body).toMatch(/shareStartDay: DateTime\n/);
		expect(body).toMatch(/shareEndDay: DateTime\n/);
		// No stored "in force" flag is carried, because the delivered row has none: whether a period is
		// in force is a question about the window and the instant, and it is asked through the filter.
		expect(body).not.toMatch(/isInForce|isCurrent|inForce/);
	});

	it('states a period in force now through the window, not through the base entity’s own flag', async () => {
		const { resolver } = surfaces();
		const now = '2026-03-01T10:00:00.000Z';

		// The question the domain exists to answer: the rows whose window contains this instant.
		const inForce = await resolver.equipmentSharings({
			and: [{ shareStartDay: { lte: now } }, { shareEndDay: { gte: now } }]
		});

		expect(inForce.nodes.map((node) => node.id)).toEqual([APPROVED_PERIOD]);

		// A period whose window was never recorded is found by `isNull`, not by the pair above, and it is
		// exactly the row the default order puts first.
		const unrecorded = await resolver.equipmentSharings({ shareStartDay: { isNull: true } });
		expect(unrecorded.nodes.map((node) => node.id)).toEqual([FILED_PERIOD]);

		// And `isActive` is a different question, because it is the base entity's own marker: narrowing
		// by it truthfully answers nothing here rather than answering the window question under its name.
		expect((await resolver.equipmentSharings({ isActive: { eq: true } })).totalCount).toBe(0);
	});

	it('carries the status as its own value rather than as a schema enum', () => {
		// The vocabulary is the contracts' own request-approval value set, shared with the approval row
		// the delivered writes record beside the sharing, so declaring it here would claim a value set
		// this domain does not own.
		expect(typeBody('EquipmentSharing')).toMatch(/status: Int!\n/);
		expect(inputBody('CreateEquipmentSharingInput')).toMatch(/status: Int!\n/);
		expect(inputBody('EquipmentSharingFilter')).toMatch(/status: NumberFilter\n/);
		expect(printed).not.toMatch(/enum EquipmentSharingStatus/);
		// The service writes the numeric vocabulary, so the member is a whole number and never a string.
		expect(ownSdl).not.toMatch(/status: String/);
	});
});

describe('EquipmentSharingResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, equipmentSharingService } = surfaces();

		const connection = await resolver.equipmentSharings(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(equipmentSharingService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FILED_PERIOD);
	});

	it('orders by the window’s own opening instant, latest first, when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.equipmentSharings();

		// The connection's own rule places an absent value first under a descending walk, which is what
		// puts the period whose window was never recorded at the head of the list.
		expect(connection.nodes.map((node) => node.id)).toEqual([FILED_PERIOD, APPROVED_PERIOD]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.equipmentSharings({
			status: { eq: RequestApprovalStatusTypesEnum.REQUESTED }
		});
		expect(byStatus.nodes.map((node) => node.id)).toEqual([FILED_PERIOD]);

		const byEquipment = await resolver.equipmentSharings({ equipmentId: { eq: EQUIPMENT } });
		expect(byEquipment.totalCount).toBe(2);

		const byPolicy = await resolver.equipmentSharings({ equipmentSharingPolicyId: { isNull: true } });
		expect(byPolicy.nodes.map((node) => node.id)).toEqual([FILED_PERIOD]);

		// The author of the period is a column, so the question the by-employee route asks by its own
		// read is also stateable on the connection — without the memberships that read joins.
		const byAuthor = await resolver.equipmentSharings({ createdByUserId: { eq: OTHER_USER } });
		expect(byAuthor.nodes.map((node) => node.id)).toEqual([FILED_PERIOD]);

		const byName = await resolver.equipmentSharings({ name: { ilike: 'field%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([APPROVED_PERIOD]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.equipmentSharings(undefined, [{ field: 'status', direction: 'ASC' }]);
		expect(byStatus.nodes.map((node) => node.id)).toEqual([FILED_PERIOD, APPROVED_PERIOD]);

		const byEnd = await resolver.equipmentSharings(undefined, [{ field: 'shareEndDay', direction: 'ASC' }]);
		expect(byEnd.nodes.map((node) => node.id)).toEqual([APPROVED_PERIOD, FILED_PERIOD]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.equipmentSharings(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FILED_PERIOD]);

		const second = await resolver.equipmentSharings(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([APPROVED_PERIOD]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.equipmentSharings(undefined, undefined, undefined, 20);

		const last = await resolver.equipmentSharings(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([FILED_PERIOD]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.equipmentSharings(undefined, [{ field: 'equipmentId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare, the two memberships among them', async () => {
		const { resolver } = surfaces();

		// The memberships are carried on the object but are deliberately not filterable: the delivered
		// list read is handed no relations, so the condition could only ever match the empty set — and
		// the connection refuses it rather than answering it with no rows.
		const error = await resolver.equipmentSharings({ employees: { eq: EMPLOYEE } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.equipmentSharings(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('keeps the evaluator’s allow-list and the schema’s filter in step, member for member', async () => {
		const { resolver } = surfaces();
		const declared = [...inputBody('EquipmentSharingFilter').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)]
			.map((match) => match[1])
			.filter((member) => !['and', 'or', 'not'].includes(member));

		for (const member of declared) {
			await expect(resolver.equipmentSharings({ [member]: {} })).resolves.toBeDefined();
		}

		const refusal = await resolver.equipmentSharings({ employees: { eq: EMPLOYEE } }).catch((thrown) => thrown);
		const allowed = String((refusal as Error).message)
			.split('Allowed: ')[1]
			.replace(/\.\s*$/, '')
			.split(',')
			.map((member) => member.trim())
			.sort();

		expect(allowed).toEqual([...declared].sort());
	});

	it('accepts every key the sort enum offers, and only those', async () => {
		const { resolver } = surfaces();
		const offered = [
			...bodyOf('enum', 'EquipmentSharingSortField').matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/gm)
		].map((match) => match[1]);

		expect(offered).toEqual([
			'createdAt',
			'updatedAt',
			'name',
			'shareRequestDay',
			'shareStartDay',
			'shareEndDay',
			'status'
		]);

		for (const field of offered) {
			await expect(resolver.equipmentSharings(undefined, [{ field, direction: 'ASC' }])).resolves.toBeDefined();
		}
	});
});

describe('EquipmentSharingResolver — the two pivot reads are fields of their own', () => {
	it('reads one organization’s periods through the delivered method, and answers their memberships', async () => {
		const { resolver, equipmentSharingService } = surfaces();

		const connection = await resolver.equipmentSharingsByOrganization(ORGANIZATION);

		expect(equipmentSharingService.findEquipmentSharingsByOrganizationId).toHaveBeenCalledWith(ORGANIZATION);
		// The rows are the read's own, so they carry what that read joins — which is the whole reason
		// this is a field of its own rather than a filter on the connection above. The row read here is
		// found by its identifier rather than by position, because the connection's own default order is
		// the window's, not the read's.
		const approved = connection.nodes.find((node) => node.id === APPROVED_PERIOD);
		expect(approved?.employees).toEqual([{ id: EMPLOYEE }]);
		expect(approved?.teams).toEqual([{ id: TEAM }]);
		expect(connection.totalCount).toBe(2);
	});

	it('reads one employee’s filed periods through the delivered method, narrowed by the requester', async () => {
		const { resolver, equipmentSharingService } = surfaces();

		const connection = await resolver.equipmentSharingsByEmployee(EMPLOYEE);

		// The path segment is named for an employee, and the delivered read narrows on the user who
		// filed the request: the field calls that read rather than inventing a membernarrowing of its own.
		expect(equipmentSharingService.findEquipmentSharingsByEmployeeId).toHaveBeenCalledWith(EMPLOYEE);
		expect(connection.nodes[0].createdByUserId).toBe(USER);
	});

	it('applies the same connection protocol to the two pivot reads as to the list', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.equipmentSharingsByOrganization(ORGANIZATION, {
			name: { ilike: 'studio%' }
		});
		expect(byName.nodes.map((node) => node.id)).toEqual([FILED_PERIOD]);

		const byStatus = await resolver.equipmentSharingsByEmployee(EMPLOYEE, undefined, [
			{ field: 'status', direction: 'ASC' }
		]);
		expect(byStatus.nodes.map((node) => node.id)).toEqual([APPROVED_PERIOD]);
	});
});

describe('EquipmentSharingResolver — one resource, two protocols, the same operations', () => {
	it('reads one period through the same service method the REST node route calls', async () => {
		const { resolver, equipmentSharingService } = surfaces();

		expect(await resolver.equipmentSharing(APPROVED_PERIOD)).toBe(ROWS[0]);
		expect(equipmentSharingService.findOneByIdString).toHaveBeenCalledWith(APPROVED_PERIOD);
	});

	it('answers null for a period that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, equipmentSharingService } = surfaces();
		equipmentSharingService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.equipmentSharing(FILED_PERIOD)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, equipmentSharingService } = surfaces();

		expect(await resolver.equipmentSharingCount()).toBe(2);
		expect(equipmentSharingService.countBy).toHaveBeenCalledWith();
	});

	it('files a period through the command the REST create route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createEquipmentSharing(ORGANIZATION, {
			name: 'Field kit',
			shareRequestDay: new Date('2026-01-05T10:00:00.000Z'),
			shareStartDay: new Date('2026-02-01T10:00:00.000Z'),
			shareEndDay: new Date('2026-04-01T10:00:00.000Z'),
			status: RequestApprovalStatusTypesEnum.REQUESTED,
			equipmentId: EQUIPMENT,
			equipmentSharingPolicyId: POLICY,
			employeeIds: [EMPLOYEE],
			teamIds: [TEAM]
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EquipmentSharingCreateCommand);
		// The organization is the route's path segment and is not part of the row's own body.
		expect(command.organizationId).toBe(ORGANIZATION);
		// The memberships are handed over as the identifiers the pivot rows are written from.
		expect(command.input).toEqual({
			name: 'Field kit',
			shareRequestDay: new Date('2026-01-05T10:00:00.000Z'),
			shareStartDay: new Date('2026-02-01T10:00:00.000Z'),
			shareEndDay: new Date('2026-04-01T10:00:00.000Z'),
			status: RequestApprovalStatusTypesEnum.REQUESTED,
			equipmentId: EQUIPMENT,
			equipmentSharingPolicyId: POLICY,
			employees: [{ id: EMPLOYEE }],
			teams: [{ id: TEAM }]
		});
	});

	it('changes a period through the command the REST edit route dispatches, with the path identifier', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateEquipmentSharing({
			id: APPROVED_PERIOD,
			status: RequestApprovalStatusTypesEnum.APPROVED,
			shareEndDay: new Date('2026-07-01T10:00:00.000Z')
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EquipmentSharingUpdateCommand);
		expect(command.id).toBe(APPROVED_PERIOD);
		expect(command.input).toEqual({
			status: RequestApprovalStatusTypesEnum.APPROVED,
			shareEndDay: new Date('2026-07-01T10:00:00.000Z')
		});
	});

	it('approves a period through the status command, with the approved value', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.approveEquipmentSharing(FILED_PERIOD)).toBe(ROWS[0]);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EquipmentSharingStatusCommand);
		expect(command.id).toBe(FILED_PERIOD);
		expect(command.status).toBe(RequestApprovalStatusTypesEnum.APPROVED);
	});

	it('refuses a period through the same command, with the refused value', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.refuseEquipmentSharing(FILED_PERIOD);

		// One operation with two decisions: the two fields dispatch the same command with the two values
		// of the contracts' own vocabulary, which is why neither takes a status from the caller.
		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(EquipmentSharingStatusCommand);
		expect(command.id).toBe(FILED_PERIOD);
		expect(command.status).toBe(RequestApprovalStatusTypesEnum.REFUSED);
	});

	it('removes a period through the same service method the REST removal route calls', async () => {
		const { resolver, equipmentSharingService } = surfaces();

		// The delivered service removes the approval row recorded beside the sharing in the same call;
		// the field reaches that method rather than the base one for exactly that reason.
		expect(await resolver.deleteEquipmentSharing(APPROVED_PERIOD)).toBe(true);
		expect(equipmentSharingService.delete).toHaveBeenCalledWith(APPROVED_PERIOD);
	});

	it('withdraws and restores a period through the service methods the inherited routes call', async () => {
		const { resolver, equipmentSharingService } = surfaces();

		const withdrawn = await resolver.softDeleteEquipmentSharing(APPROVED_PERIOD);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(equipmentSharingService.softRemove).toHaveBeenCalledWith(APPROVED_PERIOD);

		expect(await resolver.recoverEquipmentSharing(APPROVED_PERIOD)).toBe(ROWS[0]);
		expect(equipmentSharingService.softRecover).toHaveBeenCalledWith(APPROVED_PERIOD);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, equipmentSharingService } = surfaces();
		const refusal = new Error('EQUIPMENT_SHARING_OUT_OF_SCOPE: the referenced asset is another organization’s.');

		equipmentSharingService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteEquipmentSharing(APPROVED_PERIOD)).rejects.toBe(refusal);
	});
});

describe('EquipmentSharingResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', EquipmentSharingResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', EquipmentSharingController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The one guard the resolver states beyond the controller's chain is the gate, and it is the
		// addition rather than a substitution: the controller's two come first, so a caller with no
		// credential is refused as a credential problem before a tenant's switches are read.
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', EquipmentSharingResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			// Several handlers restate the permission guard their class already carries; the union is
			// what a route runs under, and it is the resolver's chain plus the gate for every one of
			// them. A route that added a guard of its own would narrow REST below GraphQL and is caught
			// here.
			expect([...guardsOfRoute(EquipmentSharingController, route), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EquipmentSharingController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EquipmentSharingResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = PERMISSION_PARITY.map(({ field, route }) => [field, route]);

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, route]) => [field, permissionOfRoute(EquipmentSharingController, route)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the view permission on the three list reads, which is what their routes state', () => {
		for (const field of [
			'equipmentSharings',
			'equipmentSharingsByOrganization',
			'equipmentSharingsByEmployee'
		]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW]);
		}

		expect(permissionOfRoute(EquipmentSharingController, 'findAll')).toEqual([
			PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW
		]);
		expect(permissionOfRoute(EquipmentSharingController, 'findEquipmentSharingsByOrganizationId')).toEqual([
			PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW
		]);
		expect(permissionOfRoute(EquipmentSharingController, 'findEquipmentSharingsByEmployeeId')).toEqual([
			PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW
		]);
	});

	it('carries the maker pair on the create and the approver pair on the edit and the two decisions', () => {
		expect(permissionOfField('createEquipmentSharing')).toEqual([
			PermissionsEnum.EQUIPMENT_MAKE_REQUEST,
			PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT
		]);
		expect(permissionOfRoute(EquipmentSharingController, 'createEquipmentSharing')).toEqual([
			PermissionsEnum.EQUIPMENT_MAKE_REQUEST,
			PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT
		]);

		for (const [field, route] of [
			['updateEquipmentSharing', 'update'],
			['approveEquipmentSharing', 'equipmentSharingsRequestApproval'],
			['refuseEquipmentSharing', 'equipmentSharingsRequestRefuse']
		] as const) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.EQUIPMENT_APPROVE_REQUEST,
				PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT
			]);
			expect(permissionOfRoute(EquipmentSharingController, route)).toEqual([
				PermissionsEnum.EQUIPMENT_APPROVE_REQUEST,
				PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT
			]);
		}
	});

	it('states no permission on the fields whose routes state none, because that absence is the parity', () => {
		// The node read, the count and the two lifecycle removals are inherited from the CRUD base, and
		// the hard removal is declared on the controller without a permission. Widening any of them here
		// — or restating the same absence as an empty `@Permissions()` — would be a second statement of
		// a scope the controller already decided.
		for (const handler of ['findById', 'getCount', 'delete', 'softRemove', 'softRecover']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EquipmentSharingController)[handler])).toBeUndefined();
		}

		for (const field of [
			'equipmentSharing',
			'equipmentSharingCount',
			'deleteEquipmentSharing',
			'softDeleteEquipmentSharing',
			'recoverEquipmentSharing'
		]) {
			expect(permissionOfField(field)).toBeUndefined();
		}
	});
});

describe('EquipmentSharingResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, EquipmentSharingResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EquipmentSharingResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('equipmentSharings')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('equipmentSharings');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the two decisions and the removals among them', async () => {
		for (const field of ['createEquipmentSharing', 'approveEquipmentSharing', 'refuseEquipmentSharing']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('equipmentSharing'))).resolves.toBe(true);
	});
});

describe('EquipmentSharingModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EquipmentSharingModule) ?? []) as unknown[];

		expect(providers).toContain(EquipmentSharingResolver);
		expect(providers).toContain(EquipmentSharingService);
	});

	it('exports the service the resolver injects and the bus the writes dispatch through', () => {
		// The resolver is a provider of whichever module the endpoint scans, so a module that imports
		// this one receives what this one hands on and nothing else: the three writes reach a command,
		// which is why the bus is exported beside the service.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EquipmentSharingModule) ?? []) as Array<{
			name?: string;
		}>;

		expect(exported).toContain(EquipmentSharingService);
		expect(exported.map((entry) => entry?.name)).toContain('CqrsModule');
		expect(EquipmentSharingResolver.length).toBe(2);
	});

	it('reaches the module that provides the guards, without importing the one the gate resolves through', () => {
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, EquipmentSharingModule) ?? []) as Array<{
			forwardRef?: () => unknown;
			name?: string;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);
		const names = resolved.map((entry) => (entry as { name?: string })?.name);

		expect(names).toContain('RolePermissionModule');
		// `FeatureModule` is deliberately not imported: it is global, so the feature service
		// `FeatureFlagGuard` resolves through is available wherever a guard runs.
		expect(names).not.toContain('FeatureModule');
	});
});
