import {
	IGoalTemplate,
	GoalLevelEnum,
	GoalTemplateCategoriesEnum,
	IKeyResultTemplate
} from '@gauzy/contracts';
import { Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import {
	KeyResultTemplate,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmGoalTemplateRepository } from './repository/mikro-orm-goal-template.repository';

@MultiORMEntity('goal_template', { mikroOrmRepository: () => MikroOrmGoalTemplateRepository })
export class GoalTemplate extends TenantOrganizationBaseEntity implements IGoalTemplate {

	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiProperty({ type: () => String, enum: GoalLevelEnum })
	@IsEnum(GoalLevelEnum)
	@Column()
	level: string;

	@ApiProperty({ type: () => String, enum: GoalTemplateCategoriesEnum })
	@IsEnum(GoalTemplateCategoriesEnum)
	@Column()
	category: string;

	@ApiProperty({ type: () => KeyResultTemplate })
	@OneToMany(() => KeyResultTemplate, (keyResult) => keyResult.goal)
	keyResults?: IKeyResultTemplate[];
}
