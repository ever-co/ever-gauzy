import { Entity, Column, ManyToOne, RelationId, JoinColumn } from 'typeorm';
import {
	IKeyResultTemplate,
	KeyResultTypeEnum,
	KeyResultDeadlineEnum
} from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { GoalTemplate } from '../goal-template/goal-template.entity';
import { GoalKPITemplate } from '../goal-kpi-template/goal-kpi-template.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('key_result_template')
export class KeyResultTemplate
	extends TenantOrganizationBase
	implements IKeyResultTemplate {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String, enum: KeyResultTypeEnum })
	@IsEnum(KeyResultTypeEnum)
	@Column()
	type: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	@IsOptional()
	unit?: string;

	@ApiProperty({ type: Number })
	@Column({ nullable: true })
	@IsOptional()
	targetValue?: number;

	@ApiProperty({ type: Number })
	@Column({ nullable: true })
	@IsOptional()
	initialValue: number;

	@ApiProperty({ type: String, enum: KeyResultDeadlineEnum })
	@IsEnum(KeyResultDeadlineEnum)
	@Column()
	deadline: string;

	@ApiProperty({ type: GoalKPITemplate })
	@ManyToOne((type) => GoalKPITemplate, { nullable: true })
	@JoinColumn({ name: 'kpiId' })
	@IsOptional()
	kpi?: GoalKPITemplate;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((keyResult: KeyResultTemplate) => keyResult.kpi)
	@Column({ nullable: true })
	kpiId?: string;

	@ApiProperty({ type: GoalTemplate })
	@ManyToOne(
		(type) => GoalTemplate,
		(goalTemplate) => goalTemplate.keyResults,
		{
			onDelete: 'CASCADE'
		}
	)
	@JoinColumn({ name: 'goalId' })
	goal: GoalTemplate;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((keyResult: KeyResultTemplate) => keyResult.goal)
	@Column({ nullable: true })
	readonly goalId?: string;
}
