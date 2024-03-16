import {
	IGoalTemplate,
	GoalLevelEnum,
	GoalTemplateCategoriesEnum,
	IKeyResultTemplate
} from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import {
	KeyResultTemplate,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmGoalTemplateRepository } from './repository/mikro-orm-goal-template.repository';

@MultiORMEntity('goal_template', { mikroOrmRepository: () => MikroOrmGoalTemplateRepository })
export class GoalTemplate extends TenantOrganizationBaseEntity implements IGoalTemplate {

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String, enum: GoalLevelEnum })
	@IsEnum(GoalLevelEnum)
	@MultiORMColumn()
	level: string;

	@ApiProperty({ type: () => String, enum: GoalTemplateCategoriesEnum })
	@IsEnum(GoalTemplateCategoriesEnum)
	@MultiORMColumn()
	category: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	@MultiORMOneToMany(() => KeyResultTemplate, (keyResult) => keyResult.goal)
	keyResults?: IKeyResultTemplate[];
}
