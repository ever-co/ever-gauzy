import { Entity, Column, ManyToOne, Index, RelationId } from 'typeorm';
import { IEmployee, IKPI, KpiMetricEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
	Employee,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('goal_kpi')
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
	@ManyToOne(() => Employee, { nullable: true })
	lead?: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: GoalKPI) => it.lead)
	@IsString()
	@IsOptional()
	@Index()
	@Column({ nullable: true })
	leadId?: string;
}
