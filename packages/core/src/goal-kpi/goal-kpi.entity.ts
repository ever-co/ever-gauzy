import { Column, Index, RelationId } from 'typeorm';
import { IEmployee, IKPI, KpiMetricEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
	Employee,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmGoalKPIRepository } from './repository/mikro-orm-goal-kpi.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('goal_kpi', { mikroOrmRepository: () => MikroOrmGoalKPIRepository })
export class GoalKPI extends TenantOrganizationBaseEntity implements IKPI {
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

	@ApiProperty({ type: () => Number })
	@Column()
	currentValue: number;

	@ApiProperty({ type: () => Number })
	@Column()
	targetValue: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, { nullable: true })
	lead?: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: GoalKPI) => it.lead)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	leadId?: string;
}
