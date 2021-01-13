import {
	IGoalTemplate,
	GoalLevelEnum,
	GoalTemplateCategoriesEnum,
	IKeyResultTemplate
} from '@gauzy/common';
import { Entity, Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { KeyResultTemplate } from '../keyresult-template/keyresult-template.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('goal_template')
export class GoalTemplate
	extends TenantOrganizationBase
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
	@OneToMany((type) => KeyResultTemplate, (keyResult) => keyResult.goal)
	@IsOptional()
	keyResults?: IKeyResultTemplate[];
}
