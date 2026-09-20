import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ICustomSmtpCreateInput,
	ICustomSmtpFindInput,
	ICustomSmtpUpdateInput,
	ID as Id,
	IPagination,
	IVerifySMTPTransport,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { CustomSmtp } from './custom-smtp.entity';
import { CustomSmtpService } from './custom-smtp.service';
import { CustomSmtpCreateCommand, CustomSmtpUpdateCommand } from './commands';

/** The members `CreateSmtpSettingInput` declares in the schema. */
export interface ICreateSmtpSettingInput {
	fromAddress?: string;
	host: string;
	port: number;
	secure: boolean;
	isValidate?: boolean;
	username: string;
	password: string;
	organizationId?: Id;
}

/** The members `UpdateSmtpSettingInput` declares in the schema. */
export interface IUpdateSmtpSettingInput extends ICreateSmtpSettingInput {
	id: Id;
}

/** The members `ValidateSmtpSettingInput` declares in the schema. */
export interface IValidateSmtpSettingInput {
	fromAddress?: string;
	host: string;
	port: number;
	secure: boolean;
	username: string;
	password: string;
}

/**
 * The fields a configuration list may be filtered and sorted by, and the order it is returned in when
 * the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `SmtpSettingFilter` and `SmtpSettingSortField`
 * are its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * The credentials are in neither list, and that is a statement rather than an omission: a filter is a
 * comparison against the row's own value, so a member for one would be a way to read a secret one
 * character at a time — and the row's own value is what the delivered projection masks.
 */
const SMTP_SETTING_FILTERABLE = {
	id: 'ID',
	fromAddress: 'STRING',
	host: 'STRING',
	port: 'NUMBER',
	secure: 'BOOLEAN',
	isValidate: 'BOOLEAN',
	organizationId: 'ID',
	tenantId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const SMTP_SETTING_SORTABLE = ['createdAt', 'updatedAt', 'host', 'port', 'isValidate'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list method fixes no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest first, because the configuration an operator has just written is the one being
 * looked for, and then the identifier, which is the key that makes the order total and a cursor walk
 * over it stable.
 */
const SMTP_SETTING_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The SMTP configuration over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below reaches the same `CustomSmtpService` method, or dispatches the same command,
 * that the `/api/smtp` routes reach, with the same payload.
 *
 * **The guard chain and the permission are the controller's.** The controller carries
 * `TenantPermissionGuard` and `PermissionGuard` beside `CUSTOM_SMTP_VIEW` on the class, and no handler
 * states a permission of its own — the creation, the edit and the validator included — so the class here
 * carries the two guards beside the gate and the same permission, and every field below runs under it.
 *
 * **The credentials are written and never answered.** The delivered API answers a masked username and
 * password, and the row a resolver holds carries the stored values; the type this resolver answers
 * therefore carries no member for either. The inputs do, because rotating a transport's credentials is
 * what the writes are for — and the value travels one way.
 *
 * **The reads are the routes' own.** The list is the CRUD base's list method, the node is its finder,
 * the count is its counter, and the resolved configuration is the resource's own read — the
 * organization's row, the installation-wide one when it has none, and the installation's configured
 * transport when neither exists.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability, and appended to the guard chain the routes already carry rather than replacing any part
 * of it.
 */
@Resolver('SmtpSetting')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.CUSTOM_SMTP_VIEW)
export class CustomSmtpResolver {
	constructor(
		private readonly customSmtpService: CustomSmtpService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The configurations of the caller's tenant.
	 *
	 * The read is the CRUD base's list method — what `GET /` reaches and what the paginated spelling
	 * slices — and the page a caller states is what the connection performs, so what is read is the
	 * unsliced set the route reads.
	 */
	@Query('customSmtpSettings')
	@Permissions(PermissionsEnum.CUSTOM_SMTP_VIEW)
	async customSmtpSettings(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<CustomSmtp>> {
		const { items }: IPagination<CustomSmtp> = await this.customSmtpService.findAll({} as never);

		return buildConnection<CustomSmtp>({
			rows: items ?? [],
			filterable: SMTP_SETTING_FILTERABLE,
			sortable: SMTP_SETTING_SORTABLE,
			defaultSort: SMTP_SETTING_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One configuration of the caller's tenant.
	 *
	 * The read is the CRUD base's finder, which the node route reaches. A configuration that is not
	 * there — or that belongs to another tenant — answers `null` rather than a refusal, because GraphQL
	 * has one answer for "no such row" on a field that may have none.
	 */
	@Query('customSmtpSetting')
	@Permissions(PermissionsEnum.CUSTOM_SMTP_VIEW)
	async customSmtpSetting(@Args('id', { type: () => ID }) id: Id): Promise<CustomSmtp | null> {
		try {
			return await this.customSmtpService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many configurations the caller's tenant holds.
	 *
	 * The same call the count route makes with the options it is given when its query string states
	 * none.
	 */
	@Query('customSmtpSettingCount')
	@Permissions(PermissionsEnum.CUSTOM_SMTP_VIEW)
	async customSmtpSettingCount(): Promise<number> {
		return await this.customSmtpService.countBy();
	}

	/**
	 * The configuration one organization's mail is sent through.
	 *
	 * The service is the delivered route's own, with the same input the route binds: the organization,
	 * and the fallback it performs itself — the installation-wide row, and the installation's configured
	 * transport when there is no row at all. The answer's identifier is what tells a caller which of the
	 * three it received, which is why the type carries one that may be absent.
	 */
	@Query('smtpSetting')
	@Permissions(PermissionsEnum.CUSTOM_SMTP_VIEW)
	async smtpSetting(
		@Args('organizationId', { type: () => ID, nullable: true }) organizationId?: Id
	): Promise<CustomSmtp> {
		const query = { organizationId } as ICustomSmtpFindInput;

		return (await this.customSmtpService.getSmtpSetting(query)) as CustomSmtp;
	}

	/**
	 * Files a configuration.
	 *
	 * The command is the route's own, and the delivered handler stores what the body carries — the
	 * credentials included — and answers the row. The tenant is not a member of the input: the service
	 * stamps the caller's own onto the row.
	 */
	@Mutation('createSmtpSetting')
	@Permissions(PermissionsEnum.CUSTOM_SMTP_VIEW)
	async createSmtpSetting(@Args('input') input: ICreateSmtpSettingInput): Promise<CustomSmtp> {
		return await this.commandBus.execute(
			new CustomSmtpCreateCommand(input as unknown as ICustomSmtpCreateInput)
		);
	}

	/**
	 * Replaces the writable columns of a configuration.
	 *
	 * The command is the route's own, and it reads the row back after the write, so the answer is the
	 * configuration as it now stands rather than the store's own write result. The delivered edit is the
	 * creation body under the path identifier, so a member the caller leaves out is written as the
	 * column's default rather than left as it is.
	 */
	@Mutation('updateSmtpSetting')
	@Permissions(PermissionsEnum.CUSTOM_SMTP_VIEW)
	async updateSmtpSetting(@Args('input') input: IUpdateSmtpSettingInput): Promise<CustomSmtp> {
		const { id, ...values } = input;

		return await this.commandBus.execute(
			new CustomSmtpUpdateCommand(id, values as unknown as ICustomSmtpUpdateInput)
		);
	}

	/**
	 * Removes a configuration outright.
	 *
	 * The delivered route is the CRUD base's removal and answers with the store's deletion result; the
	 * field answers the fact of the removal, which is the one member of that result a caller reads. A row
	 * that was not there is the service's own miss rather than a `false` answered from here.
	 */
	@Mutation('deleteSmtpSetting')
	@Permissions(PermissionsEnum.CUSTOM_SMTP_VIEW)
	async deleteSmtpSetting(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.customSmtpService.delete(id);

		return true;
	}

	/**
	 * Withdraws a configuration without removing it.
	 *
	 * The delivered route is inherited from the CRUD base, which binds no query parameter of its own, so
	 * the field states none either — and the resolution falls back to the installation-wide row for an
	 * organization whose own configuration was withdrawn, which is what the read above answers.
	 */
	@Mutation('softDeleteSmtpSetting')
	@Permissions(PermissionsEnum.CUSTOM_SMTP_VIEW)
	async softDeleteSmtpSetting(@Args('id', { type: () => ID }) id: Id): Promise<CustomSmtp> {
		return await this.customSmtpService.softRemove(id);
	}

	/**
	 * Puts a withdrawn configuration back.
	 */
	@Mutation('recoverSmtpSetting')
	@Permissions(PermissionsEnum.CUSTOM_SMTP_VIEW)
	async recoverSmtpSetting(@Args('id', { type: () => ID }) id: Id): Promise<CustomSmtp> {
		return await this.customSmtpService.softRecover(id);
	}

	/**
	 * Reports whether a transport accepts the configuration the caller states.
	 *
	 * The service is the delivered validator's own, and so is its behaviour: it opens a connection,
	 * closes it, and answers whether the server accepted the credentials — a refusal is reported as
	 * `false` rather than raised, which is why the field answers a boolean and not a report. Nothing is
	 * sent and nothing is stored, which is what makes this a question asked of a configuration rather
	 * than a write of one.
	 */
	@Mutation('validateSmtpSetting')
	@Permissions(PermissionsEnum.CUSTOM_SMTP_VIEW)
	async validateSmtpSetting(@Args('input') input: IValidateSmtpSettingInput): Promise<boolean> {
		return await this.customSmtpService.verifyTransporter(input as unknown as IVerifySMTPTransport);
	}
}
