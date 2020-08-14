import { Entity, Column, ManyToOne, RelationId, JoinColumn } from 'typeorm';
import {
	KeyResultTemplate as IKeyResultTemplate,
	KeyResultTypeEnum,
	KeyResultDeadlineEnum
} from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { TenantBase } from '../core/entities/tenant-base';
import { GoalTemplate } from '../goal-template/goal-template.entity';

@Entity('key_result_template')
export class KeyResultTemplate extends TenantBase
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
