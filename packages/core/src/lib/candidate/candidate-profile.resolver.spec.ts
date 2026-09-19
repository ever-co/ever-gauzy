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
import { CandidateDocumentsController } from '../candidate-documents/candidate-documents.controller';
import { CandidateDocumentsModule } from '../candidate-documents/candidate-documents.module';
import { CandidateDocumentsService } from '../candidate-documents/candidate-documents.service';
import { CandidateEducationController } from '../candidate-education/candidate-education.controller';
import { CandidateEducationModule } from '../candidate-education/candidate-education.module';
import { CandidateEducationService } from '../candidate-education/candidate-education.service';
import { CandidateExperienceController } from '../candidate-experience/candidate-experience.controller';
import { CandidateExperienceModule } from '../candidate-experience/candidate-experience.module';
import { CandidateExperienceService } from '../candidate-experience/candidate-experience.service';
import { CandidateSkillController } from '../candidate-skill/candidate-skill.controller';
import { CandidateSkillModule } from '../candidate-skill/candidate-skill.module';
import { CandidateSkillService } from '../candidate-skill/candidate-skill.service';
import { CandidateSourceController } from '../candidate-source/candidate-source.controller';
import { CandidateSourceModule } from '../candidate-source/candidate-source.module';
import { CandidateSourceService } from '../candidate-source/candidate-source.service';
import { CandidateProfileResolver } from './candidate-profile.resolver';

/**
 * The file a candidacy carries, over GraphQL.
 *
 * Five delivered resources are one shape repeated — a document, a course of study, a prior engagement, a
 * skill and an origin — and this suite pins the half of the two-protocol doctrine that is easy to get
 * quietly wrong for a *grouped* surface:
 *
 * - every one of the five capabilities is a root field of the one composed schema, and each list is a
 *   connection with the platform's own cursor codec behind it;
 * - **every field reaches the same service method its own resource's route reaches**, read from that
 *   resource's own controller rather than from a list written out here — which is what keeps the
 *   grouping honest, since one class now serves five controllers;
 * - **the document's list states the document view permission and the other four state the candidate
 *   one**, which is the one place the five controllers disagree on a permission;
 * - the origin carries no `candidateId`, because a source is a vocabulary the candidacy points at rather
 *   than a row that points back.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CANDIDATE = '00000000-0000-4000-8000-000000000003';
const DOCUMENT = '00000000-0000-4000-8000-000000000050';
const EDUCATION = '00000000-0000-4000-8000-000000000051';
const EXPERIENCE = '00000000-0000-4000-8000-000000000052';
const SKILL = '00000000-0000-4000-8000-000000000053';
const SOURCE = '00000000-0000-4000-8000-000000000054';

/** One row per resource, each already carrying the columns its own type declares. */
const ROWS: Readonly<Record<string, Record<string, unknown>>> = {
	document: {
		id: DOCUMENT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		candidateId: CANDIDATE,
		name: 'Curriculum vitae',
		documentUrl: 'https://example.invalid/cv.pdf',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	education: {
		id: EDUCATION,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		candidateId: CANDIDATE,
		schoolName: 'Example University',
		degree: 'BSc',
		field: 'Computer Science',
		completionDate: new Date('2019-06-30T00:00:00.000Z'),
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	},
	experience: {
		id: EXPERIENCE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		candidateId: CANDIDATE,
		occupation: 'Engineer',
		duration: '2 years',
		description: 'Built things',
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	},
	skill: {
		id: SKILL,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		candidateId: CANDIDATE,
		name: 'TypeScript',
		createdAt: new Date('2026-01-15T10:00:00.000Z'),
		updatedAt: new Date('2026-01-15T10:00:00.000Z')
	},
	source: {
		id: SOURCE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Referral',
		createdAt: new Date('2026-01-10T10:00:00.000Z'),
		updatedAt: new Date('2026-01-10T10:00:00.000Z')
	}
};

/** A scripted service: the five reads and the five writes every one of the five resources answers. */
function scriptedService(key: string) {
	const row = ROWS[key];

	return {
		findAll: jest.fn().mockResolvedValue({ items: [row], total: 1 }),
		findOneByIdString: jest.fn().mockResolvedValue(row),
		countBy: jest.fn().mockResolvedValue(1),
		create: jest.fn().mockResolvedValue(row),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...row, deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(row)
	};
}

/** The resolver, over the five scripted services. */
function surfaces() {
	const services = {
		documents: scriptedService('document'),
		education: scriptedService('education'),
		experience: scriptedService('experience'),
		skill: scriptedService('skill'),
		source: scriptedService('source')
	};

	return {
		services,
		resolver: new CandidateProfileResolver(
			services.documents as never,
			services.education as never,
			services.experience as never,
			services.skill as never,
			services.source as never
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

/** The resource suffixes this resolver serves, which is what every field name is built from. */
const RESOURCES = ['Document', 'Education', 'Experience', 'Skill', 'Source'] as const;

/** The plural spelling of each resource, as the list fields declare it. */
const PLURALS: Readonly<Record<string, string>> = {
	Document: 'candidateDocuments',
	Education: 'candidateEducations',
	Experience: 'candidateExperiences',
	Skill: 'candidateSkills',
	Source: 'candidateSources'
};

/**
 * The key each resource's scripted service and row are filed under.
 *
 * A map rather than a transformation, because the five keys are not the resource names lowercased: the
 * document's service is the plural one, and a `toLowerCase()` that looked right would leave the
 * document's five writes with no service to assert against.
 */
const KEYS: Readonly<Record<string, string>> = {
	Document: 'documents',
	Education: 'education',
	Experience: 'experience',
	Skill: 'skill',
	Source: 'source'
};

/** The reads this resolver contributes, by name. */
const OWNED_QUERY_FIELDS = RESOURCES.flatMap((resource) => [
	PLURALS[resource],
	`candidate${resource}`,
	`candidate${resource}Count`
]);

/** The writes this resolver contributes, by name. */
const OWNED_MUTATION_FIELDS = RESOURCES.flatMap((resource) => [
	`createCandidate${resource}`,
	`updateCandidate${resource}`,
	`deleteCandidate${resource}`,
	`softDeleteCandidate${resource}`,
	`recoverCandidate${resource}`
]);

/** The root fields of this group, as they are actually declared. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned = operation === 'Query' ? OWNED_QUERY_FIELDS : OWNED_MUTATION_FIELDS;

	return rootFields(operation)
		.filter((field) => owned.includes(field))
		.sort();
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to each controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: object, handler: string): unknown {
	const handlers = (controller as { prototype: Record<string, object> }).prototype;

	return Reflect.getMetadata(PERMISSIONS_METADATA, handlers[handler]) ?? Reflect.getMetadata(PERMISSIONS_METADATA, controller);
}

/** The guards one route actually runs under: the controller's chain, then the handler's own. */
function guardsOfRoute(controller: object, handler: string): unknown[] {
	const handlers = (controller as { prototype: Record<string, object> }).prototype;
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlers[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof CandidateProfileResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(CandidateProfileResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, CandidateProfileResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', CandidateProfileResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(CandidateProfileResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The controller each resource’s routes are read from, so the parity is never restated here. */
const CONTROLLERS: ReadonlyArray<{ resource: string; controller: object }> = [
	{ resource: 'Document', controller: CandidateDocumentsController },
	{ resource: 'Education', controller: CandidateEducationController },
	{ resource: 'Experience', controller: CandidateExperienceController },
	{ resource: 'Skill', controller: CandidateSkillController },
	{ resource: 'Source', controller: CandidateSourceController }
];

/**
 * One field and the route it mirrors, for every one of the forty fields this resolver serves.
 *
 * The paginated spelling of each list is deliberately absent: it is the same read with a page size, and
 * the connection states the page itself, so the two fold into one field per resource.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; resource: string; controller: object; route: string }> =
	CONTROLLERS.flatMap(({ resource, controller }) => [
		{ field: PLURALS[resource], resource, controller, route: 'findAll' },
		{ field: `candidate${resource}`, resource, controller, route: 'findById' },
		{ field: `candidate${resource}Count`, resource, controller, route: 'getCount' },
		{ field: `createCandidate${resource}`, resource, controller, route: 'create' },
		{ field: `updateCandidate${resource}`, resource, controller, route: 'update' },
		{ field: `deleteCandidate${resource}`, resource, controller, route: 'delete' },
		{ field: `softDeleteCandidate${resource}`, resource, controller, route: 'softRemove' },
		{ field: `recoverCandidate${resource}`, resource, controller, route: 'softRecover' }
	]);

describe('CandidateProfileResolver — the SDL declares the capabilities the five controllers serve', () => {
	it('declares the five connections, the five one-row reads and the five counts', () => {
		expect(ownedRootFields('Query')).toEqual([...OWNED_QUERY_FIELDS].sort());
		expect(ownedRootFields('Query')).toHaveLength(15);
	});

	it('declares one mutation per delivered write route, for each of the five', () => {
		expect(ownedRootFields('Mutation')).toEqual([...OWNED_MUTATION_FIELDS].sort());
		expect(ownedRootFields('Mutation')).toHaveLength(25);
	});

	it('declares a connection, its edges, its filter and its sort for each of the five', () => {
		for (const resource of RESOURCES) {
			expect(printed).toMatch(
				new RegExp(
					`type Candidate${resource}Connection \\{\\s*nodes: \\[Candidate${resource}!\\]!\\s*edges: \\[Candidate${resource}Edge!\\]!\\s*totalCount: Int!\\s*pageInfo: PageInfo!\\s*\\}`
				)
			);
			expect(printed).toMatch(
				new RegExp(`type Candidate${resource}Edge \\{\\s*node: Candidate${resource}!\\s*cursor: String!\\s*\\}`)
			);
			expect(printed).toMatch(new RegExp(`input Candidate${resource}Filter \\{`));
			expect(printed).toMatch(new RegExp(`input Candidate${resource}Sort \\{`));
			expect(printed).toMatch(new RegExp(`enum Candidate${resource}SortField \\{`));
		}
	});

	it('answers every count through a nullable field of its own, with no argument', () => {
		const root = schema.getType('Query') as
			| { getFields(): Record<string, { type: { toString(): string } }> }
			| undefined;

		for (const resource of RESOURCES) {
			const field = `candidate${resource}Count`;

			expect(root?.getFields()?.[field]?.type.toString()).toBe('Int');
			expect(fieldArgs('Query', field)).toEqual([]);
		}
	});
});

describe('CandidateProfileResolver — which members each type exposes, and which it refuses', () => {
	it('carries each resource’s own columns beside the base entity’s', () => {
		expect(typeBody('CandidateDocument')).toMatch(/name: String!/);
		expect(typeBody('CandidateDocument')).toMatch(/documentUrl: String\b/);
		expect(typeBody('CandidateEducation')).toMatch(/schoolName: String!/);
		expect(typeBody('CandidateEducation')).toMatch(/completionDate: DateTime!/);
		expect(typeBody('CandidateExperience')).toMatch(/occupation: String!/);
		expect(typeBody('CandidateExperience')).toMatch(/duration: String!/);
		expect(typeBody('CandidateSkill')).toMatch(/name: String!/);
		expect(typeBody('CandidateSource')).toMatch(/name: String!/);

		for (const resource of RESOURCES) {
			const body = typeBody(`Candidate${resource}`);

			expect(body).toMatch(/id: ID!/);
			expect(body).toMatch(/tenantId: ID\b/);
			expect(body).toMatch(/organizationId: ID\b/);
			expect(body).toMatch(/deletedAt: DateTime\b/);
			expect(body).toMatch(/createdAt: DateTime\b/);
			expect(body).toMatch(/updatedAt: DateTime\b/);
		}
	});

	it('carries the candidacy as an identifier on the four rows that point back at it', () => {
		for (const resource of ['Document', 'Education', 'Experience', 'Skill']) {
			expect(typeBody(`Candidate${resource}`)).toMatch(/candidateId: ID\b/);
		}
	});

	it('carries no candidacy identifier on the origin, which the candidacy points at instead', () => {
		// The relation runs from the candidate's own `sourceId` column, so a source row holds no column
		// naming a candidacy — a member here would be absent on every row this surface answers.
		const body = typeBody('CandidateSource');

		expect(body).not.toContain('candidateId');
		expect(printed).toMatch(/enum CandidateSourceSortField \{\s*createdAt\s*updatedAt\s*name\s*\}/);
		// And the filter cannot advertise the narrowing either.
		expect(inputBody('CandidateSourceFilter')).not.toContain('candidateId');
		// The other four, whose rows do hold the column, do advertise it.
		for (const resource of ['Document', 'Education', 'Experience', 'Skill']) {
			expect(inputBody(`Candidate${resource}Filter`)).toContain('candidateId');
		}
	});

	it('carries no relation object on any of the five', () => {
		for (const resource of RESOURCES) {
			const body = typeBody(`Candidate${resource}`);

			for (const relation of [/\bcandidate:/, /\borganization:/, /\btags:/, /\bcriterionsRatings:/] as const) {
				expect(body).not.toMatch(relation);
			}
		}
	});

	it('declares the columns a candidacy’s file may be narrowed by, and no relation path', () => {
		for (const resource of RESOURCES) {
			expect(printed).toMatch(new RegExp(`input Candidate${resource}Filter \\{[\\s\\S]*?id: IDFilter`));
			expect(printed).toMatch(new RegExp(`input Candidate${resource}Filter \\{[\\s\\S]*?createdAt: DateTimeFilter`));
		}

		// The experience service states a three-column projection of the organization relation, and the
		// delivered call joins no relation, so the projection never materialises: there is no organization
		// member on the type and no organization path in the filter.
		expect(typeBody('CandidateExperience')).not.toMatch(/\borganization:/);
	});
});

describe('CandidateProfileResolver — the connection contract', () => {
	it('answers a list with nodes, edges, a total and the boundary cursors', async () => {
		const { services, resolver } = surfaces();

		const connection = await resolver.candidateDocuments(undefined, undefined, undefined, 20);

		// The read is the one the delivered list route performs, with the route's own defaults.
		expect(services.documents.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(1);
		expect(connection.totalCount).toBe(1);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(DOCUMENT);
	});

	it('narrows a file to one candidacy by the column the rows carry, and refuses what they do not', async () => {
		const { resolver } = surfaces();

		const mine = await resolver.candidateSkills({ candidateId: { eq: CANDIDATE } });
		expect(mine.nodes.map((node) => node.id)).toEqual([SKILL]);

		const refusal = await resolver.candidateSkills({ interviewId: { eq: CANDIDATE } }).catch((thrown) => thrown);
		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');

		// The origin has no candidacy column at all, so the same filter is refused there too — which is
		// the difference between "no rows" and "not a question this surface can answer".
		const byCandidate = await resolver.candidateSources({ candidateId: { eq: CANDIDATE } }).catch((thrown) => thrown);
		expect(isRefusal(byCandidate)).toBe(true);
	});

	it('orders by the keys each sort enum offers, and refuses a column it does not', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.candidateDocuments(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([DOCUMENT]);

		const error = await resolver
			.candidateDocuments(undefined, [{ field: 'candidateId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.candidateEducations(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every row', async () => {
		const { resolver } = surfaces();

		const error = await resolver.candidateExperiences(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

/** One write field, the service it must reach, the row it acts on and the method it must call. */
const WRITE_DELEGATION: ReadonlyArray<{ field: string; service: string; row: string; method: string }> =
	RESOURCES.flatMap((resource) => {
		const service = KEYS[resource];
		const row = resource.toLowerCase();

		return [
			{ field: `createCandidate${resource}`, service, row, method: 'create' },
			{ field: `updateCandidate${resource}`, service, row, method: 'update' },
			{ field: `deleteCandidate${resource}`, service, row, method: 'delete' },
			{ field: `softDeleteCandidate${resource}`, service, row, method: 'softRemove' },
			{ field: `recoverCandidate${resource}`, service, row, method: 'softRecover' }
		];
	});

describe('CandidateProfileResolver — one concept, two protocols, the same operations', () => {
	it.each(WRITE_DELEGATION)(
		'$field reaches $method on its own resource’s service',
		async ({ field, service: key, row, method }) => {
			const { resolver, services } = surfaces();
			const service = services[key as keyof typeof services] as unknown as Record<string, jest.Mock>;
			const id = ROWS[row].id as string;
			const call = (resolver as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)[field];

			if (method === 'update') {
				await call.call(resolver, { id, name: 'changed' });
				expect(service.update).toHaveBeenCalledWith(id, { name: 'changed' });
				// The delivered edit answers the store's own update result, which is not a row: the field
				// reads the row back through the same reader the one-row field uses.
				expect(service.findOneByIdString).toHaveBeenCalledWith(id);
				return;
			}

			if (method === 'create') {
				await call.call(resolver, { name: 'filed' });
				expect(service.create).toHaveBeenCalledWith({ name: 'filed' });
				return;
			}

			if (method === 'delete') {
				expect(await call.call(resolver, id)).toBe(true);
				expect(service.delete).toHaveBeenCalledWith(id);
				return;
			}

			await call.call(resolver, id);
			expect(service[method]).toHaveBeenCalledWith(id);
		}
	);

	it('reads one row of each resource through the same service method its node route calls', async () => {
		const { resolver, services } = surfaces();

		expect(await resolver.candidateDocument(DOCUMENT)).toBe(ROWS.document);
		expect(services.documents.findOneByIdString).toHaveBeenCalledWith(DOCUMENT);
		expect(await resolver.candidateEducation(EDUCATION)).toBe(ROWS.education);
		expect(await resolver.candidateExperience(EXPERIENCE)).toBe(ROWS.experience);
		expect(await resolver.candidateSkill(SKILL)).toBe(ROWS.skill);
		expect(await resolver.candidateSource(SOURCE)).toBe(ROWS.source);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, services } = surfaces();
		services.skill.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.candidateSkill(SKILL)).toBeNull();
	});

	it('counts each resource through the same service method its count route calls', async () => {
		const { resolver, services } = surfaces();

		expect(await resolver.candidateDocumentCount()).toBe(1);
		expect(await resolver.candidateEducationCount()).toBe(1);
		expect(await resolver.candidateExperienceCount()).toBe(1);
		expect(await resolver.candidateSkillCount()).toBe(1);
		expect(await resolver.candidateSourceCount()).toBe(1);
		expect(services.source.countBy).toHaveBeenCalledWith();
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, services } = surfaces();
		const refusal = new Error('CANDIDATE_SOURCE_STILL_REFERENCED: a candidacy still names this origin.');

		services.source.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteCandidateSource(SOURCE)).rejects.toBe(refusal);
	});
});

describe('CandidateProfileResolver — the guard stack and the permissions are the five controllers’', () => {
	it('states on the class only the guard all five controllers state, and the permission all five state', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', CandidateProfileResolver) ?? [];

		// Four of the five carry the permission guard on the class and one does not, so the class states
		// only what all five share: the tenant guard, the gate — and the edit permission, which all five
		// state on the class.
		expect(resolverGuards).toEqual([TenantPermissionGuard, FeatureFlagGuard]);

		for (const resource of RESOURCES) {
			const controller = CONTROLLERS.find((entry) => entry.resource === resource)?.controller;

			expect(Reflect.getMetadata('__guards__', controller)).toEqual(
				expect.arrayContaining([TenantPermissionGuard])
			);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, controller)).toEqual([
				PermissionsEnum.ORG_CANDIDATES_EDIT
			]);
		}

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CandidateProfileResolver)).toEqual([
			PermissionsEnum.ORG_CANDIDATES_EDIT
		]);
	});

	it('restates the permission guard on the four resources whose controllers carry it, and not on the fifth', () => {
		for (const resource of ['Document', 'Education', 'Skill', 'Source']) {
			expect(guardsOfField(`candidate${resource}s`)).toContain(PermissionGuard);
			expect(guardsOfField(`createCandidate${resource}`)).toContain(PermissionGuard);
		}

		// The experience controller states the tenant guard twice instead of the permission guard, so its
		// fields carry the tenant guard alone — exactly as its routes do.
		expect(Reflect.getMetadata('__guards__', CandidateExperienceController)).toEqual([
			TenantPermissionGuard,
			TenantPermissionGuard
		]);
		expect(guardsOfField('candidateExperiences')).not.toContain(PermissionGuard);
		expect(guardsOfField('createCandidateExperience')).not.toContain(PermissionGuard);
	});

	it.each(ROUTE_PARITY)('$field mirrors $resource.$route exactly', ({ field, controller, route }) => {
		expect(typeof (controller as { prototype: Record<string, unknown> }).prototype[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which no route carries because it is not a
		// scope: every other guard of the field's chain still has to be its own route's.
		expect(guardsOfField(field).sort()).toEqual([...guardsOfRoute(controller, route), FeatureFlagGuard].sort());
		expect(permissionOfField(field)).toEqual(permissionOfRoute(controller, route));
	});

	it('states the document view permission on the document list and the candidate one on the other four', () => {
		// The document controller is the one of the five whose list states a permission of its own; the
		// other four state the candidate view permission on the same route.
		expect(permissionOfField('candidateDocuments')).toEqual([PermissionsEnum.ORG_CANDIDATES_DOCUMENTS_VIEW]);
		expect(permissionOfField('candidateDocuments')).not.toEqual([PermissionsEnum.ORG_CANDIDATES_VIEW]);

		for (const field of ['candidateEducations', 'candidateExperiences', 'candidateSkills', 'candidateSources']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_CANDIDATES_VIEW]);
		}
	});

	it('states the edit permission on everything but the five lists, which state their view permission', () => {
		const lists = new Set(Object.values(PLURALS));

		for (const field of OWNED_QUERY_FIELDS.concat(OWNED_MUTATION_FIELDS)) {
			if (lists.has(field)) {
				continue;
			}

			// The document controller declares nothing but its list, so every other route of that
			// resource — the count and the node included — runs under the class-level edit permission; the
			// other four declare their count and node nowhere either. So every non-list field of the group
			// states the same one permission, and no field states a permission its own route lacks.
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_CANDIDATES_EDIT]);
		}
	});
});

describe('CandidateProfileResolver — the module wiring makes its five dependencies reachable', () => {
	it('exports each service from the module that provides it', () => {
		const modules = [
			{ module: CandidateDocumentsModule, service: CandidateDocumentsService },
			{ module: CandidateEducationModule, service: CandidateEducationService },
			{ module: CandidateExperienceModule, service: CandidateExperienceService },
			{ module: CandidateSkillModule, service: CandidateSkillService },
			{ module: CandidateSourceModule, service: CandidateSourceService }
		];

		for (const { module, service } of modules) {
			const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, module) ?? []) as unknown[];
			const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, module) ?? []) as unknown[];

			expect(providers).toContain(service);
			expect(exported).toContain(service);
		}
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
		getHandler: () => (CandidateProfileResolver.prototype as never)[field],
		getClass: () => CandidateProfileResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('CandidateProfileResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, CandidateProfileResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', CandidateProfileResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('candidateDocuments')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('candidateDocuments');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('candidateDocuments'))).resolves.toBe(true);
	});
});
