import { RelationId } from 'typeorm';
import { IEmployee, IKPI, KpiMetricEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
	Employee,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmGoalKPIRepository } from './repository/mikro-orm-goal-kpi.repository';

@MultiORMEntity('goal_kpi', { mikroOrmRepository: () => MikroOrmGoalKPIRepository })
export class GoalKPI extends TenantOrganizationBaseEntity implements IKPI {
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

	@ApiProperty({ type: () => Number })
	@MultiORMColumn()
	currentValue: number;

	@ApiProperty({ type: () => Number })
	@MultiORMColumn()
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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	leadId?: string;
}
