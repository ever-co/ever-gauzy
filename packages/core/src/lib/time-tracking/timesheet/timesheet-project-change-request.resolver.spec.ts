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
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { TimesheetProjectChangeRequestController } from './timesheet-project-change-request.controller';
import { TimesheetProjectChangeRequestResolver } from './timesheet-project-change-request.resolver';

/**
 * The timesheet project change request over GraphQL.
 *
 * The delivered REST routes serve one read — the requests raised against a period — and two writes:
 * raising one, and deciding on it. This suite pins the half of the two-protocol doctrine that is easy
 * to get quietly wrong:
 *
 * - all three capabilities are root fields of the one composed schema, and the read is a connection
 *   with the platform's own cursor codec behind it, so a cursor obtained over REST resumes here and a
 *   refusal is the query protocol's own code;
 * - every field reaches the same service method the REST route reaches, so a client does not choose a
 *   better surface by choosing a protocol;
 * - **the class states no permission, because the controller states none** — this controller puts its
 *   grants on the handlers, so every field states its own route's, and the parity is field by field
 *   rather than a class-level grant copied once;
 * - the two values the delivered read requires are arguments of the list field, because a connection
 *   filter is applied to the rows a read has already returned;
 * - the delivered read's own scope — an employee sees only the requests on its own periods — is the
 *   service's, and is asserted not to have been restated as a permission here.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TIMESHEET = '00000000-0000-4000-8000-000000000003';
const PREVIOUS_PROJECT = '00000000-0000-4000-8000-000000000004';
const REQUESTED_PROJECT = '00000000-0000-4000-8000-000000000005';
const REVIEWER = '00000000-0000-4000-8000-000000000006';
const PENDING = '00000000-0000-4000-8000-000000000010';
const REVIEWED = '00000000-0000-4000-8000-000000000011';

/**
 * The rows a scripted service answers with, in the order the delivered read returns them — newest
 * first, which is the order that read states of its own.
 */
const ROWS = [
	{
		id: REVIEWED,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		timesheetId: TIMESHEET,
		requestedProjectId: REQUESTED_PROJECT,
		previousProjectId: PREVIOUS_PROJECT,
		reason: 'This time belongs to the second project.',
		status: 'APPROVED',
		reviewNote: 'Confirmed with the client.',
		reviewedAt: new Date('2026-03-05T10:00:00.000Z'),
		reviewedById: REVIEWER,
		createdAt: new Date('2026-03-04T10:00:00.000Z'),
		updatedAt: new Date('2026-03-05T10:00:00.000Z')
	},
	{
		id: PENDING,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		timesheetId: TIMESHEET,
		requestedProjectId: REQUESTED_PROJECT,
		previousProjectId: PREVIOUS_PROJECT,
		reason: 'This time belongs to the second project.',
		status: 'PENDING',
		reviewNote: null,
		reviewedAt: null,
		reviewedById: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const timesheetProjectChangeRequestService = {
		findAllByTimesheet: jest.fn().mockResolvedValue(ROWS),
		requestProjectChange: jest.fn().mockResolvedValue(ROWS[1]),
		review: jest.fn().mockResolvedValue(ROWS[0])
	};

	return {
		timesheetProjectChangeRequestService,
		resolver: new TimesheetProjectChangeRequestResolver(timesheetProjectChangeRequestService as never)
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

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('projectchange'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of the controller, inherited ones included. */
function handlersOf(controller: typeof TimesheetProjectChangeRequestController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof TimesheetProjectChangeRequestController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof TimesheetProjectChangeRequestController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = TimesheetProjectChangeRequestResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('TimesheetProjectChangeRequestResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the one read and the two writes the controller serves, and no more', () => {
		// There is no collection route, no node route and no count route on this controller, so there is
		// no second spelling of the list and no number to answer: the read it does serve is a connection
		// over the requests of one period, and the two decisions are the two mutations.
		expect(ownedRootFields('Query')).toEqual(['timesheetProjectChangeRequests']);
		expect(ownedRootFields('Mutation')).toEqual([
			'requestTimesheetProjectChange',
			'reviewTimesheetProjectChange'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type TimesheetProjectChangeRequestConnection \{\s*nodes: \[TimesheetProjectChangeRequest!\]!\s*edges: \[TimesheetProjectChangeRequestEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type TimesheetProjectChangeRequestEdge \{\s*node: TimesheetProjectChangeRequest!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input TimesheetProjectChangeRequestFilter \{/);
		expect(printed).toMatch(/input TimesheetProjectChangeRequestSort \{/);
		expect(printed).toMatch(
			/enum TimesheetProjectChangeRequestSortField \{\s*createdAt\s*updatedAt\s*reviewedAt\s*status\s*\}/
		);
	});

	it('carries both endpoints of the move, the decision, and no relation it does not load', () => {
		const body = typeBody('TimesheetProjectChangeRequest');

		// Both endpoints are carried: a request that named only the destination could not be applied
		// safely, because one period holds the time of several projects.
		expect(body).toMatch(/previousProjectId: ID!/);
		expect(body).toMatch(/requestedProjectId: ID!/);
		expect(body).toMatch(/timesheetId: ID!/);
		// The decision, without which the answer to the review write would not say what it decided.
		expect(body).toMatch(/status: String!/);
		expect(body).toMatch(/reviewedAt: DateTime/);
		expect(body).toMatch(/reviewNote: String/);
		expect(body).toMatch(/reviewedById: ID/);
		expect(body).toMatch(/reason: String!/);

		// The delivered read and both writes use the row directly, so no relation object may be
		// declared: each would be empty on every row this surface answers.
		expect(body).not.toMatch(/timesheet: Timesheet/);
		expect(body).not.toMatch(/requestedProject: OrganizationProject/);
		expect(body).not.toMatch(/previousProject: OrganizationProject/);
		expect(body).not.toMatch(/reviewedBy: User/);

		// Nothing on this resource is money, so no member of it is a decimal.
		expect(body).not.toMatch(/:\s*Decimal/);
	});

	it('declares the two bodies the two writes validate, and no tenant member on either', () => {
		expect(printed).toMatch(/input RequestTimesheetProjectChangeInput \{/);
		expect(printed).toMatch(/input ReviewTimesheetProjectChangeInput \{/);
		// The tenant is stamped from the credential by the service, so a member for it could never
		// change the write and is not published.
		expect(printed).not.toMatch(/input RequestTimesheetProjectChangeInput \{[^}]*tenantId/);
		expect(printed).not.toMatch(/input ReviewTimesheetProjectChangeInput \{[^}]*tenantId/);
	});

	it('offers no argument it cannot honour', () => {
		// The read answers one page of one period's requests; there is no unpaginated spelling of it and
		// no second field that could disagree with this one.
		expect(rootFields('Query').filter((field) => field.toLowerCase().includes('projectchange'))).toHaveLength(1);
	});
});

describe('TimesheetProjectChangeRequestResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, timesheetProjectChangeRequestService } = surfaces();

		const connection = await resolver.timesheetProjectChangeRequests(TIMESHEET, ORGANIZATION, undefined, undefined, undefined, 20);

		// The read is the one the REST route performs, with the two values that route requires.
		expect(timesheetProjectChangeRequestService.findAllByTimesheet).toHaveBeenCalledWith(
			TIMESHEET,
			ORGANIZATION
		);
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(REVIEWED);
	});

	it('answers newest first, which is the one order a delivered read states of its own', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.timesheetProjectChangeRequests(TIMESHEET, ORGANIZATION);

		expect(connection.nodes.map((node) => node.id)).toEqual([REVIEWED, PENDING]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const pending = await resolver.timesheetProjectChangeRequests(TIMESHEET, ORGANIZATION, {
			status: { eq: 'PENDING' }
		});
		expect(pending.nodes.map((node) => node.id)).toEqual([PENDING]);

		// The moves one project is waiting for, which is the read the identifier columns exist for.
		const forProject = await resolver.timesheetProjectChangeRequests(TIMESHEET, ORGANIZATION, {
			requestedProjectId: { eq: REQUESTED_PROJECT }
		});
		expect(forProject.nodes.map((node) => node.id)).toEqual([REVIEWED, PENDING]);

		// A request awaiting a decision carries no review instant, which is what `isNull` states and
		// what an `eq` never matches.
		const unreviewed = await resolver.timesheetProjectChangeRequests(TIMESHEET, ORGANIZATION, {
			reviewedAt: { isNull: true }
		});
		expect(unreviewed.nodes.map((node) => node.id)).toEqual([PENDING]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.timesheetProjectChangeRequests(
			TIMESHEET,
			ORGANIZATION,
			undefined,
			[{ field: 'status', direction: 'ASC' }]
		);

		expect(byStatus.nodes.map((node) => node.id)).toEqual([REVIEWED, PENDING]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.timesheetProjectChangeRequests(TIMESHEET, ORGANIZATION, undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([REVIEWED]);

		const second = await resolver.timesheetProjectChangeRequests(TIMESHEET, ORGANIZATION, undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([PENDING]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.timesheetProjectChangeRequests(TIMESHEET, ORGANIZATION, undefined, [
				{ field: 'reason', direction: 'ASC' }
			] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.timesheetProjectChangeRequests(TIMESHEET, ORGANIZATION, { timeLogs: { eq: TIMESHEET } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.timesheetProjectChangeRequests(TIMESHEET, ORGANIZATION, undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('TimesheetProjectChangeRequestResolver — one concept, two protocols, the same operations', () => {
	it('reads the requests of a period through the same service method the REST route calls', async () => {
		const { resolver, timesheetProjectChangeRequestService } = surfaces();

		const connection = await resolver.timesheetProjectChangeRequests(TIMESHEET, ORGANIZATION);

		expect(connection.nodes).toHaveLength(2);
		expect(timesheetProjectChangeRequestService.findAllByTimesheet).toHaveBeenCalledWith(
			TIMESHEET,
			ORGANIZATION
		);
	});

	it('raises a request through the same service method the REST route calls', async () => {
		const { resolver, timesheetProjectChangeRequestService } = surfaces();

		const created = await resolver.requestTimesheetProjectChange({
			timesheetId: TIMESHEET,
			requestedProjectId: REQUESTED_PROJECT,
			previousProjectId: PREVIOUS_PROJECT,
			reason: 'This time belongs to the second project.',
			organizationId: ORGANIZATION
		});

		expect(created).toBe(ROWS[1]);
		expect(timesheetProjectChangeRequestService.requestProjectChange).toHaveBeenCalledWith({
			timesheetId: TIMESHEET,
			requestedProjectId: REQUESTED_PROJECT,
			previousProjectId: PREVIOUS_PROJECT,
			reason: 'This time belongs to the second project.',
			organizationId: ORGANIZATION
		});
	});

	it('decides a request through the same service method the REST route calls', async () => {
		const { resolver, timesheetProjectChangeRequestService } = surfaces();

		const reviewed = await resolver.reviewTimesheetProjectChange(PENDING, {
			status: 'APPROVED' as never,
			reviewNote: 'Confirmed with the client.',
			organizationId: ORGANIZATION
		});

		expect(reviewed).toBe(ROWS[0]);
		expect(timesheetProjectChangeRequestService.review).toHaveBeenCalledWith(PENDING, {
			status: 'APPROVED',
			reviewNote: 'Confirmed with the client.',
			organizationId: ORGANIZATION
		});
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, timesheetProjectChangeRequestService } = surfaces();
		const refusal = new Error('TIMESHEET_ALREADY_BILLED: a billed period can no longer be changed.');

		timesheetProjectChangeRequestService.requestProjectChange.mockRejectedValueOnce(refusal);

		await expect(
			resolver.requestTimesheetProjectChange({
				timesheetId: TIMESHEET,
				requestedProjectId: REQUESTED_PROJECT,
				previousProjectId: PREVIOUS_PROJECT,
				reason: 'This time belongs to the second project.',
				organizationId: ORGANIZATION
			})
		).rejects.toBe(refusal);
	});

	it('lets a miss through as null-free refusal, which is what the delivered service raises', async () => {
		const { resolver, timesheetProjectChangeRequestService } = surfaces();

		timesheetProjectChangeRequestService.review.mockRejectedValueOnce(new NotFoundException());

		await expect(
			resolver.reviewTimesheetProjectChange(PENDING, { status: 'REJECTED' as never, organizationId: ORGANIZATION })
		).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('TimesheetProjectChangeRequestResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', TimesheetProjectChangeRequestResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', TimesheetProjectChangeRequestController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', TimesheetProjectChangeRequestResolver) ?? [];
		const routes = ['findAllByTimesheet', 'requestProjectChange', 'review'];

		for (const handler of routes) {
			// The controller's class chain plus the gate on the endpoint itself and the resolver's are
			// the same set, which is the whole parity claim: a route that added a guard of its own would
			// narrow REST below GraphQL and is caught here. No route here restates one.
			expect([...guardsOfRoute(TimesheetProjectChangeRequestController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TimesheetProjectChangeRequestController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TimesheetProjectChangeRequestResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['timesheetProjectChangeRequests', 'findAllByTimesheet'],
			['requestTimesheetProjectChange', 'requestProjectChange'],
			['reviewTimesheetProjectChange', 'review']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [
				field,
				permissionOfRoute(TimesheetProjectChangeRequestController, handler)
			])
		);

		expect(stated).toEqual(expected);
	});

	it('states the three grants the three routes state, and never one of its own', () => {
		// Raising a request changes nothing on its own, so it needs only the time-tracker permission
		// every employee already has; reading one needs that or the approval grant; deciding one needs
		// the approval grant alone. Widening the read here, or narrowing the raise, is what this holds.
		expect(permissionOfField('requestTimesheetProjectChange')).toEqual([PermissionsEnum.TIME_TRACKER]);
		expect(permissionOfField('reviewTimesheetProjectChange')).toEqual([
			PermissionsEnum.CAN_APPROVE_TIMESHEET
		]);
		expect(permissionOfField('timesheetProjectChangeRequests')).toEqual([
			PermissionsEnum.TIME_TRACKER,
			PermissionsEnum.CAN_APPROVE_TIMESHEET
		]);
	});

	it('does not restate the read’s own scope as a permission', () => {
		// The service answers a caller that may not approve timesheets only the requests on its own
		// periods. That scope is the delivered read's, and a field that turned it into a grant would
		// refuse the employee the route exists for — so the read states no approval-only permission.
		expect(permissionOfField('timesheetProjectChangeRequests')).not.toEqual([
			PermissionsEnum.CAN_APPROVE_TIMESHEET
		]);
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
		getHandler: () => (TimesheetProjectChangeRequestResolver.prototype as never)[field],
		getClass: () => TimesheetProjectChangeRequestResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TimesheetProjectChangeRequestResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, TimesheetProjectChangeRequestResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TimesheetProjectChangeRequestResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('timesheetProjectChangeRequests'))
			.catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('timesheetProjectChangeRequests');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('reviewTimesheetProjectChange'))).resolves.toBe(true);
	});
});
