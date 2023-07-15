import { Entity, Column, ManyToOne, Index, RelationId } from 'typeorm';
import {
	IOrganizationProject,
	IOrganizationTaskSetting,
	IOrganizationTeam,
	TaskProofOfCompletionTypeEnum,
} from '@gauzy/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
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

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksPrivacyEnabled: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksMultipleAssigneesEnabled: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksManualTimeEnabled: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksGroupEstimationEnabled: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksEstimationInHoursEnabled: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksEstimationInStoryPointsEnabled: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksProofOfCompletionEnabled: boolean;

	@ApiPropertyOptional({ type: () => String, enum: TaskProofOfCompletionTypeEnum })
	@IsOptional()
	@IsString()
	@Column({ default: TaskProofOfCompletionTypeEnum.PRIVATE })
	tasksProofOfCompletionType: TaskProofOfCompletionTypeEnum;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksLinkedEnabled: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksCommentsEnabled: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksHistoryEnabled: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksAcceptanceCriteriaEnabled: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksDraftsEnabled: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksNotifyLeftEnabled: boolean;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Column({ default: 7 })
	tasksNotifyLeftPeriodDays: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksAutoCloseEnabled: boolean;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Column({ default: 7 })
	tasksAutoClosePeriodDays: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksAutoArchiveEnabled: boolean;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Column({ default: 7 })
	tasksAutoArchivePeriodDays: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
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
