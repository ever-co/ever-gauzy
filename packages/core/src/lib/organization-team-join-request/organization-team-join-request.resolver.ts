import { ParseEnumPipe, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag, IAppIntegrationConfig, Public } from '@gauzy/common';
import {
	ID as Id,
	IOrganizationTeamJoinRequest,
	IOrganizationTeamJoinRequestCreateInput,
	IPagination,
	LanguagesEnum,
	OrganizationTeamJoinRequestStatusEnum,
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
import { OrganizationTeamJoinRequestCreateCommand } from './commands';
import { ValidateJoinRequestDTO } from './dto';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';
import { OrganizationTeamJoinRequestService } from './organization-team-join-request.service';

/** The members `CreateOrganizationTeamJoinRequestInput` declares in the schema. */
export interface ICreateOrganizationTeamJoinRequestInput {
	email: string;
	organizationTeamId: Id;
	appName?: string;
	appLogo?: string;
	appSignature?: string;
	appLink?: string;
	companyLink?: string;
	companyName?: string;
}

/** The members `ValidateOrganizationTeamJoinRequestInput` declares in the schema. */
export interface IValidateOrganizationTeamJoinRequestInput {
	email: string;
	organizationTeamId: Id;
	code?: string;
	token?: string;
}

/** The members `ResendOrganizationTeamJoinRequestCodeInput` declares in the schema. */
export interface IResendOrganizationTeamJoinRequestCodeInput {
	email: string;
	organizationTeamId: Id;
	appName?: string;
	appLogo?: string;
	appSignature?: string;
	appLink?: string;
	companyLink?: string;
	companyName?: string;
}

/** What the ask and the resend both answer: the acknowledgement, and nothing about what was done. */
export interface IOrganizationTeamJoinRequestOutcome {
	status: number;
	message: string;
}

/**
 * The fields a join-request list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OrganizationTeamJoinRequestFilter` and
 * `OrganizationTeamJoinRequestSortField` are its two renderings, and keeping the three in one file is
 * what makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * The relations are here as their identifiers and only as those. `organizationTeamId` and `userId` are
 * columns of this row, so a filter on either is evaluated against the row the read actually answers;
 * the team and the person themselves are joined by no read this surface mirrors, and a filter on one of
 * them would be evaluated against a row that carries neither and would select nothing at all — the
 * worst answer a filter can give.
 */
const ORGANIZATION_TEAM_JOIN_REQUEST_FILTERABLE = {
	id: 'ID',
	email: 'STRING',
	fullName: 'STRING',
	linkAddress: 'STRING',
	position: 'STRING',
	status: 'ENUM',
	organizationTeamId: 'ID',
	userId: 'ID',
	organizationId: 'ID',
	tenantId: 'ID',
	isExpired: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const ORGANIZATION_TEAM_JOIN_REQUEST_SORTABLE = [
	'createdAt',
	'updatedAt',
	'email',
	'status',
	'isExpired'
] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list method applies no order of its own — it hands the store the criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest first, because a queue of asks is read from the end that has just arrived and a
 * manager works it in that direction, then the identifier, which is the key that makes the order total
 * and a cursor walk over it stable.
 */
const ORGANIZATION_TEAM_JOIN_REQUEST_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The join request over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below reaches the same `OrganizationTeamJoinRequestService` method, or dispatches the
 * same command, that the `/api/organization-team-join` routes reach.
 *
 * **The guard chain and the permission are the controller's, field by field, and the controller states
 * them per route rather than on its class.** `OrganizationTeamJoinRequestController` carries no
 * class-level guard, states `TenantPermissionGuard` and `PermissionGuard` on the queue and on the move,
 * and marks the other three routes `@Public()`. The resolver class therefore carries the gate and
 * nothing else, and each field states what its own route states: the same two guard classes and the
 * permission pair on the two guarded fields, and nothing at all on the three public ones. The
 * controller states no class-level permission either, so there is none to restate here — a permission
 * on this class would narrow every field below it below the route each mirrors.
 *
 * **The gate is the catalogue's, and it is the one thing this surface cannot express fully.**
 * `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the GraphQL endpoint and its
 * resolvers, and `FeatureFlagGuard` reads it from `FEATURE_METADATA` over the handler and then the
 * class — which is why it is stated once here, on the class, and appended to the guard chain the routes
 * below already carry rather than replacing any part of it. The capability it resolves is
 * tenant-scoped: `FeatureService.isFeatureEnabled` answers from the caller's own toggle rows when the
 * request carries a tenant, and falls back to the deployment's configured state when it does not — and
 * `FEATURE_GRAPHQL` is not a code that configuration names, so a request that carries no tenant scope
 * resolves the capability as disabled and is refused. The three `@Public()` routes below are the case
 * that exposes it: their fields are served only when the capability resolves for the caller's scope,
 * which is a narrower door than the routes they mirror, and the delivery has no way to state otherwise
 * — a field cannot be more open than the gate over it. Nothing narrower is stated on those three fields
 * either, because a guard or a permission there would refuse a caller the REST route serves. Dropping
 * the gate to work around the limitation is not an option this delivery has: it would leave the whole
 * endpoint served to a deployment that switched the capability off, which is the defect the gate exists
 * to prevent. The limitation is therefore stated here rather than worked around.
 */
@Resolver('OrganizationTeamJoinRequest')
@UseGuards(FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class OrganizationTeamJoinRequestResolver {
	constructor(
		private readonly organizationTeamJoinRequestService: OrganizationTeamJoinRequestService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The join requests of the caller's tenant, newest first.
	 */
	@Query('organizationTeamJoinRequests')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_JOIN_REQUEST_VIEW)
	async organizationTeamJoinRequests(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<OrganizationTeamJoinRequest>> {
		// The delivered list route binds its query DTO to the query string and hands it to the service:
		// the `where`, the `relations`, the page and the soft-delete flag. This surface has no query
		// string to bind, so the read runs with the route's own defaults for an unstated request — no
		// criterion, no relations, no page — and the connection protocol's `filter` is applied to the
		// rows the service returns. The tenant is applied to the criterion by the service, from the
		// credential rather than from the caller.
		const options = {} as BaseQueryDTO<OrganizationTeamJoinRequest>;
		const { items }: IPagination<OrganizationTeamJoinRequest> =
			await this.organizationTeamJoinRequestService.findAll(options);

		return buildConnection<OrganizationTeamJoinRequest>({
			rows: items ?? [],
			filterable: ORGANIZATION_TEAM_JOIN_REQUEST_FILTERABLE,
			sortable: ORGANIZATION_TEAM_JOIN_REQUEST_SORTABLE,
			defaultSort: ORGANIZATION_TEAM_JOIN_REQUEST_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * Asks to join one team, and mails the confirmation code to the address that asks.
	 *
	 * The write is dispatched as the same command the delivered route dispatches, with the same
	 * language: the route reads the `language` request header through its own decorator, and
	 * `RequestContext.getLanguageCode()` reads that same header off the same request — the bootstrap
	 * mounts a request context on the GraphQL endpoint as well as on the prefixed routes — so a caller
	 * asking the same question over either protocol is mailed the same message in the same language. A
	 * request with no header answers English, which is the decorator's own default.
	 *
	 * The answer is the acknowledgement. The delivered handler produces it in a `finally`, so it is
	 * answered for every outcome, including the ones the handler swallowed; a field that translated the
	 * swallow into an error would tell a caller something the REST route does not.
	 */
	@Mutation('createOrganizationTeamJoinRequest')
	@Public()
	async createOrganizationTeamJoinRequest(
		@Args('input') input: ICreateOrganizationTeamJoinRequestInput
	): Promise<IOrganizationTeamJoinRequestOutcome> {
		const { email, organizationTeamId, ...branding } = input;
		const payload = {
			email,
			organizationTeamId,
			...branding
		} as unknown as IOrganizationTeamJoinRequestCreateInput & Partial<IAppIntegrationConfig>;

		return (await this.commandBus.execute(
			new OrganizationTeamJoinRequestCreateCommand(payload, this.languageOfTheCaller())
		)) as IOrganizationTeamJoinRequestOutcome;
	}

	/**
	 * Presents the confirmation code or token mailed to the address that asked to join.
	 *
	 * The same service method the delivered route calls, handed the route's own DTO: the read resolves
	 * the pending, unexpired request of that address in that team, matched by the code or by the token,
	 * and marks it `REQUESTED`. The answer is the row it resolved — with the identifier the service
	 * removes before it answers, which is why the schema's `id` is nullable.
	 *
	 * A miss is a refusal rather than an empty answer: the delivered service answers a request that is
	 * not there, has lapsed or has already moved with a bare `400`, and this field lets that refusal
	 * through rather than turning it into a null. "No such pending request" and "the code was wrong" are
	 * one answer on purpose: telling them apart would confirm which codes are live.
	 */
	@Mutation('validateOrganizationTeamJoinRequest')
	@Public()
	async validateOrganizationTeamJoinRequest(
		@Args('input') input: IValidateOrganizationTeamJoinRequestInput
	): Promise<IOrganizationTeamJoinRequest> {
		return await this.organizationTeamJoinRequestService.validateJoinRequest(
			input as unknown as ValidateJoinRequestDTO
		);
	}

	/**
	 * Mails a fresh confirmation code for a request that is still pending.
	 *
	 * The same service method the delivered route calls, and with the same single argument: the route
	 * passes the body and no language, so the message is written in whatever language the mailer falls
	 * back to rather than in the caller's. Passing the caller's language here would make the two
	 * surfaces disagree about the message a caller is sent, and the two-protocol rule is parity rather
	 * than improvement — the language argument is stated as a difference the delivery does not take
	 * rather than one it overlooked.
	 *
	 * The answer is the acknowledgement the method produces in its `finally`: a caller is told the
	 * request was received and is told nothing about whether a pending row was found or whether a
	 * message went out.
	 */
	@Mutation('resendOrganizationTeamJoinRequestCode')
	@Public()
	async resendOrganizationTeamJoinRequestCode(
		@Args('input') input: IResendOrganizationTeamJoinRequestCodeInput
	): Promise<IOrganizationTeamJoinRequestOutcome> {
		const { email, organizationTeamId, ...branding } = input;
		const payload = {
			email,
			organizationTeamId,
			...branding
		} as unknown as IOrganizationTeamJoinRequestCreateInput & Partial<IAppIntegrationConfig>;

		return (await this.organizationTeamJoinRequestService.resendConfirmationCode(
			payload
		)) as IOrganizationTeamJoinRequestOutcome;
	}

	/**
	 * Accepts or rejects one join request.
	 *
	 * The same service method the delivered route calls, with the same three arguments. The action is
	 * the contracts vocabulary the route's own parameter is typed by, and the schema declares the two
	 * members the delivered writer actually acts on — a third value is unrepresentable there, which is
	 * what keeps an unrecognised move from being answered as though it had been made. The language the
	 * user an acceptance creates is invited in is read the way the route's `@I18nLang()` reads it: the
	 * i18n resolver this installation configures is a header resolver over the `language` header, which
	 * is the header `RequestContext.getLanguageCode()` reads, with the same English fallback.
	 *
	 * The delivered method answers nothing at all — its own signature is `void` — so this field answers
	 * whether the call ran, which is the most the route's answer carries. That is not a statement that
	 * the request moved: the delivered move is conditional, and leaves the row exactly as it was when
	 * the applicant is already a member of the team, or when the address has no employee record in the
	 * tenant. A caller that needs the row as it now stands reads it back through the connection above.
	 */
	@Mutation('acceptOrganizationTeamJoinRequest')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TEAM_JOIN_REQUEST_VIEW, PermissionsEnum.ORG_TEAM_JOIN_REQUEST_EDIT)
	async acceptOrganizationTeamJoinRequest(
		@Args('id', { type: () => ID }) id: Id,
		@Args('action', new ParseEnumPipe(OrganizationTeamJoinRequestStatusEnum))
		action: OrganizationTeamJoinRequestStatusEnum
	): Promise<boolean> {
		await this.organizationTeamJoinRequestService.acceptRequestToJoin(id, action, this.languageOfTheCaller());

		return true;
	}

	/**
	 * The language the delivered routes read off the `language` request header.
	 *
	 * The create route reads it through its own `LanguageDecorator`, which answers the header's value or
	 * English; the move route reads it through `@I18nLang()`, whose resolver this installation
	 * configures as a header resolver over that same header with the same English fallback.
	 * `RequestContext.getLanguageCode()` reads that header off the same request — the bootstrap mounts a
	 * request context on the GraphQL endpoint as well as on the prefixed routes — so a caller asking the
	 * same question over either protocol is answered, and mailed, in the same language. Without a
	 * request it answers English, which is both decorators' own default.
	 */
	private languageOfTheCaller(): LanguagesEnum {
		return RequestContext.getLanguageCode();
	}
}
