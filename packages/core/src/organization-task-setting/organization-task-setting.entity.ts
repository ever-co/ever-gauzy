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
	IsEnum,
	IsNumber,
	IsOptional,
	IsUUID,
} from 'class-validator';
import {
	OrganizationProject,
	OrganizationTeam,
	TenantOrganizationBaseEntity,
} from '../core/entities/internal';

@Entity('organization_task_setting')
export class OrganizationTaskSetting extends TenantOrganizationBaseEntity implements IOrganizationTaskSetting {

	/**
	 * Indicates whether tasks privacy features are enabled.
	 * When true, tasks have privacy features such as restricted visibility.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksPrivacyEnabled: boolean;

	/**
	 * Indicates whether tasks allow multiple assignees.
	 * When true, tasks can have more than one assigned person.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksMultipleAssigneesEnabled: boolean;

	/**
	 * Indicates whether manual time tracking is enabled for tasks.
	 * When true, users can manually input time spent on tasks.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksManualTimeEnabled: boolean;

	/**
	 * Indicates whether group estimation is enabled for tasks.
	 * When true, tasks can be estimated collectively by a group.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksGroupEstimationEnabled: boolean;

	/**
	 * Indicates whether task estimation in hours is enabled.
	 * When true, tasks can be estimated in terms of hours.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksEstimationInHoursEnabled: boolean;

	/**
	 * Indicates whether task estimation in story points is enabled.
	 * When true, tasks can be estimated using story points.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksEstimationInStoryPointsEnabled: boolean;

	/**
	 * Indicates whether proof of completion is enabled for tasks.
	 * When true, tasks may require proof of completion.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksProofOfCompletionEnabled: boolean;

	/**
	 * Specifies the type of proof of completion required for tasks.
	 * Enumerated values from `TaskProofOfCompletionTypeEnum`.
	 */
	@ApiPropertyOptional({ type: () => String, enum: TaskProofOfCompletionTypeEnum })
	@IsOptional()
	@IsEnum(TaskProofOfCompletionTypeEnum)
	@Column({ default: TaskProofOfCompletionTypeEnum.PRIVATE })
	tasksProofOfCompletionType: TaskProofOfCompletionTypeEnum;

	/**
	 * Indicates whether the linking of tasks is enabled.
	 * When true, tasks can be linked to one another.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksLinkedEnabled: boolean;

	/**
	 * Indicates whether comments on tasks are enabled.
	 * When true, users can add comments to tasks.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksCommentsEnabled: boolean;

	/**
	 * Indicates whether the tracking of task history is enabled.
	 * When true, changes and updates to tasks are recorded for historical reference.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksHistoryEnabled: boolean;

	/**
	 * Indicates whether the use of acceptance criteria for tasks is enabled.
	 * When true, tasks may include acceptance criteria for completion.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksAcceptanceCriteriaEnabled: boolean;

	/**
	 * Indicates whether the use of drafts for tasks is enabled.
	 * When true, users can save tasks as drafts before finalizing and publishing them.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksDraftsEnabled: boolean;

	/**
	 * Indicates whether notifications about tasks approaching their due date are enabled.
	 * When true, users receive notifications for tasks with approaching due dates.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksNotifyLeftEnabled: boolean;

	/**
	 * Specifies the number of days before the due date when notifications about tasks should be sent.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Column({ default: 7 })
	tasksNotifyLeftPeriodDays: number;

	/**
	 * Indicates whether automatic closure of tasks is enabled.
	 * When true, tasks may automatically close after a specified period.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksAutoCloseEnabled: boolean;

	/**
	 * Specifies the number of days after which tasks should automatically close.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Column({ default: 7 })
	tasksAutoClosePeriodDays: number;

	/**
	 * Indicates whether automatic archiving of tasks is enabled.
	 * When true, tasks may automatically be archived after a specified period.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksAutoArchiveEnabled: boolean;

	/**
	 * Specifies the number of days after which tasks should automatically be archived.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Column({ default: 7 })
	tasksAutoArchivePeriodDays: number;

	/**
	 * Indicates whether automatic status updates are enabled for tasks.
	 * When true, tasks may automatically update their status based on certain criteria.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@Column({ default: true })
	isTasksAutoStatusEnabled: boolean;

	/**
	 * Organization Project
	 */
	@ManyToOne(() => OrganizationProject, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
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
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
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
