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
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OrganizationStrategicInitiativeController } from './organization-strategic-initiative.controller';
import { OrganizationStrategicInitiativeResolver } from './organization-strategic-initiative.resolver';
import {
	OrganizationStrategicInitiativeCreateCommand,
	OrganizationStrategicInitiativeUpdateCommand,
	OrganizationStrategicInitiativeUpdateSignalsCommand
} from './commands';
import {
	OrganizationStrategicInitiativeFindAllQuery,
	OrganizationStrategicInitiativeFindByProjectQuery,
	OrganizationStrategicInitiativeFindOneQuery
} from './queries';

/**
 * The organization strategic initiative over GraphQL.
 *
 * The delivered REST routes serve a list, one initiative, the initiatives aligned to a project, a
 * count, a filing, an edit, a signals assessment, a removal, and the withdrawal and restoration of an
 * initiative. This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it;
 * - every field dispatches the same command or query, or calls the same service method, that the REST
 *   route reaches — the writes are commands because the routes dispatch commands, and the three reads
 *   are queries for the same reason;
 * - **the guard chain and every permission are the controller's, field by field**, including the four
 *   capabilities it inherits from the CRUD base, which carry no permission and are mirrored by fields
 *   that state none;
 * - the members the delivered read can produce are what the object type carries, and the alignments
 *   the connection cannot evaluate are a field of their own rather than a filter that would select
 *   nothing;
 * - an initiative that is not there — or that the caller may not see — is `null` on the one-row field.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const PROJECT = '00000000-0000-4000-8000-000000000009';
const STEWARD = '00000000-0000-4000-8000-00000000000a';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted read answers with, in the order the delivered query returns them. */
const ROWS = [
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		title: 'Move upmarket',
		intent: 'Serve larger accounts without losing the self-serve motion.',
		state: 'active',
		visibilityScope: 'organization',
		signals: { confidenceLevel: 'high' },
		stewardId: STEWARD,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		title: 'Simplify onboarding',
		intent: 'A new tenant is productive on its first day.',
		state: 'draft',
		visibilityScope: 'leadership',
		signals: null,
		stewardId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over scripted buses and a scripted service. */
function surfaces() {
	const organizationStrategicInitiativeService = {
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	// Each read has its own answer, because the three reads answer three different questions and a spec
	// that let one stand in for another would not see a field wired to the wrong query.
	const queryBus = {
		execute: jest.fn().mockImplementation((query: unknown) => {
			if (query instanceof OrganizationStrategicInitiativeFindAllQuery) {
				return Promise.resolve({ items: ROWS, total: ROWS.length });
			}
			if (query instanceof OrganizationStrategicInitiativeFindOneQuery) {
				return Promise.resolve(ROWS[0]);
			}
			if (query instanceof OrganizationStrategicInitiativeFindByProjectQuery) {
				return Promise.resolve([ROWS[0]]);
			}

			return Promise.resolve(undefined);
		})
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		organizationStrategicInitiativeService,
		queryBus,
		commandBus,
		resolver: new OrganizationStrategicInitiativeResolver(
			organizationStrategicInitiativeService as never,
			commandBus as never,
			queryBus as never
		)
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

/**
 * The root fields this domain contributes, which are the ones that name its concept.
 *
 * The concept's name begins with the organization's own, so the match is anchored at both ends rather
 * than a substring search, which would have counted another domain's fields as this one's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned =
		operation === 'Query'
			? /^organizationStrategicInitiative(s|sByProject|Count)?$/
			: /^(create|update|delete|softDelete|recover)OrganizationStrategicInitiative(Signals)?$/;

	return rootFields(operation)
		.filter((field) => owned.test(field))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OrganizationStrategicInitiativeController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(
	controller: typeof OrganizationStrategicInitiativeController,
	handler: string
): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OrganizationStrategicInitiativeController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = OrganizationStrategicInitiativeResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('OrganizationStrategicInitiativeResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the list, the one-row read, the project read and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'organizationStrategicInitiatives',
				'organizationStrategicInitiative',
				'organizationStrategicInitiativesByProject',
				'organizationStrategicInitiativeCount'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createOrganizationStrategicInitiative',
				'updateOrganizationStrategicInitiative',
				'updateOrganizationStrategicInitiativeSignals',
				'deleteOrganizationStrategicInitiative',
				'softDeleteOrganizationStrategicInitiative',
				'recoverOrganizationStrategicInitiative'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once.
		expect(ownedRootFields('Query')).toEqual([
			'organizationStrategicInitiative',
			'organizationStrategicInitiativeCount',
			'organizationStrategicInitiatives',
			'organizationStrategicInitiativesByProject'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createOrganizationStrategicInitiative',
			'deleteOrganizationStrategicInitiative',
			'recoverOrganizationStrategicInitiative',
			'softDeleteOrganizationStrategicInitiative',
			'updateOrganizationStrategicInitiative',
			'updateOrganizationStrategicInitiativeSignals'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type OrganizationStrategicInitiativeConnection \{\s*nodes: \[OrganizationStrategicInitiative!\]!\s*edges: \[OrganizationStrategicInitiativeEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type OrganizationStrategicInitiativeEdge \{\s*node: OrganizationStrategicInitiative!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input OrganizationStrategicInitiativeFilter \{/);
		expect(printed).toMatch(/input OrganizationStrategicInitiativeSort \{/);
		expect(printed).toMatch(
			/enum OrganizationStrategicInitiativeSortField \{\s*createdAt\s*updatedAt\s*title\s*state\s*visibilityScope\s*\}/
		);
	});

	it('carries the row’s own members, the signals document and the identifiers of the relations', () => {
		const body = typeBody('OrganizationStrategicInitiative');

		expect(body).toMatch(/title: String!/);
		expect(body).toMatch(/intent: String/);
		// Both vocabularies belong to the delivered service, which switches on them; an enum here would
		// be a second declaration of a value set this file does not own.
		expect(body).toMatch(/state: String!/);
		expect(body).toMatch(/visibilityScope: String!/);
		// The signals are one human-authored document rather than a set of columns.
		expect(body).toMatch(/signals: JSON/);
		// The steward is a relation the reads do not join, so the identifier is what is carried.
		expect(body).toMatch(/stewardId: ID/);
		expect(body).not.toMatch(/\bsteward: Employee\b/);
		// The alignments are not members: an alignment is a pivot, and this schema declares no project
		// or goal object type for a member to answer with.
		expect(body).not.toMatch(/\bprojects:/);
		expect(body).not.toMatch(/\bgoals:/);
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).not.toMatch(/organizationStrategicInitiatives\([^)]*withDeleted/);
		expect(printed).not.toMatch(/organizationStrategicInitiativeCount\(/);
		// The project read mirrors a route with no page, so it answers a bare list rather than a
		// connection: a page argument here would be one the delivered read cannot take.
		expect(printed).toMatch(
			/organizationStrategicInitiativesByProject\(projectId: ID!\): \[OrganizationStrategicInitiative!\]!/
		);
	});

	it('declares the aligned projects nowhere, neither as a member nor as a filter', () => {
		const filter = printed.match(/input OrganizationStrategicInitiativeFilter \{([\s\S]*?)\n\}/)?.[1] ?? '';

		expect(filter).not.toMatch(/\bprojects\b/);
		expect(filter).not.toMatch(/\bgoals\b/);
		// The signals document is filterable, which is the one structured question this list is asked.
		expect(filter).toMatch(/signals: JSONFilter/);
	});
});

describe('OrganizationStrategicInitiativeResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, queryBus } = surfaces();

		const connection = await resolver.organizationStrategicInitiatives(undefined, undefined, undefined, 20);

		// The read is the query the REST list route dispatches, with the route's own default for an
		// unstated request.
		expect(queryBus.execute.mock.calls[0][0]).toBeInstanceOf(OrganizationStrategicInitiativeFindAllQuery);
		expect((queryBus.execute.mock.calls[0][0] as OrganizationStrategicInitiativeFindAllQuery).options).toEqual(
			{}
		);
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SECOND);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.organizationStrategicInitiatives();

		expect(connection.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byState = await resolver.organizationStrategicInitiatives({ state: { eq: 'active' } });
		expect(byState.nodes.map((node) => node.id)).toEqual([SECOND]);

		const byScope = await resolver.organizationStrategicInitiatives({
			visibilityScope: { eq: 'leadership' }
		});
		expect(byScope.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byTitle = await resolver.organizationStrategicInitiatives({ title: { ilike: '%upmarket' } });
		expect(byTitle.nodes.map((node) => node.id)).toEqual([SECOND]);

		const refusal = await resolver
			.organizationStrategicInitiatives({ projects: { eq: PROJECT } })
			.catch((thrown) => thrown);
		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byTitle = await resolver.organizationStrategicInitiatives(undefined, [
			{ field: 'title', direction: 'ASC' }
		]);
		expect(byTitle.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);

		const byCreated = await resolver.organizationStrategicInitiatives(undefined, [
			{ field: 'createdAt', direction: 'ASC' }
		]);
		expect(byCreated.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.organizationStrategicInitiatives(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([SECOND]);

		const second = await resolver.organizationStrategicInitiatives(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.organizationStrategicInitiatives(undefined, undefined, undefined, 20);

		const last = await resolver.organizationStrategicInitiatives(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationStrategicInitiatives(undefined, [{ field: 'stewardId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationStrategicInitiatives(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('OrganizationStrategicInitiativeResolver — one concept, two protocols, the same operations', () => {
	it('reads one initiative through the same query the REST route dispatches', async () => {
		const { resolver, queryBus } = surfaces();

		expect(await resolver.organizationStrategicInitiative(SECOND)).toBe(ROWS[0]);

		const query = queryBus.execute.mock.calls[0][0] as OrganizationStrategicInitiativeFindOneQuery;
		expect(query).toBeInstanceOf(OrganizationStrategicInitiativeFindOneQuery);
		expect(query.id).toBe(SECOND);
		expect(query.options).toEqual({});
	});

	it('answers null for an initiative that is not there, or that the caller may not see', async () => {
		const { resolver, queryBus } = surfaces();
		// The delivered read refuses an initiative outside the caller's visibility scope with the same
		// miss it answers for a row that is not there, so one branch covers both.
		queryBus.execute.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.organizationStrategicInitiative(FIRST)).toBeNull();
	});

	it('reads a project’s initiatives through the same query the REST route dispatches', async () => {
		const { resolver, queryBus } = surfaces();

		expect(await resolver.organizationStrategicInitiativesByProject(PROJECT)).toEqual([ROWS[0]]);

		const query = queryBus.execute.mock.calls[0][0] as OrganizationStrategicInitiativeFindByProjectQuery;
		expect(query).toBeInstanceOf(OrganizationStrategicInitiativeFindByProjectQuery);
		expect(query.projectId).toBe(PROJECT);
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, organizationStrategicInitiativeService } = surfaces();

		expect(await resolver.organizationStrategicInitiativeCount()).toBe(2);
		expect(organizationStrategicInitiativeService.countBy).toHaveBeenCalledWith();
	});

	it('files an initiative through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createOrganizationStrategicInitiative({
			organizationId: ORGANIZATION,
			title: 'Move upmarket'
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationStrategicInitiativeCreateCommand);
		expect(command.input).toEqual({ organizationId: ORGANIZATION, title: 'Move upmarket' });
		// The steward is not stated: the handler records the caller's own employee when none is given.
		expect(command.input).not.toHaveProperty('stewardId');
	});

	it('edits an initiative through the command the REST route dispatches, with the identifier as the criterion', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateOrganizationStrategicInitiative({ id: SECOND, state: 'resolved' });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationStrategicInitiativeUpdateCommand);
		expect(command.id).toBe(SECOND);
		expect(command.input).toEqual({ state: 'resolved' });
	});

	it('records an assessment through the signals command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateOrganizationStrategicInitiativeSignals({
			id: SECOND,
			confidenceLevel: 'high',
			knownRisks: ['hiring']
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationStrategicInitiativeUpdateSignalsCommand);
		expect(command.id).toBe(SECOND);
		// The identifier is the criterion, so it is not repeated inside the signals document.
		expect(command.signals).toEqual({ confidenceLevel: 'high', knownRisks: ['hiring'] });
	});

	it('removes an initiative through the same service method the REST route calls', async () => {
		const { resolver, organizationStrategicInitiativeService } = surfaces();

		expect(await resolver.deleteOrganizationStrategicInitiative(SECOND)).toBe(true);
		expect(organizationStrategicInitiativeService.delete).toHaveBeenCalledWith(SECOND);
	});

	it('withdraws and restores an initiative through the same service methods the REST routes call', async () => {
		const { resolver, organizationStrategicInitiativeService } = surfaces();

		const withdrawn = await resolver.softDeleteOrganizationStrategicInitiative(SECOND);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(organizationStrategicInitiativeService.softRemove).toHaveBeenCalledWith(SECOND);

		expect(await resolver.recoverOrganizationStrategicInitiative(SECOND)).toBe(ROWS[0]);
		expect(organizationStrategicInitiativeService.softRecover).toHaveBeenCalledWith(SECOND);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('STRATEGIC_INITIATIVE_INVALID_STATE: resolved is not reachable from draft.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(
			resolver.updateOrganizationStrategicInitiative({ id: SECOND, state: 'resolved' })
		).rejects.toBe(refusal);
	});
});

describe('OrganizationStrategicInitiativeResolver — the guard stack and the permissions are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OrganizationStrategicInitiativeResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OrganizationStrategicInitiativeController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', OrganizationStrategicInitiativeResolver) ?? [];
		const routes = [
			'findAll',
			'findByProject',
			'findById',
			'getCount',
			'create',
			'update',
			'updateSignals',
			'delete',
			'softRemove',
			'softRecover'
		];

		for (const handler of routes) {
			expect([
				...guardsOfRoute(OrganizationStrategicInitiativeController, handler),
				FeatureFlagGuard
			].sort()).toEqual([...stated].sort());
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		// The controller states a permission per route rather than on the class, so nothing here is
		// inherited and every field has to state its own.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationStrategicInitiativeController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationStrategicInitiativeResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['organizationStrategicInitiatives', 'findAll'],
			['organizationStrategicInitiative', 'findById'],
			['organizationStrategicInitiativesByProject', 'findByProject'],
			['organizationStrategicInitiativeCount', 'getCount'],
			['createOrganizationStrategicInitiative', 'create'],
			['updateOrganizationStrategicInitiative', 'update'],
			['updateOrganizationStrategicInitiativeSignals', 'updateSignals'],
			['deleteOrganizationStrategicInitiative', 'delete'],
			['softDeleteOrganizationStrategicInitiative', 'softRemove'],
			['recoverOrganizationStrategicInitiative', 'softRecover']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [
				field,
				permissionOfRoute(OrganizationStrategicInitiativeController, handler)
			])
		);

		expect(stated).toEqual(expected);
	});

	it('states each permission the controller states, and leaves the inherited routes unpermissioned', () => {
		expect(permissionOfField('organizationStrategicInitiatives')).toEqual([
			PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ
		]);
		expect(permissionOfField('organizationStrategicInitiative')).toEqual([
			PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ
		]);
		expect(permissionOfField('organizationStrategicInitiativesByProject')).toEqual([
			PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ
		]);
		expect(permissionOfField('createOrganizationStrategicInitiative')).toEqual([
			PermissionsEnum.ORG_STRATEGIC_INITIATIVE_CREATE
		]);
		expect(permissionOfField('updateOrganizationStrategicInitiative')).toEqual([
			PermissionsEnum.ORG_STRATEGIC_INITIATIVE_UPDATE
		]);
		expect(permissionOfField('updateOrganizationStrategicInitiativeSignals')).toEqual([
			PermissionsEnum.ORG_STRATEGIC_INITIATIVE_UPDATE
		]);
		expect(permissionOfField('deleteOrganizationStrategicInitiative')).toEqual([
			PermissionsEnum.ORG_STRATEGIC_INITIATIVE_DELETE
		]);

		// The four capabilities the controller inherits from the CRUD base carry no permission, so the
		// fields that mirror them state none: a field that demanded one would be narrower than its route.
		for (const field of [
			'organizationStrategicInitiativeCount',
			'softDeleteOrganizationStrategicInitiative',
			'recoverOrganizationStrategicInitiative'
		]) {
			expect(permissionOfField(field)).toBeUndefined();
		}
	});
});

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
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
		getHandler: () => (OrganizationStrategicInitiativeResolver.prototype as never)[field],
		getClass: () => OrganizationStrategicInitiativeResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OrganizationStrategicInitiativeResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationStrategicInitiativeResolver)).toBe(
			FEATURE_GRAPHQL
		);
		expect(Reflect.getMetadata('__guards__', OrganizationStrategicInitiativeResolver)).toContain(
			FeatureFlagGuard
		);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('organizationStrategicInitiatives'))
			.catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('organizationStrategicInitiatives');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('organizationStrategicInitiatives'))).resolves.toBe(true);
	});
});
