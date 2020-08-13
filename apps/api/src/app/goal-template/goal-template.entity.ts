import { GoalTemplate as IGoalTemplate, GoalLevelEnum } from '@gauzy/models';
import { Entity, Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { TenantBase } from '../core/entities/tenant-base';
import { KeyResultTemplate } from '../keyresult-template/keyresult-template.entity';

@Entity('goal_template')
export class GoalTemplate extends TenantBase implements IGoalTemplate {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String, enum: GoalLevelEnum })
	@IsEnum(GoalLevelEnum)
	@Column()
	level: string;

	@ApiProperty({ type: KeyResultTemplate })
	@OneToMany((type) => KeyResultTemplate, (keyResult) => keyResult.goal)
	@IsOptional()
	keyResults?: KeyResultTemplate[];
}
