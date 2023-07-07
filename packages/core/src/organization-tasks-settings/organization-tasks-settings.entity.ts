import { Entity, Column } from 'typeorm';
import {
	IOrganizationTasksSettings,
	TasksProofOfCompletionTypeEnum,
} from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsString } from 'class-validator';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('organization_tasks_settings')
export class OrganizationTasksSettings
	extends TenantOrganizationBaseEntity
	implements IOrganizationTasksSettings
{
	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksPrivacyEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksMultipleAssigneesEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksManualTimeEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksGroupEstimationEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksEstimationInHoursEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksEstimationInStoryPointsEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksProofOfCompletionEnabled: boolean;
	@ApiProperty({ type: () => String, enum: TasksProofOfCompletionTypeEnum })
	@IsString()
	@Column({ default: TasksProofOfCompletionTypeEnum.PRIVATE })
	tasksProofOfCompletionType: string;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksLinkedEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksCommentsEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksHistoryEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksAcceptanceCriteriaEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksDraftsEnabled: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksNotifyLeftEnabled: boolean;
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 7 })
	tasksNotifyLeftPeriodDays: number;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksAutoCloseEnabled: boolean;
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 7 })
	tasksAutoClosePeriodDays: number;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksAutoArchiveEnabled: boolean;
	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 7 })
	tasksAutoArchivePeriodDays: number;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column({ default: true })
	isTasksAutoStatusEnabled: boolean;
}
