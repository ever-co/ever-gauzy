import { UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	IEmailHistory,
	IResendEmailInput,
	IPagination,
	LanguagesEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
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
import { EmailHistory } from './email-history.entity';
import { EmailHistoryService } from './email-history.service';
import { EmailHistoryResendCommand } from './commands';

/** The members `UpdateEmailHistoryInput` declares in the schema. */
export interface IUpdateEmailHistoryInput {
	id: Id;
	isArchived?: boolean;
}

/** The members `ResendEmailHistoryInput` declares in the schema. */
export interface IResendEmailHistoryInput {
	organizationId?: Id;
}

/**
 * The fields a message list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EmailHistoryFilter` and `EmailHistorySortField`
 * are its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `content` is in neither. It is the rendered body of every message, and a condition or an ordering on
 * it would scan the whole of every message for a pattern — a question the delivered read never asks.
 *
 * `isActive` and `isArchived` are in neither, although the type carries them: the delivered read narrows
 * to the rows that are both live and unarchived itself, so the two columns hold one value across every
 * row this connection can see and a condition on either would answer everything or nothing.
 */
const EMAIL_HISTORY_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	email: 'STRING',
	status: 'STRING',
	userId: 'ID',
	emailTemplateId: 'ID',
	organizationId: 'ID',
	tenantId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const EMAIL_HISTORY_SORTABLE = ['createdAt', 'updatedAt', 'name', 'email', 'status'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * This is one of the few places where the connection *reproduces* the delivered read rather than deciding
 * for it: the list read orders by creation time descending on both of its ORM branches, so a client that
 * states no sort is answered in the order the REST route would have answered it. The identifier is added
 * after it because the delivered order is not total — two messages recorded in the same millisecond have
 * no order between them — and a cursor walk needs one.
 */
const EMAIL_HISTORY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The sent-message ledger over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `EmailHistoryService` method, or dispatches the same command,
 * that the `/api/email` routes reach.
 *
 * **The guard chain and the permission are the controller's.** The class carries what the controller
 * class carries — both guards and the class-level permission — and so does every field: the resend
 * handler restates the two guards without stating a permission of its own, so it runs under the class's
 * permission exactly as the list and the edit do. A field that stated anything narrower, or anything at
 * all beyond this, would give GraphQL a scope REST does not have.
 *
 * **The list read caps its own answer, and this surface states that rather than hiding it.** The
 * delivered service reads at most one page — the platform's default page size when the caller states
 * none — and reports the matching total beside it. This surface applies the connection protocol to the
 * rows that read answered, so `totalCount` is the count of the rows the connection holds rather than the
 * service's own total for the whole table. Reporting that larger number here would be a `totalCount` no
 * page of `nodes` agrees with; a caller that needs a window wider than one page has the REST route's own
 * `take`/`skip`.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('EmailHistory')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.VIEW_ALL_EMAILS)
export class EmailHistoryResolver {
	constructor(
		private readonly emailHistoryService: EmailHistoryService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The messages the caller's organization has sent, in the ledger's own order.
	 */
	@Query('emailHistories')
	@Permissions(PermissionsEnum.VIEW_ALL_EMAILS)
	async emailHistories(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<EmailHistory>> {
		// The same read the list route performs, through the same service method. This surface has no query
		// string to bind, so the DTO carries the one narrowing a request that states nothing carries: an
		// empty criterion. The service applies the caller's own organization and tenant to it from the
		// credential — which is what makes the two protocols answer the same set of rows — and it
		// dereferences the criterion, which is why the field is present rather than absent.
		const options = { where: {}, ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<EmailHistory>;
		const { items }: IPagination<EmailHistory> = await this.emailHistoryService.findAll(options);

		return buildConnection<EmailHistory>({
			rows: items ?? [],
			filterable: EMAIL_HISTORY_FILTERABLE,
			sortable: EMAIL_HISTORY_SORTABLE,
			defaultSort: EMAIL_HISTORY_DEFAULT_SORT,
			request: { filter, sort, page, first, last, after, before, limit, offset }
		});
	}

	/**
	 * Changes a sent message.
	 *
	 * The delivered edit reaches the same service method with the identifier in its path and the body
	 * beside it, so the field does the same and for the same reason states the identifier as a member of
	 * its input: a GraphQL mutation has no path. The answer is the row read back through the node read
	 * the service owns, because the delivered route answers either the row or the store's own update
	 * result and the latter is not a row.
	 */
	@Mutation('updateEmailHistory')
	@Permissions(PermissionsEnum.VIEW_ALL_EMAILS)
	async updateEmailHistory(@Args('input') input: IUpdateEmailHistoryInput): Promise<EmailHistory> {
		const { id, ...values } = input;

		await this.emailHistoryService.update(id, values);

		return await this.emailHistoryService.findOneByIdString(id);
	}

	/**
	 * Sends a message again and answers the row with the outcome written onto it.
	 *
	 * The same command the delivered resend route dispatches, with the same language beside it: the route
	 * reads the `language` request header through its decorator, and `RequestContext.getLanguageCode()`
	 * reads the same header off the same request — the bootstrap mounts the request context on the
	 * GraphQL endpoint as well as on the prefixed routes — so a caller resending the same message over
	 * either protocol gets the same message rendered for it.
	 */
	@Mutation('resendEmailHistory')
	@Permissions(PermissionsEnum.VIEW_ALL_EMAILS)
	async resendEmailHistory(
		@Args('id', { type: () => ID }) id: Id,
		@Args('input', { nullable: true }) input?: IResendEmailHistoryInput
	): Promise<IEmailHistory> {
		return (await this.commandBus.execute(
			new EmailHistoryResendCommand(
				id,
				{ organizationId: input?.organizationId } as IResendEmailInput,
				this.languageOfTheCaller()
			)
		)) as IEmailHistory;
	}

	/**
	 * The language the delivered resend route's `language` header names.
	 *
	 * The controller reads that header through its `LanguageDecorator`, which answers English when the
	 * request carries none; `RequestContext.getLanguageCode()` reads the same header off the same request
	 * and answers the same default without one, so the message a caller resends is rendered in the
	 * language the route would have rendered it in.
	 */
	private languageOfTheCaller(): LanguagesEnum {
		return RequestContext.getLanguageCode();
	}
}
