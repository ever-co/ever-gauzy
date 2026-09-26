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
import { MODULE_METADATA } from '@nestjs/common/constants';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { CandidateInterviewersController } from './candidate-interviewers.controller';
import { CandidateInterviewersModule } from './candidate-interviewers.module';
import { CandidateInterviewersResolver } from './candidate-interviewers.resolver';
import { CandidateInterviewersService } from './candidate-interviewers.service';
import {
	CandidateInterviewersBulkCreateCommand,
	CandidateInterviewersEmployeeBulkDeleteCommand,
	CandidateInterviewersInterviewBulkDeleteCommand
} from './commands';

/**
 * The interview panel over GraphQL.
 *
 * The delivered REST routes serve a list, one seat, a count, a filing, an edit, the bulk filing, the two
 * scoped removals and the three lifecycle routes. This suite pins the half of the two-protocol doctrine
 * that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it;
 * - **the guard chain is the controller's and one permission is stated per field**: the list runs under
 *   the interviewer *view* permission and every other field under the class-level interviewer *edit*
 *   permission, because that is exactly how the controller's own routes are scoped;
 * - **a panel seat is a pair of identifiers** — the sitting and the engagement — and the person's own
 *   columns are read from the employee surface;
 * - **the interview-scoped read folds into the list** while the two scoped removals stay fields.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const INTERVIEW = '00000000-0000-4000-8000-000000000004';
const EMPLOYEE = '00000000-0000-4000-8000-000000000006';
const FIRST = '00000000-0000-4000-8000-000000000090';
const SECOND = '00000000-0000-4000-8000-000000000091';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		interviewId: INTERVIEW,
		employeeId: EMPLOYEE,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		interviewId: INTERVIEW,
		employeeId: EMPLOYEE,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const candidateInterviewersService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS) };

	return {
		candidateInterviewersService,
		commandBus,
		resolver: new CandidateInterviewersResolver(candidateInterviewersService as never, commandBus as never)
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

/** The type one root field answers with, read from the built schema rather than matched as text. */
function fieldType(operation: 'Query' | 'Mutation', field: string): string {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { type: { toString(): string } }> }
		| undefined;

	return root?.getFields()?.[field]?.type.toString() ?? '';
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/** The printed body of one type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type, by the same reading. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The reads and writes the panel seat itself contributes, by name. */
const OWNED_QUERY_FIELDS = ['candidateInterviewer', 'candidateInterviewerCount', 'candidateInterviewers'];

/** The mutations the panel seat contributes, by name. */
const OWNED_MUTATION_FIELDS = [
	'createCandidateInterviewer',
	'createCandidateInterviewersBulk',
	'deleteCandidateInterviewer',
	'deleteCandidateInterviewersByEmployee',
	'deleteCandidateInterviewersByInterview',
	'recoverCandidateInterviewer',
	'softDeleteCandidateInterviewer',
	'updateCandidateInterviewer'
];

/** The root fields of this resource, as they are actually declared. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned = operation === 'Query' ? OWNED_QUERY_FIELDS : OWNED_MUTATION_FIELDS;

	return rootFields(operation)
		.filter((field) => owned.includes(field))
		.sort();
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof CandidateInterviewersController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof CandidateInterviewersController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under: the controller's chain, then the handler's own. */
function guardsOfRoute(controller: typeof CandidateInterviewersController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof CandidateInterviewersResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(CandidateInterviewersResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, CandidateInterviewersResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', CandidateInterviewersResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(CandidateInterviewersResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/**
 * One field and the route it mirrors.
 *
 * The paginated spelling of the list is deliberately absent, and so is the interview-scoped read: both
 * are the list with a narrowing the connection states itself — a page, and an `interviewId` filter.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'candidateInterviewers', route: 'findAll' },
	{ field: 'candidateInterviewer', route: 'findById' },
	{ field: 'candidateInterviewerCount', route: 'getCount' },
	{ field: 'createCandidateInterviewer', route: 'create' },
	{ field: 'updateCandidateInterviewer', route: 'update' },
	{ field: 'deleteCandidateInterviewer', route: 'delete' },
	{ field: 'softDeleteCandidateInterviewer', route: 'softRemove' },
	{ field: 'recoverCandidateInterviewer', route: 'softRecover' },
	{ field: 'createCandidateInterviewersBulk', route: 'createBulk' },
	{ field: 'deleteCandidateInterviewersByInterview', route: 'deleteBulkByInterviewId' },
	{ field: 'deleteCandidateInterviewersByEmployee', route: 'deleteBulkByEmployeeId' }
];

describe('CandidateInterviewersResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(ownedRootFields('Query')).toEqual([
			'candidateInterviewer',
			'candidateInterviewerCount',
			'candidateInterviewers'
		]);
	});

	it('declares one mutation per delivered write route', () => {
		expect(ownedRootFields('Mutation')).toEqual([
			'createCandidateInterviewer',
			'createCandidateInterviewersBulk',
			'deleteCandidateInterviewer',
			'deleteCandidateInterviewersByEmployee',
			'deleteCandidateInterviewersByInterview',
			'recoverCandidateInterviewer',
			'softDeleteCandidateInterviewer',
			'updateCandidateInterviewer'
		]);
	});

	it('declares the connection, its edges, its filter and its sort', () => {
		expect(printed).toMatch(
			/type CandidateInterviewerConnection \{\s*nodes: \[CandidateInterviewer!\]!\s*edges: \[CandidateInterviewerEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type CandidateInterviewerEdge \{\s*node: CandidateInterviewer!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input CandidateInterviewerFilter \{/);
		expect(printed).toMatch(/enum CandidateInterviewerSortField \{\s*createdAt\s*updatedAt\s*\}/);
	});

	it('answers the count through a nullable field of its own, with no argument', () => {
		expect(fieldType('Query', 'candidateInterviewerCount')).toBe('Int');
		expect(fieldArgs('Query', 'candidateInterviewerCount')).toEqual([]);
	});

	it('states the two scoped removals as two fields beside the three lifecycle routes', () => {
		// One clears a sitting's whole panel, the other removes every seat one set of engagements holds
		// anywhere in the tenant; neither is a narrowing of a list, and neither is the plain removal.
		expect(fieldArgs('Mutation', 'deleteCandidateInterviewersByInterview')).toEqual(['interviewId']);
		expect(fieldArgs('Mutation', 'deleteCandidateInterviewersByEmployee')).toEqual(['employeeIds']);
		expect(fieldType('Mutation', 'deleteCandidateInterviewersByInterview')).toBe('Boolean!');
		expect(fieldType('Mutation', 'deleteCandidateInterviewer')).toBe('Boolean!');
		expect(fieldType('Mutation', 'softDeleteCandidateInterviewer')).toBe('CandidateInterviewer!');
		expect(fieldType('Mutation', 'recoverCandidateInterviewer')).toBe('CandidateInterviewer!');
	});
});

describe('CandidateInterviewersResolver — which members the surface exposes, and which it refuses', () => {
	it('carries the pair the row is, and the base columns', () => {
		const body = typeBody('CandidateInterviewer');

		expect(body).toMatch(/id: ID!/);
		expect(body).toMatch(/interviewId: ID!/);
		expect(body).toMatch(/employeeId: ID\b/);
		expect(body).toMatch(/tenantId: ID\b/);
		expect(body).toMatch(/organizationId: ID\b/);
	});

	it('carries no relation object, and no member for the employee’s own columns', () => {
		const body = typeBody('CandidateInterviewer');

		for (const relation of [/\binterview:/, /\bemployee:/, /\borganization:/] as const) {
			expect(body).not.toMatch(relation);
		}

		// The person on the panel is an engagement, and this row knows only its identifier: the name and
		// the rest are read from `employee(id)`, which is the surface that owns them.
		expect(body).not.toMatch(/\bfullName:/);
		expect(body).not.toMatch(/\bname:/);
		expect(body).not.toMatch(/\bemail:/);
	});

	it('declares the columns a panel list may be narrowed by, including the sitting', () => {
		const body = inputBody('CandidateInterviewerFilter');

		expect(body).toMatch(/interviewId: IDFilter/);
		expect(body).toMatch(/employeeId: IDFilter/);
		expect(body).not.toMatch(/\bemployee: /);
	});

	it('states the engagements of a bulk filing as identifiers rather than as rows', () => {
		const body = inputBody('CreateCandidateInterviewersBulkInput');

		expect(body).toMatch(/interviewId: ID!/);
		expect(body).toMatch(/employeeIds: \[ID!\]!/);
		expect(body).not.toMatch(/\bemployeeIds: \[CandidateInterviewer/);
	});
});

describe('CandidateInterviewersResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, candidateInterviewersService } = surfaces();

		const connection = await resolver.candidateInterviewers(undefined, undefined, undefined, 20);

		expect(candidateInterviewersService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('narrows by the sitting, which is the delivered interview-scoped read as a filter', async () => {
		const { resolver } = surfaces();

		const mine = await resolver.candidateInterviewers({ interviewId: { eq: INTERVIEW } });
		expect(mine.nodes).toHaveLength(2);

		const other = await resolver.candidateInterviewers({ interviewId: { eq: EMPLOYEE } });
		expect(other.nodes).toHaveLength(0);

		const refusal = await resolver.candidateInterviewers({ interviewer: { eq: INTERVIEW } }).catch((thrown) => thrown);
		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses a sort key the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.candidateInterviewers(undefined, [{ field: 'interviewId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.candidateInterviewers(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.candidateInterviewers(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('caps the page rather than answering every seat', async () => {
		const { resolver } = surfaces();

		const error = await resolver.candidateInterviewers(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('CandidateInterviewersResolver — one concept, two protocols, the same operations', () => {
	it('reads one seat through the same service method the REST route calls', async () => {
		const { resolver, candidateInterviewersService } = surfaces();

		expect(await resolver.candidateInterviewer(FIRST)).toBe(ROWS[0]);
		expect(candidateInterviewersService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a seat that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, candidateInterviewersService } = surfaces();
		candidateInterviewersService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.candidateInterviewer(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, candidateInterviewersService } = surfaces();

		expect(await resolver.candidateInterviewerCount()).toBe(2);
		expect(candidateInterviewersService.countBy).toHaveBeenCalledWith();
	});

	it('puts one engagement on one panel through the same service call the filing route makes', async () => {
		const { resolver, candidateInterviewersService } = surfaces();

		await resolver.createCandidateInterviewer({ interviewId: INTERVIEW, employeeId: EMPLOYEE });

		expect(candidateInterviewersService.create).toHaveBeenCalledWith({
			interviewId: INTERVIEW,
			employeeId: EMPLOYEE
		});
	});

	it('edits one seat through the same service call, and answers the row the write produced', async () => {
		const { resolver, candidateInterviewersService } = surfaces();

		await resolver.updateCandidateInterviewer({ id: FIRST, employeeId: EMPLOYEE });

		expect(candidateInterviewersService.update).toHaveBeenCalledWith(FIRST, { employeeId: EMPLOYEE });
		expect(candidateInterviewersService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('removes one seat through the same service method the removal route calls', async () => {
		const { resolver, candidateInterviewersService } = surfaces();

		expect(await resolver.deleteCandidateInterviewer(FIRST)).toBe(true);
		expect(candidateInterviewersService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores one seat through the same two service methods', async () => {
		const { resolver, candidateInterviewersService } = surfaces();

		const withdrawn = await resolver.softDeleteCandidateInterviewer(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(candidateInterviewersService.softRemove).toHaveBeenCalledWith(FIRST);

		expect(await resolver.recoverCandidateInterviewer(FIRST)).toBe(ROWS[0]);
		expect(candidateInterviewersService.softRecover).toHaveBeenCalledWith(FIRST);
	});

	it('files a whole panel through the command the bulk route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		const rows = await resolver.createCandidateInterviewersBulk({
			interviewId: INTERVIEW,
			employeeIds: [EMPLOYEE, FIRST]
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CandidateInterviewersBulkCreateCommand);
		expect(command.input).toEqual({ interviewId: INTERVIEW, employeeIds: [EMPLOYEE, FIRST] });
		expect(rows).toBe(ROWS);
	});

	it('clears one sitting’s panel through the command the scoped removal dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteCandidateInterviewersByInterview(INTERVIEW)).toBe(true);
		expect(commandBus.execute.mock.calls[0][0]).toBeInstanceOf(CandidateInterviewersInterviewBulkDeleteCommand);
		expect(commandBus.execute.mock.calls[0][0].id).toBe(INTERVIEW);
	});

	it('removes every seat one set of engagements holds, as the identifiers the handler reads', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteCandidateInterviewersByEmployee([EMPLOYEE, FIRST])).toBe(true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CandidateInterviewersEmployeeBulkDeleteCommand);
		// The delivered handler reads one member of each row of its `deleteInput` list, so the field hands
		// it the same rows stated as the identifiers those members are.
		expect(command.input).toEqual([{ employeeId: EMPLOYEE }, { employeeId: FIRST }]);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('CANDIDATE_INTERVIEWER_DUPLICATE: this person already sits on the panel.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(
			resolver.createCandidateInterviewersBulk({ interviewId: INTERVIEW, employeeIds: [EMPLOYEE] })
		).rejects.toBe(refusal);
	});
});

describe('CandidateInterviewersResolver — the guard stack and the permission are the controller’s, field by field', () => {
	it('states on the class the guards and the permission the controller states on its class', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', CandidateInterviewersController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', CandidateInterviewersResolver) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard])
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CandidateInterviewersResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, CandidateInterviewersController)
		);
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		expect(typeof handlersOf(CandidateInterviewersController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which no route carries because it is not a
		// scope: every other guard of the field's chain still has to be its own route's.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(CandidateInterviewersController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(CandidateInterviewersController, route));
	});

	it('states the view permission on the one read whose route states it, and the edit one everywhere else', () => {
		// The controller states the view permission on exactly two handlers — the list and the
		// interview-scoped read, which folds into that list — and nothing anywhere else, so every other
		// route of this resource runs under the class-level edit permission.
		expect(permissionOfField('candidateInterviewers')).toEqual([
			PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_VIEW
		]);

		for (const field of [
			'candidateInterviewer',
			'candidateInterviewerCount',
			'createCandidateInterviewer',
			'updateCandidateInterviewer',
			'deleteCandidateInterviewer',
			'softDeleteCandidateInterviewer',
			'recoverCandidateInterviewer',
			'createCandidateInterviewersBulk',
			'deleteCandidateInterviewersByInterview',
			'deleteCandidateInterviewersByEmployee'
		]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT]);
		}
	});
});

describe('CandidateInterviewersModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, CandidateInterviewersModule) ?? []) as unknown[];

		expect(providers).toContain(CandidateInterviewersResolver);
		expect(providers).toContain(CandidateInterviewersService);
	});

	it('re-exports the command bus the three panel writes dispatch through', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, CandidateInterviewersModule) ?? []) as unknown[];

		expect(exported).toContain(CandidateInterviewersService);
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
		getHandler: () => (CandidateInterviewersResolver.prototype as never)[field],
		getClass: () => CandidateInterviewersResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('CandidateInterviewersResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, CandidateInterviewersResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', CandidateInterviewersResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('candidateInterviewers')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('candidateInterviewers');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('candidateInterviewers'))).resolves.toBe(true);
	});
});
