import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ICustomizableEmailTemplate,
	ICustomizeEmailTemplateFindInput,
	IEmailTemplateSaveInput,
	ID as Id,
	IPagination,
	LanguagesEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { BaseQueryDTO } from '../core/crud';
import { RequestContext } from '../core/context';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateGeneratePreviewQuery, EmailTemplateQuery, FindEmailTemplateQuery } from './queries';
import { EmailTemplateSaveCommand } from './commands';

/** The members `CreateEmailTemplateInput` declares in the schema. */
export interface ICreateEmailTemplateInput {
	name: string;
	languageCode: string;
	hbs: string;
	mjml?: string;
	organizationId?: Id;
}

/** The members `UpdateEmailTemplateInput` declares in the schema. */
export interface IUpdateEmailTemplateInput {
	id: Id;
	name?: string;
	languageCode?: string;
	hbs?: string;
	mjml?: string;
	organizationId?: Id;
}

/** The members `SaveEmailTemplateInput` declares in the schema. */
export interface ISaveEmailTemplateInput {
	name: string;
	languageCode: string;
	mjml: string;
	subject: string;
	organizationId?: Id;
}

/**
 * The fields a template list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EmailTemplateFilter` and
 * `EmailTemplateSortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible to
 * introduce quietly.
 *
 * `organizationId` is here because it is the member that states the tenant-wide copy: a row with no
 * organization is the copy the platform answers to every organization of its tenant, and the delivered
 * reader falls back to it. `tenantId` is here because the copies seeded from the platform's own
 * template folder carry no tenant either, so the two keys together separate the copy that belongs to no
 * tenant at all from an organization-less copy a tenant filed for itself.
 *
 * `deletedAt` is in neither. The delivered list read answers live rows only, so the column is absent on
 * every row this connection holds.
 */
const EMAIL_TEMPLATE_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	languageCode: 'STRING',
	tenantId: 'ID',
	organizationId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const EMAIL_TEMPLATE_SORTABLE = ['createdAt', 'updatedAt', 'name', 'languageCode'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list read applies only the order its caller names and otherwise leaves the rows in the
 * store's own, so this is a decision the connection has to make rather than one it reproduces: the
 * address of the part — the name it is looked up by, then the language, which together are the pair the
 * delivered reader resolves a message with — and then the identifier, which is the key that makes the
 * order total and a cursor walk over it stable.
 */
const EMAIL_TEMPLATE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'name', direction: 'ASC' },
	{ field: 'languageCode', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The message templates over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below reaches the same `EmailTemplateService` method, or dispatches the same query or
 * command, that the `/api/email-template` routes reach.
 *
 * **The guard chain and the permission are the controller's.** The class carries what the controller
 * class carries — both guards and the one permission — and so does every field, because no handler on
 * that controller states a permission of its own: the class-level one covers all of them, the inherited
 * create, soft removal and recovery included. A field that stated anything narrower, or anything at
 * all beyond this, would give GraphQL a scope REST does not have.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('EmailTemplate')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES)
export class EmailTemplateResolver {
	constructor(
		private readonly emailTemplateService: EmailTemplateService,
		private readonly queryBus: QueryBus,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The message parts of the caller's tenant, with the organization-less copies the whole tenant falls
	 * back to, in the order of the address they are read by.
	 */
	@Query('emailTemplates')
	@Permissions(PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES)
	async emailTemplates(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<EmailTemplate>> {
		// The same read the list route performs, through the same query it dispatches. This surface has no
		// query string to bind, so the DTO carries the one narrowing a well-formed REST request states: the
		// caller's own tenant. The reader applies a tenant only when the DTO names one — and substitutes the
		// credential's value for whatever the DTO holds — and it adds the copies belonging to no tenant at
		// all beside them, so naming it is what makes the two protocols answer the same set of rows.
		const options = {
			where: { tenantId: RequestContext.currentTenantId() }
		} as unknown as BaseQueryDTO<EmailTemplate>;
		const { items }: IPagination<EmailTemplate> = await this.queryBus.execute(new EmailTemplateQuery(options));

		return buildConnection<EmailTemplate>({
			rows: items ?? [],
			filterable: EMAIL_TEMPLATE_FILTERABLE,
			sortable: EMAIL_TEMPLATE_SORTABLE,
			defaultSort: EMAIL_TEMPLATE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One message part of the caller's tenant.
	 *
	 * The read is the one the delivered node route performs, tenant criterion included. A part that is
	 * not there — or that belongs to another tenant — answers `null` rather than a refusal: GraphQL has
	 * one answer for "no such row" on a field that may have none, and the refusal the delivered route
	 * raises for the same fact is that fact stated in the other protocol's vocabulary, which a field
	 * cannot carry.
	 */
	@Query('emailTemplate')
	@Permissions(PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES)
	async emailTemplate(@Args('id', { type: () => ID }) id: Id): Promise<EmailTemplate | null> {
		try {
			return await this.emailTemplateService.findOneByIdString(id, {
				where: { tenantId: RequestContext.currentTenantId() }
			});
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many message parts the caller's own tenant holds.
	 *
	 * The same call the count route makes with the options it is given when its query string states
	 * none: the tenant is read from the credential and passed as the criterion.
	 */
	@Query('emailTemplateCount')
	@Permissions(PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES)
	async emailTemplateCount(): Promise<number> {
		return await this.emailTemplateService.countBy({ tenantId: RequestContext.currentTenantId() });
	}

	/**
	 * The subject text and the body source that will be used for one template.
	 *
	 * The same query the delivered lookup route dispatches, with the same language beside it: the route
	 * reads the `language` request header and passes it as the i18n fallback, and
	 * `RequestContext.getLanguageCode()` reads the same header off the same request — the bootstrap
	 * mounts the request context on the GraphQL endpoint as well as on the prefixed routes — so a caller
	 * asking the same question over either protocol is answered in the same language. The fallback the
	 * route applies is the caller's stated `languageCode` first and the request's language after it,
	 * which is the order the delivered handler resolves them in.
	 */
	@Query('emailTemplateContent')
	@Permissions(PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES)
	async emailTemplateContent(
		@Args('name', { type: () => String }) name: string,
		@Args('languageCode', { type: () => String, nullable: true }) languageCode?: string,
		@Args('organizationId', { type: () => ID }) organizationId?: Id
	): Promise<ICustomizableEmailTemplate> {
		const input: ICustomizeEmailTemplateFindInput = {
			name,
			languageCode,
			organizationId
		} as ICustomizeEmailTemplateFindInput;

		return await this.queryBus.execute(new FindEmailTemplateQuery(input, this.languageOfTheCaller()));
	}

	/**
	 * Converts a document into the HTML a preview shows.
	 *
	 * The same query the delivered preview route dispatches. Nothing is written, which is why the field
	 * is a read here although the route that carries it is a `POST`: the route states a body, not an
	 * effect.
	 */
	@Query('emailTemplatePreview')
	@Permissions(PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES)
	async emailTemplatePreview(
		@Args('data', { type: () => String }) data: string
	): Promise<{ html: string }> {
		return await this.queryBus.execute(new EmailTemplateGeneratePreviewQuery(data));
	}

	/**
	 * Files one part of one message.
	 *
	 * The same service method the delivered create route calls. The tenant is the credential's and never
	 * an argument: the row carries a tenant column, the delivered route writes whatever a body states,
	 * and no write on this platform lets a caller choose the tenant it writes into. An absent
	 * organization files the tenant-wide copy, which is the same statement the delivered reader makes
	 * when it reads an organization-less input.
	 */
	@Mutation('createEmailTemplate')
	@Permissions(PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES)
	async createEmailTemplate(@Args('input') input: ICreateEmailTemplateInput): Promise<EmailTemplate> {
		return await this.emailTemplateService.create({
			name: input.name,
			languageCode: input.languageCode,
			hbs: input.hbs,
			mjml: input.mjml,
			organizationId: input.organizationId,
			tenantId: RequestContext.currentTenantId()
		} as unknown as EmailTemplate);
	}

	/**
	 * Changes the facts of a message part that exists.
	 *
	 * The delivered edit reads the row and then writes the body it was given, and this field does the
	 * same in the same order: a caller naming a part of another tenant, or one that is not there, is
	 * answered with the miss rather than with a write whose criterion matches nothing.
	 *
	 * **A member the caller leaves out is left out of the payload**, which is what makes an absent
	 * member "leave it as it is" and a member stated as `null` "write null" — the two requests the
	 * schema keeps apart. Moving a copy to the tenant-wide one is the second of them.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered route
	 * answers the store's own update result — a statement about the write, `{ affected }` — which is not
	 * a row and not what a GraphQL field named `updateEmailTemplate` may return. The member left out is
	 * not written as the column's default: the delivered edit is a partial column update rather than a
	 * replacement of the row.
	 */
	@Mutation('updateEmailTemplate')
	@Permissions(PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES)
	async updateEmailTemplate(@Args('input') input: IUpdateEmailTemplateInput): Promise<EmailTemplate> {
		const { id, ...values } = input;
		const tenantId = RequestContext.currentTenantId();

		await this.emailTemplateService.findOneByIdString(id, { where: { tenantId } });
		await this.emailTemplateService.update({ id, tenantId }, values as QueryDeepPartialEntity<EmailTemplate>);

		return await this.emailTemplateService.findOneByIdString(id, { where: { tenantId } });
	}

	/**
	 * Removes a message part outright.
	 *
	 * The delivered route reads the row before it removes it, so a caller naming a part of another
	 * tenant is refused by the same read rather than by a delete that matched nothing and reported
	 * success.
	 */
	@Mutation('deleteEmailTemplate')
	@Permissions(PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES)
	async deleteEmailTemplate(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		const tenantId = RequestContext.currentTenantId();

		await this.emailTemplateService.findOneByIdString(id, { where: { tenantId } });
		await this.emailTemplateService.delete({ id, tenantId });

		return true;
	}

	/**
	 * Withdraws a copy without removing it.
	 *
	 * The delivered route is inherited from the CRUD base, which declares no query parameter of its own
	 * and passes the service the option list it bound from the query string, so the field states none
	 * either.
	 */
	@Mutation('softDeleteEmailTemplate')
	@Permissions(PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES)
	async softDeleteEmailTemplate(@Args('id', { type: () => ID }) id: Id): Promise<EmailTemplate> {
		return await this.emailTemplateService.softRemove(id);
	}

	/**
	 * Puts a withdrawn copy back.
	 */
	@Mutation('recoverEmailTemplate')
	@Permissions(PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES)
	async recoverEmailTemplate(@Args('id', { type: () => ID }) id: Id): Promise<EmailTemplate> {
		return await this.emailTemplateService.softRecover(id);
	}

	/**
	 * Saves both parts of one message for one language.
	 *
	 * The same command the delivered save route dispatches, with the members its handler reads: the
	 * template and the language address the two rows, `subject` is stored as the subject part's compiled
	 * text, and `mjml` is stored as the body part's source with the compiled body derived from it. The
	 * tenant is not among them — the handler stamps the caller's own — and an absent organization is the
	 * tenant-wide pair of parts, which is the row the whole tenant falls back to.
	 */
	@Mutation('saveEmailTemplate')
	@Permissions(PermissionsEnum.VIEW_ALL_EMAIL_TEMPLATES)
	async saveEmailTemplate(@Args('input') input: ISaveEmailTemplateInput): Promise<EmailTemplate> {
		return await this.commandBus.execute(
			new EmailTemplateSaveCommand({
				name: input.name,
				languageCode: input.languageCode,
				mjml: input.mjml,
				subject: input.subject,
				organizationId: input.organizationId
			} as unknown as IEmailTemplateSaveInput)
		);
	}

	/**
	 * The language the delivered lookup route's `language` header names.
	 *
	 * The controller reads that header through its `LanguageDecorator`, which answers English when the
	 * request carries none; `RequestContext.getLanguageCode()` reads the same header off the same
	 * request and answers the same default without one, so the fallback a caller gets is the one the
	 * route would have given it.
	 */
	private languageOfTheCaller(): LanguagesEnum {
		return RequestContext.getLanguageCode();
	}
}
