import { JoinColumn } from 'typeorm';
import {
	IGoalKPITemplate,
	KpiMetricEnum,
	IEmployee
} from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
	Employee,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmGoalKPITemplateRepository } from './repository/mikro-orm-goal-kpi-template.repository';

@MultiORMEntity('goal_kpi_template', { mikroOrmRepository: () => MikroOrmGoalKPITemplateRepository })
export class GoalKPITemplate extends TenantOrganizationBaseEntity implements IGoalKPITemplate {
	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	description: string;

	@ApiProperty({ type: () => String, enum: KpiMetricEnum })
	@MultiORMColumn()
	@IsEnum(KpiMetricEnum)
	type: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	@IsOptional()
	unit?: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn()
	operator: string;

	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, { nullable: true })
	@JoinColumn()
	@IsOptional()
	lead?: IEmployee;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn()
	@IsOptional()
	currentValue?: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn()
	@IsOptional()
	targetValue?: number;
}
