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
import { CandidateCriterionsRatingController } from './candidate-criterion-rating.controller';
import { CandidateCriterionsRatingModule } from './candidate-criterion-rating.module';
import { CandidateCriterionsRatingResolver } from './candidate-criterion-rating.resolver';
import { CandidateCriterionsRatingService } from './candidate-criterion-rating.service';
import {
	CandidateCriterionsRatingBulkCreateCommand,
	CandidateCriterionsRatingBulkDeleteCommand,
	CandidateCriterionsRatingBulkUpdateCommand
} from './commands';

/**
 * The criterion a verdict rated, over GraphQL.
 *
 * The delivered REST routes serve a list, one criterion, a count, the filing, the edit, the three
 * lifecycle routes and the three bulk operations the assessment screen reaches. This suite pins the half
 * of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it;
 * - **the guard chain is the controller's and the two permissions are the interview ones**: the list runs
 *   under the interview *view* permission, everything else under the class-level interview *edit*
 *   permission, and no field ever states the candidate view permission — that is another resource's
 *   vocabulary;
 * - **the rating's scale is stated**: this column is an `integer`, so the member is `Int!` while every
 *   other rating in this domain is the exact decimal its `numeric` column holds;
 * - the verdict-scoped removal and the two bulk writes are fields of their own, because none is a
 *   narrowing of the list.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const FEEDBACK = '00000000-0000-4000-8000-000000000007';
const TECHNOLOGY = '00000000-0000-4000-8000-000000000008';
const QUALITY = '00000000-0000-4000-8000-000000000009';
const FIRST = '00000000-0000-4000-8000-0000000000b0';
const SECOND = '00000000-0000-4000-8000-0000000000b1';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		feedbackId: FEEDBACK,
		technologyId: TECHNOLOGY,
		personalQualityId: null,
		rating: 4,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		feedbackId: FEEDBACK,
		technologyId: null,
		personalQualityId: QUALITY,
		rating: 2,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const candidateCriterionsRatingService = {
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
		candidateCriterionsRatingService,
		commandBus,
		resolver: new CandidateCriterionsRatingResolver(
			candidateCriterionsRatingService as never,
			commandBus as never
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

/** The reads and writes the criterion rating itself contributes, by name. */
const OWNED_QUERY_FIELDS = [
	'candidateCriterionsRating',
	'candidateCriterionsRatingCount',
	'candidateCriterionsRatings'
];

/** The mutations the criterion rating contributes, by name. */
const OWNED_MUTATION_FIELDS = [
	'createCandidateCriterionsRating',
	'createCandidateCriterionsRatingsBulk',
	'deleteCandidateCriterionsRating',
	'deleteCandidateCriterionsRatingsByFeedback',
	'recoverCandidateCriterionsRating',
	'softDeleteCandidateCriterionsRating',
	'updateCandidateCriterionsRating',
	'updateCandidateCriterionsRatingsBulk'
];

/** The root fields of this resource, as they are actually declared. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned = operation === 'Query' ? OWNED_QUERY_FIELDS : OWNED_MUTATION_FIELDS;

	return rootFields(operation)
		.filter((field) => owned.includes(field))
		.sort();
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof CandidateCriterionsRatingController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof CandidateCriterionsRatingController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under: the controller's chain, then the handler's own. */
function guardsOfRoute(controller: typeof CandidateCriterionsRatingController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof CandidateCriterionsRatingResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(CandidateCriterionsRatingResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, CandidateCriterionsRatingResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', CandidateCriterionsRatingResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(CandidateCriterionsRatingResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/**
 * One field and the route it mirrors.
 *
 * The paginated spelling of the list is deliberately absent: it is the same read with a page size, and
 * the connection states the page itself.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'candidateCriterionsRatings', route: 'findAll' },
	{ field: 'candidateCriterionsRating', route: 'findById' },
	{ field: 'candidateCriterionsRatingCount', route: 'getCount' },
	{ field: 'createCandidateCriterionsRating', route: 'create' },
	{ field: 'updateCandidateCriterionsRating', route: 'update' },
	{ field: 'deleteCandidateCriterionsRating', route: 'delete' },
	{ field: 'softDeleteCandidateCriterionsRating', route: 'softRemove' },
	{ field: 'recoverCandidateCriterionsRating', route: 'softRecover' },
	{ field: 'createCandidateCriterionsRatingsBulk', route: 'createBulk' },
	{ field: 'updateCandidateCriterionsRatingsBulk', route: 'updateBulk' },
	{ field: 'deleteCandidateCriterionsRatingsByFeedback', route: 'deleteBulkByFeedbackId' }
];

describe('CandidateCriterionsRatingResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(ownedRootFields('Query')).toEqual([
			'candidateCriterionsRating',
			'candidateCriterionsRatingCount',
			'candidateCriterionsRatings'
		]);
	});

	it('declares one mutation per delivered write route', () => {
		expect(ownedRootFields('Mutation')).toEqual([
			'createCandidateCriterionsRating',
			'createCandidateCriterionsRatingsBulk',
			'deleteCandidateCriterionsRating',
			'deleteCandidateCriterionsRatingsByFeedback',
			'recoverCandidateCriterionsRating',
			'softDeleteCandidateCriterionsRating',
			'updateCandidateCriterionsRating',
			'updateCandidateCriterionsRatingsBulk'
		]);
	});

	it('declares the connection, its edges, its filter and its sort', () => {
		expect(printed).toMatch(
			/type CandidateCriterionsRatingConnection \{\s*nodes: \[CandidateCriterionsRating!\]!\s*edges: \[CandidateCriterionsRatingEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(
			/type CandidateCriterionsRatingEdge \{\s*node: CandidateCriterionsRating!\s*cursor: String!\s*\}/
		);
		expect(printed).toMatch(/input CandidateCriterionsRatingFilter \{/);
		expect(printed).toMatch(/enum CandidateCriterionsRatingSortField \{\s*createdAt\s*updatedAt\s*rating\s*\}/);
	});

	it('answers the count through a nullable field of its own, with no argument', () => {
		expect(fieldType('Query', 'candidateCriterionsRatingCount')).toBe('Int');
		expect(fieldArgs('Query', 'candidateCriterionsRatingCount')).toEqual([]);
	});

	it('states the three bulk operations as the fields the assessment screen reaches', () => {
		expect(fieldType('Mutation', 'createCandidateCriterionsRatingsBulk')).toBe(
			'[CandidateCriterionsRating!]!'
		);
		expect(fieldType('Mutation', 'updateCandidateCriterionsRatingsBulk')).toBe(
			'[CandidateCriterionsRating!]!'
		);
		expect(fieldType('Mutation', 'deleteCandidateCriterionsRatingsByFeedback')).toBe('Boolean!');
		expect(fieldArgs('Mutation', 'deleteCandidateCriterionsRatingsByFeedback')).toEqual(['feedbackId']);
	});
});

describe('CandidateCriterionsRatingResolver — which members the surface exposes, and which it refuses', () => {
	it('states the rating’s scale, which is a whole number on an integer column', () => {
		const body = typeBody('CandidateCriterionsRating');

		expect(body).toMatch(/id: ID!/);
		// Every other rating in this domain is the exact decimal its `numeric` column holds; this one is
		// an `integer`, and the schema says so rather than claiming a scale the column does not have.
		expect(body).toMatch(/rating: Int!/);
		expect(body).not.toContain('Float');
		expect(body).not.toContain('Decimal');
	});

	it('carries the three relations as identifiers, and no relation object', () => {
		const body = typeBody('CandidateCriterionsRating');

		expect(body).toMatch(/technologyId: ID\b/);
		expect(body).toMatch(/personalQualityId: ID\b/);
		expect(body).toMatch(/feedbackId: ID\b/);

		for (const relation of [/\btechnology:/, /\bpersonalQuality:/, /\bfeedback:/] as const) {
			expect(body).not.toMatch(relation);
		}
	});

	it('declares the columns a criterion list may be narrowed by, including the verdict', () => {
		const body = inputBody('CandidateCriterionsRatingFilter');

		expect(body).toMatch(/feedbackId: IDFilter/);
		expect(body).toMatch(/technologyId: IDFilter/);
		expect(body).toMatch(/personalQualityId: IDFilter/);
		// The number is filtered as a whole number for the same reason the member is an `Int`.
		expect(body).toMatch(/rating: NumberFilter/);
	});

	it('states the two things a sitting is assessed on as two members of the bulk filing', () => {
		const technologies = inputBody('CandidateTechnologyRatingBulkInput');
		const qualities = inputBody('CandidatePersonalQualityRatingBulkInput');

		expect(technologies).toMatch(/technologyId: ID!/);
		expect(technologies).toMatch(/rating: Int!/);
		expect(qualities).toMatch(/personalQualityId: ID!/);
		expect(qualities).toMatch(/rating: Int!/);

		const bulk = inputBody('CreateCandidateCriterionsRatingsBulkInput');
		expect(bulk).toMatch(/feedbackId: ID!/);
		expect(bulk).toMatch(/technologies: \[CandidateTechnologyRatingBulkInput!\]/);
		expect(bulk).toMatch(/qualities: \[CandidatePersonalQualityRatingBulkInput!\]/);
	});

	it('states the numbers a bulk update writes beside the rows they belong to', () => {
		const body = inputBody('UpdateCandidateCriterionsRatingsBulkInput');

		expect(body).toMatch(/criterionsRating: \[UpdateCandidateCriterionsRatingInput!\]!/);
		expect(body).toMatch(/technologies: \[Int!\]/);
		expect(body).toMatch(/personalQualities: \[Int!\]/);
	});
});

describe('CandidateCriterionsRatingResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, candidateCriterionsRatingService } = surfaces();

		const connection = await resolver.candidateCriterionsRatings(undefined, undefined, undefined, 20);

		expect(candidateCriterionsRatingService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('narrows by the verdict, which is the delivered verdict-scoped removal’s own axis', async () => {
		const { resolver } = surfaces();

		const mine = await resolver.candidateCriterionsRatings({ feedbackId: { eq: FEEDBACK } });
		expect(mine.nodes).toHaveLength(2);

		const other = await resolver.candidateCriterionsRatings({ feedbackId: { eq: TECHNOLOGY } });
		expect(other.nodes).toHaveLength(0);

		const refusal = await resolver
			.candidateCriterionsRatings({ feedback: { eq: FEEDBACK } })
			.catch((thrown) => thrown);
		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers, and refuses a column it does not', async () => {
		const { resolver } = surfaces();

		const byRating = await resolver.candidateCriterionsRatings(undefined, [{ field: 'rating', direction: 'ASC' }]);
		expect(byRating.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);

		const error = await resolver
			.candidateCriterionsRatings(undefined, [{ field: 'feedbackId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.candidateCriterionsRatings(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.candidateCriterionsRatings(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('caps the page rather than answering every criterion', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.candidateCriterionsRatings(undefined, undefined, undefined, 500)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('CandidateCriterionsRatingResolver — one concept, two protocols, the same operations', () => {
	it('reads one criterion through the same service method the REST route calls', async () => {
		const { resolver, candidateCriterionsRatingService } = surfaces();

		expect(await resolver.candidateCriterionsRating(FIRST)).toBe(ROWS[0]);
		expect(candidateCriterionsRatingService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a criterion that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, candidateCriterionsRatingService } = surfaces();
		candidateCriterionsRatingService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.candidateCriterionsRating(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, candidateCriterionsRatingService } = surfaces();

		expect(await resolver.candidateCriterionsRatingCount()).toBe(2);
		expect(candidateCriterionsRatingService.countBy).toHaveBeenCalledWith();
	});

	it('files one criterion through the same service call the filing route makes', async () => {
		const { resolver, candidateCriterionsRatingService } = surfaces();

		await resolver.createCandidateCriterionsRating({
			feedbackId: FEEDBACK,
			technologyId: TECHNOLOGY,
			rating: 4
		});

		expect(candidateCriterionsRatingService.create).toHaveBeenCalledWith({
			feedbackId: FEEDBACK,
			technologyId: TECHNOLOGY,
			rating: 4
		});
	});

	it('edits one criterion through the same service call, and answers the row the write produced', async () => {
		const { resolver, candidateCriterionsRatingService } = surfaces();

		await resolver.updateCandidateCriterionsRating({ id: FIRST, rating: 5 });

		expect(candidateCriterionsRatingService.update).toHaveBeenCalledWith(FIRST, { rating: 5 });
		expect(candidateCriterionsRatingService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('removes one criterion through the same service method the removal route calls', async () => {
		const { resolver, candidateCriterionsRatingService } = surfaces();

		expect(await resolver.deleteCandidateCriterionsRating(FIRST)).toBe(true);
		expect(candidateCriterionsRatingService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores one criterion through the same two service methods', async () => {
		const { resolver, candidateCriterionsRatingService } = surfaces();

		const withdrawn = await resolver.softDeleteCandidateCriterionsRating(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(candidateCriterionsRatingService.softRemove).toHaveBeenCalledWith(FIRST);

		expect(await resolver.recoverCandidateCriterionsRating(FIRST)).toBe(ROWS[0]);
		expect(candidateCriterionsRatingService.softRecover).toHaveBeenCalledWith(FIRST);
	});

	it('files a whole verdict’s criteria through the command the bulk route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createCandidateCriterionsRatingsBulk({
			feedbackId: FEEDBACK,
			technologies: [{ technologyId: TECHNOLOGY, rating: 4 }],
			qualities: [{ personalQualityId: QUALITY, rating: 2 }]
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CandidateCriterionsRatingBulkCreateCommand);
		expect(command.feedbackId).toBe(FEEDBACK);
		// The delivered handler reads an item's identifier, its rating and its organization, so the field
		// hands it the same shape the REST body's rows are read into.
		expect(command.technologies).toEqual([{ id: TECHNOLOGY, rating: 4, organizationId: undefined }]);
		expect(command.qualities).toEqual([{ id: QUALITY, rating: 2, organizationId: undefined }]);
	});

	it('re-rates a whole verdict’s criteria through the command the bulk update dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateCandidateCriterionsRatingsBulk({
			criterionsRating: [{ id: FIRST, technologyId: TECHNOLOGY }],
			technologies: [5],
			personalQualities: []
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CandidateCriterionsRatingBulkUpdateCommand);
		// The delivered handler pairs each number with a row by position, so the two lists travel beside
		// each other exactly as the delivered body states them.
		expect(command.data.technologies).toEqual([5]);
		expect(command.data.personalQualities).toEqual([]);
		expect(command.data.criterionsRating).toEqual([{ id: FIRST, technologyId: TECHNOLOGY }]);
	});

	it('removes a whole verdict’s criteria through the command the scoped removal dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteCandidateCriterionsRatingsByFeedback(FEEDBACK)).toBe(true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CandidateCriterionsRatingBulkDeleteCommand);
		expect(command.id).toBe(FEEDBACK);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('CANDIDATE_CRITERION_ORPHANED: a rating needs a technology or a quality.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(
			resolver.createCandidateCriterionsRatingsBulk({ feedbackId: FEEDBACK, technologies: [] })
		).rejects.toBe(refusal);
	});
});

describe('CandidateCriterionsRatingResolver — the guard stack and the permissions are the controller’s', () => {
	it('states on the class the guards and the permission the controller states on its class', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', CandidateCriterionsRatingController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', CandidateCriterionsRatingResolver) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard])
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CandidateCriterionsRatingResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, CandidateCriterionsRatingController)
		);
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		expect(typeof handlersOf(CandidateCriterionsRatingController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which no route carries because it is not a
		// scope: every other guard of the field's chain still has to be its own route's.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(CandidateCriterionsRatingController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(CandidateCriterionsRatingController, route));
	});

	it('states the interview view permission on the list and the interview edit one everywhere else', () => {
		expect(permissionOfField('candidateCriterionsRatings')).toEqual([
			PermissionsEnum.ORG_CANDIDATES_INTERVIEW_VIEW
		]);

		for (const field of OWNED_MUTATION_FIELDS.concat([
			'candidateCriterionsRating',
			'candidateCriterionsRatingCount'
		])) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT]);
		}

		// The candidate view permission is another resource's vocabulary, and no route of this controller
		// states it: a field that did would give GraphQL a scope REST does not have.
		expect(permissionOfField('candidateCriterionsRatings')).not.toEqual([PermissionsEnum.ORG_CANDIDATES_VIEW]);
	});
});

describe('CandidateCriterionsRatingModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, CandidateCriterionsRatingModule) ??
			[]) as unknown[];

		expect(providers).toContain(CandidateCriterionsRatingResolver);
		expect(providers).toContain(CandidateCriterionsRatingService);
	});

	it('re-exports the command bus the three bulk fields dispatch through', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, CandidateCriterionsRatingModule) ??
			[]) as unknown[];

		expect(exported).toContain(CandidateCriterionsRatingService);
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
		getHandler: () => (CandidateCriterionsRatingResolver.prototype as never)[field],
		getClass: () => CandidateCriterionsRatingResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('CandidateCriterionsRatingResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, CandidateCriterionsRatingResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', CandidateCriterionsRatingResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('candidateCriterionsRatings'))
			.catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('candidateCriterionsRatings');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('candidateCriterionsRatings'))).resolves.toBe(true);
	});
});
