/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { CqrsModule } from '@nestjs/cqrs';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { LanguagesEnum, OrganizationTeamJoinRequestStatusEnum, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OrganizationTeamJoinRequestController } from './organization-team-join-request.controller';
import { OrganizationTeamJoinRequestModule } from './organization-team-join-request.module';
import { OrganizationTeamJoinRequestResolver } from './organization-team-join-request.resolver';
import { OrganizationTeamJoinRequestService } from './organization-team-join-request.service';
import { OrganizationTeamJoinRequestCreateCommand } from './commands';

/**
 * The join request over GraphQL.
 *
 * The delivered `/api/organization-team-join` routes serve the queue of requests, the ask itself, the
 * presentation of the mailed code, a resend of that code, and the acceptance or rejection of one
 * request. This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the queue is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain and the permissions are the controller's, field by field**, read from the
 *   controller's own metadata rather than restated: this controller states its guards per route rather
 *   than on its class, so the two guarded fields state the pair and the three `@Public()` fields state
 *   nothing at all;
 * - **the write of the ask and the resend answer the acknowledgement**, because that — and not the row —
 *   is what the delivered handlers produce, in a `finally`;
 * - **the action is a closed set of the two members the delivered writer acts on**, so a value it does
 *   not recognise cannot be sent;
 * - the members the delivered answer withholds — the code, the token and the instant the row lapses —
 *   are not members of the type.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TEAM = '00000000-0000-4000-8000-000000000003';
const APPLICANT = '00000000-0000-4000-8000-000000000004';
const PENDING = '00000000-0000-4000-8000-000000000010';
const MOVED = '00000000-0000-4000-8000-000000000011';

/** What the two acknowledgement routes answer, as the delivered handlers produce it. */
const ACK = { status: 200, message: 'OK' };

/**
 * What the validation answers: the row the read resolved, with the identifier the delivered service
 * removes before it answers. That absence is why the schema declares `id` nullable.
 */
const VALIDATED = { email: 'ada@example.com', organizationTeamId: TEAM };

/**
 * The rows a scripted service answers with, in the order the delivered list method returns them: an ask
 * that has been confirmed and is waiting for a manager, and one that was confirmed and has since
 * lapsed.
 */
const ROWS = [
	{
		id: PENDING,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		organizationTeamId: TEAM,
		email: 'zoe@example.com',
		fullName: null,
		linkAddress: null,
		position: 'Designer',
		status: null,
		isExpired: false,
		userId: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: MOVED,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		organizationTeamId: TEAM,
		email: 'ada@example.com',
		fullName: 'Ada Lovelace',
		linkAddress: null,
		position: null,
		status: OrganizationTeamJoinRequestStatusEnum.REQUESTED,
		isExpired: true,
		userId: APPLICANT,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const organizationTeamJoinRequestService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		validateJoinRequest: jest.fn().mockResolvedValue(VALIDATED),
		resendConfirmationCode: jest.fn().mockResolvedValue(ACK),
		acceptRequestToJoin: jest.fn().mockResolvedValue(undefined)
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ACK) };

	return {
		organizationTeamJoinRequestService,
		commandBus,
		resolver: new OrganizationTeamJoinRequestResolver(
			organizationTeamJoinRequestService as never,
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

/**
 * The root fields this domain contributes.
 *
 * The concept's name is a *prefix* of its neighbours' — `organizationTeam`, `organizationTeamEmployee`
 * and `organizationTeamCreate` all begin with the same sixteen letters — so the query match is anchored
 * at both ends rather than a substring search, which would have counted another domain's fields as this
 * one's. The mutations carry the concept inside the name instead, which no neighbour does, so they are
 * matched on it.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned = operation === 'Query' ? /^organizationTeamJoinRequests?$/ : /organizationTeamJoinRequest/i;

	return rootFields(operation).filter((field) => owned.test(field)).sort();
}

/** The printed body of one type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`(?:type|input|enum) ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/**
 * Whether an object or input type declares a member.
 *
 * Read from the declaration rather than from the printed body as a whole, because the printed body
 * carries the descriptions too — and a description that explains *why* a member is absent names it,
 * which is exactly what a `not.toContain` assertion would trip over.
 */
function declaresMember(name: string, member: string): boolean {
	return new RegExp(`^\\s*${member}\\s*:`, 'm').test(typeBody(name));
}

/** Whether an enum declares a value, whose printed form is the bare name on its own line. */
function declaresEnumValue(name: string, value: string): boolean {
	return new RegExp(`^\\s*${value}\\s*$`, 'm').test(typeBody(name));
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OrganizationTeamJoinRequestController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof OrganizationTeamJoinRequestController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OrganizationTeamJoinRequestController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = OrganizationTeamJoinRequestResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one field runs under: the class chain the gate is declared on, then the field's own. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', OrganizationTeamJoinRequestResolver) ?? [];
	const restated =
		Reflect.getMetadata('__guards__', (OrganizationTeamJoinRequestResolver.prototype as never)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** Every root field and the delivered route it mirrors. */
const ROUTES: ReadonlyArray<[string, string]> = [
	['organizationTeamJoinRequests', 'findAll'],
	['createOrganizationTeamJoinRequest', 'create'],
	['validateOrganizationTeamJoinRequest', 'validateJoinRequest'],
	['resendOrganizationTeamJoinRequestCode', 'resendConfirmationCode'],
	['acceptOrganizationTeamJoinRequest', 'acceptRequestToJoin']
];

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
	const guard = new FeatureFlagGuard(cache as never, new Reflector(), featureService as never);

	return { guard, featureService };
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (OrganizationTeamJoinRequestResolver.prototype as never)[field],
		getClass: () => OrganizationTeamJoinRequestResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OrganizationTeamJoinRequestResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the queue query and the four writes', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['organizationTeamJoinRequests']));
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createOrganizationTeamJoinRequest',
				'validateOrganizationTeamJoinRequest',
				'resendOrganizationTeamJoinRequestCode',
				'acceptOrganizationTeamJoinRequest'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller declares one read and four writes and inherits nothing from a CRUD base, so the
		// surface is exactly what it serves: no node query, no count, and no lifecycle move.
		expect(ownedRootFields('Query')).toEqual(['organizationTeamJoinRequests']);
		expect(ownedRootFields('Mutation')).toEqual([
			'acceptOrganizationTeamJoinRequest',
			'createOrganizationTeamJoinRequest',
			'resendOrganizationTeamJoinRequestCode',
			'validateOrganizationTeamJoinRequest'
		]);
	});

	it('declares the connection, its edge, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type OrganizationTeamJoinRequestConnection \{\s*nodes: \[OrganizationTeamJoinRequest!\]!\s*edges: \[OrganizationTeamJoinRequestEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type OrganizationTeamJoinRequestEdge \{\s*node: OrganizationTeamJoinRequest!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input OrganizationTeamJoinRequestFilter \{/);
		expect(printed).toMatch(/input OrganizationTeamJoinRequestSort \{/);
		expect(printed).toMatch(
			/enum OrganizationTeamJoinRequestSortField \{\s*createdAt\s*updatedAt\s*email\s*status\s*isExpired\s*\}/
		);
	});

	it('carries the request row as the delivered read answers it', () => {
		expect(declaresMember('OrganizationTeamJoinRequest', 'email')).toBe(true);
		expect(declaresMember('OrganizationTeamJoinRequest', 'status')).toBe(true);
		expect(declaresMember('OrganizationTeamJoinRequest', 'isExpired')).toBe(true);
		// The relations are the identifiers the row itself carries: the rows beside them are joined by no
		// read this surface mirrors.
		expect(declaresMember('OrganizationTeamJoinRequest', 'organizationTeamId')).toBe(true);
		expect(declaresMember('OrganizationTeamJoinRequest', 'userId')).toBe(true);
		expect(declaresMember('OrganizationTeamJoinRequest', 'organizationTeam')).toBe(false);
		expect(declaresMember('OrganizationTeamJoinRequest', 'user')).toBe(false);
	});

	it('withholds the three members the delivered answer withholds', () => {
		// `code`, `token` and `expiredAt` are excluded from the REST answer by the entity's own
		// `@Exclude`, so a field for one of them would serve over this door what the other withholds.
		for (const withheld of ['code', 'token', 'expiredAt']) {
			expect(declaresMember('OrganizationTeamJoinRequest', withheld)).toBe(false);
		}
		// No route withdraws or restores a request, so the soft-delete column is the effect of no
		// capability a client can reach.
		expect(declaresMember('OrganizationTeamJoinRequest', 'deletedAt')).toBe(false);
	});

	it('states the identifier as nullable, because the validation answers without one', () => {
		// The delivered validation removes the identifier from the row before it answers, so the member
		// cannot be non-null on this type; the connection always carries one, and a nullable field is the
		// statement that covers both answers honestly.
		expect(typeBody('OrganizationTeamJoinRequest')).toMatch(/^\s*id: ID$/m);
		expect(typeBody('OrganizationTeamJoinRequest')).not.toMatch(/^\s*id: ID!$/m);
	});

	it('states the acknowledgement the two handlers produce, and nothing beside it', () => {
		// The pair the delivered handlers build: the status they put in the body, which is `200` on both
		// routes while the ask's transport answers `201`, and the message they put beside it.
		expect(typeBody('OrganizationTeamJoinRequestOutcome')).toMatch(/^\s*status: Int!$/m);
		expect(typeBody('OrganizationTeamJoinRequestOutcome')).toMatch(/^\s*message: String!$/m);
		// The acknowledgement is the answer of the ask and of the resend, and of nothing else: the
		// validation answers the row it resolved and the move answers whether the call ran.
		expect(printed).toMatch(
			/createOrganizationTeamJoinRequest\(input: CreateOrganizationTeamJoinRequestInput!\): OrganizationTeamJoinRequestOutcome!/
		);
		expect(printed).toMatch(
			/resendOrganizationTeamJoinRequestCode\(input: ResendOrganizationTeamJoinRequestCodeInput!\): OrganizationTeamJoinRequestOutcome!/
		);
		expect(printed).toMatch(
			/validateOrganizationTeamJoinRequest\(input: ValidateOrganizationTeamJoinRequestInput!\): OrganizationTeamJoinRequest!/
		);
	});

	it('declares the action as the two members the delivered writer acts on', () => {
		const body = typeBody('OrganizationTeamJoinRequestAction');

		expect(declaresEnumValue('OrganizationTeamJoinRequestAction', 'ACCEPTED')).toBe(true);
		expect(declaresEnumValue('OrganizationTeamJoinRequestAction', 'REJECTED')).toBe(true);
		// The third member of the contracts vocabulary is the state a request is already in, and the
		// delivered writer does nothing at all for it: as a value the schema accepted it would be answered
		// as though the move had been made while the row kept its state.
		expect(declaresEnumValue('OrganizationTeamJoinRequestAction', 'REQUESTED')).toBe(false);
		expect(body).not.toContain('REQUESTED');
		// The state of a row still carries all three, because the delivered reader can produce all three.
		expect(declaresEnumValue('OrganizationTeamJoinRequestStatus', 'REQUESTED')).toBe(true);
		expect(declaresEnumValue('OrganizationTeamJoinRequestStatus', 'ACCEPTED')).toBe(true);
		expect(declaresEnumValue('OrganizationTeamJoinRequestStatus', 'REJECTED')).toBe(true);
		// The move states the closed set as its argument rather than a free string.
		expect(printed).toMatch(
			/acceptOrganizationTeamJoinRequest\(id: ID!, action: OrganizationTeamJoinRequestAction!\): Boolean!/
		);
	});

	it('declares only the ask members the delivered write reads, and not one it discards', () => {
		expect(declaresMember('CreateOrganizationTeamJoinRequestInput', 'email')).toBe(true);
		expect(declaresMember('CreateOrganizationTeamJoinRequestInput', 'organizationTeamId')).toBe(true);
		expect(declaresMember('CreateOrganizationTeamJoinRequestInput', 'appName')).toBe(true);
		expect(declaresMember('CreateOrganizationTeamJoinRequestInput', 'companyName')).toBe(true);
		// The delivered create builds its row from the team, the address, the generated credentials and a
		// null status: a stated name, link, position or state is validated by the delivered body and then
		// dropped, so none of them is offered.
		for (const discarded of ['fullName', 'linkAddress', 'position', 'status']) {
			expect(declaresMember('CreateOrganizationTeamJoinRequestInput', discarded)).toBe(false);
		}
		// The tenant and the organization are stamped from the team the request names.
		for (const stamped of ['tenantId', 'organizationId', 'code', 'token']) {
			expect(declaresMember('CreateOrganizationTeamJoinRequestInput', stamped)).toBe(false);
		}
	});

	it('declares the two credentials the validation accepts, and the address and team it matches on', () => {
		expect(declaresMember('ValidateOrganizationTeamJoinRequestInput', 'email')).toBe(true);
		expect(declaresMember('ValidateOrganizationTeamJoinRequestInput', 'organizationTeamId')).toBe(true);
		expect(declaresMember('ValidateOrganizationTeamJoinRequestInput', 'code')).toBe(true);
		expect(declaresMember('ValidateOrganizationTeamJoinRequestInput', 'token')).toBe(true);
		// Neither is required by the schema, because the delivered DTO requires exactly one of the two —
		// a rule no input type can state — and the field's own description carries it.
		expect(printed).toMatch(/input ValidateOrganizationTeamJoinRequestInput \{/);
		expect(typeBody('ValidateOrganizationTeamJoinRequestInput')).not.toMatch(/^\s*code: String!$/m);
		expect(typeBody('ValidateOrganizationTeamJoinRequestInput')).not.toMatch(/^\s*token: String!$/m);
		// The row is named by the address and the team, never by its identifier.
		expect(declaresMember('ValidateOrganizationTeamJoinRequestInput', 'id')).toBe(false);
	});

	it('offers no argument and no field the controller does not serve', () => {
		// The delivered list method reads live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/organizationTeamJoinRequests\([^)]*withDeleted/);
		// The controller declares no `GET /:id` and no count route, so neither is a root field here.
		expect(printed).not.toMatch(/^\s*organizationTeamJoinRequest\(/m);
		expect(printed).not.toMatch(/organizationTeamJoinRequestCount/);
	});
});

describe('OrganizationTeamJoinRequestResolver — the connection contract', () => {
	it('answers the queue with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, organizationTeamJoinRequestService } = surfaces();

		const connection = await resolver.organizationTeamJoinRequests(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when its query string states nothing.
		expect(organizationTeamJoinRequestService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(PENDING);
	});

	it('orders the queue newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.organizationTeamJoinRequests();

		expect(connection.nodes.map((node) => node.id)).toEqual([PENDING, MOVED]);
	});

	it('narrows by the fields the filter declares, including the derived liveness flag', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.organizationTeamJoinRequests({
			status: { eq: OrganizationTeamJoinRequestStatusEnum.REQUESTED }
		});
		expect(byStatus.nodes.map((node) => node.id)).toEqual([MOVED]);

		// A row whose state is still unset is the one that has been confirmed and not yet moved, which is
		// the `isNull` case and never an `eq`.
		const unset = await resolver.organizationTeamJoinRequests({ status: { isNull: true } });
		expect(unset.nodes.map((node) => node.id)).toEqual([PENDING]);

		const lapsed = await resolver.organizationTeamJoinRequests({ isExpired: { eq: true } });
		expect(lapsed.nodes.map((node) => node.id)).toEqual([MOVED]);

		const byAddress = await resolver.organizationTeamJoinRequests({ email: { ilike: 'ada%' } });
		expect(byAddress.nodes.map((node) => node.id)).toEqual([MOVED]);

		const byTeam = await resolver.organizationTeamJoinRequests({ organizationTeamId: { eq: TEAM } });
		expect(byTeam.totalCount).toBe(2);
	});

	it('refuses a filter on a relation the delivered read does not join', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationTeamJoinRequests({ organizationTeam: { eq: TEAM } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byAddress = await resolver.organizationTeamJoinRequests(undefined, [{ field: 'email', direction: 'ASC' }]);
		expect(byAddress.nodes.map((node) => node.id)).toEqual([MOVED, PENDING]);

		const byLiveness = await resolver.organizationTeamJoinRequests(undefined, [
			{ field: 'isExpired', direction: 'DESC' }
		]);
		expect(byLiveness.nodes.map((node) => node.id)).toEqual([MOVED, PENDING]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.organizationTeamJoinRequests(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([PENDING]);

		const second = await resolver.organizationTeamJoinRequests(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([MOVED]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.organizationTeamJoinRequests(undefined, undefined, undefined, 20);

		const last = await resolver.organizationTeamJoinRequests(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([PENDING]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// `position` is filterable and not sortable, which is the difference the two declarations exist
		// to keep readable: a field a caller may narrow by is not automatically a field to order by.
		const error = await resolver
			.organizationTeamJoinRequests(undefined, [{ field: 'position', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationTeamJoinRequests(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('OrganizationTeamJoinRequestResolver — one concept, two protocols, the same operations', () => {
	it('reads the queue through the same service method the REST route calls', async () => {
		const { resolver, organizationTeamJoinRequestService } = surfaces();

		expect((await resolver.organizationTeamJoinRequests()).totalCount).toBe(2);
		expect(organizationTeamJoinRequestService.findAll).toHaveBeenCalledWith({});
	});

	it('files an ask through the command the REST route dispatches, in the caller’s language', async () => {
		const { resolver, commandBus } = surfaces();

		expect(
			await resolver.createOrganizationTeamJoinRequest({
				email: 'ada@example.com',
				organizationTeamId: TEAM,
				appName: 'Acme'
			})
		).toBe(ACK);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationTeamJoinRequestCreateCommand);
		expect(command.input).toEqual({ email: 'ada@example.com', organizationTeamId: TEAM, appName: 'Acme' });
		// The language is the `language` request header, or English when none was stated — the same
		// header and the same default the delivered route's own decorator reads.
		expect(command.languageCode).toBe(LanguagesEnum.ENGLISH);
	});

	it('presents the mailed credential through the same service method the REST route calls', async () => {
		const { resolver, organizationTeamJoinRequestService } = surfaces();
		const input = { email: 'ada@example.com', organizationTeamId: TEAM, code: 'A1B2C3' };

		expect(await resolver.validateOrganizationTeamJoinRequest(input)).toBe(VALIDATED);
		expect(organizationTeamJoinRequestService.validateJoinRequest).toHaveBeenCalledWith(input);
	});

	it('lets a validation miss stay a refusal rather than answering an empty row', async () => {
		const { resolver, organizationTeamJoinRequestService } = surfaces();
		organizationTeamJoinRequestService.validateJoinRequest.mockRejectedValueOnce(new BadRequestException());

		// The delivered service answers a request that is not there, has lapsed or has already moved with
		// a bare 400, and the field passes that refusal on: a null here would be a fourth answer the route
		// does not give.
		await expect(
			resolver.validateOrganizationTeamJoinRequest({
				email: 'ada@example.com',
				organizationTeamId: TEAM,
				token: 'not-a-token'
			})
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('mails a fresh code through the same service method, with the route’s own single argument', async () => {
		const { resolver, organizationTeamJoinRequestService } = surfaces();

		expect(
			await resolver.resendOrganizationTeamJoinRequestCode({
				email: 'ada@example.com',
				organizationTeamId: TEAM,
				appName: 'Acme'
			})
		).toBe(ACK);

		// The delivered route passes the body and nothing else: no language is stated, so the message is
		// written in whatever the mailer falls back to on both protocols.
		expect(organizationTeamJoinRequestService.resendConfirmationCode.mock.calls[0]).toHaveLength(1);
		expect(organizationTeamJoinRequestService.resendConfirmationCode).toHaveBeenCalledWith({
			email: 'ada@example.com',
			organizationTeamId: TEAM,
			appName: 'Acme'
		});
	});

	it('moves a request through the same service method the REST route calls', async () => {
		const { resolver, organizationTeamJoinRequestService } = surfaces();

		expect(
			await resolver.acceptOrganizationTeamJoinRequest(PENDING, OrganizationTeamJoinRequestStatusEnum.REJECTED)
		).toBe(true);
		expect(organizationTeamJoinRequestService.acceptRequestToJoin).toHaveBeenCalledWith(
			PENDING,
			OrganizationTeamJoinRequestStatusEnum.REJECTED,
			LanguagesEnum.ENGLISH
		);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, organizationTeamJoinRequestService } = surfaces();
		const refusal = new Error('ORGANIZATION_TEAM_JOIN_REQUEST_ALREADY_MOVED: this request is no longer pending.');

		organizationTeamJoinRequestService.acceptRequestToJoin.mockRejectedValueOnce(refusal);

		await expect(
			resolver.acceptOrganizationTeamJoinRequest(PENDING, OrganizationTeamJoinRequestStatusEnum.ACCEPTED)
		).rejects.toBe(refusal);
	});
});

describe('OrganizationTeamJoinRequestResolver — the guard stack and the permissions are the controller’s', () => {
	it('runs every field under the guard chain its own route runs under, plus the gate', () => {
		for (const [field, handler] of ROUTES) {
			// The controller declares its guards per route rather than on the class, so each field states
			// the same pair — and the gate is the one addition, declared on the class for every field.
			expect(guardsOfField(field).sort()).toEqual(
				[...guardsOfRoute(OrganizationTeamJoinRequestController, handler), FeatureFlagGuard].sort()
			);
		}
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(OrganizationTeamJoinRequestController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationTeamJoinRequestController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationTeamJoinRequestResolver)).toBeUndefined();
		// The controller guards its two routes and not its class, so a class-level guard here would narrow
		// the three public fields below what their routes serve.
		expect(Reflect.getMetadata('__guards__', OrganizationTeamJoinRequestController)).toBeUndefined();
		expect(Reflect.getMetadata('__guards__', OrganizationTeamJoinRequestResolver)).toEqual([FeatureFlagGuard]);
	});

	it('states the read pair on the queue and the move pair on the move', () => {
		expect(permissionOfField('organizationTeamJoinRequests')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.ORG_TEAM_JOIN_REQUEST_VIEW
		]);
		expect(permissionOfField('acceptOrganizationTeamJoinRequest')).toEqual([
			PermissionsEnum.ORG_TEAM_JOIN_REQUEST_VIEW,
			PermissionsEnum.ORG_TEAM_JOIN_REQUEST_EDIT
		]);
		expect(Reflect.getMetadata('__guards__', OrganizationTeamJoinRequestController.prototype.findAll)).toEqual([
			TenantPermissionGuard,
			PermissionGuard
		]);
		expect(
			Reflect.getMetadata('__guards__', OrganizationTeamJoinRequestController.prototype.acceptRequestToJoin)
		).toEqual([TenantPermissionGuard, PermissionGuard]);
	});

	it('asks for no credential and no permission on the three public routes', () => {
		// The three fields mirror the controller's `@Public()` routes, named by field and by handler so
		// that both halves of the parity are read from metadata rather than restated.
		const publicRoutes: ReadonlyArray<[string, string]> = [
			['createOrganizationTeamJoinRequest', 'create'],
			['validateOrganizationTeamJoinRequest', 'validateJoinRequest'],
			['resendOrganizationTeamJoinRequestCode', 'resendConfirmationCode']
		];

		for (const [field, handler] of publicRoutes) {
			// `@Public()` on the route is mirrored by `@Public()` on the field, and neither the tenant
			// guard nor a permission follows it: the address that asks to join holds no credential yet.
			expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, handlersOf(OrganizationTeamJoinRequestController)[handler])).toBe(true);
			expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, (OrganizationTeamJoinRequestResolver.prototype as never)[field])).toBe(true);
			expect(permissionOfField(field)).toBeUndefined();
			expect(guardsOfField(field)).toEqual([FeatureFlagGuard]);
			expect(Reflect.getMetadata('__guards__', handlersOf(OrganizationTeamJoinRequestController)[handler])).toBeUndefined();
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(OrganizationTeamJoinRequestController)[handler])).toBeUndefined();
		}

		for (const [field, handler] of ROUTES.filter(([field]) => !publicRoutes.some(([name]) => name === field))) {
			// The two guarded routes are the other half: their fields state the pair, and mark nothing
			// public, because a field that opened a route the permission model closes would be a way
			// around that model.
			expect(
				Reflect.getMetadata(PUBLIC_METHOD_METADATA, (OrganizationTeamJoinRequestResolver.prototype as never)[field])
			).toBeUndefined();
			expect(Reflect.getMetadata('__guards__', handlersOf(OrganizationTeamJoinRequestController)[handler])).toEqual([
				TenantPermissionGuard,
				PermissionGuard
			]);
		}
	});
});

describe('OrganizationTeamJoinRequestResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationTeamJoinRequestResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OrganizationTeamJoinRequestResolver)).toEqual([FeatureFlagGuard]);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('organizationTeamJoinRequests'))
			.catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('organizationTeamJoinRequests');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the public routes’ fields too, because the gate is the class’s one statement', async () => {
		const { guard } = gate(false);

		// The three fields mirror routes the controller serves without a guard and without a permission,
		// and the gate is stated once, on the class, rather than restated per field — so nothing on this
		// surface is exempt from the capability, the question about an address being the one a caller
		// would most want to ask of a switched-off endpoint.
		for (const field of [
			'createOrganizationTeamJoinRequest',
			'validateOrganizationTeamJoinRequest',
			'resendOrganizationTeamJoinRequestCode'
		]) {
			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('organizationTeamJoinRequests'))).resolves.toBe(true);
	});
});

describe('OrganizationTeamJoinRequestModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, OrganizationTeamJoinRequestModule) ??
			[]) as unknown[];

		// The resolver is an ordinary Nest provider, so it can only inject what the module hosting it can
		// reach: the service it reads through and the command bus its two writes dispatch through.
		expect(providers).toContain(OrganizationTeamJoinRequestResolver);
		expect(providers).toContain(OrganizationTeamJoinRequestService);
	});

	it('exports the command bus the resolver’s write fields dispatch through', () => {
		// A resolver is a provider of whichever module the Apollo configuration scans, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, OrganizationTeamJoinRequestModule) ??
			[]) as unknown[];

		expect(exported).toContain(CqrsModule);
	});

	it('reaches the module the permission guards on its fields look their permissions up through', () => {
		// The tenant and permission guards are providers of whichever module declares the resolver they
		// protect, so this module is what has to reach `RolePermissionService` — without it the API boot
		// fails on an unresolved dependency, which no static check sees.
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, OrganizationTeamJoinRequestModule) ??
			[]) as Array<{ forwardRef?: () => unknown }>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(resolved).toContain(RolePermissionModule);
	});
});
