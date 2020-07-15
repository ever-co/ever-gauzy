import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { KPI as IKPI, KpiMetricEnum } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Organization } from '../organization/organization.entity';
import { TenantBase } from '../core/entities/tenant-base';
import { Employee } from '../employee/employee.entity';

@Entity('goal_kpi')
export class GoalKPI extends TenantBase implements IKPI {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column()
	description: string;

	@ApiProperty({ type: String, enum: KpiMetricEnum })
	@Column()
	@IsEnum(KpiMetricEnum)
	metric: string;

	@ApiProperty({ type: String })
	@Column()
	operator: string;

	@ApiProperty({ type: Employee })
	@ManyToOne((type) => Employee, { nullable: true })
	@JoinColumn()
	@IsOptional()
	lead: Employee;

	@ApiProperty({ type: Number })
	@Column()
	currentValue: number;

	@ApiProperty({ type: Number })
	@Column()
	targetValue: number;

	@ManyToOne((type) => Organization, (organization) => organization.id)
	organization: Organization;
}
