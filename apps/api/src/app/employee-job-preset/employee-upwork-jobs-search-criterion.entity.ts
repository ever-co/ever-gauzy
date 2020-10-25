import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { EmployeeUpworkJobsSearchCriterion as IEmployeeUpworkJobsSearchCriterion } from '@gauzy/models';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';
import { JobPreset } from './job-preset.entity';
import { Employee } from '../employee/employee.entity';

@Entity('employee_upwork_job_search_criterion')
export class EmployeeUpworkJobsSearchCriterion
	extends TenantOrganizationBase
	implements IEmployeeUpworkJobsSearchCriterion {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	jobPresetId?: string;

	@ManyToOne(() => JobPreset, (jobPreset) => jobPreset.id)
	jobPreset?: JobPreset;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	employeeId?: string;

	@ManyToOne(() => Employee, (employee) => employee.id)
	employee?: Employee;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	occupationId?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	categoryId?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	keyword?: string;

	@ApiProperty({ type: Boolean })
	@IsString()
	@IsNotEmpty()
	@Column({ default: false })
	hourly?: boolean;

	@ApiProperty({ type: Boolean })
	@IsString()
	@IsNotEmpty()
	@Column({ default: false })
	fixPrice?: boolean;
}
