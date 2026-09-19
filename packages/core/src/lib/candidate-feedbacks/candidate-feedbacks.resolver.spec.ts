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
import { CandidateFeedbacksController } from './candidate-feedbacks.controller';
import { CandidateFeedbacksModule } from './candidate-feedbacks.module';
import { CandidateFeedbacksResolver } from './candidate-feedbacks.resolver';
import { CandidateFeedbacksService } from './candidate-feedbacks.service';
import { FeedbackDeleteCommand, FeedbackUpdateCommand } from './commands';

/**
 * The panel's verdict over GraphQL.
 *
 * The delivered REST routes serve a list, one verdict, a count, a filing, an edit, the plain removal and
 * the interview-scoped removal that recomputes the sitting's average. This suite pins the half of the
 * two-protocol doctrine that is easy to get quietly wrong for the one resource in this domain whose
 * controller carries no permission on its class:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it;
 * - **the guard chain is the controller's and it is the shortest in this domain**: the tenant guard on
 *   the class and nothing else, which means most fields state no permission at all, and the four whose
 *   routes state the permission guard and the feedback edit permission state exactly those;
 * - the delivered list method is the route's own, read with the route's own defaults;
 * - the two removals are two fields, because they leave the platform in two different states.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CANDIDATE = '00000000-0000-4000-8000-000000000003';
const INTERVIEW = '00000000-0000-4000-8000-000000000004';
const INTERVIEWER = '00000000-0000-4000-8000-000000000005';
const FIRST = '00000000-0000-4000-8000-000000000070';
const SECOND = '00000000-0000-4000-8000-000000000071';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		candidateId: CANDIDATE,
		interviewId: INTERVIEW,
		interviewerId: INTERVIEWER,
		description: 'Strong on the fundamentals',
		rating: 4.5,
		status: 'APPLIED',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		candidateId: CANDIDATE,
		interviewId: INTERVIEW,
		interviewerId: INTERVIEWER,
		description: 'Would not hire',
		rating: 1.5,
		status: 'REJECTED',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const candidateFeedbacksService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		candidateFeedbacksService,
		commandBus,
		resolver: new CandidateFeedbacksResolver(candidateFeedbacksService as never, commandBus as never)
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

/** The reads and writes the verdict itself contributes, by name. */
const OWNED_QUERY_FIELDS = ['candidateFeedback', 'candidateFeedbackCount', 'candidateFeedbacks'];

/** The mutations the verdict contributes, by name. */
const OWNED_MUTATION_FIELDS = [
	'createCandidateFeedback',
	'deleteCandidateFeedback',
	'deleteCandidateFeedbackByInterview',
	'recoverCandidateFeedback',
	'softDeleteCandidateFeedback',
	'updateCandidateFeedback'
];

/** The root fields of this resource, as they are actually declared. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned = operation === 'Query' ? OWNED_QUERY_FIELDS : OWNED_MUTATION_FIELDS;

	return rootFields(operation)
		.filter((field) => owned.includes(field))
		.sort();
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof CandidateFeedbacksController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file. For this resource the answer is
 * `undefined` on most routes, which is a statement and not a gap: the controller states no permission
 * there, and neither may the field.
 */
function permissionOfRoute(controller: typeof CandidateFeedbacksController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under: the controller's chain, then the handler's own. */
function guardsOfRoute(controller: typeof CandidateFeedbacksController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof CandidateFeedbacksResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(CandidateFeedbacksResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, CandidateFeedbacksResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', CandidateFeedbacksResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(CandidateFeedbacksResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/**
 * One field and the route it mirrors.
 *
 * The paginated spelling of the list is deliberately absent: it is the same read with a page size, and
 * the connection states the page itself. The interview-scoped read has no field of its own either — it
 * is the list narrowed by a column the row carries — while the interview-scoped *removal* has one,
 * because it is a different operation.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'candidateFeedbacks', route: 'findAll' },
	{ field: 'candidateFeedback', route: 'findById' },
	{ field: 'candidateFeedbackCount', route: 'getCount' },
	{ field: 'createCandidateFeedback', route: 'create' },
	{ field: 'updateCandidateFeedback', route: 'update' },
	{ field: 'deleteCandidateFeedbackByInterview', route: 'deleteFeedback' },
	{ field: 'deleteCandidateFeedback', route: 'delete' },
	{ field: 'softDeleteCandidateFeedback', route: 'softRemove' },
	{ field: 'recoverCandidateFeedback', route: 'softRecover' }
];

describe('CandidateFeedbacksResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(ownedRootFields('Query')).toEqual(['candidateFeedback', 'candidateFeedbackCount', 'candidateFeedbacks']);
	});

	it('declares one mutation per delivered write route', () => {
		expect(ownedRootFields('Mutation')).toEqual([
			'createCandidateFeedback',
			'deleteCandidateFeedback',
			'deleteCandidateFeedbackByInterview',
			'recoverCandidateFeedback',
			'softDeleteCandidateFeedback',
			'updateCandidateFeedback'
		]);
	});

	it('declares the connection, its edges, its filter and its sort', () => {
		expect(printed).toMatch(
			/type CandidateFeedbackConnection \{\s*nodes: \[CandidateFeedback!\]!\s*edges: \[CandidateFeedbackEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type CandidateFeedbackEdge \{\s*node: CandidateFeedback!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input CandidateFeedbackFilter \{/);
		expect(printed).toMatch(
			/enum CandidateFeedbackSortField \{\s*createdAt\s*updatedAt\s*rating\s*status\s*\}/
		);
	});

	it('answers the count through a nullable field of its own, with no argument', () => {
		expect(fieldType('Query', 'candidateFeedbackCount')).toBe('Int');
		expect(fieldArgs('Query', 'candidateFeedbackCount')).toEqual([]);
	});

	it('states the two removals as two fields, because they leave the sitting in two states', () => {
		// `DELETE /:id` is the inherited plain removal and `DELETE /interview/:interviewId/:feedbackId`
		// recomputes the sitting's average from the verdicts that remain. A client that could not tell
		// them apart could not tell whether a sitting's rating still describes its panel.
		expect(fieldType('Mutation', 'deleteCandidateFeedback')).toBe('Boolean!');
		expect(fieldType('Mutation', 'deleteCandidateFeedbackByInterview')).toBe('Boolean!');
		expect(fieldArgs('Mutation', 'deleteCandidateFeedbackByInterview')).toEqual(['interviewId', 'feedbackId']);
	});
});

describe('CandidateFeedbacksResolver — which members the surface exposes, and which it refuses', () => {
	it('carries the columns the delivered answer carries, with the rating as an exact decimal', () => {
		const body = typeBody('CandidateFeedback');

		expect(body).toMatch(/id: ID!/);
		expect(body).toMatch(/description: String\b/);
		expect(body).toMatch(/rating: Decimal\b/);
		expect(body).toMatch(/status: String\b/);
		expect(body).not.toContain('Float');
	});

	it('carries the three relations as identifiers, and no relation object', () => {
		const body = typeBody('CandidateFeedback');

		expect(body).toMatch(/candidateId: ID\b/);
		expect(body).toMatch(/interviewId: ID\b/);
		expect(body).toMatch(/interviewerId: ID\b/);

		for (const relation of [/\bcandidate:/, /\binterview:/, /\binterviewer:/, /\bcriterionsRating:/] as const) {
			expect(body).not.toMatch(relation);
		}
	});

	it('declares the columns a verdict list may be narrowed by, including the two parent axes', () => {
		const body = inputBody('CandidateFeedbackFilter');

		expect(body).toMatch(/interviewId: IDFilter/);
		expect(body).toMatch(/candidateId: IDFilter/);
		expect(body).toMatch(/interviewerId: IDFilter/);
		expect(body).toMatch(/rating: DecimalFilter/);
		expect(body).toMatch(/status: StringFilter/);
	});

	it('states the nested seating the delivered handler reads beside the identifier the row stores', () => {
		// The delivered edit does not read the verdict's own interview column: it reads the sitting out of
		// the nested panel seat the REST body carries, and recomputes that sitting's average. A field that
		// stated only the seat would silently leave the average stale.
		const body = inputBody('UpdateCandidateFeedbackInput');

		expect(body).toMatch(/interviewerId: ID\b/);
		expect(body).toMatch(/interviewId: ID\b/);
		expect(body).not.toMatch(/\binterviewer:/);
	});
});

describe('CandidateFeedbacksResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, candidateFeedbacksService } = surfaces();

		const connection = await resolver.candidateFeedbacks(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults: that route
		// hands the service the `where` and `relations` members of its `data` parameter, and a caller
		// that states neither hands it neither.
		expect(candidateFeedbacksService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('narrows by the sitting, which is the delivered interview-scoped read as a filter', async () => {
		const { resolver } = surfaces();

		const mine = await resolver.candidateFeedbacks({ interviewId: { eq: INTERVIEW } });
		expect(mine.nodes).toHaveLength(2);

		const other = await resolver.candidateFeedbacks({ interviewId: { eq: CANDIDATE } });
		expect(other.nodes).toHaveLength(0);

		const refusal = await resolver.candidateFeedbacks({ interviewer: { eq: INTERVIEWER } }).catch((thrown) => thrown);
		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers, and refuses a column it does not', async () => {
		const { resolver } = surfaces();

		const byRating = await resolver.candidateFeedbacks(undefined, [{ field: 'rating', direction: 'ASC' }]);
		expect(byRating.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);

		const error = await resolver
			.candidateFeedbacks(undefined, [{ field: 'interviewerId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.candidateFeedbacks(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.candidateFeedbacks(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('caps the page rather than answering every verdict', async () => {
		const { resolver } = surfaces();

		const error = await resolver.candidateFeedbacks(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('CandidateFeedbacksResolver — one concept, two protocols, the same operations', () => {
	it('reads one verdict through the same service method the REST route calls', async () => {
		const { resolver, candidateFeedbacksService } = surfaces();

		expect(await resolver.candidateFeedback(FIRST)).toBe(ROWS[0]);
		expect(candidateFeedbacksService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a verdict that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, candidateFeedbacksService } = surfaces();
		candidateFeedbacksService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.candidateFeedback(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, candidateFeedbacksService } = surfaces();

		expect(await resolver.candidateFeedbackCount()).toBe(2);
		expect(candidateFeedbacksService.countBy).toHaveBeenCalledWith();
	});

	it('files a verdict through the same service call the filing route makes', async () => {
		const { resolver, candidateFeedbacksService } = surfaces();

		await resolver.createCandidateFeedback({
			candidateId: CANDIDATE,
			interviewId: INTERVIEW,
			interviewerId: INTERVIEWER,
			rating: 5,
			description: 'Hire'
		});

		expect(candidateFeedbacksService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				candidateId: CANDIDATE,
				interviewId: INTERVIEW,
				interviewerId: INTERVIEWER,
				rating: 5
			})
		);
	});

	it('edits a verdict through the command the edit route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateCandidateFeedback({ id: FIRST, rating: 2, interviewId: INTERVIEW });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(FeedbackUpdateCommand);
		expect(command.id).toBe(FIRST);
		expect(command.entity).toEqual(
			expect.objectContaining({ rating: 2, interviewer: { interviewId: INTERVIEW } })
		);
	});

	it('removes a verdict through the same service method the plain removal route calls', async () => {
		const { resolver, candidateFeedbacksService } = surfaces();

		expect(await resolver.deleteCandidateFeedback(FIRST)).toBe(true);
		expect(candidateFeedbacksService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('removes a verdict from a sitting through the command the scoped removal dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteCandidateFeedbackByInterview(INTERVIEW, FIRST)).toBe(true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(FeedbackDeleteCommand);
		expect(command.feedbackId).toBe(FIRST);
		expect(command.interviewId).toBe(INTERVIEW);
	});

	it('withdraws and restores a verdict through the same two service methods', async () => {
		const { resolver, candidateFeedbacksService } = surfaces();

		const withdrawn = await resolver.softDeleteCandidateFeedback(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(candidateFeedbacksService.softRemove).toHaveBeenCalledWith(FIRST);

		expect(await resolver.recoverCandidateFeedback(FIRST)).toBe(ROWS[0]);
		expect(candidateFeedbacksService.softRecover).toHaveBeenCalledWith(FIRST);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('CANDIDATE_FEEDBACK_SEAT_TAKEN: this panel seat already filed a verdict.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.updateCandidateFeedback({ id: FIRST })).rejects.toBe(refusal);
	});
});

describe('CandidateFeedbacksResolver — the guard stack and the permission are the route’s, field by field', () => {
	it('states on the class the one guard the controller states on its class, and no permission', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', CandidateFeedbacksController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', CandidateFeedbacksResolver) ?? [];

		// This controller is the one resource in the domain whose class carries the tenant guard alone:
		// there is no permission guard in its chain and no permission on its class, so a class-level
		// permission here would be a scope no route of this resource has.
		expect(controllerGuards).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CandidateFeedbacksController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CandidateFeedbacksResolver)).toBeUndefined();
		expect(resolverGuards).toEqual([TenantPermissionGuard, FeatureFlagGuard]);
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		expect(typeof handlersOf(CandidateFeedbacksController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which no route carries because it is not a
		// scope: every other guard of the field's chain still has to be its own route's.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(CandidateFeedbacksController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(CandidateFeedbacksController, route));
	});

	it('states the feedback edit permission on the four fields whose routes state it, and nothing elsewhere', () => {
		for (const field of [
			'createCandidateFeedback',
			'updateCandidateFeedback',
			'deleteCandidateFeedbackByInterview'
		]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT]);
		}

		// The interview-scoped read states the permission guard and no permission — the delivered
		// decorator is commented out in the controller — so the field states none either: the guard's
		// own rule is that an absent list authorizes.
		expect(
			Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(CandidateFeedbacksController)['findByInterviewId'])
		).toBeUndefined();
		expect(permissionOfField('candidateFeedbacks')).toBeUndefined();
		expect(permissionOfField('candidateFeedback')).toBeUndefined();
		expect(permissionOfField('candidateFeedbackCount')).toBeUndefined();
		expect(permissionOfField('deleteCandidateFeedback')).toBeUndefined();
		expect(permissionOfField('softDeleteCandidateFeedback')).toBeUndefined();
		expect(permissionOfField('recoverCandidateFeedback')).toBeUndefined();
	});

	it('restates the permission guard only on the four fields whose routes carry it', () => {
		const withPermissionGuard = [
			'createCandidateFeedback',
			'updateCandidateFeedback',
			'deleteCandidateFeedbackByInterview'
		];

		for (const field of withPermissionGuard) {
			expect(guardsOfField(field)).toContain(PermissionGuard);
		}

		for (const field of [
			'candidateFeedbacks',
			'candidateFeedback',
			'candidateFeedbackCount',
			'deleteCandidateFeedback',
			'softDeleteCandidateFeedback',
			'recoverCandidateFeedback'
		]) {
			expect(guardsOfField(field)).not.toContain(PermissionGuard);
		}
	});
});

describe('CandidateFeedbacksModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, CandidateFeedbacksModule) ?? []) as unknown[];

		expect(providers).toContain(CandidateFeedbacksResolver);
		expect(providers).toContain(CandidateFeedbacksService);
	});

	it('re-exports the command bus the two write fields dispatch through', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, CandidateFeedbacksModule) ?? []) as unknown[];

		expect(exported).toContain(CandidateFeedbacksService);
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
		getHandler: () => (CandidateFeedbacksResolver.prototype as never)[field],
		getClass: () => CandidateFeedbacksResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('CandidateFeedbacksResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, CandidateFeedbacksResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', CandidateFeedbacksResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('candidateFeedbacks')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('candidateFeedbacks');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('candidateFeedbacks'))).resolves.toBe(true);
	});
});
