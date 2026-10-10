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
import { CandidateInterviewController } from './candidate-interview.controller';
import { CandidateInterviewModule } from './candidate-interview.module';
import { CandidateInterviewResolver } from './candidate-interview.resolver';
import { CandidateInterviewService } from './candidate-interview.service';

/**
 * The interview over GraphQL.
 *
 * The delivered REST routes serve a list, a candidate-scoped list, one sitting, a count, a scheduling,
 * an edit and the three lifecycle routes. This suite pins the half of the two-protocol doctrine that is
 * easy to get quietly wrong for this resource:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it;
 * - **every field states the interview *edit* permission, and none states the interview view one** —
 *   the controller states no permission on any of its eight handlers, so all eight routes run under its
 *   class-level edit permission, while the interview view permission belongs to a different controller;
 * - **the candidate-scoped read folds into the list**, because it is the same reader with one more
 *   predicate over a column the row carries;
 * - the sitting's four collections are refused as members, because the delivered read joins none of
 *   them.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CANDIDATE = '00000000-0000-4000-8000-000000000003';
const FIRST = '00000000-0000-4000-8000-000000000080';
const SECOND = '00000000-0000-4000-8000-000000000081';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		candidateId: CANDIDATE,
		title: 'Technical screen',
		startTime: new Date('2026-03-02T09:00:00.000Z'),
		endTime: new Date('2026-03-02T10:00:00.000Z'),
		location: 'Room 1',
		note: 'Bring the laptop',
		rating: 4.5,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		candidateId: CANDIDATE,
		title: 'Culture fit',
		startTime: new Date('2026-03-03T09:00:00.000Z'),
		endTime: new Date('2026-03-03T10:00:00.000Z'),
		location: 'Room 2',
		note: 'Second round',
		rating: 2.5,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const candidateInterviewService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return {
		candidateInterviewService,
		resolver: new CandidateInterviewResolver(candidateInterviewService as never)
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

/** The reads and writes the sitting itself contributes, by name. */
const OWNED_QUERY_FIELDS = ['candidateInterview', 'candidateInterviewCount', 'candidateInterviews'];

/** The mutations the sitting contributes, by name. */
const OWNED_MUTATION_FIELDS = [
	'createCandidateInterview',
	'deleteCandidateInterview',
	'recoverCandidateInterview',
	'softDeleteCandidateInterview',
	'updateCandidateInterview'
];

/** The root fields of this resource, as they are actually declared. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned = operation === 'Query' ? OWNED_QUERY_FIELDS : OWNED_MUTATION_FIELDS;

	return rootFields(operation)
		.filter((field) => owned.includes(field))
		.sort();
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof CandidateInterviewController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof CandidateInterviewController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under: the controller's chain, then the handler's own. */
function guardsOfRoute(controller: typeof CandidateInterviewController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof CandidateInterviewResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(CandidateInterviewResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, CandidateInterviewResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', CandidateInterviewResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(CandidateInterviewResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/**
 * One field and the route it mirrors.
 *
 * The paginated spelling of the list is deliberately absent, and so is the candidate-scoped read: both
 * are the list with a narrowing the connection states itself — a page, and a `candidateId` filter.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'candidateInterviews', route: 'findAll' },
	{ field: 'candidateInterview', route: 'findById' },
	{ field: 'candidateInterviewCount', route: 'getCount' },
	{ field: 'createCandidateInterview', route: 'create' },
	{ field: 'updateCandidateInterview', route: 'update' },
	{ field: 'deleteCandidateInterview', route: 'delete' },
	{ field: 'softDeleteCandidateInterview', route: 'softRemove' },
	{ field: 'recoverCandidateInterview', route: 'softRecover' }
];

describe('CandidateInterviewResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(ownedRootFields('Query')).toEqual([
			'candidateInterview',
			'candidateInterviewCount',
			'candidateInterviews'
		]);
	});

	it('declares one mutation per delivered write route', () => {
		expect(ownedRootFields('Mutation')).toEqual([
			'createCandidateInterview',
			'deleteCandidateInterview',
			'recoverCandidateInterview',
			'softDeleteCandidateInterview',
			'updateCandidateInterview'
		]);
	});

	it('declares the connection, its edges, its filter and its sort', () => {
		expect(printed).toMatch(
			/type CandidateInterviewConnection \{\s*nodes: \[CandidateInterview!\]!\s*edges: \[CandidateInterviewEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type CandidateInterviewEdge \{\s*node: CandidateInterview!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input CandidateInterviewFilter \{/);
		expect(printed).toMatch(
			/enum CandidateInterviewSortField \{\s*createdAt\s*updatedAt\s*title\s*startTime\s*endTime\s*rating\s*\}/
		);
	});

	it('answers the count through a nullable field of its own, with no argument', () => {
		expect(fieldType('Query', 'candidateInterviewCount')).toBe('Int');
		expect(fieldArgs('Query', 'candidateInterviewCount')).toEqual([]);
	});
});

describe('CandidateInterviewResolver — which members the surface exposes, and which it refuses', () => {
	it('carries the columns the delivered answer carries, with the average as an exact decimal', () => {
		const body = typeBody('CandidateInterview');

		expect(body).toMatch(/id: ID!/);
		expect(body).toMatch(/title: String!/);
		expect(body).toMatch(/startTime: DateTime\b/);
		expect(body).toMatch(/endTime: DateTime\b/);
		expect(body).toMatch(/location: String\b/);
		expect(body).toMatch(/note: String\b/);
		expect(body).toMatch(/rating: Decimal\b/);
		expect(body).toMatch(/candidateId: ID\b/);
		expect(body).not.toContain('Float');
	});

	it('carries no collection, because the delivered read of a sitting joins none', () => {
		const body = typeBody('CandidateInterview');

		for (const collection of [
			/\bfeedbacks:/,
			/\binterviewers:/,
			/\btechnologies:/,
			/\bpersonalQualities:/,
			/\bcandidate:/
		] as const) {
			expect(body).not.toMatch(collection);
		}
	});

	it('declares the columns a sitting list may be narrowed by, including the candidacy', () => {
		const body = inputBody('CandidateInterviewFilter');

		expect(body).toMatch(/candidateId: IDFilter/);
		expect(body).toMatch(/startTime: DateTimeFilter/);
		expect(body).toMatch(/rating: DecimalFilter/);
		expect(body).not.toMatch(/\bfeedbacks: /);
	});

	it('states the candidacy as an identifier on the scheduling write, and the average as a member', () => {
		const body = inputBody('CreateCandidateInterviewInput');

		expect(body).toMatch(/candidateId: ID\b/);
		expect(body).toMatch(/title: String!/);
		expect(body).toMatch(/startTime: DateTime!/);
		expect(body).toMatch(/rating: Decimal\b/);
		expect(body).not.toMatch(/\bcandidate: /);
	});
});

describe('CandidateInterviewResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, candidateInterviewService } = surfaces();

		const connection = await resolver.candidateInterviews(undefined, undefined, undefined, 20);

		expect(candidateInterviewService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('narrows by the candidacy, which is the delivered candidate-scoped read as a filter', async () => {
		const { resolver } = surfaces();

		const mine = await resolver.candidateInterviews({ candidateId: { eq: CANDIDATE } });
		expect(mine.nodes).toHaveLength(2);

		const other = await resolver.candidateInterviews({ candidateId: { eq: FIRST } });
		expect(other.nodes).toHaveLength(0);

		const refusal = await resolver.candidateInterviews({ candidate: { eq: CANDIDATE } }).catch((thrown) => thrown);
		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers, and refuses a column it does not', async () => {
		const { resolver } = surfaces();

		const byStart = await resolver.candidateInterviews(undefined, [{ field: 'startTime', direction: 'DESC' }]);
		expect(byStart.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);

		const error = await resolver
			.candidateInterviews(undefined, [{ field: 'location', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.candidateInterviews(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.candidateInterviews(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('caps the page rather than answering every sitting', async () => {
		const { resolver } = surfaces();

		const error = await resolver.candidateInterviews(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('CandidateInterviewResolver — one concept, two protocols, the same operations', () => {
	it('reads one sitting through the same service method the REST route calls', async () => {
		const { resolver, candidateInterviewService } = surfaces();

		expect(await resolver.candidateInterview(FIRST)).toBe(ROWS[0]);
		expect(candidateInterviewService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a sitting that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, candidateInterviewService } = surfaces();
		candidateInterviewService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.candidateInterview(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, candidateInterviewService } = surfaces();

		expect(await resolver.candidateInterviewCount()).toBe(2);
		expect(candidateInterviewService.countBy).toHaveBeenCalledWith();
	});

	it('schedules a sitting through the same service call the scheduling route makes', async () => {
		const { resolver, candidateInterviewService } = surfaces();

		await resolver.createCandidateInterview({
			candidateId: CANDIDATE,
			title: 'Technical screen',
			startTime: new Date('2026-03-02T09:00:00.000Z'),
			endTime: new Date('2026-03-02T10:00:00.000Z')
		});

		expect(candidateInterviewService.create).toHaveBeenCalledWith(
			expect.objectContaining({ candidateId: CANDIDATE, title: 'Technical screen' })
		);
	});

	it('edits a sitting through the same service call, and answers the row the write produced', async () => {
		const { resolver, candidateInterviewService } = surfaces();

		await resolver.updateCandidateInterview({ id: FIRST, title: 'Technical screen (rescheduled)' });

		expect(candidateInterviewService.update).toHaveBeenCalledWith(FIRST, {
			title: 'Technical screen (rescheduled)'
		});
		// The delivered edit answers the store's own update result, which is not a row: the field reads
		// the row back through the same reader the node field uses.
		expect(candidateInterviewService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('removes a sitting through the same service method the removal route calls', async () => {
		const { resolver, candidateInterviewService } = surfaces();

		expect(await resolver.deleteCandidateInterview(FIRST)).toBe(true);
		expect(candidateInterviewService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores a sitting through the same two service methods', async () => {
		const { resolver, candidateInterviewService } = surfaces();

		const withdrawn = await resolver.softDeleteCandidateInterview(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(candidateInterviewService.softRemove).toHaveBeenCalledWith(FIRST);

		expect(await resolver.recoverCandidateInterview(FIRST)).toBe(ROWS[0]);
		expect(candidateInterviewService.softRecover).toHaveBeenCalledWith(FIRST);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, candidateInterviewService } = surfaces();
		const refusal = new Error('CANDIDATE_INTERVIEW_PANELLED: this sitting already has a panel.');

		candidateInterviewService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteCandidateInterview(FIRST)).rejects.toBe(refusal);
	});
});

describe('CandidateInterviewResolver — the guard stack and the permission are the controller’s, field by field', () => {
	it('states on the class the guards and the permission the controller states on its class', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', CandidateInterviewController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', CandidateInterviewResolver) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard])
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CandidateInterviewResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, CandidateInterviewController)
		);
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		expect(typeof handlersOf(CandidateInterviewController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which no route carries because it is not a
		// scope: every other guard of the field's chain still has to be its own route's.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(CandidateInterviewController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(CandidateInterviewController, route));
	});

	it('states the edit permission on every field, and never the interview view permission', () => {
		// The controller states no permission on any of its eight handlers, so all eight routes run under
		// the class-level edit permission. The interview *view* permission is carried by the
		// criterion-rating controller, which is a different resource: stating it here would give GraphQL a
		// scope no route of this resource has.
		for (const field of OWNED_QUERY_FIELDS.concat(OWNED_MUTATION_FIELDS)) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT]);
		}

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(CandidateInterviewController)['findAll'])).toBeUndefined();
		expect(permissionOfField('candidateInterviews')).not.toEqual([
			PermissionsEnum.ORG_CANDIDATES_INTERVIEW_VIEW
		]);
	});
});

describe('CandidateInterviewModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, CandidateInterviewModule) ?? []) as unknown[];

		expect(providers).toContain(CandidateInterviewResolver);
		expect(providers).toContain(CandidateInterviewService);
	});

	it('imports the two modules the vocabulary resolver’s services come from', () => {
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, CandidateInterviewModule) ?? []) as unknown[];
		const names = imports.map((entry) => (entry as { name?: string })?.name);

		expect(names).toEqual(
			expect.arrayContaining(['CandidateTechnologiesModule', 'CandidatePersonalQualitiesModule'])
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
		getHandler: () => (CandidateInterviewResolver.prototype as never)[field],
		getClass: () => CandidateInterviewResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('CandidateInterviewResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, CandidateInterviewResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', CandidateInterviewResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('candidateInterviews')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('candidateInterviews');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('candidateInterviews'))).resolves.toBe(true);
	});
});
