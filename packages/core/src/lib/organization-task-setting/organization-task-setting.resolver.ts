import { UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	ID as Id,
	IOrganizationTaskSetting,
	IOrganizationTaskSettingCreateInput,
	IOrganizationTaskSettingFindInput,
	IOrganizationTaskSettingUpdateInput,
	PermissionsEnum
} from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import {
	OrganizationTaskSettingCreateCommand,
	OrganizationTaskSettingUpdateCommand
} from './commands';
import { OrganizationTaskSetting } from './organization-task-setting.entity';
import { OrganizationTaskSettingService } from './organization-task-setting.service';

/**
 * The settings a caller states when it files a task-setting row, as
 * `CreateOrganizationTaskSettingInput` declares them.
 *
 * Every setting is optional because every column behind it carries a default; the organization is
 * required, which is the shape the delivered read and the delivered write both address the row by.
 */
export interface ICreateOrganizationTaskSettingInput {
	organizationId: Id;
	isTasksPrivacyEnabled?: boolean;
	isTasksMultipleAssigneesEnabled?: boolean;
	isTasksManualTimeEnabled?: boolean;
	isTasksGroupEstimationEnabled?: boolean;
	isTasksEstimationInHoursEnabled?: boolean;
	isTasksEstimationInStoryPointsEnabled?: boolean;
	isTasksProofOfCompletionEnabled?: boolean;
	tasksProofOfCompletionType?: string;
	isTasksLinkedEnabled?: boolean;
	isTasksCommentsEnabled?: boolean;
	isTasksHistoryEnabled?: boolean;
	isTasksAcceptanceCriteriaEnabled?: boolean;
	isTasksDraftsEnabled?: boolean;
	isTasksNotifyLeftEnabled?: boolean;
	tasksNotifyLeftPeriodDays?: number;
	isTasksAutoCloseEnabled?: boolean;
	tasksAutoClosePeriodDays?: number;
	isTasksAutoArchiveEnabled?: boolean;
	tasksAutoArchivePeriodDays?: number;
	isTasksAutoStatusEnabled?: boolean;
	projectId?: Id;
	organizationTeamId?: Id;
}

/** The members `UpdateOrganizationTaskSettingInput` declares in the schema. */
export interface IUpdateOrganizationTaskSettingInput extends ICreateOrganizationTaskSettingInput {
	id: Id;
}

/**
 * The task setting over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: the read calls the same `OrganizationTaskSettingService.findByOrganization` the delivered
 * read route calls, and the two writes dispatch the same commands the delivered create and edit routes
 * dispatch.
 *
 * **There is no connection and no count, because the resource has neither.** The delivered controller
 * does not extend the CRUD base: it serves three routes and no list, so a connection here would be a
 * capability the REST surface does not have — and the two-protocol rule forbids that as firmly as it
 * forbids the reverse.
 *
 * **The permissions are the controller's, and they are pairs.** Each of the three routes states two
 * permissions rather than one — the organization permission that governs organization settings and the
 * task-setting permission that governs this resource — and the permission guard authorizes a caller
 * that holds any of them. This resolver states the same two on the same three fields, in the same
 * order, so the two protocols admit the same callers. The class carries the controller's own class-level
 * permission so that a field which one day forgets to state its own is held to the controller's rather
 * than to nothing.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('OrganizationTaskSetting')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
export class OrganizationTaskSettingResolver {
	constructor(
		private readonly organizationTaskSettingService: OrganizationTaskSettingService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The task settings the delivered read resolves for one organization.
	 *
	 * The same call the delivered read route makes, with the same criterion: the organization is the
	 * path the caller names, the tenant comes from the credential, and the read answers the organization's
	 * own row. A caller with no row filed yet is answered `null` rather than a refusal, which is what a
	 * field that may have no value means over this protocol.
	 */
	@Query('organizationTaskSetting')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_SETTING)
	async organizationTaskSetting(
		@Args('organizationId', { type: () => ID }) organizationId: Id
	): Promise<OrganizationTaskSetting | null> {
		const row: IOrganizationTaskSetting = await this.organizationTaskSettingService.findByOrganization({
			organizationId
		} as IOrganizationTaskSettingFindInput);

		return (row as OrganizationTaskSetting) ?? null;
	}

	/**
	 * Files the task settings for an organization through the command the delivered route dispatches.
	 *
	 * The tenant is stamped from the credential rather than stated by the caller, and every setting the
	 * caller leaves out is written as the column's own default.
	 */
	@Mutation('createOrganizationTaskSetting')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_SETTING)
	async createOrganizationTaskSetting(
		@Args('input') input: ICreateOrganizationTaskSettingInput
	): Promise<OrganizationTaskSetting> {
		return await this.commandBus.execute(
			new OrganizationTaskSettingCreateCommand(
				input as unknown as Partial<IOrganizationTaskSettingCreateInput>
			)
		);
	}

	/**
	 * Changes the settings of one row through the command the delivered route dispatches.
	 *
	 * The identifier is the criterion and is not repeated in the payload: the delivered route carries it
	 * in the path and the body states the settings. The handler reads the row before it writes and
	 * answers it afterwards, so a row that is not the caller's is a miss rather than a write under an
	 * identifier the caller does not own.
	 */
	@Mutation('updateOrganizationTaskSetting')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TASK_SETTING)
	async updateOrganizationTaskSetting(
		@Args('input') input: IUpdateOrganizationTaskSettingInput
	): Promise<OrganizationTaskSetting> {
		const { id, ...values } = input;

		return await this.commandBus.execute(
			new OrganizationTaskSettingUpdateCommand(id, values as unknown as IOrganizationTaskSettingUpdateInput)
		);
	}
}
