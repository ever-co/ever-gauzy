import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import {
	IGoalKPITemplate as IKPITemplate,
	KpiMetricEnum,
	IEmployee,
	DeepPartial
} from '@gauzy/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Employee, TenantOrganizationBaseEntity } from '../internal';

@Entity('goal_kpi_template')
export class GoalKPITemplate
	extends TenantOrganizationBaseEntity
	implements IKPITemplate {
	constructor(input?: DeepPartial<GoalKPITemplate>) {
		super(input);
	}

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
	@ManyToOne(() => Employee, { nullable: true })
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
