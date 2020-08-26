import {
	GoalTemplate as IGoalTemplate,
	GoalLevelEnum,
	GoalTemplateCategoriesEnum
} from '@gauzy/models';
import { Entity, Column, OneToMany, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
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

	@ApiProperty({ type: String, enum: GoalTemplateCategoriesEnum })
	@IsEnum(GoalTemplateCategoriesEnum)
	@Column()
	category: string;

	@ApiProperty({ type: KeyResultTemplate })
	@OneToMany((type) => KeyResultTemplate, (keyResult) => keyResult.goal)
	@IsOptional()
	keyResults?: KeyResultTemplate[];

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((template: GoalTemplate) => template.organization)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}
