import {
	JoinTable
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import {
	IEmployeeUpworkJobsSearchCriterion,
	IJobPresetUpworkJobSearchCriterion,
	IJobPreset
} from '@gauzy/contracts';
import {
	Employee,
	EmployeeUpworkJobsSearchCriterion,
	JobPresetUpworkJobSearchCriterion,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToMany, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmJobPresetRepository } from './repository/mikro-orm-job-preset.repository';

@MultiORMEntity('job_preset', { mikroOrmRepository: () => MikroOrmJobPresetRepository })
export class JobPreset extends TenantOrganizationBaseEntity implements IJobPreset {

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
	@MultiORMOneToMany(() => EmployeeUpworkJobsSearchCriterion, (it) => it.jobPreset, {
		onDelete: 'CASCADE'
	})
	employeeCriterions?: IEmployeeUpworkJobsSearchCriterion[];

	/**
	 * Job Criterions
	 */
	@MultiORMOneToMany(() => JobPresetUpworkJobSearchCriterion, (it) => it.jobPreset, {
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
	@MultiORMManyToMany(() => Employee, (it) => it.jobPresets, {
		cascade: true,
		owner: true,
		pivotTable: 'employee_job_preset',
		joinColumn: 'jobPresetId',
		inverseJoinColumn: 'employeeId',
	})
	@JoinTable({
		name: 'employee_job_preset'
	})
	employees?: Employee[];
}
