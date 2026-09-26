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
import { CqrsModule } from '@nestjs/cqrs';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum, RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { RequestApprovalController } from './request-approval.controller';
import { RequestApprovalModule } from './request-approval.module';
import { RequestApprovalResolver } from './request-approval.resolver';
import { RequestApprovalService } from './request-approval.service';
import { RequestApprovalStatusCommand } from './commands';

/**
 * The request approval over GraphQL.
 *
 * The delivered `/api/request-approval` routes serve a register, one employee's own queue, one
 * request, a count, a raise, an edit, an approval, a refusal, a removal, a withdrawal and a
 * restoration. This suite pins the half of the two-protocol doctrine that is easy to get quietly
 * wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the two lists are
 *   connections with the platform's own cursor codec behind them, so a cursor obtained over REST
 *   resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's class chain and every field states the permission its own
 *   route runs under** — including the five fields whose routes are inherited from the CRUD base
 *   without a permission of their own, and which therefore state none;
 * - **the by-employee read is a field of its own**, because the read it mirrors walks the employee's
 *   own approval collection through a pivot the register's read does not join;
 * - `amount` is the kernel's decimal scalar and never a float, so a money value read here and the same
 *   value read over REST are string-identical;
 * - a request that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const POLICY = '00000000-0000-4000-8000-000000000004';
const REQUEST = '00000000-0000-4000-8000-000000000005';
const WAITING = '00000000-0000-4000-8000-000000000010';
const SETTLED = '00000000-0000-4000-8000-000000000011';

/**
 * The rows a scripted service answers with, in the order the delivered reads return them: a purchase
 * that commits money and is still waiting for its approvers, and a time-off request that commits none
 * and has already been answered.
 */
const ROWS = [
	{
		id: WAITING,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Laptop purchase',
		status: RequestApprovalStatusTypesEnum.REQUESTED,
		min_count: 2,
		requestId: REQUEST,
		requestType: 'EQUIPMENT_SHARING',
		amount: '1250.500000',
		currency: 'EUR',
		note: 'Replaces the 2019 model',
		approvalPolicyId: POLICY,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SETTLED,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Annual leave',
		status: RequestApprovalStatusTypesEnum.APPROVED,
		min_count: 1,
		requestId: REQUEST,
		requestType: 'TIME_OFF',
		amount: null,
		currency: null,
		note: null,
		approvalPolicyId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const requestApprovalService = {
		findAllRequestApprovals: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findRequestApprovalsByEmployeeId: jest.fn().mockResolvedValue({ items: [ROWS[0]], total: 1 }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		createRequestApproval: jest.fn().mockResolvedValue(ROWS[0]),
		updateRequestApproval: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		requestApprovalService,
		commandBus,
		resolver: new RequestApprovalResolver(requestApprovalService as never, commandBus as never)
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

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('requestapproval'))
		.sort();
}

/** The printed body of one type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`(?:type|input|enum) ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/**
 * Whether an object or input type declares a member.
 *
 * Read from the declaration rather than from the printed body as a whole, because the printed body
 * carries the descriptions too — and a description that explains *why* a member is absent names it,
 * which is exactly what a `not.toContain` assertion would trip over.
 */
function declaresMember(name: string, member: string): boolean {
	return new RegExp(`^\\s*${member}\\s*:`, 'm').test(typeBody(name));
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof RequestApprovalController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof RequestApprovalController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof RequestApprovalController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = RequestApprovalResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one field runs under: the class chain the gate is declared on, then the field's own. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', RequestApprovalResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', (RequestApprovalResolver.prototype as never)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** Every root field and the delivered route it mirrors, which is the parity table this suite holds. */
const ROUTES: ReadonlyArray<[string, string]> = [
	['requestApprovals', 'findAll'],
	['requestApprovalsByEmployee', 'findRequestApprovalsByEmployeeId'],
	['requestApproval', 'findById'],
	['requestApprovalCount', 'getCount'],
	['createRequestApproval', 'create'],
	['updateRequestApproval', 'update'],
	['approveRequestApproval', 'employeeApprovalRequestApproval'],
	['refuseRequestApproval', 'employeeRefuseRequestApproval'],
	['deleteRequestApproval', 'delete'],
	['softDeleteRequestApproval', 'softRemove'],
	['recoverRequestApproval', 'softRecover']
];

/** The fields whose routes are inherited from the CRUD base without a permission of their own. */
const UNPERMISSIONED: ReadonlyArray<string> = [
	'requestApproval',
	'requestApprovalCount',
	'deleteRequestApproval',
	'softDeleteRequestApproval',
	'recoverRequestApproval'
];

describe('RequestApprovalResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the two registers, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'requestApprovals',
				'requestApprovalsByEmployee',
				'requestApproval',
				'requestApprovalCount'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createRequestApproval',
				'updateRequestApproval',
				'approveRequestApproval',
				'refuseRequestApproval',
				'deleteRequestApproval',
				'softDeleteRequestApproval',
				'recoverRequestApproval'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual([
			'requestApproval',
			'requestApprovalCount',
			'requestApprovals',
			'requestApprovalsByEmployee'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'approveRequestApproval',
			'createRequestApproval',
			'deleteRequestApproval',
			'recoverRequestApproval',
			'refuseRequestApproval',
			'softDeleteRequestApproval',
			'updateRequestApproval'
		]);
	});

	it('declares the connections, their edges, their filters and their sorts', () => {
		expect(printed).toMatch(
			/type RequestApprovalConnection \{\s*nodes: \[RequestApproval!\]!\s*edges: \[RequestApprovalEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type RequestApprovalEdge \{\s*node: RequestApproval!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input RequestApprovalFilter \{/);
		expect(printed).toMatch(/input RequestApprovalSort \{/);
		expect(printed).toMatch(
			/enum RequestApprovalSortField \{\s*id\s*name\s*status\s*min_count\s*amount\s*currency\s*createdAt\s*updatedAt\s*deletedAt\s*\}/
		);
	});

	it('carries the row as the delivered reads answer it', () => {
		expect(declaresMember('RequestApproval', 'name')).toBe(true);
		expect(declaresMember('RequestApproval', 'min_count')).toBe(true);
		expect(declaresMember('RequestApproval', 'requestId')).toBe(true);
		expect(declaresMember('RequestApproval', 'requestType')).toBe(true);
		expect(declaresMember('RequestApproval', 'approvalPolicyId')).toBe(true);
		// The state is the contracts' numeric vocabulary, carried as its value rather than declared as
		// an enum of this domain's own: the same numbers type the employee and team approval columns.
		expect(typeBody('RequestApproval')).toMatch(/^\s*status: Int$/m);
		// Withdrawing and restoring are delivered routes whose whole effect is this column.
		expect(typeBody('RequestApproval')).toMatch(/^\s*deletedAt: DateTime$/m);
	});

	it('carries money as the kernel’s decimal scalar and never as a float', () => {
		// A `numeric(20,6)` read here and the same value read over REST are string-identical, which is
		// what the kernel's decimal scalar exists for; a float would have lost the cent.
		expect(typeBody('RequestApproval')).toMatch(/^\s*amount: Decimal$/m);
		expect(typeBody('RequestApproval')).not.toMatch(/^\s*amount: Float/m);
		expect(typeBody('CreateRequestApprovalInput')).toMatch(/^\s*amount: Decimal$/m);
		expect(typeBody('UpdateRequestApprovalInput')).toMatch(/^\s*amount: Decimal$/m);
		// The filter family follows the member: a money filter that rounds returns the wrong rows.
		expect(printed).toMatch(/input RequestApprovalFilter \{[\s\S]*?amount: DecimalFilter/);
		// The ISO code the amount is stated in travels beside it.
		expect(declaresMember('RequestApproval', 'currency')).toBe(true);
	});

	it('declares no object field for a relation no read behind this surface joins', () => {
		// The register's read joins none of the four, and the by-employee read loads them per request it
		// appends — so a member for one of them would be absent on every row the connection answers.
		for (const relation of ['approvalPolicy', 'employeeApprovals', 'teamApprovals', 'tags']) {
			expect(declaresMember('RequestApproval', relation)).toBe(false);
		}
		// The identifiers that are columns of the row are carried instead, so a client can still reach
		// the policy and the document the request names.
		expect(declaresMember('RequestApproval', 'approvalPolicyId')).toBe(true);
		expect(declaresMember('RequestApproval', 'requestId')).toBe(true);
	});

	it('declares the two collections an input writes as identifiers, and not as rows', () => {
		// The delivered write resolves the employees and the teams itself and builds one pivot row per
		// resolved row, so what it wants from the body is the identifiers.
		expect(typeBody('CreateRequestApprovalInput')).toMatch(/^\s*employeeApprovals: \[ID!\]$/m);
		expect(typeBody('CreateRequestApprovalInput')).toMatch(/^\s*teams: \[ID!\]$/m);
		expect(typeBody('CreateRequestApprovalInput')).toMatch(/^\s*tags: \[ID!\]$/m);
		expect(typeBody('UpdateRequestApprovalInput')).toMatch(/^\s*employeeApprovals: \[ID!\]$/m);
	});

	it('offers no argument and no member the delivered write does not honour', () => {
		// The delivered list method reads live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/requestApprovals\([^)]*withDeleted/);
		expect(printed).not.toMatch(/requestApprovalsByEmployee\([^)]*withDeleted/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/requestApprovalCount\(/);
		// No input states a tenant: the delivered writes stamp the caller's own and overwrite whatever a
		// body says.
		for (const input of ['CreateRequestApprovalInput', 'UpdateRequestApprovalInput']) {
			expect(declaresMember(input, 'tenantId')).toBe(false);
			expect(declaresMember(input, 'tenant')).toBe(false);
		}
		// The state is the write's decision, not the caller's: the delivered create and the delivered
		// update both stamp `1` back onto the row.
		expect(declaresMember('CreateRequestApprovalInput', 'status')).toBe(false);
		expect(declaresMember('UpdateRequestApprovalInput', 'status')).toBe(false);
	});

	it('states the update inputs as the delivered update reads them', () => {
		// The update is neither a replacement nor a partial column update, so the identifier is the one
		// required member and every other one is optional and behaves as its own description says.
		expect(typeBody('UpdateRequestApprovalInput')).toMatch(/^\s*id: ID!$/m);
		expect(typeBody('CreateRequestApprovalInput')).toMatch(/^\s*name: String!$/m);
		expect(typeBody('UpdateRequestApprovalInput')).not.toMatch(/^\s*name: String!$/m);
	});
});

describe('RequestApprovalResolver — the connection contract', () => {
	it('answers the register with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, requestApprovalService } = surfaces();

		const connection = await resolver.requestApprovals(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when its envelope states nothing.
		expect(requestApprovalService.findAllRequestApprovals).toHaveBeenCalledWith({ relations: [] }, {});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(WAITING);
	});

	it('orders the register newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.requestApprovals();

		expect(connection.nodes.map((node) => node.id)).toEqual([WAITING, SETTLED]);
	});

	it('narrows by the fields the filter declares, including the money column', async () => {
		const { resolver } = surfaces();

		const byState = await resolver.requestApprovals({ status: { eq: RequestApprovalStatusTypesEnum.REQUESTED } });
		expect(byState.nodes.map((node) => node.id)).toEqual([WAITING]);

		// A request that commits no money carries neither the amount nor the code, which is what
		// `isNull` states and what an `eq` never matches.
		const moneyFree = await resolver.requestApprovals({ amount: { isNull: true } });
		expect(moneyFree.nodes.map((node) => node.id)).toEqual([SETTLED]);

		// The decimal comparison is exact rather than approximate, which is the whole reason the member
		// is a decimal and not a number.
		const byAmount = await resolver.requestApprovals({ amount: { gte: '1250.500000' } });
		expect(byAmount.nodes.map((node) => node.id)).toEqual([WAITING]);

		const byPolicy = await resolver.requestApprovals({ approvalPolicyId: { eq: POLICY } });
		expect(byPolicy.nodes.map((node) => node.id)).toEqual([WAITING]);
	});

	it('orders by the keys the sort enum offers, including the money column and the state', async () => {
		const { resolver } = surfaces();

		// An absent value is the largest value in both directions, which is the one rule that makes a
		// cursor walk over a nullable column stable: descending, the request that commits no money comes
		// first. That is the opposite of the default order, so the test reads the sort rather than the
		// default.
		const byAmount = await resolver.requestApprovals(undefined, [{ field: 'amount', direction: 'DESC' }]);
		expect(byAmount.nodes.map((node) => node.id)).toEqual([SETTLED, WAITING]);

		const byState = await resolver.requestApprovals(undefined, [{ field: 'status', direction: 'DESC' }]);
		expect(byState.nodes.map((node) => node.id)).toEqual([SETTLED, WAITING]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.requestApprovals(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([WAITING]);

		const second = await resolver.requestApprovals(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SETTLED]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.requestApprovals(undefined, undefined, undefined, 20);

		const last = await resolver.requestApprovals(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([WAITING]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// `note` is a column of the row and is filterable, and it is not sortable — the difference the
		// two declarations exist to keep readable: a field a caller may narrow by is not automatically a
		// field to order by.
		const error = await resolver
			.requestApprovals(undefined, [{ field: 'note', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// The approver collections are not filters: the read behind this connection loads none of them,
		// so a condition on one could only ever select the empty set.
		const error = await resolver.requestApprovals({ employeeApprovals: { eq: EMPLOYEE } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.requestApprovals(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('answers the by-employee read over the rows its own service method returns', async () => {
		const { resolver, requestApprovalService } = surfaces();

		const connection = await resolver.requestApprovalsByEmployee(EMPLOYEE, undefined, undefined, undefined, 20);

		// The same three arguments the delivered route passes, with the same defaults: the employee, no
		// joined collection and no criterion.
		expect(requestApprovalService.findRequestApprovalsByEmployeeId).toHaveBeenCalledWith(EMPLOYEE, [], {});
		expect(connection.nodes.map((node) => node.id)).toEqual([WAITING]);
		expect(connection.totalCount).toBe(1);
	});
});

describe('RequestApprovalResolver — one concept, two protocols, the same operations', () => {
	it('reads the register through the same service method the REST route calls', async () => {
		const { resolver, requestApprovalService } = surfaces();

		expect((await resolver.requestApprovals()).totalCount).toBe(2);
		expect(requestApprovalService.findAllRequestApprovals).toHaveBeenCalledWith({ relations: [] }, {});
	});

	it('reads one employee’s queue through the same service method the REST route calls', async () => {
		const { resolver, requestApprovalService } = surfaces();

		await resolver.requestApprovalsByEmployee(EMPLOYEE);

		expect(requestApprovalService.findRequestApprovalsByEmployeeId).toHaveBeenCalledWith(EMPLOYEE, [], {});
	});

	it('reads one request through the same service method the REST route calls', async () => {
		const { resolver, requestApprovalService } = surfaces();

		expect(await resolver.requestApproval(WAITING)).toBe(ROWS[0]);
		expect(requestApprovalService.findOneByIdString).toHaveBeenCalledWith(WAITING);
	});

	it('answers null for a request that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, requestApprovalService } = surfaces();
		requestApprovalService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.requestApproval(SETTLED)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, requestApprovalService } = surfaces();

		expect(await resolver.requestApprovalCount()).toBe(2);
		expect(requestApprovalService.countBy).toHaveBeenCalledWith();
	});

	it('raises a request through the same service method the REST route calls, with the body as stated', async () => {
		const { resolver, requestApprovalService } = surfaces();
		const input = {
			name: 'Laptop purchase',
			approvalPolicyId: POLICY,
			min_count: 2,
			amount: '1250.500000',
			currency: 'EUR',
			employeeApprovals: [EMPLOYEE],
			organizationId: ORGANIZATION
		};

		expect(await resolver.createRequestApproval(input)).toBe(ROWS[0]);
		expect(requestApprovalService.createRequestApproval).toHaveBeenCalledWith(input);
	});

	it('changes a request through the same service method the REST route calls, identifier first', async () => {
		const { resolver, requestApprovalService } = surfaces();

		await resolver.updateRequestApproval({ id: WAITING, name: 'Laptop purchase (revised)' });

		expect(requestApprovalService.updateRequestApproval).toHaveBeenCalledWith(
			WAITING,
			expect.objectContaining({ id: WAITING, name: 'Laptop purchase (revised)' })
		);
	});

	it('approves a request through the command the REST route dispatches, carrying the same decision', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.approveRequestApproval(WAITING)).toBe(ROWS[0]);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(RequestApprovalStatusCommand);
		expect(command.requestApprovalId).toBe(WAITING);
		expect(command.status).toBe(RequestApprovalStatusTypesEnum.APPROVED);
	});

	it('refuses a request through the same command, carrying the other decision', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.refuseRequestApproval(WAITING);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(RequestApprovalStatusCommand);
		expect(command.requestApprovalId).toBe(WAITING);
		expect(command.status).toBe(RequestApprovalStatusTypesEnum.REFUSED);
	});

	it('removes a request through the same service method the REST route calls', async () => {
		const { resolver, requestApprovalService } = surfaces();

		expect(await resolver.deleteRequestApproval(WAITING)).toBe(true);
		expect(requestApprovalService.delete).toHaveBeenCalledWith(WAITING);
	});

	it('withdraws and restores a request through the same service methods the REST routes call', async () => {
		const { resolver, requestApprovalService } = surfaces();

		const withdrawn = await resolver.softDeleteRequestApproval(WAITING);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(requestApprovalService.softRemove).toHaveBeenCalledWith(WAITING);

		expect(await resolver.recoverRequestApproval(WAITING)).toBe(ROWS[0]);
		expect(requestApprovalService.softRecover).toHaveBeenCalledWith(WAITING);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, requestApprovalService } = surfaces();
		const refusal = new Error('REQUEST_APPROVAL_ALREADY_SETTLED: this request has already been answered.');

		requestApprovalService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteRequestApproval(WAITING)).rejects.toBe(refusal);
	});
});

describe('RequestApprovalResolver — the guard stack and the permissions are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', RequestApprovalResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', RequestApprovalController) ?? [];

		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard])
		);
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// Every route of the controller is served under the class chain, because the controller states
		// its guards on the class and on no route.
		for (const [, handler] of ROUTES) {
			expect(Reflect.getMetadata('__guards__', handlersOf(RequestApprovalController)[handler])).toBeUndefined();
		}
	});

	it('runs every field under the guard chain its own route runs under, plus the gate', () => {
		for (const [field, handler] of ROUTES) {
			// The controller declares its guards on the class, so each field's chain is that class chain
			// and the gate — the one addition, declared on this resolver's class for every field.
			expect(guardsOfField(field).sort()).toEqual(
				[...guardsOfRoute(RequestApprovalController, handler), FeatureFlagGuard].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, RequestApprovalController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, RequestApprovalResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(RequestApprovalController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('states nothing on the routes that declare no permission of their own', () => {
		// `GET /:id`, `GET /count`, `DELETE /:id`, `DELETE /:id/soft` and `PUT /:id/recover` are inherited
		// from the CRUD base without a permission, so each runs under the controller's class chain and no
		// permission. Stating one here would give GraphQL a scope REST does not have.
		for (const field of UNPERMISSIONED) {
			expect(permissionOfField(field)).toBeUndefined();
		}

		expect(
			Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(RequestApprovalController)['findById'])
		).toBeUndefined();
		expect(
			Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(RequestApprovalController)['getCount'])
		).toBeUndefined();
		expect(
			Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(RequestApprovalController)['delete'])
		).toBeUndefined();
	});

	it('states the view permission on the two registers and the edit permission on the six writes', () => {
		expect(permissionOfField('requestApprovals')).toEqual([PermissionsEnum.REQUEST_APPROVAL_VIEW]);
		expect(permissionOfField('requestApprovalsByEmployee')).toEqual([PermissionsEnum.REQUEST_APPROVAL_VIEW]);

		for (const field of [
			'createRequestApproval',
			'updateRequestApproval',
			'approveRequestApproval',
			'refuseRequestApproval'
		]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.REQUEST_APPROVAL_EDIT]);
		}
	});

	it('reads the two registers under the same view permission their own routes state', () => {
		expect(
			Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(RequestApprovalController)['findAll'])
		).toEqual([PermissionsEnum.REQUEST_APPROVAL_VIEW]);
		expect(
			Reflect.getMetadata(
				PERMISSIONS_METADATA,
				handlersOf(RequestApprovalController)['findRequestApprovalsByEmployeeId']
			)
		).toEqual([PermissionsEnum.REQUEST_APPROVAL_VIEW]);
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
	const guard = new FeatureFlagGuard(cache as never, new Reflector(), featureService as never);

	return { guard, featureService };
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (RequestApprovalResolver.prototype as never)[field],
		getClass: () => RequestApprovalResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('RequestApprovalResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, RequestApprovalResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', RequestApprovalResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('requestApprovals')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('requestApprovals');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('requestApprovals'))).resolves.toBe(true);
	});
});

describe('RequestApprovalModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, RequestApprovalModule) ?? []) as unknown[];

		// The resolver is an ordinary Nest provider, so it can only inject what the module hosting it
		// can reach: the service it reads through and the command bus its two decision writes dispatch
		// through.
		expect(providers).toContain(RequestApprovalResolver);
		expect(providers).toContain(RequestApprovalService);
	});

	it('exports the command bus the resolver’s decision fields dispatch through', () => {
		// A resolver is a provider of whichever module the Apollo configuration scans, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, RequestApprovalModule) ?? []) as unknown[];

		expect(exported).toContain(CqrsModule);
	});
});
