/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { CqrsModule } from '@nestjs/cqrs';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { InviteController } from './invite.controller';
import { InviteModule } from './invite.module';
import { InviteResolver } from './invite.resolver';
import { InviteService } from './invite.service';
import {
	InviteAcceptCommand,
	InviteAcceptOrganizationContactCommand,
	InviteBulkCreateCommand,
	InviteOrganizationContactCommand,
	InviteRejectCommand,
	InviteResendCommand
} from './commands';
import { FindInviteByEmailCodeQuery, FindInviteByEmailTokenQuery } from './queries';

/**
 * The invitation over GraphQL.
 *
 * The delivered `/api/invite` routes serve a register, the caller's own queue, the two presentations
 * of a mailed credential, a bulk send, a resend, three acceptances, a refusal, a contact invitation,
 * a removal and a response. This suite pins the half of the two-protocol doctrine that is easy to get
 * quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the two registers
 *   are connections with the platform's own cursor codec behind them, so a cursor obtained over REST
 *   resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command or query, that the REST
 *   route reaches — the five `@Public()` routes included, because a public route is a capability like
 *   any other and a field that reached something else would be a second implementation of it;
 * - **the guard chain and the permission are the controller's, field by field**, read from the
 *   controller's own metadata rather than restated: this controller states its guards per route rather
 *   than on its class, so the seven guarded fields state the pair and the five `@Public()` fields state
 *   nothing at all;
 * - **the five public fields are nevertheless behind the class gate**, which is the limitation the
 *   resolver's own class comment records, and the last two suites assert it rather than describing it;
 * - the credential — the token and the code — is a member of no field of the object type, because this
 *   surface answers an invitation's state and not the pair that redeems it.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TEAM = '00000000-0000-4000-8000-000000000003';
const ROLE = '00000000-0000-4000-8000-000000000004';
const INVITER = '00000000-0000-4000-8000-000000000005';
const PENDING = '00000000-0000-4000-8000-000000000010';
const LAPSED = '00000000-0000-4000-8000-000000000011';

/**
 * The rows a scripted service answers with, in the order the delivered register returns them: an
 * invitation that is still waiting for its address, and one whose instant has passed.
 */
const ROWS = [
	{
		id: PENDING,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		email: 'zoe@example.com',
		fullName: null,
		status: 'INVITED',
		expireDate: new Date('2026-06-01T10:00:00.000Z'),
		actionDate: null,
		isExpired: false,
		roleId: ROLE,
		userId: null,
		invitedByUserId: INVITER,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: LAPSED,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		email: 'ada@example.com',
		fullName: 'Ada Lovelace',
		status: 'INVITED',
		expireDate: new Date('2026-01-01T10:00:00.000Z'),
		actionDate: null,
		isExpired: true,
		roleId: ROLE,
		userId: null,
		invitedByUserId: INVITER,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** What the bulk send answers, as the delivered handler produces it. */
const OUTCOME = { items: [ROWS[0]], total: 1, ignored: 1 };

/** The resolver, over a scripted service and the two buses its writes dispatch through. */
function surfaces() {
	const inviteService = {
		findAllInvites: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		getCurrentUserInvites: jest.fn().mockResolvedValue({ items: [ROWS[0]], total: 1 }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		handleInvitationResponse: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };
	const queryBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		inviteService,
		commandBus,
		queryBus,
		resolver: new InviteResolver(inviteService as never, commandBus as never, queryBus as never)
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
 * The concept's name is a *stem* rather than a word: the two registers and the two presentations
 * carry `invite`, and the response a caller gives an invitation carries `invitation` — the same
 * concept under its longer spelling, which a search for `invite` alone would have missed. No other
 * domain of the composed schema declares a field whose name carries the stem at all, which is what
 * makes this a statement about this domain and not about its neighbours; the assertion below is what
 * keeps that true.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('invit'))
		.sort();
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

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof InviteController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof InviteController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof InviteController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = InviteResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one field runs under: the class chain the gate is declared on, then the field's own. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', InviteResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', (InviteResolver.prototype as never)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** Every root field and the delivered route it mirrors, which is the parity table this suite holds. */
const ROUTES: ReadonlyArray<[string, string]> = [
	['invites', 'findAll'],
	['myInvites', 'getCurrentUserInvites'],
	['inviteByToken', 'validateInviteByToken'],
	['inviteByCode', 'validateInviteByCode'],
	['sendInvites', 'createManyInvitesWithEmails'],
	['resendInvite', 'resendInvite'],
	['acceptInvite', 'acceptInvitation'],
	['rejectInvite', 'rejectInvitation'],
	['acceptOrganizationContactInvite', 'acceptOrganizationContactInvite'],
	['inviteOrganizationContact', 'inviteOrganizationContact'],
	['deleteInvite', 'delete'],
	['handleInvitationResponse', 'handleInvitationResponse']
];

/** The five fields whose routes the controller marks `@Public()`. */
const PUBLIC_ROUTES: ReadonlyArray<[string, string]> = [
	['inviteByToken', 'validateInviteByToken'],
	['inviteByCode', 'validateInviteByCode'],
	['acceptInvite', 'acceptInvitation'],
	['rejectInvite', 'rejectInvitation'],
	['acceptOrganizationContactInvite', 'acceptOrganizationContactInvite']
];

describe('InviteResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the two registers and the two presentations of a credential as queries', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['invites', 'myInvites', 'inviteByToken', 'inviteByCode'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'sendInvites',
				'resendInvite',
				'acceptInvite',
				'rejectInvite',
				'acceptOrganizationContactInvite',
				'inviteOrganizationContact',
				'deleteInvite',
				'handleInvitationResponse'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller declares twelve routes and inherits none from a CRUD base, so the surface is
		// exactly what it serves: no node query, no count, and no lifecycle move beyond the removal.
		expect(ownedRootFields('Query')).toEqual(['inviteByCode', 'inviteByToken', 'invites', 'myInvites']);
		expect(ownedRootFields('Mutation')).toEqual([
			'acceptInvite',
			'acceptOrganizationContactInvite',
			'deleteInvite',
			'handleInvitationResponse',
			'inviteOrganizationContact',
			'rejectInvite',
			'resendInvite',
			'sendInvites'
		]);
	});

	it('declares the connection, its edge, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type InviteConnection \{\s*nodes: \[Invite!\]!\s*edges: \[InviteEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type InviteEdge \{\s*node: Invite!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input InviteFilter \{/);
		expect(printed).toMatch(/input InviteSort \{/);
		expect(printed).toMatch(
			/enum InviteSortField \{\s*id\s*email\s*fullName\s*status\s*expireDate\s*actionDate\s*createdAt\s*updatedAt\s*deletedAt\s*\}/
		);
	});

	it('carries the invitation row as the delivered reads answer it', () => {
		expect(declaresMember('Invite', 'email')).toBe(true);
		expect(declaresMember('Invite', 'status')).toBe(true);
		expect(declaresMember('Invite', 'expireDate')).toBe(true);
		expect(declaresMember('Invite', 'actionDate')).toBe(true);
		expect(declaresMember('Invite', 'isExpired')).toBe(true);
		// The vocabulary of the state belongs to the contracts, which types the column and the
		// transitions the delivered writers make on it, so the member is carried as its value.
		expect(typeBody('Invite')).toMatch(/^\s*status: String!$/m);
	});

	it('carries the three identifier columns and no relation the reads do not join', () => {
		// Every collection of this row is loaded only when a REST caller names it, and no read behind
		// this surface names one — so a field for one of them would read null on every row answered here.
		for (const relation of ['role', 'user', 'invitedByUser', 'projects', 'organizationContacts', 'departments', 'teams']) {
			expect(declaresMember('Invite', relation)).toBe(false);
		}
		// The three that are columns of the row travel with every read of it, so they are carried.
		expect(declaresMember('Invite', 'roleId')).toBe(true);
		expect(declaresMember('Invite', 'userId')).toBe(true);
		expect(declaresMember('Invite', 'invitedByUserId')).toBe(true);
	});

	it('withholds the credential the message carries', () => {
		// The token is what the accept route consumes and the code is the other half of the same
		// single-use pair — a pair the entity already excludes from the answers it is serialised into.
		// A member for either would put a live acceptance credential on every row of an administration
		// list, which is a capability neither surface's routes intend.
		expect(declaresMember('Invite', 'token')).toBe(false);
		expect(declaresMember('Invite', 'code')).toBe(false);
		// The entity's own `@Exclude` on the code is the entity's decision, and this surface follows it
		// rather than widening it; the listing reads are where the two protocols agree on the omission.
		expect(declaresMember('Invite', 'deletedAt')).toBe(true);
	});

	it('states the send as an envelope of its own, and not as the invitation type', () => {
		// The delivered handler answers the rows it wrote beside a count of the addresses it skipped;
		// flattening that into a list would lose the count, which is the only way a caller learns that
		// an address it named was already invited.
		expect(typeBody('InviteSendOutcome')).toMatch(/^\s*items: \[Invite!\]!$/m);
		expect(typeBody('InviteSendOutcome')).toMatch(/^\s*total: Int!$/m);
		expect(typeBody('InviteSendOutcome')).toMatch(/^\s*ignored: Int!$/m);
		expect(printed).toMatch(/sendInvites\(input: CreateInvitesInput!\): InviteSendOutcome!/);
		// The resend answers the invitation the caller named, not the envelope and not the store's
		// update result.
		expect(printed).toMatch(/resendInvite\(input: ResendInviteInput!\): Invite!/);
		// The one acceptance whose answer is a shape no single type can state is carried as a document.
		expect(printed).toMatch(/acceptInvite\(input: AcceptInviteInput!\): JSON!/);
		expect(printed).toMatch(/rejectInvite\(input: RejectInviteInput!\): JSON!/);
		expect(printed).toMatch(
			/acceptOrganizationContactInvite\(input: AcceptOrganizationContactInviteInput!\): JSON!/
		);
		expect(printed).toMatch(/inviteOrganizationContact\(id: ID!\): JSON!/);
	});

	it('declares the send members the delivered write reads, and not one it discards', () => {
		expect(declaresMember('CreateInvitesInput', 'emailIds')).toBe(true);
		expect(declaresMember('CreateInvitesInput', 'inviteType')).toBe(true);
		expect(declaresMember('CreateInvitesInput', 'roleId')).toBe(true);
		expect(declaresMember('CreateInvitesInput', 'organizationId')).toBe(true);
		expect(declaresMember('CreateInvitesInput', 'teamIds')).toBe(true);
		expect(declaresMember('CreateInvitesInput', 'projectIds')).toBe(true);
		expect(declaresMember('CreateInvitesInput', 'departmentIds')).toBe(true);
		expect(declaresMember('CreateInvitesInput', 'organizationContactIds')).toBe(true);
		expect(declaresMember('CreateInvitesInput', 'callbackUrl')).toBe(true);
		expect(declaresMember('CreateInvitesInput', 'queryParams')).toBe(true);
		// The addresses are addresses, and there is at least one of them: a send that names none has
		// nothing to send. The collections the write resolves itself are identifiers.
		expect(typeBody('CreateInvitesInput')).toMatch(/^\s*emailIds: \[String!\]!$/m);
		expect(typeBody('CreateInvitesInput')).toMatch(/^\s*teamIds: \[ID!\]$/m);
		// The delivered body carries a `sentTo` member that no part of the write reads, so it is not
		// offered: a member stated and dropped is worse than one that is not there.
		expect(declaresMember('CreateInvitesInput', 'sentTo')).toBe(false);
		expect(declaresMember('CreateInvitesInput', 'tenantId')).toBe(false);
		// The kind is a closed set, because the delivered writer switches on it: a value it does not
		// recognise is answered as an error rather than as a send.
		expect(typeBody('InvitationType')).toContain('USER');
		expect(typeBody('InvitationType')).toContain('TEAM');
	});

	it('declares the resend and the refusal as their delivered bodies state them', () => {
		expect(declaresMember('ResendInviteInput', 'inviteId')).toBe(true);
		expect(declaresMember('ResendInviteInput', 'inviteType')).toBe(true);
		expect(declaresMember('ResendInviteInput', 'callbackUrl')).toBe(true);
		// The delivered write reads neither the organization nor the tenant: the row already belongs to
		// both, and it is the invitation's own organization the message is composed with.
		expect(declaresMember('ResendInviteInput', 'organizationId')).toBe(false);
		expect(declaresMember('ResendInviteInput', 'tenantId')).toBe(false);

		expect(declaresMember('RejectInviteInput', 'email')).toBe(true);
		expect(declaresMember('RejectInviteInput', 'token')).toBe(true);
		expect(declaresMember('RejectInviteInput', 'code')).toBe(true);
		expect(declaresMember('RejectInviteInput', 'tenantId')).toBe(false);
	});

	it('declares the account body without the members the handler settles itself', () => {
		expect(declaresMember('AcceptInviteInput', 'email')).toBe(true);
		expect(declaresMember('AcceptInviteInput', 'user')).toBe(true);
		expect(declaresMember('AcceptInviteInput', 'password')).toBe(true);
		expect(declaresMember('AcceptInviteInput', 'terms')).toBe(true);
		// The delivered handler overwrites the address, the role, the tenant and the invitation itself
		// before it registers anything, because the route is public and each of them decides who the new
		// account is or which tenant it lands in.
		for (const settled of ['inviteId', 'originalUrl', 'organizationId', 'createdByUserId']) {
			expect(declaresMember('AcceptInviteInput', settled)).toBe(false);
		}
		// No input of this surface states a tenant, and neither does the account body inside one.
		for (const input of ['AcceptInviteInput', 'AcceptOrganizationContactInviteInput', 'AcceptInviteUserInput']) {
			expect(declaresMember(input, 'tenantId')).toBe(false);
			expect(declaresMember(input, 'tenant')).toBe(false);
		}
		// The role is pinned to the invitation's own on both acceptance paths.
		expect(declaresMember('AcceptInviteUserInput', 'roleId')).toBe(false);
		// The address is pinned to the invited one: a body-supplied address would register an account
		// for somebody else's address, and it is verified automatically after an acceptance.
		expect(declaresMember('AcceptInviteUserInput', 'email')).toBe(false);

		expect(declaresMember('AcceptOrganizationContactInviteInput', 'inviteId')).toBe(true);
		expect(declaresMember('AcceptOrganizationContactInviteInput', 'contactOrganization')).toBe(true);
		expect(declaresMember('AcceptOrganizationContactInviteInput', 'user')).toBe(true);
		expect(declaresMember('AcceptOrganizationContactInviteInput', 'password')).toBe(true);
	});

	it('offers no argument the delivered read cannot honour', () => {
		// The delivered register reads live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/invites\([^)]*withDeleted/);
		expect(printed).not.toMatch(/myInvites\([^)]*withDeleted/);
		// The controller declares no `GET /:id` and no count route, so neither is a root field here.
		expect(printed).not.toMatch(/^\s*invite\(/m);
		expect(printed).not.toMatch(/inviteCount/);
		// The derived liveness flag is a member of the object and not a filter: the delivered register
		// turns it into a range on `expireDate`, so a condition on the flag itself would be evaluated
		// against a value derived from a different column.
		expect(declaresMember('InviteFilter', 'isExpired')).toBe(false);
		expect(declaresMember('InviteFilter', 'expireDate')).toBe(true);
	});
});

describe('InviteResolver — the connection contract', () => {
	it('answers the register with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, inviteService } = surfaces();

		const connection = await resolver.invites(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when its query string states nothing.
		expect(inviteService.findAllInvites).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(PENDING);
	});

	it('orders the register newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.invites();

		expect(connection.nodes.map((node) => node.id)).toEqual([PENDING, LAPSED]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byAddress = await resolver.invites({ email: { ilike: 'ada%' } });
		expect(byAddress.nodes.map((node) => node.id)).toEqual([LAPSED]);

		// The instant is the column the register's own liveness narrowing is stated on, so a caller that
		// wants the live rows states the range that means so.
		const lapsed = await resolver.invites({ expireDate: { lt: '2026-03-01T00:00:00.000Z' } });
		expect(lapsed.nodes.map((node) => node.id)).toEqual([LAPSED]);

		const byState = await resolver.invites({ status: { eq: 'INVITED' } });
		expect(byState.totalCount).toBe(2);

		const byIssuer = await resolver.invites({ invitedByUserId: { eq: INVITER } });
		expect(byIssuer.totalCount).toBe(2);
	});

	it('refuses a filter on the derived flag, which is a member of the object and not of the filter', async () => {
		const { resolver } = surfaces();

		const error = await resolver.invites({ isExpired: { eq: true } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses a filter on a relation the delivered read does not join', async () => {
		const { resolver } = surfaces();

		const error = await resolver.invites({ role: { eq: ROLE } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		// The name is nullable and an absent value is the largest in both directions, so ascending puts
		// the invitation that states one first — the opposite of the default order, which is what makes
		// this a test of the sort rather than of the default.
		const byName = await resolver.invites(undefined, [{ field: 'fullName', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([LAPSED, PENDING]);

		const byExpiry = await resolver.invites(undefined, [{ field: 'expireDate', direction: 'ASC' }]);
		expect(byExpiry.nodes.map((node) => node.id)).toEqual([LAPSED, PENDING]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.invites(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([PENDING]);

		const second = await resolver.invites(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([LAPSED]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.invites(undefined, undefined, undefined, 20);

		const last = await resolver.invites(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([PENDING]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// `isExpired` is a member of the object and is not a sortable field: a value derived on load is
		// not a column to order by.
		const error = await resolver
			.invites(undefined, [{ field: 'isExpired', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.invites(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('answers the caller’s own queue over the rows its own service method returns', async () => {
		const { resolver, inviteService } = surfaces();

		const connection = await resolver.myInvites(undefined, undefined, undefined, 20);

		// The read takes no argument at all: the one narrowing it applies is the caller's own address,
		// which it resolves out of the credential rather than out of the request.
		expect(inviteService.getCurrentUserInvites).toHaveBeenCalledWith();
		expect(connection.nodes.map((node) => node.id)).toEqual([PENDING]);
		expect(connection.totalCount).toBe(1);
	});
});

describe('InviteResolver — one concept, two protocols, the same operations', () => {
	it('reads the register through the same service method the REST route calls', async () => {
		const { resolver, inviteService } = surfaces();

		expect((await resolver.invites()).totalCount).toBe(2);
		expect(inviteService.findAllInvites).toHaveBeenCalledWith({});
	});

	it('reads the caller’s own queue through the same service method the REST route calls', async () => {
		const { resolver, inviteService } = surfaces();

		await resolver.myInvites();

		expect(inviteService.getCurrentUserInvites).toHaveBeenCalledWith();
	});

	it('presents a mailed token through the same query the public REST route dispatches', async () => {
		const { resolver, queryBus } = surfaces();

		expect(await resolver.inviteByToken('ada@example.com', 'a-token')).toBe(ROWS[0]);

		const query = queryBus.execute.mock.calls[0][0];
		expect(query).toBeInstanceOf(FindInviteByEmailTokenQuery);
		expect(query.params).toEqual({ email: 'ada@example.com', token: 'a-token' });
	});

	it('presents a mailed code through the same query the public REST route dispatches', async () => {
		const { resolver, queryBus } = surfaces();

		await resolver.inviteByCode('ada@example.com', 'A1B2C3');

		const query = queryBus.execute.mock.calls[0][0];
		expect(query).toBeInstanceOf(FindInviteByEmailCodeQuery);
		expect(query.params).toEqual({ email: 'ada@example.com', code: 'A1B2C3' });
	});

	it('sends invitations through the command the REST route dispatches, in the caller’s language', async () => {
		const { resolver, commandBus } = surfaces();
		const input = {
			emailIds: ['ada@example.com'],
			inviteType: 'EMPLOYEE',
			roleId: ROLE,
			organizationId: ORGANIZATION,
			teamIds: [TEAM]
		};
		commandBus.execute.mockResolvedValueOnce(OUTCOME);

		expect(await resolver.sendInvites(input)).toBe(OUTCOME);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(InviteBulkCreateCommand);
		expect(command.input).toEqual(input);
		// The language is the `language` request header, or English when none was stated — the same
		// header and the same default the delivered route's own decorator reads.
		expect(command.languageCode).toBe(LanguagesEnum.ENGLISH);
	});

	it('resends through the command the REST route dispatches, and answers the re-read row', async () => {
		const { resolver, commandBus, inviteService } = surfaces();
		const input = { inviteId: PENDING, inviteType: 'EMPLOYEE' };

		expect(await resolver.resendInvite(input)).toBe(ROWS[0]);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(InviteResendCommand);
		expect(command.input).toEqual(input);
		expect(command.languageCode).toBe(LanguagesEnum.ENGLISH);
		// The route answers the store's update result; this field answers the row, and the row is read
		// back by the identifier the caller named.
		expect(inviteService.findOneByIdString).toHaveBeenCalledWith(PENDING);
	});

	it('accepts through the command the public REST route dispatches, with the transport’s origin', async () => {
		const { resolver, commandBus } = surfaces();
		const input = { email: 'ada@example.com', token: 'a-token', user: { firstName: 'Ada' } };

		await resolver.acceptInvite(input);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(InviteAcceptCommand);
		// The origin is read off the request rather than stated by the caller: a GraphQL operation with
		// no request answers none, which is the delivered route's own case when the header is absent.
		expect(command.input).toEqual({ ...input, originalUrl: undefined });
		expect(command.languageCode).toBe(LanguagesEnum.ENGLISH);
	});

	it('refuses through the command the public REST route dispatches, with the route’s single argument', async () => {
		const { resolver, commandBus } = surfaces();
		const input = { email: 'ada@example.com', token: 'a-token', code: 'A1B2C3' };

		await resolver.rejectInvite(input);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(InviteRejectCommand);
		expect(command.input).toEqual(input);
		// The delivered handler reads no language, so neither does this field: the two protocols have to
		// agree about the message a caller is sent.
		expect(commandBus.execute.mock.calls[0]).toHaveLength(1);
	});

	it('accepts a contact invitation through the command the public REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		const input = { inviteId: PENDING, contactOrganization: { name: 'Acme' }, user: {}, password: 's3cret' };

		await resolver.acceptOrganizationContactInvite(input);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(InviteAcceptOrganizationContactCommand);
		// The delivered route writes the request's own `Origin` onto the body before it dispatches.
		expect(command.input).toEqual({ ...input, originalUrl: undefined });
		expect(command.languageCode).toBe(LanguagesEnum.ENGLISH);
	});

	it('invites an organization contact through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.inviteOrganizationContact(ORGANIZATION);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(InviteOrganizationContactCommand);
		// The inviter is the credential's own account, as the delivered route's `request.user` is — not
		// a member a caller states.
		expect(command.input).toEqual(
			expect.objectContaining({ id: ORGANIZATION, languageCode: LanguagesEnum.ENGLISH })
		);
		expect(command.input.originalUrl).toBeUndefined();
		expect(command.input.inviterUser).toBeNull();
	});

	it('removes an invitation through the same service method the REST route calls', async () => {
		const { resolver, inviteService } = surfaces();

		expect(await resolver.deleteInvite(PENDING)).toBe(true);
		expect(inviteService.delete).toHaveBeenCalledWith(PENDING);
	});

	it('answers an invitation through the same service method the REST route calls, with its four arguments', async () => {
		const { resolver, inviteService } = surfaces();

		expect(await resolver.handleInvitationResponse(PENDING, 'ACCEPTED')).toBe(ROWS[0]);
		expect(inviteService.handleInvitationResponse).toHaveBeenCalledWith(
			PENDING,
			'ACCEPTED',
			undefined,
			LanguagesEnum.ENGLISH
		);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, inviteService } = surfaces();
		const refusal = new Error('INVITE_ALREADY_ACCEPTED: this invitation has already been answered.');

		inviteService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteInvite(PENDING)).rejects.toBe(refusal);
	});
});

describe('InviteResolver — the guard stack and the permissions are the controller’s', () => {
	it('runs every field under the guard chain its own route runs under, plus the gate', () => {
		for (const [field, handler] of ROUTES) {
			// The controller declares its guards per route rather than on the class, so each field states
			// the same chain — and the gate is the one addition, declared on this resolver's class for
			// every field.
			expect(guardsOfField(field).sort()).toEqual(
				[...guardsOfRoute(InviteController, handler), FeatureFlagGuard].sort()
			);
		}
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(InviteController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('states no permission on the class and no guard beyond the gate, because the controller states neither', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, InviteController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, InviteResolver)).toBeUndefined();
		// The controller guards its routes and not its class, so a class-level guard here would narrow
		// the five public fields below what their routes serve.
		expect(Reflect.getMetadata('__guards__', InviteController)).toBeUndefined();
		expect(Reflect.getMetadata('__guards__', InviteResolver)).toEqual([FeatureFlagGuard]);
	});

	it('states the view permission on the two registers and the edit pair on the writes', () => {
		expect(permissionOfField('invites')).toEqual([PermissionsEnum.ORG_INVITE_VIEW]);
		expect(permissionOfField('myInvites')).toEqual([PermissionsEnum.ORG_INVITE_VIEW]);
		// The send states both, because a send may add people to teams and the second permission is the
		// one that says so.
		expect(permissionOfField('sendInvites')).toEqual([
			PermissionsEnum.ORG_INVITE_EDIT,
			PermissionsEnum.ORG_TEAM_ADD
		]);

		for (const field of [
			'resendInvite',
			'inviteOrganizationContact',
			'deleteInvite',
			'handleInvitationResponse'
		]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ORG_INVITE_EDIT]);
		}
	});

	it('asks for no credential and no permission on the five public routes', () => {
		// The five fields mirror the controller's `@Public()` routes, named by field and by handler so
		// that both halves of the parity are read from metadata rather than restated.
		for (const [field, handler] of PUBLIC_ROUTES) {
			// `@Public()` on the route is mirrored by `@Public()` on the field, and neither the tenant
			// guard nor a permission follows it: the invited address holds no credential yet.
			expect(
				Reflect.getMetadata(PUBLIC_METHOD_METADATA, handlersOf(InviteController)[handler])
			).toBe(true);
			expect(
				Reflect.getMetadata(PUBLIC_METHOD_METADATA, (InviteResolver.prototype as never)[field])
			).toBe(true);
			// The expected permission of a public route comes out as nothing at all, and the expected
			// guards as the gate alone — which is what the field states.
			expect(permissionOfRoute(InviteController, handler)).toBeUndefined();
			expect(permissionOfField(field)).toBeUndefined();
			expect(guardsOfRoute(InviteController, handler)).toEqual([]);
			expect(
				Reflect.getMetadata('__guards__', handlersOf(InviteController)[handler])
			).toBeUndefined();
		}

		for (const [field, handler] of ROUTES.filter(
			([field]) => !PUBLIC_ROUTES.some(([name]) => name === field)
		)) {
			// The seven guarded routes are the other half: their fields state the pair, and mark nothing
			// public, because a field that opened a route the permission model closes would be a way
			// around that model.
			expect(
				Reflect.getMetadata(PUBLIC_METHOD_METADATA, (InviteResolver.prototype as never)[field])
			).toBeUndefined();
			expect(Reflect.getMetadata('__guards__', handlersOf(InviteController)[handler])).toEqual([
				TenantPermissionGuard,
				PermissionGuard
			]);
		}
	});

	it('declares no guard beyond the class gate on a public field', () => {
		// The whole of what a public field states is the class's own statement: it carries no guard of
		// its own, so the gate is the only thing between it and the endpoint.
		for (const [field] of PUBLIC_ROUTES) {
			expect(
				Reflect.getMetadata('__guards__', (InviteResolver.prototype as never)[field])
			).toBeUndefined();
			expect(guardsOfField(field)).toEqual([FeatureFlagGuard]);
		}
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
	const guard = new FeatureFlagGuard(cache as never, new Reflector(), featureService as never);

	return { guard, featureService };
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (InviteResolver.prototype as never)[field],
		getClass: () => InviteResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('InviteResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, InviteResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', InviteResolver)).toEqual([FeatureFlagGuard]);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('invites')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('invites');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the public routes’ fields too, which is the limitation the class comment records', async () => {
		const { guard } = gate(false);

		// The gate is read with `getAllAndOverride` over the handler and then the class, and it is stated
		// on the class rather than restated per field — so a field that states no guard of its own, and
		// no permission either, is still refused when the capability is off. That is the limitation in
		// metadata rather than in prose: the five `@Public()` fields are served behind a narrower door
		// than the routes they mirror, because the capability they are behind resolves a request that
		// carries no tenant as disabled. What none of them carries is anything narrower.
		for (const [field] of PUBLIC_ROUTES) {
			expect(Reflect.getMetadata(FEATURE_METADATA, (InviteResolver.prototype as never)[field])).toBeUndefined();
			expect(
				Reflect.getMetadata('__guards__', (InviteResolver.prototype as never)[field])
			).toBeUndefined();
			expect(Reflect.getMetadata(FEATURE_METADATA, InviteResolver)).toBe(FEATURE_GRAPHQL);
			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('invites'))).resolves.toBe(true);
	});
});

describe('InviteModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, InviteModule) ?? []) as unknown[];

		// The resolver is an ordinary Nest provider, so it can only inject what the module hosting it
		// can reach: the service it reads through and the two buses its fields dispatch through.
		expect(providers).toContain(InviteResolver);
		expect(providers).toContain(InviteService);
	});

	it('exports the command bus the resolver’s write fields dispatch through', () => {
		// The resolver uses both buses — the send, the resend, the two acceptances and the refusal are
		// commands, and the two presentations of a credential are queries — so the module it lives in has
		// to hand the buses on to whichever module the Apollo configuration scans.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, InviteModule) ?? []) as unknown[];

		expect(exported).toContain(CqrsModule);
	});
});
