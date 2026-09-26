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
import { RolesEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA, ROLES_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, RoleGuard, TenantPermissionGuard } from '../shared/guards';
import { CandidateInterviewModule } from '../candidate-interview/candidate-interview.module';
import { CandidateInterviewVocabularyResolver } from '../candidate-interview/candidate-interview-vocabulary.resolver';
import { CandidatePersonalQualitiesController } from '../candidate-personal-qualities/candidate-personal-qualities.controller';
import { CandidatePersonalQualitiesModule } from '../candidate-personal-qualities/candidate-personal-qualities.module';
import { CandidatePersonalQualitiesService } from '../candidate-personal-qualities/candidate-personal-qualities.service';
import { CandidatePersonalQualitiesBulkCreateCommand, CandidatePersonalQualitiesBulkDeleteCommand } from '../candidate-personal-qualities/commands';
import { CandidateTechnologiesController } from '../candidate-technologies/candidate-technologies.controller';
import { CandidateTechnologiesModule } from '../candidate-technologies/candidate-technologies.module';
import { CandidateTechnologiesService } from '../candidate-technologies/candidate-technologies.service';
import {
	CandidateTechnologiesBulkCreateCommand,
	CandidateTechnologiesBulkDeleteCommand,
	CandidateTechnologiesBulkUpdateCommand
} from '../candidate-technologies/commands';

/**
 * The vocabulary a sitting is assessed against, over GraphQL.
 *
 * Two delivered resources are one shape repeated — a technology and a personal quality, each a name and
 * an average hanging off one sitting — and this suite pins the half of the two-protocol doctrine that is
 * easy to get quietly wrong for a *grouped* surface whose routes carry a role guard:
 *
 * - every one of the capabilities both controllers serve is a root field of the one composed schema, and
 *   each list is a connection with the platform's own cursor codec behind it;
 * - **the guard chain is the controllers' and no field states a permission**, because neither controller
 *   has a permission on its class or on any handler: the tenant guard is on the class, the role guard and
 *   the same three roles are on the handlers the controllers declare, and the inherited CRUD routes carry
 *   neither — which is why the role guard is restated per field rather than put on the class;
 * - **every field reads its own resource's controller** for the guards and the roles, so the grouping
 *   cannot drift from either;
 * - the two bulk removals are fields of their own while the interview-scoped read folds into the list.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const INTERVIEW = '00000000-0000-4000-8000-000000000004';
const FIRST = '00000000-0000-4000-8000-0000000000a0';
const SECOND = '00000000-0000-4000-8000-0000000000a1';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
function rows(name: string) {
	return [
		{
			id: FIRST,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			interviewId: INTERVIEW,
			name,
			rating: 4.5,
			createdAt: new Date('2026-03-01T10:00:00.000Z'),
			updatedAt: new Date('2026-03-01T10:00:00.000Z')
		},
		{
			id: SECOND,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			interviewId: INTERVIEW,
			name: `${name} (second)`,
			rating: 2.5,
			createdAt: new Date('2026-02-01T10:00:00.000Z'),
			updatedAt: new Date('2026-02-01T10:00:00.000Z')
		}
	];
}

/** A scripted service: the eight routes every one of the two resources answers. */
function scriptedService(name: string) {
	const data = rows(name);

	return {
		findAll: jest.fn().mockResolvedValue({ items: data, total: data.length }),
		findOneByIdString: jest.fn().mockResolvedValue(data[0]),
		countBy: jest.fn().mockResolvedValue(data.length),
		create: jest.fn().mockResolvedValue(data[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...data[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(data[0])
	};
}

/** The resolver, over the two scripted services and a command bus. */
function surfaces() {
	const services = {
		technologies: scriptedService('TypeScript'),
		qualities: scriptedService('Punctual')
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(rows('filed')) };

	return {
		services,
		commandBus,
		resolver: new CandidateInterviewVocabularyResolver(
			services.technologies as never,
			services.qualities as never,
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

/** The reads and writes the two vocabularies contribute, by name. */
const OWNED_QUERY_FIELDS = [
	'candidatePersonalQualities',
	'candidatePersonalQuality',
	'candidatePersonalQualityCount',
	'candidateTechnologies',
	'candidateTechnology',
	'candidateTechnologyCount'
];

/** The mutations the two vocabularies contribute, by name. */
const OWNED_MUTATION_FIELDS = [
	'createCandidatePersonalQualitiesBulk',
	'createCandidatePersonalQuality',
	'createCandidateTechnologiesBulk',
	'createCandidateTechnology',
	'deleteCandidatePersonalQualitiesBulk',
	'deleteCandidatePersonalQuality',
	'deleteCandidateTechnologiesBulk',
	'deleteCandidateTechnology',
	'recoverCandidatePersonalQuality',
	'recoverCandidateTechnology',
	'softDeleteCandidatePersonalQuality',
	'softDeleteCandidateTechnology',
	'updateCandidateTechnologiesBulk',
	'updateCandidateTechnology',
	'updateCandidatePersonalQuality'
];

/** The root fields of this group, as they are actually declared. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned = operation === 'Query' ? OWNED_QUERY_FIELDS : OWNED_MUTATION_FIELDS;

	return rootFields(operation)
		.filter((field) => owned.includes(field))
		.sort();
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof CandidateInterviewVocabularyResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', CandidateInterviewVocabularyResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(CandidateInterviewVocabularyResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under, by the same override rule the guards apply. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(CandidateInterviewVocabularyResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, CandidateInterviewVocabularyResolver)
	);
}

/** The roles one resolver field states. */
function rolesOfField(field: string): unknown {
	return Reflect.getMetadata(ROLES_METADATA, fieldsOf(CandidateInterviewVocabularyResolver)[field]);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: object): Record<string, object> {
	return (controller as { prototype: Record<string, object> }).prototype;
}

/** The guards one route actually runs under: the controller's chain, then the handler's own. */
function guardsOfRoute(controller: object, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The roles one route states. */
function rolesOfRoute(controller: object, handler: string): unknown {
	return Reflect.getMetadata(ROLES_METADATA, handlersOf(controller)[handler]);
}

/**
 * One field and the route it mirrors.
 *
 * The paginated spelling of each list is deliberately absent, and so is the interview-scoped read: both
 * are the list with a narrowing the connection states itself.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; controller: object; route: string }> = [
	// The technologies: the bulk update is the one route the quality controller does not serve.
	{ field: 'candidateTechnologies', controller: CandidateTechnologiesController, route: 'findAll' },
	{ field: 'candidateTechnology', controller: CandidateTechnologiesController, route: 'findById' },
	{ field: 'candidateTechnologyCount', controller: CandidateTechnologiesController, route: 'getCount' },
	{ field: 'createCandidateTechnology', controller: CandidateTechnologiesController, route: 'create' },
	{ field: 'updateCandidateTechnology', controller: CandidateTechnologiesController, route: 'update' },
	{ field: 'deleteCandidateTechnology', controller: CandidateTechnologiesController, route: 'delete' },
	{ field: 'softDeleteCandidateTechnology', controller: CandidateTechnologiesController, route: 'softRemove' },
	{ field: 'recoverCandidateTechnology', controller: CandidateTechnologiesController, route: 'softRecover' },
	{ field: 'createCandidateTechnologiesBulk', controller: CandidateTechnologiesController, route: 'createBulkCandidateTechnologies' },
	{ field: 'updateCandidateTechnologiesBulk', controller: CandidateTechnologiesController, route: 'updateBulkCandidateTechnologies' },
	{ field: 'deleteCandidateTechnologiesBulk', controller: CandidateTechnologiesController, route: 'deleteBulkTechnologies' },
	// The personal qualities.
	{ field: 'candidatePersonalQualities', controller: CandidatePersonalQualitiesController, route: 'findAll' },
	{ field: 'candidatePersonalQuality', controller: CandidatePersonalQualitiesController, route: 'findById' },
	{ field: 'candidatePersonalQualityCount', controller: CandidatePersonalQualitiesController, route: 'getCount' },
	{ field: 'createCandidatePersonalQuality', controller: CandidatePersonalQualitiesController, route: 'create' },
	{ field: 'updateCandidatePersonalQuality', controller: CandidatePersonalQualitiesController, route: 'update' },
	{ field: 'deleteCandidatePersonalQuality', controller: CandidatePersonalQualitiesController, route: 'delete' },
	{ field: 'softDeleteCandidatePersonalQuality', controller: CandidatePersonalQualitiesController, route: 'softRemove' },
	{ field: 'recoverCandidatePersonalQuality', controller: CandidatePersonalQualitiesController, route: 'softRecover' },
	{ field: 'createCandidatePersonalQualitiesBulk', controller: CandidatePersonalQualitiesController, route: 'createBulk' },
	{ field: 'deleteCandidatePersonalQualitiesBulk', controller: CandidatePersonalQualitiesController, route: 'deleteBulk' }
];

describe('CandidateInterviewVocabularyResolver — the SDL declares the capabilities the two controllers serve', () => {
	it('declares the two connections, the two one-row reads and the two counts', () => {
		expect(ownedRootFields('Query')).toEqual([...OWNED_QUERY_FIELDS].sort());
		expect(ownedRootFields('Query')).toHaveLength(6);
	});

	it('declares one mutation per delivered write route of either resource', () => {
		expect(ownedRootFields('Mutation')).toEqual([...OWNED_MUTATION_FIELDS].sort());
		// Seven writes for the technology — the bulk update included — and six for the quality, which the
		// technology controller alone serves, plus the five lifecycle pairs the CRUD base gives both.
		expect(ownedRootFields('Mutation')).toHaveLength(15);
	});

	it('declares a connection, its edges, its filter and its sort for both resources', () => {
		for (const resource of ['Technology', 'PersonalQuality']) {
			expect(printed).toMatch(
				new RegExp(
					`type Candidate${resource}Connection \\{\\s*nodes: \\[Candidate${resource}!\\]!\\s*edges: \\[Candidate${resource}Edge!\\]!\\s*totalCount: Int!\\s*pageInfo: PageInfo!\\s*\\}`
				)
			);
			expect(printed).toMatch(
				new RegExp(`type Candidate${resource}Edge \\{\\s*node: Candidate${resource}!\\s*cursor: String!\\s*\\}`)
			);
			expect(printed).toMatch(new RegExp(`input Candidate${resource}Filter \\{`));
			expect(printed).toMatch(
				new RegExp(`enum Candidate${resource}SortField \\{\\s*createdAt\\s*updatedAt\\s*name\\s*rating\\s*\\}`)
			);
		}
	});

	it('answers every count through a nullable field of its own, with no argument', () => {
		for (const field of ['candidateTechnologyCount', 'candidatePersonalQualityCount']) {
			expect(fieldArgs('Query', field)).toEqual([]);
		}

		const root = schema.getType('Query') as
			| { getFields(): Record<string, { type: { toString(): string } }> }
			| undefined;

		expect(root?.getFields()?.['candidateTechnologyCount']?.type.toString()).toBe('Int');
		expect(root?.getFields()?.['candidatePersonalQualityCount']?.type.toString()).toBe('Int');
	});

	it('states the numbers a bulk update writes and the rows a bulk removal names', () => {
		// The delivered bulk update reads a row's identifier and its rating, so the input states those two.
		const rating = inputBody('CandidateTechnologyRatingInput');

		expect(rating).toMatch(/id: ID!/);
		expect(rating).toMatch(/rating: Decimal\b/);

		expect(fieldArgs('Mutation', 'updateCandidateTechnologiesBulk')).toEqual(['technologies']);
		expect(fieldArgs('Mutation', 'deleteCandidateTechnologiesBulk')).toEqual(['interviewId', 'technologies']);
		expect(fieldArgs('Mutation', 'createCandidateTechnologiesBulk')).toEqual(['interviewId', 'technologies']);
		expect(fieldArgs('Mutation', 'deleteCandidatePersonalQualitiesBulk')).toEqual([
			'interviewId',
			'personalQualities'
		]);
		// The delivered bulk update dispatches without awaiting and answers nothing, so the field answers
		// the fact that the write was accepted rather than a page it would have to read first.
		expect(schema.getType('Mutation')).toBeTruthy();
		expect(
			(schema.getType('Mutation') as { getFields(): Record<string, { type: { toString(): string } }> }).getFields()[
				'updateCandidateTechnologiesBulk'
			].type.toString()
		).toBe('Boolean!');
	});
});

describe('CandidateInterviewVocabularyResolver — which members the two types expose, and which they refuse', () => {
	it('carries the name, the average and the sitting, with the average as an exact decimal', () => {
		for (const resource of ['CandidateTechnology', 'CandidatePersonalQuality']) {
			const body = typeBody(resource);

			expect(body).toMatch(/id: ID!/);
			expect(body).toMatch(/name: String!/);
			expect(body).toMatch(/rating: Decimal\b/);
			expect(body).toMatch(/interviewId: ID\b/);
			expect(body).not.toContain('Float');
		}
	});

	it('carries no relation object, and no member for the criteria rated against the row', () => {
		for (const resource of ['CandidateTechnology', 'CandidatePersonalQuality']) {
			const body = typeBody(resource);

			for (const relation of [/\binterview:/, /\borganization:/, /\bcriterionsRatings:/] as const) {
				expect(body).not.toMatch(relation);
			}
		}
	});

	it('declares the columns both lists may be narrowed by, including the sitting', () => {
		for (const resource of ['Technology', 'PersonalQuality']) {
			const body = inputBody(`Candidate${resource}Filter`);

			expect(body).toMatch(/interviewId: IDFilter/);
			expect(body).toMatch(/name: StringFilter/);
			expect(body).toMatch(/rating: DecimalFilter/);
		}
	});
});

describe('CandidateInterviewVocabularyResolver — the connection contract', () => {
	it('answers a list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, services } = surfaces();

		const connection = await resolver.candidateTechnologies(undefined, undefined, undefined, 20);

		expect(services.technologies.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('narrows by the sitting, which is the delivered interview-scoped read as a filter', async () => {
		const { resolver } = surfaces();

		const mine = await resolver.candidateTechnologies({ interviewId: { eq: INTERVIEW } });
		expect(mine.nodes).toHaveLength(2);

		const other = await resolver.candidatePersonalQualities({ interviewId: { eq: FIRST } });
		expect(other.nodes).toHaveLength(0);

		const refusal = await resolver.candidateTechnologies({ technology: { eq: INTERVIEW } }).catch((thrown) => thrown);
		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys both sort enums offer, and refuses a column they do not', async () => {
		const { resolver } = surfaces();

		const byRating = await resolver.candidatePersonalQualities(undefined, [{ field: 'rating', direction: 'ASC' }]);
		expect(byRating.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);

		const error = await resolver
			.candidatePersonalQualities(undefined, [{ field: 'interviewId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.candidateTechnologies(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.candidateTechnologies(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const back = await resolver.candidateTechnologies(undefined, undefined, {
			last: 1,
			before: second.edges[0].cursor
		});

		expect(back.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(back.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.candidateTechnologies(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every row', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.candidatePersonalQualities(undefined, undefined, undefined, 500)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('CandidateInterviewVocabularyResolver — one concept, two protocols, the same operations', () => {
	it('reads one row of each resource through the same service method its node route calls', async () => {
		const { resolver, services } = surfaces();

		expect(await resolver.candidateTechnology(FIRST)).toBe((await services.technologies.findAll()).items[0]);
		expect(services.technologies.findOneByIdString).toHaveBeenCalledWith(FIRST);
		expect(await resolver.candidatePersonalQuality(SECOND)).toBe(
			(await services.qualities.findAll()).items[0]
		);
		expect(services.qualities.findOneByIdString).toHaveBeenCalledWith(SECOND);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, services } = surfaces();
		services.qualities.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.candidatePersonalQuality(FIRST)).toBeNull();
	});

	it('counts each resource through the same service method its count route calls', async () => {
		const { resolver, services } = surfaces();

		expect(await resolver.candidateTechnologyCount()).toBe(2);
		expect(await resolver.candidatePersonalQualityCount()).toBe(2);
		expect(services.qualities.countBy).toHaveBeenCalledWith();
	});

	it('files one technology through the same service call its own route makes', async () => {
		const { resolver, services } = surfaces();

		await resolver.createCandidateTechnology({ interviewId: INTERVIEW, name: 'TypeScript' });

		expect(services.technologies.create).toHaveBeenCalledWith({
			interviewId: INTERVIEW,
			name: 'TypeScript'
		});
	});

	it('files one personal quality through the same service call its own route makes', async () => {
		const { resolver, services } = surfaces();

		await resolver.createCandidatePersonalQuality({ interviewId: INTERVIEW, name: 'Punctual' });

		expect(services.qualities.create).toHaveBeenCalledWith({ interviewId: INTERVIEW, name: 'Punctual' });
	});

	it('edits a technology and a personal quality through the same service calls, answering the row', async () => {
		const { resolver, services } = surfaces();

		await resolver.updateCandidateTechnology({ id: FIRST, name: 'TypeScript 5' });
		expect(services.technologies.update).toHaveBeenCalledWith(FIRST, { name: 'TypeScript 5' });
		expect(services.technologies.findOneByIdString).toHaveBeenCalledWith(FIRST);

		await resolver.updateCandidatePersonalQuality({ id: FIRST, name: 'Punctual (verified)' });
		expect(services.qualities.update).toHaveBeenCalledWith(FIRST, { name: 'Punctual (verified)' });
		expect(services.qualities.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('removes a technology and a personal quality through the same service methods', async () => {
		const { resolver, services } = surfaces();

		expect(await resolver.deleteCandidateTechnology(FIRST)).toBe(true);
		expect(services.technologies.delete).toHaveBeenCalledWith(FIRST);

		expect(await resolver.deleteCandidatePersonalQuality(FIRST)).toBe(true);
		expect(services.qualities.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores each resource through the same two service methods', async () => {
		const { resolver, services } = surfaces();

		const withdrawn = await resolver.softDeleteCandidateTechnology(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(services.technologies.softRemove).toHaveBeenCalledWith(FIRST);
		expect(await resolver.recoverCandidateTechnology(FIRST)).toBeTruthy();
		expect(services.technologies.softRecover).toHaveBeenCalledWith(FIRST);

		await resolver.softDeleteCandidatePersonalQuality(FIRST);
		expect(services.qualities.softRemove).toHaveBeenCalledWith(FIRST);
		await resolver.recoverCandidatePersonalQuality(FIRST);
		expect(services.qualities.softRecover).toHaveBeenCalledWith(FIRST);
	});

	it('files several technologies through the command the bulk route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		const created = await resolver.createCandidateTechnologiesBulk(INTERVIEW, ['TypeScript', 'SQL']);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CandidateTechnologiesBulkCreateCommand);
		expect(command.interviewId).toBe(INTERVIEW);
		expect(command.technologies).toEqual(['TypeScript', 'SQL']);
		expect(created).toHaveLength(2);
	});

	it('files several personal qualities through the command the bulk route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createCandidatePersonalQualitiesBulk(INTERVIEW, ['Punctual', 'Curious']);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CandidatePersonalQualitiesBulkCreateCommand);
		expect(command.interviewId).toBe(INTERVIEW);
		expect(command.personalQualities).toEqual(['Punctual', 'Curious']);
	});

	it('writes a new number on each technology criterion through the bulk update command', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.updateCandidateTechnologiesBulk([{ id: FIRST, rating: 4 }])).toBe(true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CandidateTechnologiesBulkUpdateCommand);
		expect(command.technologies).toEqual([{ id: FIRST, rating: 4 }]);
	});

	it('clears a sitting’s technologies through the bulk removal command, naming the rows it was given', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteCandidateTechnologiesBulk(INTERVIEW, [FIRST, SECOND])).toBe(true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CandidateTechnologiesBulkDeleteCommand);
		expect(command.id).toBe(INTERVIEW);
		// The delivered handler reads one member of each row, so the field states the identifiers those
		// members are.
		expect(command.technologies).toEqual([{ id: FIRST }, { id: SECOND }]);
	});

	it('clears a sitting’s whole technology vocabulary when the caller names no row', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteCandidateTechnologiesBulk(INTERVIEW)).toBe(true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CandidateTechnologiesBulkDeleteCommand);
		expect(command.technologies).toBeUndefined();
	});

	it('clears personal qualities through the bulk removal command, or the whole vocabulary', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteCandidatePersonalQualitiesBulk(INTERVIEW, [FIRST])).toBe(true);
		const named = commandBus.execute.mock.calls[0][0];
		expect(named).toBeInstanceOf(CandidatePersonalQualitiesBulkDeleteCommand);
		expect(named.personalQualities).toEqual([{ id: FIRST }]);

		expect(await resolver.deleteCandidatePersonalQualitiesBulk(INTERVIEW)).toBe(true);
		const all = commandBus.execute.mock.calls[1][0];
		expect(all).toBeInstanceOf(CandidatePersonalQualitiesBulkDeleteCommand);
		expect(all.personalQualities).toBeUndefined();
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('CANDIDATE_INTERVIEW_NOT_FOUND: the sitting this row belongs to is gone.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.createCandidateTechnologiesBulk(INTERVIEW, ['SQL'])).rejects.toBe(refusal);
	});
});

describe('CandidateInterviewVocabularyResolver — the guard stack is the controllers’, field by field', () => {
	it('states on the class the one guard both controllers state, and no permission', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', CandidateInterviewVocabularyResolver) ?? [];

		// Neither controller carries a permission guard in its chain and neither declares a permission on
		// its class or on any handler, so the class here carries the tenant guard and the gate alone, and
		// no field states a permission — a field that demanded one would refuse a caller every one of
		// those routes serves.
		expect(resolverGuards).toEqual([TenantPermissionGuard, FeatureFlagGuard]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CandidateTechnologiesController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CandidatePersonalQualitiesController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CandidateInterviewVocabularyResolver)).toBeUndefined();

		for (const field of OWNED_QUERY_FIELDS.concat(OWNED_MUTATION_FIELDS)) {
			expect(permissionOfField(field)).toBeUndefined();
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors its own controller’s route exactly', ({ field, controller, route }) => {
		expect(typeof handlersOf(controller)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which no route carries because it is not a
		// scope: every other guard of the field's chain still has to be its own route's.
		expect(guardsOfField(field).sort()).toEqual([...guardsOfRoute(controller, route), FeatureFlagGuard].sort());
		expect(rolesOfField(field)).toEqual(rolesOfRoute(controller, route));
	});

	it('restates the role guard and the same three roles on the routes that state them, and nowhere else', () => {
		// The role guard is on the handlers the two controllers declare, and the inherited CRUD routes —
		// the count, the node, the edit and the two lifecycle routes — carry neither it nor the roles. That
		// asymmetry is the controllers' own, and it is why the guard is per field rather than on the class.
		for (const field of [
			'candidateTechnologies',
			'createCandidateTechnology',
			'deleteCandidateTechnology',
			'createCandidateTechnologiesBulk',
			'updateCandidateTechnologiesBulk',
			'deleteCandidateTechnologiesBulk',
			'candidatePersonalQualities',
			'createCandidatePersonalQuality',
			'deleteCandidatePersonalQuality',
			'createCandidatePersonalQualitiesBulk',
			'deleteCandidatePersonalQualitiesBulk'
		]) {
			expect(guardsOfField(field)).toContain(RoleGuard);
			expect(rolesOfField(field)).toEqual([RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN]);
		}

		for (const field of [
			'candidateTechnology',
			'candidateTechnologyCount',
			'updateCandidateTechnology',
			'softDeleteCandidateTechnology',
			'recoverCandidateTechnology',
			'candidatePersonalQuality',
			'candidatePersonalQualityCount',
			'updateCandidatePersonalQuality',
			'softDeleteCandidatePersonalQuality',
			'recoverCandidatePersonalQuality'
		]) {
			expect(guardsOfField(field)).not.toContain(RoleGuard);
			expect(rolesOfField(field)).toBeUndefined();
		}
	});
});

describe('CandidateInterviewModule — the two vocabularies are hosted where their services are reachable', () => {
	it('declares the vocabulary resolver as a provider of the module that imports both resources', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, CandidateInterviewModule) ?? []) as unknown[];

		expect(providers).toContain(CandidateInterviewVocabularyResolver);
	});

	it('imports both modules, which export the services the resolver injects', () => {
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, CandidateInterviewModule) ?? []) as unknown[];
		const names = imports.map((entry) => (entry as { name?: string })?.name);

		expect(names).toEqual(
			expect.arrayContaining(['CandidateTechnologiesModule', 'CandidatePersonalQualitiesModule'])
		);

		expect(
			(Reflect.getMetadata(MODULE_METADATA.EXPORTS, CandidateTechnologiesModule) ?? []) as unknown[]
		).toContain(CandidateTechnologiesService);
		expect(
			(Reflect.getMetadata(MODULE_METADATA.EXPORTS, CandidatePersonalQualitiesModule) ?? []) as unknown[]
		).toContain(CandidatePersonalQualitiesService);
	});

	it('re-exports the command bus the three bulk fields dispatch through', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, CandidateInterviewModule) ?? []) as unknown[];

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
		getHandler: () => (CandidateInterviewVocabularyResolver.prototype as never)[field],
		getClass: () => CandidateInterviewVocabularyResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('CandidateInterviewVocabularyResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, CandidateInterviewVocabularyResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', CandidateInterviewVocabularyResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('candidateTechnologies')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('candidateTechnologies');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('candidateTechnologies'))).resolves.toBe(true);
	});
});
