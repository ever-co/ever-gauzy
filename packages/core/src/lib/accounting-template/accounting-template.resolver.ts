import { NotFoundException, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	IAccountingTemplate,
	IAccountingTemplateFindInput,
	IAccountingTemplateUpdateInput,
	ID as Id,
	IPagination,
	JsonData,
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
import { AccountingTemplate } from './accounting-template.entity';
import { AccountingTemplateService } from './accounting-template.service';
import { AccountingTemplateQuery } from './queries';

/** The members `CreateAccountingTemplateInput` declares in the schema. */
export interface ICreateAccountingTemplateInput {
	name?: string;
	languageCode?: string;
	templateType?: string;
	mjml?: string;
	hbs?: string;
	organizationId?: Id;
}

/** The members `UpdateAccountingTemplateInput` declares in the schema. */
export interface IUpdateAccountingTemplateInput extends ICreateAccountingTemplateInput {
	id: Id;
}

/** The members `SaveAccountingTemplateInput` declares in the schema. */
export interface ISaveAccountingTemplateInput {
	templateType: string;
	languageCode: string;
	organizationId: Id;
	mjml: string;
}

/**
 * The fields an accounting template list may be filtered and sorted by, and the order it is returned in
 * when the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `AccountingTemplateFilter` and
 * `AccountingTemplateSortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 *
 * `mjml` and `hbs` are in neither. They are document columns: a condition on one would scan a whole
 * template's source for a pattern, which is a question no delivered read asks and which would answer a
 * match against markup rather than against a template.
 *
 * `deletedAt` is in neither, because the delivered list read answers live rows only, so the column is
 * absent on every row this connection holds.
 */
const ACCOUNTING_TEMPLATE_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	languageCode: 'STRING',
	templateType: 'STRING',
	organizationId: 'ID',
	tenantId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const ACCOUNTING_TEMPLATE_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'languageCode',
	'templateType'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list read applies only the order its caller names and otherwise leaves the rows in the
 * store's own, so this is a decision the connection has to make rather than one it reproduces: the
 * address the resolved read looks a template up by — its type, then its language — and then the
 * identifier, which is the key that makes the order total and a cursor walk over it stable.
 */
const ACCOUNTING_TEMPLATE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'templateType', direction: 'ASC' },
	{ field: 'languageCode', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The accounting templates over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below reaches the same `AccountingTemplateService` method, or dispatches the same
 * query, that the `/api/accounting-template` routes reach.
 *
 * **The guard chain and the permission are the controller's.** The class carries what the controller
 * class carries — both guards and the class-level permission — and every field then states the same
 * permission, because no handler on that controller states one of its own: the class-level permission
 * covers all of them, the inherited creation, withdrawal and restoration included. A field that stated
 * anything narrower, or anything at all beyond this, would give GraphQL a scope REST does not have.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('AccountingTemplate')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES)
export class AccountingTemplateResolver {
	constructor(
		private readonly accountingTemplateService: AccountingTemplateService,
		private readonly queryBus: QueryBus
	) {}

	/**
	 * The templates of the caller's tenant, with the copies the platform ships that belong to no tenant
	 * and no organization.
	 */
	@Query('accountingTemplates')
	@Permissions(PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES)
	async accountingTemplates(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<AccountingTemplate>> {
		// The same read the list route performs, through the same query it dispatches. This surface has no
		// query string to bind, so the DTO carries the one narrowing a request that states nothing carries:
		// an empty criterion. The read adds the caller's own tenant and the rows belonging to no tenant at
		// all from the credential — which is what makes the two protocols answer the same set of rows — and
		// it dereferences the criterion, which is why the field is present rather than absent.
		const options = { where: {} } as BaseQueryDTO<AccountingTemplate>;
		const { items }: IPagination<AccountingTemplate> = await this.queryBus.execute(
			new AccountingTemplateQuery(options)
		);

		return buildConnection<AccountingTemplate>({
			rows: items ?? [],
			filterable: ACCOUNTING_TEMPLATE_FILTERABLE,
			sortable: ACCOUNTING_TEMPLATE_SORTABLE,
			defaultSort: ACCOUNTING_TEMPLATE_DEFAULT_SORT,
			request: { filter, sort, page, first, last, after, before, limit, offset }
		});
	}

	/**
	 * One template, or null when there is none.
	 *
	 * The delivered node route answers the same miss with a `400`, because its handler catches every
	 * failure broadly and states no message with it. That is a refusal raised *about* a miss rather than a
	 * fact a client can act on, and GraphQL has one answer for "no such row" on a field that may have
	 * none — so the miss is answered as the null row it is, and every other failure still reaches the
	 * caller as the failure it is.
	 */
	@Query('accountingTemplate')
	@Permissions(PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES)
	async accountingTemplate(@Args('id', { type: () => ID }) id: Id): Promise<AccountingTemplate | null> {
		try {
			return await this.accountingTemplateService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many templates the caller's own tenant holds.
	 *
	 * The same call the count route makes with the options it is given when its query string states none:
	 * the service is handed an empty criterion and applies the caller's tenant to it.
	 */
	@Query('accountingTemplateCount')
	@Permissions(PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES)
	async accountingTemplateCount(): Promise<number> {
		return await this.accountingTemplateService.countBy({});
	}

	/**
	 * The template one type of record is rendered through, resolved through the delivered fallback.
	 *
	 * The same service call the delivered lookup route makes, with the same three addressing members and
	 * the same language fallback: the route reads the `language` request header through its decorator,
	 * and `RequestContext.getLanguageCode()` reads the same header off the same request — the bootstrap
	 * mounts the request context on the GraphQL endpoint as well as on the prefixed routes — so a caller
	 * asking the same question over either protocol is answered from the same fallback chain.
	 */
	@Query('accountingTemplateFor')
	@Permissions(PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES)
	async accountingTemplateFor(
		@Args('templateType', { type: () => String }) templateType: string,
		@Args('languageCode', { type: () => String }) languageCode: string,
		@Args('organizationId', { type: () => ID }) organizationId: Id
	): Promise<AccountingTemplate | null> {
		const input = { templateType, languageCode, organizationId } as IAccountingTemplateFindInput;

		return (await this.accountingTemplateService.getAccountTemplate(
			input,
			this.languageOfTheCaller()
		)) as AccountingTemplate | null;
	}

	/**
	 * Converts a document into the HTML a preview shows.
	 *
	 * The same service call the delivered preview route makes. The route states a body, not an effect —
	 * nothing is written — which is why the field is a read here although the route that carries it is a
	 * `POST`. The delivered handler reads its two members out of a `request` member of the body; the two
	 * are arguments here, because that nesting is the request shape rather than a fact about the preview.
	 */
	@Query('accountingTemplatePreview')
	@Permissions(PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES)
	async accountingTemplatePreview(
		@Args('data', { type: () => String }) data: string,
		@Args('organization', { nullable: true }) organization?: JsonData
	): Promise<{ html: string }> {
		return await this.accountingTemplateService.generatePreview({ request: { data, organization } });
	}

	/**
	 * Files a template.
	 *
	 * The same service method the delivered create route inherits from the CRUD base calls, with the
	 * payload as stated. The tenant a row is written into is stamped from the credential and is never an
	 * argument, which is the statement every write on this platform makes.
	 */
	@Mutation('createAccountingTemplate')
	@Permissions(PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES)
	async createAccountingTemplate(
		@Args('input') input: ICreateAccountingTemplateInput
	): Promise<AccountingTemplate> {
		return await this.accountingTemplateService.create(input as unknown as AccountingTemplate);
	}

	/**
	 * Changes a template that exists.
	 *
	 * The delivered edit is the service's own create called with the path identifier beside the stated
	 * body — the columns are written as stated, and a member the caller leaves out takes the column's
	 * default rather than keeping its value — and the row is then read back through the same node read
	 * the route performs, so both surfaces answer the same row.
	 */
	@Mutation('updateAccountingTemplate')
	@Permissions(PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES)
	async updateAccountingTemplate(
		@Args('input') input: IUpdateAccountingTemplateInput
	): Promise<AccountingTemplate> {
		const { id, ...values } = input;

		await this.accountingTemplateService.create({ ...values, id } as unknown as AccountingTemplate);

		return await this.accountingTemplateService.findOneByIdString(id);
	}

	/**
	 * Removes a template outright.
	 */
	@Mutation('deleteAccountingTemplate')
	@Permissions(PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES)
	async deleteAccountingTemplate(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.accountingTemplateService.delete(id);

		return true;
	}

	/**
	 * Withdraws a template without removing it.
	 *
	 * The delivered route is inherited from the CRUD base, which declares no query parameter of its own
	 * and passes the service the option list it bound from the query string, so the field states none
	 * either.
	 */
	@Mutation('softDeleteAccountingTemplate')
	@Permissions(PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES)
	async softDeleteAccountingTemplate(@Args('id', { type: () => ID }) id: Id): Promise<AccountingTemplate> {
		return await this.accountingTemplateService.softRemove(id);
	}

	/**
	 * Puts a withdrawn template back.
	 */
	@Mutation('recoverAccountingTemplate')
	@Permissions(PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES)
	async recoverAccountingTemplate(@Args('id', { type: () => ID }) id: Id): Promise<AccountingTemplate> {
		return await this.accountingTemplateService.softRecover(id);
	}

	/**
	 * Saves the document of one template.
	 *
	 * The same service method the delivered save route calls, with the four members its handler reads:
	 * the copy is resolved by type, language and organization, the stated source is compiled, and both
	 * copies are stored — creating the row when the resolution found none.
	 *
	 * The service answers either the row it created or the store's own update result, which is not a row
	 * and not what a GraphQL field named `saveAccountingTemplate` may return. The row the write produced
	 * is therefore read back by the same three members the save resolved it by, which is the criterion
	 * the service's own lookup uses.
	 */
	@Mutation('saveAccountingTemplate')
	@Permissions(PermissionsEnum.VIEW_ALL_ACCOUNTING_TEMPLATES)
	async saveAccountingTemplate(
		@Args('input') input: ISaveAccountingTemplateInput
	): Promise<IAccountingTemplate> {
		await this.accountingTemplateService.saveTemplate({
			templateType: input.templateType,
			languageCode: input.languageCode,
			organizationId: input.organizationId,
			mjml: input.mjml
		} as IAccountingTemplateUpdateInput);

		return await this.accountingTemplateService.findOneByWhereOptions({
			templateType: input.templateType,
			languageCode: input.languageCode,
			organizationId: input.organizationId
		});
	}

	/**
	 * The language the delivered lookup route's `language` header names.
	 *
	 * The controller reads that header through its `LanguageDecorator`, which answers English when the
	 * request carries none; `RequestContext.getLanguageCode()` reads the same header off the same request
	 * and answers the same default without one, so the fallback a caller gets is the one the route would
	 * have given it.
	 */
	private languageOfTheCaller(): LanguagesEnum {
		return RequestContext.getLanguageCode();
	}
}
