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
import { CandidateController } from './candidate.controller';
import { CandidateModule } from './candidate.module';
import { CandidateResolver } from './candidate.resolver';
import { CandidateService } from './candidate.service';
import {
	CandidateBulkCreateCommand,
	CandidateCreateCommand,
	CandidateHiredCommand,
	CandidateRejectedCommand,
	CandidateUpdateCommand
} from './commands';

/**
 * The candidacy over GraphQL.
 *
 * The delivered REST routes serve a list, one candidacy, a count, a filing, a bulk filing, an edit, the
 * two pipeline moves and the three removal routes. This suite pins the half of the two-protocol doctrine
 * that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — including the three reads, whose routes state a view permission the controller's class
 *   does not carry;
 * - **a candidacy is a person, so the members that are refused are asserted to be absent**: no relation
 *   object, no account column the list read does not select, no virtual column the store does not have,
 *   and no member for a column this row does not own;
 * - **the two pipeline moves are one field and not an edit**, and the three lifecycle routes are three
 *   fields.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const ACCOUNT = '00000000-0000-4000-8000-000000000003';
const FIRST = '00000000-0000-4000-8000-000000000040';
const SECOND = '00000000-0000-4000-8000-000000000041';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		userId: ACCOUNT,
		status: 'APPLIED',
		rating: 4.5,
		billRateValue: 90,
		minimumBillingRate: 70,
		reWeeklyLimit: 40,
		billRateCurrency: 'USD',
		appliedDate: new Date('2026-03-01T10:00:00.000Z'),
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		userId: ACCOUNT,
		status: 'HIRED',
		rating: 2.5,
		billRateValue: 40,
		minimumBillingRate: 30,
		reWeeklyLimit: 20,
		billRateCurrency: 'EUR',
		appliedDate: new Date('2026-02-01T10:00:00.000Z'),
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const candidateService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		candidateService,
		commandBus,
		resolver: new CandidateResolver(candidateService as never, commandBus as never)
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
 * The type one root field answers with, read from the built schema rather than matched as text: the name
 * of a field is not the name of a *place*, and this domain has several counts.
 */
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

/** The query fields this domain contributes, by name. */
const OWNED_QUERY_FIELDS = ['candidate', 'candidateCount', 'candidates'];

/** The mutations the candidacy itself contributes, by name. */
const OWNED_MUTATION_FIELDS = [
	'createCandidate',
	'createCandidatesBulk',
	'deleteCandidate',
	'recoverCandidate',
	'softDeleteCandidate',
	'updateCandidate',
	'updateCandidateStatus'
];

/** The root fields of the candidacy itself, as they are actually declared. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned = operation === 'Query' ? OWNED_QUERY_FIELDS : OWNED_MUTATION_FIELDS;

	return rootFields(operation)
		.filter((field) => owned.includes(field))
		.sort();
}

/** The printed body of one type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type, so a member it must not carry can be asserted absent. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof CandidateController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof CandidateController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof CandidateController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof CandidateResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(CandidateResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, CandidateResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', CandidateResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(CandidateResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/**
 * One field and the route it mirrors.
 *
 * The paginated spelling of the list is deliberately absent: it is the same read with a page size, and
 * the connection states the page itself, so the two fold into one field rather than becoming two that
 * could disagree.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'candidates', route: 'findAll' },
	{ field: 'candidate', route: 'findById' },
	{ field: 'candidateCount', route: 'getCount' },
	{ field: 'createCandidate', route: 'create' },
	{ field: 'createCandidatesBulk', route: 'createBulk' },
	{ field: 'updateCandidate', route: 'update' },
	{ field: 'updateCandidateStatus', route: 'updateCandidateStatus' },
	{ field: 'deleteCandidate', route: 'delete' },
	{ field: 'softDeleteCandidate', route: 'softRemove' },
	{ field: 'recoverCandidate', route: 'softRecover' }
];

describe('CandidateResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['candidates', 'candidate', 'candidateCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createCandidate',
				'createCandidatesBulk',
				'updateCandidate',
				'updateCandidateStatus',
				'deleteCandidate',
				'softDeleteCandidate',
				'recoverCandidate'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual(['candidate', 'candidateCount', 'candidates']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createCandidate',
			'createCandidatesBulk',
			'deleteCandidate',
			'recoverCandidate',
			'softDeleteCandidate',
			'updateCandidate',
			'updateCandidateStatus'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type CandidateConnection \{\s*nodes: \[Candidate!\]!\s*edges: \[CandidateEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type CandidateEdge \{\s*node: Candidate!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input CandidateFilter \{/);
		expect(printed).toMatch(/input CandidateSort \{/);
		expect(printed).toMatch(
			/enum CandidateSortField \{\s*createdAt\s*updatedAt\s*appliedDate\s*hiredDate\s*rejectDate\s*candidateLevel\s*status\s*rating\s*billRateValue\s*\}/
		);
	});

	it('answers the count through a nullable field of its own, with no argument', () => {
		// The count route passes its query string through as the store's own `where`, a shape no schema
		// can state, so the field offers no narrowing rather than an argument it could not pass on.
		expect(fieldType('Query', 'candidateCount')).toBe('Int');
		expect(fieldArgs('Query', 'candidateCount')).toEqual([]);
	});

	it('states the pipeline move as the two values the delivered route acts on', () => {
		// The delivered `switch` has no default branch, so a move it does not name answers nothing at all;
		// a schema that accepted any string would advertise a capability that does not exist.
		expect(printed).toMatch(/enum CandidatePipelineAction \{\s*hired\s*rejected\s*\}/);
		expect(fieldType('Mutation', 'updateCandidateStatus')).toBe('Candidate!');
		expect(fieldArgs('Mutation', 'updateCandidateStatus')).toEqual(['id', 'status']);
	});

	it('states the lifecycle writes as three separate fields', () => {
		// Two of the three routes are inherited from the CRUD base and one is the controller's own; all
		// three are delivered capabilities, and a client that could not tell them apart could not tell
		// whether the rows that point at a withdrawn candidacy survived.
		expect(fieldType('Mutation', 'deleteCandidate')).toBe('Boolean!');
		expect(fieldType('Mutation', 'softDeleteCandidate')).toBe('Candidate!');
		expect(fieldType('Mutation', 'recoverCandidate')).toBe('Candidate!');
	});
});

describe('CandidateResolver — which members the surface exposes, and which it refuses', () => {
	it('carries the columns the delivered answer carries, with money as an exact decimal', () => {
		const body = typeBody('Candidate');

		expect(body).toMatch(/id: ID!/);
		expect(body).toMatch(/status: String\b/);
		expect(body).toMatch(/candidateLevel: String\b/);
		expect(body).toMatch(/reWeeklyLimit: Int\b/);
		expect(body).toMatch(/payPeriod: String\b/);
		expect(body).toMatch(/cvUrl: String\b/);
		expect(body).toMatch(/billRateCurrency: String\b/);
		// Money and money-per-hour: an exact decimal and never a binary fraction.
		expect(body).toMatch(/billRateValue: Decimal\b/);
		expect(body).toMatch(/minimumBillingRate: Decimal\b/);
		expect(body).toMatch(/rating: Decimal\b/);
		expect(body).not.toContain('Float');
	});

	it('carries no relation object, and carries the identifier each relation reports instead', () => {
		const body = typeBody('Candidate');

		expect(body).toMatch(/userId: ID!/);
		expect(body).toMatch(/contactId: ID\b/);
		expect(body).toMatch(/organizationPositionId: ID\b/);
		expect(body).toMatch(/sourceId: ID\b/);
		expect(body).toMatch(/employeeId: ID\b/);

		// The delivered reads state no `relations`, so a member for any of these would be absent on every
		// row this surface answers — a field that always reads null is worse than no field.
		for (const relation of [
			/\buser:/,
			/\bcontact:/,
			/\bsource:/,
			/\bemployee:/,
			/\borganizationPosition:/,
			/\btags:/,
			/\bdocuments:/,
			/\beducations:/,
			/\bexperience:/,
			/\bskills:/,
			/\bfeedbacks:/,
			/\binterview:/,
			/\borganizationDepartments:/,
			/\borganizationEmploymentTypes:/
		] as const) {
			expect(body).not.toMatch(relation);
		}
	});

	it('carries no member for the account’s own columns, nor for the two virtual columns', () => {
		const body = typeBody('Candidate');

		// The list read joins the account only in the paginated spelling, and only to narrow by it: the
		// rows this surface answers carry no account column, so a `name`, an `email` or an `imageUrl`
		// member would be empty here and filled on another spelling of the same list.
		expect(body).not.toMatch(/\bname:/);
		expect(body).not.toMatch(/\bemail:/);
		expect(body).not.toMatch(/\bimageUrl:/);

		// `ratings` is filled out of the feedbacks collection, which this surface's reads do not join.
		// `alreadyHired` is a function of two columns the type already carries, and the subscriber that
		// fills it is the TypeORM one alone.
		expect(body).not.toContain('ratings');
		expect(body).not.toContain('alreadyHired');
		expect(body).not.toContain('fullName');
	});

	it('declares a filter carrying exactly the columns the read returns, and refuses the account', () => {
		const body = inputBody('CandidateFilter');

		expect(body).toMatch(/status: StringFilter/);
		expect(body).toMatch(/candidateId: IDFilter|userId: IDFilter/);
		expect(body).toMatch(/billRateValue: DecimalFilter/);
		expect(body).toMatch(/minimumBillingRate: DecimalFilter/);
		expect(body).toMatch(/rating: DecimalFilter/);
		expect(body).toMatch(/reWeeklyLimit: NumberFilter/);
		// The account is not filterable: the connection narrows the rows the read returned, and those
		// carry no account column.
		expect(body).not.toMatch(/\buser: /);
		expect(body).not.toMatch(/name: StringFilter/);
	});

	it('declares the two write inputs, and never a member the row has no column for', () => {
		const create = inputBody('CreateCandidateInput');
		const update = inputBody('UpdateCandidateInput');
		const account = inputBody('CandidateUserInput');

		expect(create).toMatch(/organizationId: ID!/);
		expect(create).toMatch(/user: CandidateUserInput!/);
		expect(create).toMatch(/password: String!/);
		expect(create).toMatch(/organizationPositionId: ID/);
		expect(create).toMatch(/tagIds: \[ID!\]/);
		expect(create).not.toMatch(/\bdocuments:/);

		// The delivered handler overwrites both of the account's remaining members — it resolves the
		// candidate role itself and hands it beside the language of the request — so neither is stated: a
		// stated role could only get the caller refused, and a stated language would be overwritten.
		expect(account).toMatch(/email: String!/);
		expect(account).toMatch(/firstName: String\b/);
		expect(account).toMatch(/lastName: String\b/);
		expect(account).toMatch(/imageUrl: String\b/);
		expect(account).not.toMatch(/\broleId:/);
		expect(account).not.toMatch(/\bpreferredLanguage:/);

		expect(update).toMatch(/id: ID!/);
		expect(update).toMatch(/candidateLevel: String/);
		expect(update).toMatch(/billRateValue: Decimal/);
		expect(update).toMatch(/contactId: ID/);

		// The delivered bodies also accept the engagement's terms, two engagement hiring dates, the
		// engagement's own `employeeLevel` and its away flag; a candidacy row has no column for any of
		// them, so an argument that stated one would be accepted and dropped.
		for (const member of [
			'startedWorkOn',
			'endWork',
			'short_description',
			'description',
			'anonymousBonus',
			'employeeLevel',
			'offerDate',
			'acceptDate',
			'isAway'
		]) {
			expect(create).not.toContain(member);
			expect(update).not.toContain(member);
		}

		// `status` is written by the two pipeline moves and by the subscriber's own reading of
		// `rejectDate`; a member for it would be a second way to write the pipeline.
		expect(update).not.toMatch(/\bstatus:/);
	});
});

describe('CandidateResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, candidateService } = surfaces();

		const connection = await resolver.candidates(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(candidateService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.candidates();

		expect(connection.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows by the fields the filter declares, and refuses the ones it does not', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.candidates({ status: { eq: 'HIRED' } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([SECOND]);

		const byRate = await resolver.candidates({ billRateValue: { gte: '50' } });
		expect(byRate.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byApplied = await resolver.candidates({ appliedDate: { between: ['2026-02-15', '2026-03-15'] } });
		expect(byApplied.nodes.map((node) => node.id)).toEqual([FIRST]);

		// The account is not a field of this vocabulary, and the refusal says so rather than answering
		// every row.
		const refusal = await resolver.candidates({ user: { eq: ACCOUNT } }).catch((thrown) => thrown);

		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers, and refuses a column it does not', async () => {
		const { resolver } = surfaces();

		const byRate = await resolver.candidates(undefined, [{ field: 'billRateValue', direction: 'ASC' }]);
		expect(byRate.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);

		const error = await resolver
			.candidates(undefined, [{ field: 'cvUrl', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.candidates(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.candidates(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const back = await resolver.candidates(undefined, undefined, {
			last: 1,
			before: second.edges[0].cursor
		});

		expect(back.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(back.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.candidates(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every candidacy', async () => {
		const { resolver } = surfaces();

		const error = await resolver.candidates(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('CandidateResolver — one concept, two protocols, the same operations', () => {
	it('reads one candidacy through the same service method the REST route calls', async () => {
		const { resolver, candidateService } = surfaces();

		expect(await resolver.candidate(FIRST)).toBe(ROWS[0]);
		expect(candidateService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a candidacy that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, candidateService } = surfaces();
		candidateService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.candidate(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls', async () => {
		const { resolver, candidateService } = surfaces();

		expect(await resolver.candidateCount()).toBe(2);
		expect(candidateService.countBy).toHaveBeenCalledWith();
	});

	it('files a candidacy through the command the create route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createCandidate({
			organizationId: ORGANIZATION,
			user: { email: 'ada@example.com', firstName: 'Ada' },
			password: 'a-long-enough-password',
			tagIds: [FIRST]
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CandidateCreateCommand);
		expect(command.input).toEqual(
			expect.objectContaining({
				organizationId: ORGANIZATION,
				user: expect.objectContaining({ email: 'ada@example.com' }),
				password: 'a-long-enough-password',
				tags: [{ id: FIRST }]
			})
		);
	});

	it('files several candidacies through the bulk command, one payload per row', async () => {
		const { resolver, commandBus } = surfaces();
		const payload = {
			organizationId: ORGANIZATION,
			user: { email: 'ada@example.com' },
			password: 'a-long-enough-password'
		};

		await resolver.createCandidatesBulk([payload, payload]);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CandidateBulkCreateCommand);
		expect(command.input).toHaveLength(2);
	});

	it('edits a candidacy through the command the edit route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateCandidate({ id: FIRST, candidateLevel: 'Senior', contactId: ACCOUNT });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CandidateUpdateCommand);
		expect(command.input).toEqual(
			expect.objectContaining({
				id: FIRST,
				candidateLevel: 'Senior',
				contact: { id: ACCOUNT }
			})
		);
		// The identifier columns are lifted out of the body rather than passed beside their relations.
		expect(command.input).not.toHaveProperty('contactId');
	});

	it('moves the pipeline through the two commands the status route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateCandidateStatus(FIRST, 'hired');
		expect(commandBus.execute.mock.calls[0][0]).toBeInstanceOf(CandidateHiredCommand);

		await resolver.updateCandidateStatus(FIRST, 'rejected');
		expect(commandBus.execute.mock.calls[1][0]).toBeInstanceOf(CandidateRejectedCommand);
	});

	it('removes a candidacy through the same service method the removal route calls', async () => {
		const { resolver, candidateService } = surfaces();

		expect(await resolver.deleteCandidate(FIRST)).toBe(true);
		expect(candidateService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores a candidacy through the same two service methods', async () => {
		const { resolver, candidateService } = surfaces();

		const withdrawn = await resolver.softDeleteCandidate(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(candidateService.softRemove).toHaveBeenCalledWith(FIRST);

		expect(await resolver.recoverCandidate(FIRST)).toBe(ROWS[0]);
		expect(candidateService.softRecover).toHaveBeenCalledWith(FIRST);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('CANDIDATE_ALREADY_HIRED: this candidacy is already an engagement.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.updateCandidateStatus(FIRST, 'hired')).rejects.toBe(refusal);
	});
});

describe('CandidateResolver — the guard stack and the permission are the controller’s, field by field', () => {
	it('states on the class the guards and the permission the controller states on its class', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', CandidateController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', CandidateResolver) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard])
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CandidateResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, CandidateController)
		);
		expect(permissionOfField('createCandidate')).toEqual([PermissionsEnum.ORG_CANDIDATES_EDIT]);
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(CandidateController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(CandidateController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(CandidateController, route));
	});

	it('states the view permission on the three reads and the edit permission on the other seven', () => {
		for (const field of ['candidates', 'candidate', 'candidateCount']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_CANDIDATES_VIEW]);
		}

		for (const field of [
			'createCandidate',
			'createCandidatesBulk',
			'updateCandidate',
			'updateCandidateStatus',
			'deleteCandidate',
			'softDeleteCandidate',
			'recoverCandidate'
		]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_CANDIDATES_EDIT]);
		}
	});

	it('holds the three lifecycle fields to the inherited routes they mirror', () => {
		// All three routes are inherited from the CRUD base and run under the class-level edit permission,
		// which is what the fields state.
		for (const [field, route] of [
			['deleteCandidate', 'delete'],
			['softDeleteCandidate', 'softRemove'],
			['recoverCandidate', 'softRecover']
		] as ReadonlyArray<[string, string]>) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(CandidateController)[route])).toBeUndefined();
			expect(permissionOfRoute(CandidateController, route)).toEqual([PermissionsEnum.ORG_CANDIDATES_EDIT]);
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_CANDIDATES_EDIT]);
		}
	});
});

describe('CandidateModule — the resolvers are declared where their dependencies are reachable', () => {
	it('declares both resolvers as providers of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, CandidateModule) ?? []) as unknown[];

		expect(providers).toContain(CandidateResolver);
		expect(providers).toContain(CandidateService);
	});

	it('re-exports the command bus the five write fields dispatch through', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, CandidateModule) ?? []) as unknown[];

		expect(exported).toContain(CandidateService);
		expect(exported.map((entry) => (entry as { name?: string })?.name)).toEqual(
			expect.arrayContaining(['CqrsModule'])
		);
	});

	it('imports the five modules that own the rows the file beside a candidacy is made of', () => {
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, CandidateModule) ?? []) as unknown[];
		const names = imports.map((entry) => (entry as { name?: string })?.name);

		expect(names).toEqual(
			expect.arrayContaining([
				'CandidateDocumentsModule',
				'CandidateEducationModule',
				'CandidateExperienceModule',
				'CandidateSkillModule',
				'CandidateSourceModule'
			])
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
		getHandler: () => (CandidateResolver.prototype as never)[field],
		getClass: () => CandidateResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('CandidateResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, CandidateResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', CandidateResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('candidates')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('candidates');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('candidates'))).resolves.toBe(true);
	});
});
