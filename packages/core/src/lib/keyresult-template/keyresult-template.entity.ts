import { RelationId, JoinColumn } from 'typeorm';
import {
	IKeyResultTemplate,
	KeyResultTypeEnum,
	KeyResultDeadlineEnum,
	IGoalTemplate,
	IGoalKPITemplate
} from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import {
	GoalKPITemplate,
	GoalTemplate,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmKeyResultTemplateRepository } from './repository/mikro-orm-keyresult-template.repository';

@MultiORMEntity('key_result_template', { mikroOrmRepository: () => MikroOrmKeyResultTemplateRepository })
export class KeyResultTemplate extends TenantOrganizationBaseEntity implements IKeyResultTemplate {

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String, enum: KeyResultTypeEnum })
	@IsEnum(KeyResultTypeEnum)
	@MultiORMColumn()
	type: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	@IsOptional()
	unit?: string;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ nullable: true })
	@IsOptional()
	targetValue?: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn({ nullable: true })
	@IsOptional()
	initialValue: number;

	@ApiProperty({ type: () => String, enum: KeyResultDeadlineEnum })
	@IsEnum(KeyResultDeadlineEnum)
	@MultiORMColumn()
	deadline: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => GoalKPITemplate })
	@MultiORMManyToOne(() => GoalKPITemplate, { nullable: true })
	@JoinColumn({ name: 'kpiId' })
	@IsOptional()
	kpi?: IGoalKPITemplate;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: KeyResultTemplate) => it.kpi)
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true, relationId: true })
	kpiId?: string;


	@ApiProperty({ type: () => GoalTemplate })
	@MultiORMManyToOne(() => GoalTemplate, (goalTemplate) => goalTemplate.keyResults, {
		onDelete: 'CASCADE'
	})
	@JoinColumn({ name: 'goalId' })
	goal: IGoalTemplate;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: KeyResultTemplate) => it.goal)
	@IsString()
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	readonly goalId?: string;
}
