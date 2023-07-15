import {
	IOrganizationTaskSetting,
	TaskProofOfCompletionTypeEnum,
} from '@gauzy/contracts';
import {
	ApiProperty,
	IntersectionType,
	PartialType,
	PickType,
} from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, Min } from 'class-validator';
import { TenantOrganizationBaseDTO } from 'core/dto';
import { OrganizationTaskSetting } from 'organization-task-setting/organization-task-setting.entity';

export class OrganizationTaskSettingDTO
	extends IntersectionType(
		PartialType(TenantOrganizationBaseDTO),
		PickType(OrganizationTaskSetting, [
			'organizationTeamId',
			'organizationTeam',
			'projectId',
			'project',
		])
	)
	implements IOrganizationTaskSetting
{
	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksPrivacyEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksMultipleAssigneesEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksManualTimeEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksGroupEstimationEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksEstimationInHoursEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksEstimationInStoryPointsEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksProofOfCompletionEnabled: boolean;

	@ApiProperty({ type: () => String, enum: TaskProofOfCompletionTypeEnum })
	@IsEnum(TaskProofOfCompletionTypeEnum)
	readonly tasksProofOfCompletionType: TaskProofOfCompletionTypeEnum;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksLinkedEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksCommentsEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksHistoryEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksAcceptanceCriteriaEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksDraftsEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksNotifyLeftEnabled: boolean;

	@ApiProperty({ type: () => Number, minimum: 1 })
	@IsNumber()
	@Min(1)
	readonly tasksNotifyLeftPeriodDays: number;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksAutoCloseEnabled: boolean;

	@ApiProperty({ type: () => Number, minimum: 1 })
	@IsNumber()
	@Min(1)
	readonly tasksAutoClosePeriodDays: number;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksAutoArchiveEnabled: boolean;

	@ApiProperty({ type: () => Number, minimum: 1 })
	@IsNumber()
	@Min(1)
	readonly tasksAutoArchivePeriodDays: number;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	readonly isTasksAutoStatusEnabled: boolean;
}
