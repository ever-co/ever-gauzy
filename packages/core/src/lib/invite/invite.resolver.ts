import { UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag, Public } from '@gauzy/common';
import {
	ICreateEmailInvitesInput,
	ICreateEmailInvitesOutput,
	ID as Id,
	IInviteAcceptInput,
	IInviteRejectInput,
	IInviteResendInput,
	IOrganizationContactAcceptInviteInput,
	IOrganizationContactInviteInput,
	IPagination,
	InviteActionEnum,
	LanguagesEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { RequestContext } from '../core/context';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import {
	InviteAcceptCommand,
	InviteAcceptOrganizationContactCommand,
	InviteBulkCreateCommand,
	InviteOrganizationContactCommand,
	InviteRejectCommand,
	InviteResendCommand
} from './commands';
import { Invite } from './invite.entity';
import { InviteService } from './invite.service';
import { FindInviteByEmailCodeQuery, FindInviteByEmailTokenQuery } from './queries';

/** The members `CreateInvitesInput` declares in the schema. */
export interface ICreateInvitesInput {
	emailIds: string[];
	inviteType: string;
	roleId: Id;
	organizationId: Id;
	teamIds?: Id[];
	projectIds?: Id[];
	departmentIds?: Id[];
	organizationContactIds?: Id[];
	startedWorkOn?: Date;
	appliedDate?: Date;
	invitationExpirationPeriod?: string;
	fullName?: string;
	callbackUrl?: string;
	queryParams?: Record<string, string>;
}

/** The members `ResendInviteInput` declares in the schema. */
export interface IResendInviteInput {
	inviteId: Id;
	inviteType: string;
	callbackUrl?: string;
}

/** The members `RejectInviteInput` declares in the schema. */
export interface IRejectInviteInput {
	email: string;
	token: string;
	code: string;
}

/** The account body `AcceptInviteUserInput` declares in the schema. */
export interface IAcceptInviteUserInput {
	firstName?: string;
	lastName?: string;
	imageUrl?: string;
	preferredLanguage?: string;
}

/** The members `AcceptInviteInput` declares in the schema. */
export interface IAcceptInviteInput {
	email: string;
	token?: string;
	code?: string;
	user: IAcceptInviteUserInput;
	password?: string;
	featureAsEmployee?: boolean;
	terms?: Array<Record<string, string>>;
	isImporting?: boolean;
	sourceId?: Id;
}

/** The members `AcceptOrganizationContactInviteInput` declares in the schema. */
export interface IAcceptOrganizationContactInviteInput {
	inviteId: Id;
	contactOrganization: Record<string, unknown>;
	user: IAcceptInviteUserInput;
	password: string;
}

/**
 * The fields an invitation list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `InviteFilter` and `InviteSortField` are its two
 * renderings, and keeping the three in one file is what makes a field that is filterable in the schema
 * but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the invitation row, which is why the set is what it is: the connection
 * narrows the rows the service returned, and the two reads behind it join no collection. `isExpired` is
 * deliberately absent although the object type carries it: the delivered register turns that flag into
 * a range on `expireDate` — treating an absent instant as an invitation that never lapses — rather than
 * filtering a column, so a condition stated on the flag here would be evaluated against a value the
 * rows this surface was handed have already had derived from a different column. A caller that wants
 * the live rows states the range on `expireDate` that means so, which is the question the register
 * itself asks.
 *
 * The three identifiers are here for the reason the object type gives: they are columns of the row the
 * read answers, so a condition on one narrows the rows rather than a collection nothing loaded.
 */
const INVITE_FILTERABLE = {
	id: 'ID',
	email: 'STRING',
	fullName: 'STRING',
	status: 'STRING',
	expireDate: 'DATE',
	actionDate: 'DATE',
	roleId: 'ID',
	userId: 'ID',
	invitedByUserId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	deletedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const INVITE_SORTABLE = [
	'id',
	'email',
	'fullName',
	'status',
	'expireDate',
	'actionDate',
	'createdAt',
	'updatedAt',
	'deletedAt'
] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered register states no order of its own — it builds its criterion and takes the rows as the
 * store returns them — so this is a decision the connection has to make rather than one it reproduces:
 * newest first, because a register of invitations is read from the end that has just been issued, then
 * the identifier, which is the key that makes the order total and a cursor walk over it stable.
 */
const INVITE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The invitation over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below reaches the same `InviteService` method, or dispatches the same command or
 * query, that the `/api/invite` routes reach.
 *
 * **The guard chain and the permission are the controller's, field by field, and the controller states
 * them per route rather than on its class.** `InviteController` carries no class-level guard and no
 * class-level permission, states `TenantPermissionGuard` and `PermissionGuard` on the seven routes that
 * are not public, and marks the other five `@Public()`. The resolver class therefore carries the gate
 * and nothing else, and each field states what its own route states: the same two guard classes and the
 * route's own permission on the guarded fields, and nothing at all on the five public ones. A
 * permission on this class would narrow every field below it below the route each mirrors.
 *
 * **The gate is the catalogue's, and it is the one thing this surface cannot express fully.**
 * `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the GraphQL endpoint and its
 * resolvers, and `FeatureFlagGuard` reads it from `FEATURE_METADATA` over the handler and then the
 * class — which is why it is stated once here, on the class, and appended to the guard chain the routes
 * below already carry rather than replacing any part of it. The capability it resolves is
 * tenant-scoped: `FeatureService.isFeatureEnabled` answers from the caller's own toggle rows when the
 * request carries a tenant, and falls back to the deployment's configured state when it does not — and
 * `FEATURE_GRAPHQL` is not a code that configuration names, so a request that carries no tenant scope
 * resolves the capability as disabled and is refused. The five `@Public()` routes below are the case
 * that exposes it: their fields are served only when the capability resolves for the caller's scope,
 * which is a narrower door than the routes they mirror, and the delivery has no way to state otherwise
 * — a field cannot be more open than the gate over it. Nothing narrower is stated on those five fields
 * either, because a guard or a permission there would refuse a caller the REST route serves. Dropping
 * the gate to work around the limitation is not an option this delivery has: it would leave the whole
 * endpoint served to a deployment that switched the capability off, which is the defect the gate exists
 * to prevent. The limitation is therefore stated here rather than worked around.
 */
@Resolver('Invite')
@UseGuards(FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class InviteResolver {
	constructor(
		private readonly inviteService: InviteService,
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus
	) {}

	/**
	 * The invitations of the caller's tenant, newest first.
	 */
	@Query('invites')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_VIEW)
	async invites(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Invite>> {
		// The delivered list route binds its query DTO to the query string and hands it to the service:
		// the criterion, the relations to join, the page and the soft-delete flag. This surface has no
		// query string to bind, so the read runs with the route's own defaults for an unstated request,
		// and the connection protocol's `filter` is applied to the rows the service returns. The tenant
		// is added to the criterion by the service, from the credential rather than from the caller.
		const { items }: IPagination<Invite> = await this.inviteService.findAllInvites({} as BaseQueryDTO<Invite>);

		return buildConnection<Invite>({
			rows: items ?? [],
			filterable: INVITE_FILTERABLE,
			sortable: INVITE_SORTABLE,
			defaultSort: INVITE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * The invitations waiting for the caller, newest first.
	 *
	 * A field of its own rather than a filter on the register: the delivered read resolves the caller's
	 * own address out of the credential and selects that address's pending, unexpired rows, restricting
	 * its columns to the identifier, the expiry and the teams. No filter over the register can state
	 * "addressed to me", which is why the two are two fields — and why these rows carry fewer members
	 * than the connection's.
	 */
	@Query('myInvites')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_VIEW)
	async myInvites(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Invite>> {
		// The read is the one the delivered route performs, and the one narrowing it applies is the
		// caller's own address — so there is nothing here for a caller to state and nothing to pass on.
		const { items }: IPagination<Invite> = await this.inviteService.getCurrentUserInvites();

		return buildConnection<Invite>({
			rows: items ?? [],
			filterable: INVITE_FILTERABLE,
			sortable: INVITE_SORTABLE,
			defaultSort: INVITE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * Presents the token a message's link carried.
	 *
	 * The write is dispatched as the same query the delivered `GET /validate` route dispatches, with the
	 * route's own two members and nothing else: the address, and the token that is verified against the
	 * platform's secret before any row is matched.
	 *
	 * A miss is a refusal rather than an empty answer — the delivered reader answers one with a bare
	 * `400`, and this field lets that refusal through rather than turning it into a null. "No such
	 * invitation" and "the token was wrong" are one answer on purpose, because telling them apart would
	 * confirm which tokens are live.
	 */
	@Query('inviteByToken')
	@Public()
	async inviteByToken(
		@Args('email', { type: () => String }) email: string,
		@Args('token', { type: () => String }) token: string
	): Promise<Invite> {
		return await this.queryBus.execute(new FindInviteByEmailTokenQuery({ email, token }));
	}

	/**
	 * Presents the code that was mailed to an address.
	 *
	 * A query although the delivered route is a `POST`: the verb belongs to the transport, which carries
	 * the code in a body rather than in a path, and the delivered read matches an invitation by it and
	 * writes nothing.
	 */
	@Query('inviteByCode')
	@Public()
	async inviteByCode(
		@Args('email', { type: () => String }) email: string,
		@Args('code', { type: () => String }) code: string
	): Promise<Invite> {
		return await this.queryBus.execute(new FindInviteByEmailCodeQuery({ email, code }));
	}

	/**
	 * Sends invitations to a list of addresses.
	 *
	 * The write is dispatched as the same command the delivered route dispatches, with the same
	 * language: the route reads the `language` request header through its own decorator, and
	 * `RequestContext.getLanguageCode()` reads that same header off the same request — the bootstrap
	 * mounts a request context on the GraphQL endpoint as well as on the prefixed routes — so a caller
	 * asking the same question over either protocol is mailed the same message in the same language. A
	 * request with no header answers English, which is the decorator's own default.
	 */
	@Mutation('sendInvites')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT, PermissionsEnum.ORG_TEAM_ADD)
	async sendInvites(@Args('input') input: ICreateInvitesInput): Promise<ICreateEmailInvitesOutput> {
		return await this.commandBus.execute(
			new InviteBulkCreateCommand(input as unknown as ICreateEmailInvitesInput, this.languageOfTheCaller())
		);
	}

	/**
	 * Mails a fresh credential for an invitation that is still pending, and answers the invitation.
	 *
	 * The delivered route's declared answer is the store's update result or the invitation, and this
	 * field answers the invitation: the update result is a statement about the write — how many rows the
	 * store touched — and carries none of what they now hold, so a client could not read the new expiry
	 * or state of the row it just refreshed. The command runs first, and the row the caller named is
	 * then re-read through the same service the register reads through: an identifier that names nothing
	 * is a miss rather than an empty invitation, which is the refusal the delivered re-read would raise
	 * for the same call.
	 */
	@Mutation('resendInvite')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	async resendInvite(@Args('input') input: IResendInviteInput): Promise<Invite> {
		await this.commandBus.execute(
			new InviteResendCommand(input as unknown as IInviteResendInput, this.languageOfTheCaller())
		);

		return await this.inviteService.findOneByIdString(input.inviteId);
	}

	/**
	 * Accepts an invitation: the invited person registers, and the credential is spent.
	 *
	 * The write is dispatched as the same command the delivered route dispatches, with the same two
	 * arguments — the body, and the origin the transport carried: the route passes the request's
	 * `origin` header as `originalUrl`, and this field reads that same header off the same request
	 * rather than asking the caller to state it a second time.
	 *
	 * The answer is the kernel's `JSON` scalar because what the command produces depends on the
	 * invitation's own kind — an account with its tokens, an employee, or a candidate — and no single
	 * schema type can state that union. See the SDL for the full statement.
	 */
	@Mutation('acceptInvite')
	@Public()
	async acceptInvite(@Args('input') input: IAcceptInviteInput): Promise<unknown> {
		return await this.commandBus.execute(
			new InviteAcceptCommand(
				{ ...input, originalUrl: this.originOfTheCaller() } as unknown as IInviteAcceptInput,
				this.languageOfTheCaller()
			)
		);
	}

	/**
	 * Refuses an invitation.
	 *
	 * The same command the delivered route dispatches, with the same single argument: the body, and no
	 * language, because the delivered handler reads none. A refusal that loses a race against an
	 * acceptance is the handler's own `409`, and this field lets it through unchanged.
	 */
	@Mutation('rejectInvite')
	@Public()
	async rejectInvite(@Args('input') input: IRejectInviteInput): Promise<unknown> {
		return await this.commandBus.execute(new InviteRejectCommand(input as unknown as IInviteRejectInput));
	}

	/**
	 * Takes up a contact invitation and provisions the contact's own workspace.
	 *
	 * The same command the delivered route dispatches, with the origin stated the way the route states
	 * it: the route writes the request's `Origin` header onto the body before it dispatches, and this
	 * field reads that same header off the same request.
	 *
	 * The answer is the kernel's `JSON` scalar: what the handler returns is the store's update result
	 * for the invitation, a shape that states nothing about the tenant, organization and account it
	 * built. A caller that needs the invitation's own state reads it through `invites`.
	 */
	@Mutation('acceptOrganizationContactInvite')
	@Public()
	async acceptOrganizationContactInvite(
		@Args('input') input: IAcceptOrganizationContactInviteInput
	): Promise<unknown> {
		return await this.commandBus.execute(
			new InviteAcceptOrganizationContactCommand(
				{ ...input, originalUrl: this.originOfTheCaller() } as unknown as IOrganizationContactAcceptInviteInput,
				this.languageOfTheCaller()
			)
		);
	}

	/**
	 * Invites an existing organization contact to take up a workspace of its own.
	 *
	 * The same command the delivered route dispatches, with the same body: the identifier from the path,
	 * the origin from the transport's own header, and the inviter read from the credential rather than
	 * stated by the caller — the route passes `request.user` there, which is the account the request was
	 * authenticated as, and `RequestContext.currentUser()` reads that same account off the same request.
	 *
	 * The answer is the kernel's `JSON` scalar: the route answers an organization contact, a type this
	 * schema does not declare because the contact is that domain's own resource.
	 */
	@Mutation('inviteOrganizationContact')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	async inviteOrganizationContact(@Args('id', { type: () => ID }) id: Id): Promise<unknown> {
		return await this.commandBus.execute(
			new InviteOrganizationContactCommand({
				id,
				originalUrl: this.originOfTheCaller(),
				inviterUser: RequestContext.currentUser(),
				languageCode: this.languageOfTheCaller()
			} as IOrganizationContactInviteInput)
		);
	}

	/**
	 * Removes an invitation outright.
	 *
	 * The service is the one the REST route calls, and the field answers whether the removal happened
	 * rather than the removed row, because the delivered route answers the store's delete result — a
	 * statement about the write and not a row.
	 */
	@Mutation('deleteInvite')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	async deleteInvite(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.inviteService.delete(id);

		return true;
	}

	/**
	 * Accepts or refuses an invitation on the caller's own behalf.
	 *
	 * The same service method the delivered route calls, with the same four arguments: the invitation,
	 * the move, the origin the transport carried, and the caller's language. The service narrows the row
	 * to the caller's own address before it writes anything, so this is not a way to answer somebody
	 * else's invitation, and it re-reads the row after the move and answers it — which is the state a
	 * caller needs rather than a statement about the write.
	 */
	@Mutation('handleInvitationResponse')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVITE_EDIT)
	async handleInvitationResponse(
		@Args('id', { type: () => ID }) id: Id,
		@Args('action', { type: () => String }) action: string
	): Promise<Invite> {
		return await this.inviteService.handleInvitationResponse(
			id,
			action as InviteActionEnum,
			this.originOfTheCaller(),
			this.languageOfTheCaller()
		);
	}

	/**
	 * The language the delivered routes read off the `language` request header.
	 *
	 * The send and the resend read it through their own `LanguageDecorator`, which answers the header's
	 * value or English; the acceptances and the contact invite read it through `@I18nLang()`, whose
	 * resolver this installation configures as a header resolver over that same header with the same
	 * English fallback. `RequestContext.getLanguageCode()` reads that header off the same request — the
	 * bootstrap mounts a request context on the GraphQL endpoint as well as on the prefixed routes — so a
	 * caller asking the same question over either protocol is answered, and mailed, in the same language.
	 * Without a request it answers English, which is both decorators' own default.
	 */
	private languageOfTheCaller(): LanguagesEnum {
		return RequestContext.getLanguageCode();
	}

	/**
	 * The origin the delivered routes read off the request's `origin` header.
	 *
	 * The acceptances build the links their messages carry from it, and the delivered routes take it
	 * from the same header rather than from the body — so the field reads it off the same request rather
	 * than asking the caller to state it a second time: a caller cannot state one origin over one
	 * protocol and a different one over the other. A GraphQL operation with no request at all answers
	 * `undefined`, which is what the delivered routes answer when the header is absent.
	 */
	private originOfTheCaller(): string {
		const request = RequestContext.currentRequest() as { headers?: Record<string, unknown> } | null;
		const origin = request?.headers?.['origin'];

		return typeof origin === 'string' ? origin : undefined;
	}
}
