import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import {
	IGoalKPITemplate as IKPITemplate,
	KpiMetricEnum,
	IEmployee
} from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Employee } from '../employee/employee.entity';
import { TenantOrganizationBase } from '../tenant-organization-base';

@Entity('goal_kpi_template')
export class GoalKPITemplate
	extends TenantOrganizationBase
	implements IKPITemplate {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column()
	description: string;

	@ApiProperty({ type: String, enum: KpiMetricEnum })
	@Column()
	@IsEnum(KpiMetricEnum)
	type: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	@IsOptional()
	unit?: string;

	@ApiProperty({ type: String })
	@Column()
	operator: string;

	@ApiProperty({ type: Employee })
	@ManyToOne((type) => Employee, { nullable: true })
	@JoinColumn()
	@IsOptional()
	lead: IEmployee;

	@ApiProperty({ type: Number })
	@Column()
	@IsOptional()
	currentValue?: number;

	@ApiProperty({ type: Number })
	@Column()
	@IsOptional()
	targetValue?: number;
}
