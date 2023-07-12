import { Entity, Column, ManyToOne, Index, RelationId } from 'typeorm';
import {
	IOrganizationProject,
	IOrganizationTaskSetting,
	IOrganizationTeam,
	TaskProofOfCompletionTypeEnum,
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
} from 'class-validator';
import {
	OrganizationProject,
	OrganizationTeam,
	TenantOrganizationBaseEntity,
} from '../core/entities/internal';

@Entity('organization_task_setting')
export class OrganizationTaskSetting extends TenantOrganizationBaseEntity implements IOrganizationTaskSetting {

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

	@ApiProperty({ type: () => String, enum: TaskProofOfCompletionTypeEnum })
	@IsString()
	@Column({ default: TaskProofOfCompletionTypeEnum.PRIVATE })
	tasksProofOfCompletionType: TaskProofOfCompletionTypeEnum;

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

	/**
	 * Organization Project
	 */
	@ManyToOne(() => OrganizationProject, {
		onDelete: 'CASCADE'
	})
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationTaskSetting) => it.project)
	@Index()
	@Column({ nullable: true })
	projectId?: IOrganizationProject['id'];

	/**
	 * Organization Team
	 */
	@ManyToOne(() => OrganizationTeam, {
		onDelete: 'CASCADE'
	})
	organizationTeam?: IOrganizationTeam;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationTaskSetting) => it.organizationTeam)
	@Index()
	@Column({ nullable: true })
	organizationTeamId?: IOrganizationTeam['id'];
}
