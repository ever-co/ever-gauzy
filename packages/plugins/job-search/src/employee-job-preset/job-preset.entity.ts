import { ApiProperty } from '@nestjs/swagger';
import { DeepPartial, JoinTable } from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
import {
	IEmployeeUpworkJobsSearchCriterion,
	IJobPresetUpworkJobSearchCriterion,
	IJobPreset
} from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity } from '@gauzy/core';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToMany, MultiORMOneToMany } from '@gauzy/core';
import { MikroOrmJobPresetRepository } from './repository/mikro-orm-job-preset.repository';
import { EmployeeUpworkJobsSearchCriterion } from './employee-upwork-jobs-search-criterion.entity';
import { JobPresetUpworkJobSearchCriterion } from './job-preset-upwork-job-search-criterion.entity';

@MultiORMEntity('job_preset', { mikroOrmRepository: () => MikroOrmJobPresetRepository })
export class JobPreset extends TenantOrganizationBaseEntity implements IJobPreset {

	constructor(input?: DeepPartial<JobPreset>) {
		super(input);
	}

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	name?: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * Employee Job Criterions
	 */
	@MultiORMOneToMany(() => EmployeeUpworkJobsSearchCriterion, (it: EmployeeUpworkJobsSearchCriterion) => it.jobPreset, {
		onDelete: 'CASCADE'
	})
	employeeCriterions?: IEmployeeUpworkJobsSearchCriterion[];

	/**
	 * Job Criterions
	 */
	@MultiORMOneToMany(() => JobPresetUpworkJobSearchCriterion, (it: JobPresetUpworkJobSearchCriterion) => it.jobPreset, {
		onDelete: 'CASCADE'
	})
	jobPresetCriterions?: IJobPresetUpworkJobSearchCriterion[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Job Preset Employees
	 */
	@MultiORMManyToMany(() => Employee, (it: Employee) => it.customFields['jobPresets'], {
		cascade: true,
		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true,
		/** Pivot table for many-to-many relationship. */
		pivotTable: 'employee_job_preset',
		/** Column in pivot table referencing 'time_slot' primary key. */
		joinColumn: 'jobPresetId',
		/** Column in pivot table referencing 'time_logs' primary key. */
		inverseJoinColumn: 'employeeId',
	})
	@JoinTable({ name: 'employee_job_preset' })
	employees?: Employee[];
}
