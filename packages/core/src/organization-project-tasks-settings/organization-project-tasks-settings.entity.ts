import { Entity, Column, JoinColumn, OneToOne } from 'typeorm';
import {
	IOrganizationProject,
	IOrganizationProjectTasksSettings,
	TasksProofOfCompletionTypeEnum
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { OrganizationProject, TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('organization_project_tasks_settings')
export class OrganizationProjectTasksSettings
	extends TenantOrganizationBaseEntity
	implements IOrganizationProjectTasksSettings
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
	tasksProofOfCompletionType: TasksProofOfCompletionTypeEnum;

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

	/*
	|--------------------------------------------------------------------------
	| @OneToOne
	|--------------------------------------------------------------------------
	*/

	@ApiPropertyOptional({ type: () => OrganizationProject })
	@OneToOne(() => OrganizationProject, {
		nullable: true,
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true
	})
	@JoinColumn()
	project?: OrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@Column({ nullable: true })
	projectId?: IOrganizationProject['id'];
}
