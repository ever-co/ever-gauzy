import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	ID as Id,
	IPagination,
	ITenantSetting,
	ITenantUiPreferences,
	ITenantUiPreferencesUpdateInput,
	IWasabiFileStorageProviderConfig,
	PREFERRED_UI_SETTING_KEY,
	PermissionsEnum,
	PreferredUiEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../../api/graphql-connection';
import { RequestContext } from '../../core/context';
import { Permissions } from '../../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { TenantSetting } from './tenant-setting.entity';
import { TenantSettingService } from './tenant-setting.service';
import {
	GlobalSettingGetCommand,
	GlobalSettingSaveCommand,
	TenantSettingGetCommand,
	TenantSettingSaveCommand
} from './commands';
import { normalizePreferredUi } from './tenant-ui-preferences.controller';

/** The members `UpdateTenantSettingInput` declares in the schema. */
export interface IUpdateTenantSettingInput {
	fileStorageProvider?: string;
	wasabi_aws_access_key_id?: string;
	wasabi_aws_secret_access_key?: string;
	wasabi_aws_bucket?: string;
	wasabi_aws_default_region?: string;
	wasabi_aws_service_url?: string;
	wasabi_aws_force_path_style?: boolean;
	digitalocean_access_key_id?: string;
	digitalocean_secret_access_key?: string;
	digitalocean_s3_bucket?: string;
	digitalocean_service_url?: string;
	digitalocean_cdn_url?: string;
	digitalocean_default_region?: string;
	digitalocean_s3_force_path_style?: boolean;
	aws_access_key_id?: string;
	aws_secret_access_key?: string;
	aws_default_region?: string;
	aws_bucket?: string;
	aws_force_path_style?: boolean;
	cloudinary_cloud_name?: string;
	cloudinary_api_key?: string;
	cloudinary_api_secret?: string;
	cloudinary_api_secure?: string;
}

/** One key and the value to store under it, as `TenantSettingValueInput` declares it. */
export interface ITenantSettingValueInput {
	name: string;
	value: string;
}

/** The members `UpdateDynamicTenantSettingInput` declares in the schema. */
export interface IUpdateDynamicTenantSettingInput {
	settings: ITenantSettingValueInput[];
}

/** The members `UpdateTenantSettingRowInput` declares in the schema. */
export interface IUpdateTenantSettingRowInput {
	id: Id;
	name?: string;
	value?: string;
	valueJson?: unknown;
	valueType?: string;
	isEncrypted?: boolean;
	description?: string;
	organizationId?: Id;
	channelId?: Id;
	scope?: string;
}

/** The members `WasabiFileStorageConfigInput` declares in the schema. */
export interface IWasabiFileStorageConfigInput {
	wasabi_aws_access_key_id?: string;
	wasabi_aws_secret_access_key?: string;
	wasabi_aws_bucket?: string;
	wasabi_aws_default_region?: string;
	wasabi_aws_service_url?: string;
	wasabi_aws_force_path_style?: boolean;
}

/** The members `UpdateTenantUiPreferencesInput` declares in the schema. */
export interface IUpdateTenantUiPreferencesInput {
	preferredUi?: PreferredUiEnum;
}

/**
 * The fields a settings list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `TenantSettingFilter` and
 * `TenantSettingSortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 *
 * The three scope columns are here because they are what a reader of a settings list actually asks:
 * `organizationId: { isNull: true }` is the tenant-wide rows alone, which is a question no other
 * member of this row can answer. `valueJson` is a `JSON` rather than a `STRING`, because the column
 * holds a document and a filter compared against a string of JSON would compare against a form the
 * column never stores.
 */
const TENANT_SETTING_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	value: 'STRING',
	valueJson: 'JSON',
	valueType: 'STRING',
	isEncrypted: 'BOOLEAN',
	description: 'STRING',
	organizationId: 'ID',
	channelId: 'ID',
	scope: 'ENUM',
	tenantId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const TENANT_SETTING_SORTABLE = ['createdAt', 'updatedAt', 'name', 'scope', 'isEncrypted'] as const;

/**
 * The order this connection means: newest first, with the identifier as the last key so that two rows
 * written in the same millisecond still have one order between them.
 *
 * The delivered list method fixes no order of its own — it hands the store a `where` and takes the
 * rows as they come back — so the order is stated here rather than reproduced from it, and it is
 * stated because a cursor names a row by its position in a total order: without one, a walk over
 * these rows could not resume at all.
 */
const TENANT_SETTING_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The tenant's configuration over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `TenantSettingService` method or dispatches the same
 * command its own route calls, with the same payload.
 *
 * **The guard chain is the controllers' and the gate is the catalogue's.** The domain is served by two
 * controllers — `TenantSettingController` and `TenantUiPreferencesController` — and both carry
 * `TenantPermissionGuard` and `PermissionGuard` on the class, so those two are stated once here and
 * every field runs under them. The catalogue declares `FEATURE_GRAPHQL` as the code that gates the
 * GraphQL endpoint and its resolvers, and a disabled feature makes a gated capability's routes answer
 * 404 through `FeatureFlagGuard`; the guard resolves that code from `FEATURE_METADATA`, read with
 * `getAllAndOverride` over the handler and then the class, which is why the code is declared once on
 * this class: every field below is behind it, and a field that ever needed a different code would
 * state one of its own and the guard would read that instead. Nothing ad-hoc is done here — no call to
 * `isFeatureEnabled` inside a method — because a gate stated in one place and enforced in another is a
 * gate that can be removed from one of them.
 *
 * The effect, stated plainly: a tenant that switched the capability off is answered
 * `Cannot query field <name>` — the same refusal, in this protocol's vocabulary, that a disabled
 * capability's REST routes answer with a 404. That is safe rather than circular, because the REST
 * routes of this resource are not gated by that code: the door that switches a capability back on is
 * never the door the capability locked.
 *
 * **The permission is stated per field, and that is the parity rather than a deviation from it.** One
 * controller states `TENANT_SETTING` on its class and `GLOBAL_SETTING` on its two global routes; the
 * other states no class-level permission at all, because the tenant's UI flavour is readable by every
 * signed-in user. A single class-level statement cannot be both, so each field below states exactly
 * what its own route's metadata resolves to — and the spec reads those two values and compares them
 * rather than restating a list that could agree with this file while disagreeing with the controller.
 */
@Resolver('TenantSetting')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class TenantSettingResolver {
	constructor(
		private readonly tenantSettingService: TenantSettingService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The setting rows of the caller's tenant, tenant-wide rows included.
	 *
	 * The rows are the set the delivered paginated list route slices, and the read is the service's own
	 * list method — the tenant is applied by the service, from the credential, so a caller cannot name
	 * another tenant's rows. The page a caller states is what the connection performs, so the read here
	 * is the unsliced set: `limit`/`offset` or `first`/`after` is the slice the route's `take`/`skip`
	 * would have applied, and `totalCount` is the size of the set the filters selected.
	 */
	@Query('tenantSettings')
	@Permissions(PermissionsEnum.TENANT_SETTING)
	async tenantSettings(
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
	): Promise<GraphqlConnection<TenantSetting>> {
		const { items }: IPagination<TenantSetting> = await this.tenantSettingService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) });

		return buildConnection<TenantSetting>({
			rows: items ?? [],
			filterable: TENANT_SETTING_FILTERABLE,
			sortable: TENANT_SETTING_SORTABLE,
			defaultSort: TENANT_SETTING_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One setting row of the caller's tenant.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary. The read is tenant-scoped by the service, so a foreign identifier is
	 * the miss and not another tenant's row.
	 */
	@Query('tenantSetting')
	@Permissions(PermissionsEnum.TENANT_SETTING)
	async tenantSetting(@Args('id', { type: () => ID }) id: Id): Promise<TenantSetting | null> {
		try {
			return await this.tenantSettingService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many setting rows the caller's tenant holds.
	 *
	 * The same call the count route makes, with the same absence of narrowing. That route binds its
	 * query string to the store's own `where` and hands it to `countBy`; the connection protocol has no
	 * argument of that shape, so the field passes none and counts the caller's own rows — the tenant is
	 * applied to the criterion by the service, from the credential rather than from the caller, which
	 * is what the route's bare call counts too.
	 */
	@Query('tenantSettingCount')
	@Permissions(PermissionsEnum.TENANT_SETTING)
	async tenantSettingCount(): Promise<number> {
		return await this.tenantSettingService.countBy();
	}

	/**
	 * The caller's tenant's settings as the delivered document route answers them.
	 *
	 * The command is the route's own, and it is dispatched rather than the service called directly
	 * because the masking is the handler's: the secret-bearing keys are wrapped there, so a caller
	 * reading this field observes exactly what the route answers, and not the row values beside it.
	 */
	@Query('tenantSettingValues')
	@Permissions(PermissionsEnum.TENANT_SETTING)
	async tenantSettingValues(): Promise<Record<string, unknown>> {
		return await this.commandBus.execute(new TenantSettingGetCommand());
	}

	/**
	 * The installation-wide defaults, as the delivered global route answers them.
	 *
	 * The route states `GLOBAL_SETTING` on itself, overriding the controller's class-level permission,
	 * and the field states the same one: these are the rows with no tenant, which are the installation
	 * operator's to read rather than any tenant administrator's.
	 */
	@Query('globalTenantSettingValues')
	@Permissions(PermissionsEnum.GLOBAL_SETTING)
	async globalTenantSettingValues(): Promise<Record<string, unknown>> {
		return await this.commandBus.execute(new GlobalSettingGetCommand());
	}

	/**
	 * The UI flavour this tenant's users are served.
	 *
	 * No permission is stated because the delivered route states none: the preference is what the
	 * dashboard renders from, so every signed-in user of the tenant reads it, while only an
	 * administrator may change it — which is the write below. The read is the service's own resolution,
	 * straight from the rows rather than from the request-scoped settings cache, so a save is visible
	 * on the very next request.
	 */
	@Query('tenantUiPreferences')
	async tenantUiPreferences(): Promise<ITenantUiPreferences> {
		const tenantId = RequestContext.currentTenantId();
		const resolved = await this.tenantSettingService.getResolvedSettings([PREFERRED_UI_SETTING_KEY], tenantId);

		return { preferredUi: normalizePreferredUi(resolved[PREFERRED_UI_SETTING_KEY]) };
	}

	/**
	 * Saves the tenant's settings document: the file storage provider and the credentials of the
	 * provider the caller selected.
	 *
	 * The write is dispatched as the same command the REST route dispatches, with the same body, so the
	 * two surfaces store the same rows. The tenant is not a member of the input: the handler reads it
	 * from the credential and refuses the write when there is none.
	 */
	@Mutation('updateTenantSetting')
	@Permissions(PermissionsEnum.TENANT_SETTING)
	async updateTenantSetting(@Args('input') input: IUpdateTenantSettingInput): Promise<ITenantSetting> {
		return await this.commandBus.execute(new TenantSettingSaveCommand(input as unknown as ITenantSetting));
	}

	/**
	 * Saves settings the caller names itself.
	 *
	 * The same command as the route, and the same fold: the delivered body is a map, a GraphQL input is
	 * a closed shape, so the pairs a caller states are folded into the document the service iterates.
	 * `Object.fromEntries` is what performs the fold, so a key named like an object prototype member
	 * becomes an own property of the document rather than reaching the prototype.
	 */
	@Mutation('updateDynamicTenantSetting')
	@Permissions(PermissionsEnum.TENANT_SETTING)
	async updateDynamicTenantSetting(
		@Args('input') input: IUpdateDynamicTenantSettingInput
	): Promise<ITenantSetting> {
		return await this.commandBus.execute(new TenantSettingSaveCommand(this.settingsDocument(input)));
	}

	/**
	 * Saves the installation-wide defaults (`tenantId IS NULL`).
	 *
	 * The route states `GLOBAL_SETTING` on itself and the field states the same one; the command is the
	 * one the route dispatches, and the document is folded exactly as the dynamic write above folds it.
	 * A global row is the default every tenant falls back to, which is why this is the one write here
	 * that is not scoped to the caller's own tenant.
	 */
	@Mutation('saveGlobalTenantSetting')
	@Permissions(PermissionsEnum.GLOBAL_SETTING)
	async saveGlobalTenantSetting(@Args('input') input: IUpdateDynamicTenantSettingInput): Promise<ITenantSetting> {
		return await this.commandBus.execute(new GlobalSettingSaveCommand(this.settingsDocument(input)));
	}

	/**
	 * Replaces the writable columns of one settings row.
	 *
	 * The service is the one the REST route calls, and it reads the row before it writes: a caller
	 * naming a row of another tenant, or one that is not there, is answered with the miss rather than
	 * with a write under an identifier the caller does not own.
	 *
	 * The field answers with the row read back rather than with the update result. The delivered route
	 * answers with the platform's `UpdateResult`, whose one member a caller reads is the count of rows
	 * the write reached, and that count is not a GraphQL scalar this schema declares; answering with
	 * the row is the same operation stated in the shape a client reads next anyway.
	 */
	@Mutation('updateTenantSettingRow')
	@Permissions(PermissionsEnum.TENANT_SETTING)
	async updateTenantSettingRow(@Args('input') input: IUpdateTenantSettingRowInput): Promise<TenantSetting> {
		await this.tenantSettingService.update(input.id, input as unknown as TenantSetting);

		return await this.tenantSettingService.findOneByIdString(input.id);
	}

	/**
	 * Removes a settings row outright.
	 *
	 * The delivered route answers with the deletion result; the field answers with the fact of the
	 * removal, which is the one member of that result a caller reads. A row that was not there is the
	 * service's own miss rather than a `false` answered from here.
	 */
	@Mutation('deleteTenantSetting')
	@Permissions(PermissionsEnum.TENANT_SETTING)
	async deleteTenantSetting(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.tenantSettingService.delete(id);

		return true;
	}

	/**
	 * Withdraws a settings row without removing it: the row stays, marked as removed, and the
	 * resolution falls back to the next scope. The same service method the delivered route calls, with
	 * the same omission of options — the route passes the empty array its variadic parameter collects,
	 * and no options is what that array states.
	 */
	@Mutation('softDeleteTenantSetting')
	@Permissions(PermissionsEnum.TENANT_SETTING)
	async softDeleteTenantSetting(@Args('id', { type: () => ID }) id: Id): Promise<TenantSetting> {
		return await this.tenantSettingService.softRemove(id);
	}

	/**
	 * Puts a withdrawn settings row back, as the delivered restore route does.
	 */
	@Mutation('recoverTenantSetting')
	@Permissions(PermissionsEnum.TENANT_SETTING)
	async recoverTenantSetting(@Args('id', { type: () => ID }) id: Id): Promise<TenantSetting> {
		return await this.tenantSettingService.softRecover(id);
	}

	/**
	 * Asks the platform to verify a Wasabi configuration by using it.
	 *
	 * The service is the route's own and so is its behaviour: it refuses a configuration missing either
	 * credential with a `400`, which this surface answers as an error, and otherwise reports what the
	 * provider said. That report is a document — a status, a message and the provider's own answer —
	 * which is why the field answers `JSON` rather than a type invented for it here.
	 */
	@Mutation('validateWasabiFileStorage')
	@Permissions(PermissionsEnum.TENANT_SETTING)
	async validateWasabiFileStorage(
		@Args('input') input: IWasabiFileStorageConfigInput
	): Promise<Record<string, unknown>> {
		const report = await this.tenantSettingService.verifyWasabiConfiguration(
			input as unknown as IWasabiFileStorageProviderConfig
		);

		return report as unknown as Record<string, unknown>;
	}

	/**
	 * Changes the UI flavour this tenant's users are served.
	 *
	 * The route's own body: the preference is saved as a tenant setting through the same command, and
	 * the answer is the resolved preference afterwards — this resolver's own read, exactly as the route
	 * answers with its own `getUiPreferences()`. A body that states no preference performs no write,
	 * which is the route's behaviour too.
	 */
	@Mutation('updateTenantUiPreferences')
	@Permissions(PermissionsEnum.TENANT_SETTING)
	async updateTenantUiPreferences(
		@Args('input') input: IUpdateTenantUiPreferencesInput
	): Promise<ITenantUiPreferences> {
		const update: ITenantUiPreferencesUpdateInput = input;

		if (update.preferredUi) {
			// `ITenantSetting` only types the file-storage keys; every other tenant setting travels
			// through the same key/value store untyped.
			const setting: ITenantSetting = { [PREFERRED_UI_SETTING_KEY]: update.preferredUi } as ITenantSetting;
			await this.commandBus.execute(new TenantSettingSaveCommand(setting));
		}

		return this.tenantUiPreferences();
	}

	/**
	 * The settings document the delivered save reads, folded from the pairs a caller states.
	 *
	 * The keys are the setting names and the values are the scalar values, which is what `saveSettings`
	 * iterates: it looks up one row per key and writes the value onto it, creating the row when the
	 * scope has none.
	 *
	 * @param input The pairs a caller stated.
	 * @returns The document, one member per key.
	 */
	private settingsDocument(input: IUpdateDynamicTenantSettingInput): ITenantSetting {
		return Object.fromEntries(
			(input?.settings ?? []).map(({ name, value }) => [name, value])
		) as unknown as ITenantSetting;
	}
}
