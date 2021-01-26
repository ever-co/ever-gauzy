import {
	IGoalTemplate,
	GoalLevelEnum,
	GoalTemplateCategoriesEnum,
	IKeyResultTemplate
} from '@gauzy/contracts';
import { Entity, Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import {
	KeyResultTemplate,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('goal_template')
export class GoalTemplate
	extends TenantOrganizationBaseEntity
	implements IGoalTemplate {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String, enum: GoalLevelEnum })
	@IsEnum(GoalLevelEnum)
	@Column()
	level: string;

	@ApiProperty({ type: String, enum: GoalTemplateCategoriesEnum })
	@IsEnum(GoalTemplateCategoriesEnum)
	@Column()
	category: string;

	@ApiProperty({ type: KeyResultTemplate })
	@OneToMany(() => KeyResultTemplate, (keyResult) => keyResult.goal)
	@IsOptional()
	keyResults?: IKeyResultTemplate[];
}
