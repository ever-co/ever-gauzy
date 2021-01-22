import {
	IGoalTemplate,
	GoalLevelEnum,
	GoalTemplateCategoriesEnum,
	IKeyResultTemplate,
	DeepPartial
} from '@gauzy/common';
import { Entity, Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { KeyResultTemplate, TenantOrganizationBaseEntity } from '../internal';

@Entity('goal_template')
export class GoalTemplate
	extends TenantOrganizationBaseEntity
	implements IGoalTemplate {
	constructor(input?: DeepPartial<GoalTemplate>) {
		super(input);
	}

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
