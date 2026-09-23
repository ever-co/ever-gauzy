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
import { buildSchema, printSchema } from 'graphql';
import { ApprovalPolicyTypesStringEnum, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ApprovalPolicy } from './approval-policy.entity';
import { ApprovalPolicyController } from './approval-policy.controller';
import { ApprovalPolicyResolver } from './approval-policy.resolver';
import {
	ApprovalPolicyCreateCommand,
	ApprovalPolicyGetCommand,
	ApprovalPolicyUpdateCommand,
	RequestApprovalPolicyGetCommand
} from './commands';

/**
 * The approval policy over GraphQL.
 *
 * The delivered REST routes file a policy, rename one, read one, list them, count them, list the ones
 * a request may be filed under, remove one, and withdraw and restore one. This suite pins the half of
 * the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, the list is a
 *   connection with the platform's own cursor codec behind it, and a refusal is the query protocol's
 *   own code;
 * - **the request-approval route is that connection narrowed**, not a root field of its own: its
 *   reader excludes two codes from a column every row carries, and the suite checks the narrowed
 *   connection selects the same rows the route's own reader does;
 * - every field dispatches the same command, or calls the same service method, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain and the permission are the controller's, read back from the controller's own
 *   metadata** — including the asymmetry this resource has: the list states the view permission on its
 *   handler while every route the controller inherits runs under the class-level edit permission, so
 *   reading one policy is the narrower grant and listing them the wider one;
 * - the members the delivered read answers are what the object type carries, and nothing else.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const BUSINESS_TRIP = '00000000-0000-4000-8000-000000000010';
const PURCHASE_ORDER = '00000000-0000-4000-8000-000000000011';
const TIME_OFF = '00000000-0000-4000-8000-000000000012';
const EQUIPMENT_SHARING = '00000000-0000-4000-8000-000000000013';

/**
 * The two codes the delivered request-approval reader excludes, as the reader's own criterion states
 * them. The connection is asserted against the literals the domain's document names, so the two sides
 * are written independently and a vocabulary that moved on one of them is caught here.
 */
const REQUEST_APPROVAL_EXCLUDED: string[] = [
	ApprovalPolicyTypesStringEnum.TIME_OFF,
	ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING
];

/**
 * The rows a scripted read answers with, in the order the delivered list read returns them: the two
 * policies an approval request may be filed under, then the two the request-approval reader excludes —
 * the later of those two sharing its instant with nothing else and the last two sharing theirs, which
 * is what makes the identifier the key that decides between them.
 */
const ROWS = [
	{
		id: BUSINESS_TRIP,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Business Trip',
		description: 'Travel an organization pays for.',
		approvalType: ApprovalPolicyTypesStringEnum.BUSINESS_TRIP,
		isActive: true,
		isArchived: false,
		archivedAt: null,
		deletedAt: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	},
	{
		id: PURCHASE_ORDER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Purchase Order',
		description: 'A purchase somebody has to sign off.',
		approvalType: ApprovalPolicyTypesStringEnum.PURCHASE_ORDER,
		isActive: true,
		isArchived: false,
		archivedAt: null,
		deletedAt: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: TIME_OFF,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Time Off',
		description: 'Leave, filed by the employee it concerns.',
		approvalType: ApprovalPolicyTypesStringEnum.TIME_OFF,
		isActive: true,
		isArchived: false,
		archivedAt: null,
		deletedAt: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: EQUIPMENT_SHARING,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Equipment Sharing',
		description: 'Equipment lent to another employee.',
		approvalType: ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
		isActive: true,
		isArchived: false,
		archivedAt: null,
		deletedAt: null,
		createdAt: new Date('2026-04-01T10:00:00.000Z'),
		updatedAt: new Date('2026-04-01T10:00:00.000Z')
	}
];

/**
 * The resolver, over a scripted service and a scripted command bus.
 *
 * The bus answers the two read commands the way their own handlers do — the list with every row, and
 * the request-approval read with the rows its criterion selects — and every other command with one
 * row, which is what the write handlers answer with.
 */
function surfaces() {
	const approvalPolicyService = {
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-05-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = {
		execute: jest.fn(async (command: unknown): Promise<IPagination<ApprovalPolicy> | ApprovalPolicy> => {
			if (command instanceof RequestApprovalPolicyGetCommand) {
				// The delivered reader: the policies whose code is neither of the two it excludes.
				const items = ROWS.filter((row) => !REQUEST_APPROVAL_EXCLUDED.includes(row.approvalType));

				return { items: items as unknown as ApprovalPolicy[], total: items.length };
			}

			if (command instanceof ApprovalPolicyGetCommand) {
				return { items: ROWS as unknown as ApprovalPolicy[], total: ROWS.length };
			}

			return ROWS[0] as unknown as ApprovalPolicy;
		})
	};

	return {
		approvalPolicyService,
		commandBus,
		resolver: new ApprovalPolicyResolver(approvalPolicyService as never, commandBus as never)
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
		.filter((field) => field.toLowerCase().includes('approvalpolic'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/**
 * The member names one printed object type declares, in declaration order.
 *
 * Descriptions are stripped first: a printed field description is indented like a field and may carry
 * a colon of its own, so reading the member list off the raw body would count prose as a member.
 */
function membersOf(name: string): string[] {
	const body = typeBody(name).replace(/"""[\s\S]*?"""/g, '');

	return [...body.matchAll(/^[ \t]*(\w+)[ \t]*[:(]/gm)].map((match) => match[1]);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof ApprovalPolicyController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof ApprovalPolicyController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof ApprovalPolicyController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = ApprovalPolicyResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('ApprovalPolicyResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['approvalPolicies', 'approvalPolicy', 'approvalPolicyCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createApprovalPolicy',
				'updateApprovalPolicy',
				'deleteApprovalPolicy',
				'softDeleteApprovalPolicy',
				'recoverApprovalPolicy'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual(['approvalPolicies', 'approvalPolicy', 'approvalPolicyCount']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createApprovalPolicy',
			'deleteApprovalPolicy',
			'recoverApprovalPolicy',
			'softDeleteApprovalPolicy',
			'updateApprovalPolicy'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type ApprovalPolicyConnection \{\s*nodes: \[ApprovalPolicy!\]!\s*edges: \[ApprovalPolicyEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ApprovalPolicyEdge \{\s*node: ApprovalPolicy!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ApprovalPolicyFilter \{/);
		expect(printed).toMatch(/input ApprovalPolicySort \{/);
		expect(printed).toMatch(
			/enum ApprovalPolicySortField \{\s*id\s*name\s*approvalType\s*createdAt\s*updatedAt\s*deletedAt\s*\}/
		);
	});

	it('carries the members the delivered read answers, and nothing else', () => {
		expect(membersOf('ApprovalPolicy')).toEqual([
			'id',
			'name',
			'description',
			'approvalType',
			'tenantId',
			'organizationId',
			'isActive',
			'isArchived',
			'archivedAt',
			'deletedAt',
			'createdAt',
			'updatedAt'
		]);

		const body = typeBody('ApprovalPolicy');

		// The code the platform matches on is carried as a value rather than declared as a schema enum:
		// the delivered write derives it from the name, so the vocabulary is open.
		expect(body).toMatch(/approvalType: String/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('serves the request-approval route as the connection rather than as a root field of its own', () => {
		// Its reader excludes two codes from a column every row of the connection carries and joins no
		// pivot the list read does not join, so a second root field would be one read under two names —
		// and two names for one read can disagree about which policies a request form may offer.
		//
		// The request that is approved is another resource with a surface of its own; what is stated here
		// is only that this domain contributes no second read of the policy table for the route.
		expect(ownedRootFields('Query')).not.toContain('approvalPoliciesForRequestApproval');
		expect(ownedRootFields('Query').some((field) => field.toLowerCase().includes('request'))).toBe(false);
	});

	it('offers no argument it cannot honour', () => {
		// `withDeleted` is offered because the delivered list route offers it: `BaseQueryDTO` carries it
		// and that route hands its query string straight to the same read, so a REST caller can ask for
		// withdrawn rows and a connection that could not would hide them.
		expect(printed).toMatch(/approvalPolicies\([^)]*withDeleted/);
		// The relations a REST caller may name are not a connection argument: this read names none.
		expect(printed).not.toMatch(/approvalPolicies\([^)]*relations/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/approvalPolicyCount\(/);
	});
});

describe('ApprovalPolicyResolver — the connection contract', () => {
	it('answers the list through the command the REST route dispatches, with nodes, edges, a total and cursors', async () => {
		const { resolver, commandBus } = surfaces();

		const connection = await resolver.approvalPolicies(undefined, undefined, undefined, 20);
		const command = commandBus.execute.mock.calls[0][0] as ApprovalPolicyGetCommand;

		// The read is the one the REST list route performs when it is given no query string.
		expect(command).toBeInstanceOf(ApprovalPolicyGetCommand);
		expect(command.input).toEqual({});
		expect(connection.nodes).toHaveLength(4);
		expect(connection.totalCount).toBe(4);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[3].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(EQUIPMENT_SHARING);
	});

	it('orders newest first when the caller states none, and by the identifier between two policies of one instant', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.approvalPolicies();

		// The two policies filed on the same day share an instant, so the identifier is what orders them —
		// the key that makes the default order total, without which a cursor walk over it would not be.
		expect(connection.nodes.map((node) => node.id)).toEqual([
			EQUIPMENT_SHARING,
			TIME_OFF,
			PURCHASE_ORDER,
			BUSINESS_TRIP
		]);
	});

	it('narrows by the fields the filter declares, including the code', async () => {
		const { resolver } = surfaces();

		const byCode = await resolver.approvalPolicies({ approvalType: { eq: 'BUSINESS_TRIP' } });
		expect(byCode.nodes.map((node) => node.id)).toEqual([BUSINESS_TRIP]);

		const byName = await resolver.approvalPolicies({ name: { ilike: 'purchase%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([PURCHASE_ORDER]);

		// A policy with no note carries none, which is what `isNull` states and what an `eq` never matches.
		const unannotated = await resolver.approvalPolicies({ description: { isNull: true } });
		expect(unannotated.totalCount).toBe(0);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.approvalPolicies(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([
			BUSINESS_TRIP,
			EQUIPMENT_SHARING,
			PURCHASE_ORDER,
			TIME_OFF
		]);

		const byCode = await resolver.approvalPolicies(undefined, [{ field: 'approvalType', direction: 'DESC' }]);
		expect(byCode.nodes.map((node) => node.id)).toEqual([
			TIME_OFF,
			PURCHASE_ORDER,
			EQUIPMENT_SHARING,
			BUSINESS_TRIP
		]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.approvalPolicies(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([EQUIPMENT_SHARING]);
		expect(CursorCodec.decode(first.pageInfo.endCursor ?? '').id).toBe(EQUIPMENT_SHARING);

		const second = await resolver.approvalPolicies(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([TIME_OFF]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// `description` is filterable — a caller narrows by the text — but it is not a key the order is
		// total on.
		const error = await resolver
			.approvalPolicies(undefined, [{ field: 'description', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.approvalPolicies({ requests: { eq: TENANT } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.approvalPolicies(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('ApprovalPolicyResolver — the folded sub-route is one condition on the connection', () => {
	it('selects the rows the request-approval reader selects, as one filter on the connection', async () => {
		const { resolver, commandBus } = surfaces();

		// The route's own reader, through the command `GET /request-approval` dispatches.
		const routeAnswer = (await commandBus.execute(
			new RequestApprovalPolicyGetCommand({} as never)
		)) as IPagination<ApprovalPolicy>;

		// The narrowing the domain's own document states, as a caller would write it.
		const narrowed = await resolver.approvalPolicies({
			approvalType: { nin: ['TIME_OFF', 'EQUIPMENT_SHARING'] }
		});

		// The two reads agree about which policies a request may be filed under. The comparison is of the
		// selected set rather than of the two orders: the route answers in the store's order and the
		// connection in its own, which is exactly the difference the connection protocol is allowed to
		// state, and the rows are what must not differ.
		expect(narrowed.nodes.map((node) => node.id).sort()).toEqual(routeAnswer.items.map((row) => row.id).sort());
		expect(narrowed.nodes.map((node) => node.id)).toEqual([PURCHASE_ORDER, BUSINESS_TRIP]);
		expect(narrowed.totalCount).toBe(routeAnswer.total);
	});

	it('serves the folded route under the permission the route states, which is the connection’s own', () => {
		// The fold is permission-neutral: the route states the view permission on its handler, and so does
		// the connection field that answers it.
		expect(permissionOfRoute(ApprovalPolicyController, 'findApprovalPoliciesForRequestApproval')).toEqual([
			PermissionsEnum.APPROVAL_POLICY_VIEW
		]);
		expect(permissionOfField('approvalPolicies')).toEqual([PermissionsEnum.APPROVAL_POLICY_VIEW]);
	});
});

describe('ApprovalPolicyResolver — one concept, two protocols, the same operations', () => {
	it('reads one policy through the same service method the REST route calls', async () => {
		const { resolver, approvalPolicyService } = surfaces();

		expect(await resolver.approvalPolicy(BUSINESS_TRIP)).toBe(ROWS[0]);
		expect(approvalPolicyService.findOneByIdString).toHaveBeenCalledWith(BUSINESS_TRIP);
	});

	it('answers null for a policy that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, approvalPolicyService } = surfaces();
		approvalPolicyService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.approvalPolicy(TIME_OFF)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, approvalPolicyService } = surfaces();

		expect(await resolver.approvalPolicyCount()).toBe(4);
		expect(approvalPolicyService.countBy).toHaveBeenCalledWith();
	});

	it('files a policy through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		const input = { name: 'Business Trip', description: 'Travel an organization pays for.', organizationId: ORGANIZATION };

		await resolver.createApprovalPolicy(input);

		const command = commandBus.execute.mock.calls[0][0] as ApprovalPolicyCreateCommand;
		expect(command).toBeInstanceOf(ApprovalPolicyCreateCommand);
		// The code is not a member: the handler derives it from the name, so the body the two protocols
		// send is the same body.
		expect(command.input).toEqual(input);
		expect(command.input).not.toHaveProperty('approvalType');
	});

	it('renames a policy through the command the REST route dispatches, with the identifier beside the body', async () => {
		const { resolver, commandBus } = surfaces();
		const input = { id: BUSINESS_TRIP, name: 'Business Travel', organizationId: ORGANIZATION };

		await resolver.updateApprovalPolicy(input);

		const command = commandBus.execute.mock.calls[0][0] as ApprovalPolicyUpdateCommand;
		expect(command).toBeInstanceOf(ApprovalPolicyUpdateCommand);
		// The route carries the identifier in the path and the body beside it; the command holds the two
		// as separate members, and this is the pair the field dispatches.
		expect(command.id).toBe(BUSINESS_TRIP);
		expect(command.input).toEqual(input);
	});

	it('removes a policy through the same service method the REST route calls', async () => {
		const { resolver, approvalPolicyService } = surfaces();

		expect(await resolver.deleteApprovalPolicy(BUSINESS_TRIP)).toBe(true);
		expect(approvalPolicyService.delete).toHaveBeenCalledWith(BUSINESS_TRIP);
	});

	it('withdraws and restores a policy through the same service methods the REST routes call', async () => {
		const { resolver, approvalPolicyService } = surfaces();

		const withdrawn = await resolver.softDeleteApprovalPolicy(BUSINESS_TRIP);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(approvalPolicyService.softRemove).toHaveBeenCalledWith(BUSINESS_TRIP);

		expect(await resolver.recoverApprovalPolicy(BUSINESS_TRIP)).toBe(ROWS[0]);
		expect(approvalPolicyService.softRecover).toHaveBeenCalledWith(BUSINESS_TRIP);
	});
});

describe('ApprovalPolicyResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ApprovalPolicyResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ApprovalPolicyController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', ApprovalPolicyResolver) ?? [];
		// The paginated spelling and the folded request-approval route are in the list although no root
		// field mirrors them by name: the routes a surface has to be no narrower than are all of them.
		const routes = [
			'findAll',
			'findApprovalPoliciesForRequestApproval',
			'pagination',
			'findById',
			'getCount',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover'
		];

		for (const handler of routes) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow
			// REST below GraphQL and is caught here.
			expect([...guardsOfRoute(ApprovalPolicyController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ApprovalPolicyController)).toEqual([
			PermissionsEnum.APPROVAL_POLICY_EDIT
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ApprovalPolicyResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, ApprovalPolicyController)
		);
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['approvalPolicies', 'findAll'],
			['approvalPolicy', 'findById'],
			['approvalPolicyCount', 'getCount'],
			['createApprovalPolicy', 'create'],
			['updateApprovalPolicy', 'update'],
			['deleteApprovalPolicy', 'delete'],
			['softDeleteApprovalPolicy', 'softRemove'],
			['recoverApprovalPolicy', 'softRecover']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(ApprovalPolicyController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the edit permission on the routes the controller inherits, because the class states it', () => {
		// The asymmetry this resource has, stated in one place: the two read routes the controller
		// declares state the view permission on their own handlers, while every inherited route states
		// nothing and therefore runs under the class-level edit permission. Reading one policy costing
		// more than listing them is the controller's decision; widening it here, on one surface only, is
		// exactly what the two-protocol rule forbids.
		expect(permissionOfRoute(ApprovalPolicyController, 'findAll')).toEqual([
			PermissionsEnum.APPROVAL_POLICY_VIEW
		]);
		expect(permissionOfRoute(ApprovalPolicyController, 'pagination')).toEqual([
			PermissionsEnum.APPROVAL_POLICY_VIEW
		]);

		for (const handler of ['findById', 'getCount', 'delete', 'softRemove', 'softRecover']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(ApprovalPolicyController)[handler])).toBeUndefined();
			expect(permissionOfRoute(ApprovalPolicyController, handler)).toEqual([
				PermissionsEnum.APPROVAL_POLICY_EDIT
			]);
		}

		// The fields that mirror those routes state the same edit permission, and the list states the view
		// permission its handler states.
		expect(permissionOfField('approvalPolicies')).toEqual([PermissionsEnum.APPROVAL_POLICY_VIEW]);
		for (const field of [
			'approvalPolicy',
			'approvalPolicyCount',
			'createApprovalPolicy',
			'updateApprovalPolicy',
			'deleteApprovalPolicy',
			'softDeleteApprovalPolicy',
			'recoverApprovalPolicy'
		]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.APPROVAL_POLICY_EDIT]);
		}
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
		getHandler: () => (ApprovalPolicyResolver.prototype as never)[field],
		getClass: () => ApprovalPolicyResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ApprovalPolicyResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, ApprovalPolicyResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ApprovalPolicyResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('approvalPolicies')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('approvalPolicies');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('approvalPolicies'))).resolves.toBe(true);
	});
});
