import { Column, JoinColumn } from 'typeorm';
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
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmGoalKPITemplateRepository } from './repository/mikro-orm-goal-kpi-template.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('goal_kpi_template', { mikroOrmRepository: () => MikroOrmGoalKPITemplateRepository })
export class GoalKPITemplate extends TenantOrganizationBaseEntity implements IGoalKPITemplate {
	@ApiProperty({ type: () => String })
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	description: string;

	@ApiProperty({ type: () => String, enum: KpiMetricEnum })
	@Column()
	@IsEnum(KpiMetricEnum)
	type: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	@IsOptional()
	unit?: string;

	@ApiProperty({ type: () => String })
	@Column()
	operator: string;

	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, { nullable: true })
	@JoinColumn()
	@IsOptional()
	lead?: IEmployee;

	@ApiProperty({ type: () => Number })
	@Column()
	@IsOptional()
	currentValue?: number;

	@ApiProperty({ type: () => Number })
	@Column()
	@IsOptional()
	targetValue?: number;
}
