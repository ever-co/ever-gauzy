import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { JobPreset } from './job-preset.entity';
import {
	EmployeePresetInput,
	GetJobPresetCriterionInput,
	GetJobPresetInput,
	MatchingCriterions
} from '@gauzy/models';
import { CrudService } from '../core/crud/crud.service';
import { JobPresetUpworkJobSearchCriterion } from './job-preset-upwork-job-search-criterion.entity';
import { EmployeeUpworkJobsSearchCriterion } from './employee-upwork-jobs-search-criterion.entity';
import { CommandBus } from '@nestjs/cqrs';
import { CreateJobPresetCommand } from './commands/create-job-preset.command';
import { Employee } from '../employee/employee.entity';
import { SavePresetCriterionCommand } from './commands/save-preset-criterion.command';
import { SaveEmployeePresetCommand } from './commands/save-employee-preset.command';

@Injectable()
export class JobPresetService extends CrudService<JobPreset> {
	constructor(
		private readonly commandBus: CommandBus,
		@InjectRepository(JobPreset)
		private readonly jobPresetRepository: Repository<JobPreset>,
		@InjectRepository(JobPresetUpworkJobSearchCriterion)
		private readonly jobPresetUpworkJobSearchCriterionRepository: Repository<
			JobPresetUpworkJobSearchCriterion
		>,
		@InjectRepository(EmployeeUpworkJobsSearchCriterion)
		private readonly employeeUpworkJobsSearchCriterionRepository: Repository<
			EmployeeUpworkJobsSearchCriterion
		>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {
		super(jobPresetRepository);
	}

	public async getAll(request?: GetJobPresetInput) {
		const data = await this.jobPresetRepository.find({
			join: {
				alias: 'job_preset',
				leftJoin: {
					employees: 'job_preset.employees'
				}
			},
			relations: ['jobPresetCriterion'],
			order: {
				name: 'ASC'
			},
			where: (qb: SelectQueryBuilder<JobPreset>) => {
				if (request.search) {
					qb.andWhere('name LIKE :search', {
						search: request.search
					});
				}
				if (request.organizationId) {
					qb.andWhere('"organizationId" = :organizationId', {
						organizationId: request.organizationId
					});
				}
				if (request.employeeId) {
					qb.andWhere('"employees"."id" = :employeeId', {
						employeeId: request.employeeId
					});
				}
			}
		});
		return data;
	}

	public async get(id: string, request?: GetJobPresetCriterionInput) {
		const query = this.jobPresetRepository.createQueryBuilder();
		query.leftJoinAndSelect(
			`${query.alias}.jobPresetCriterion`,
			'jobPresetCriterion'
		);
		if (request.employeeId) {
			query.leftJoinAndSelect(
				`${query.alias}.employeeCriterion`,
				'employeeCriterion',
				'employeeCriterion.employeeId = :employeeId',
				{ employeeId: request.employeeId }
			);
		}
		query.andWhere(`${query.alias}.id = :id`, { id });

		return query.getOne();
	}

	public getJobPresetCriterion(presetId: string) {
		return this.jobPresetUpworkJobSearchCriterionRepository.find({
			where: {
				presetId: presetId
			}
		});
	}

	public getJobPresetEmployeeCriterion(presetId: string, employeeId: string) {
		return this.employeeUpworkJobsSearchCriterionRepository.find({
			where: {
				presetId: presetId,
				employeeId: employeeId
			}
		});
	}

	public async createJobPreset(request?: JobPreset) {
		return this.commandBus.execute(new CreateJobPresetCommand(request));
	}

	async saveCriterion(request: MatchingCriterions) {
		return this.commandBus.execute(new SavePresetCriterionCommand(request));
	}

	async getEmployeePreset(employeeId: string) {
		const employee = await this.employeeRepository.findOne(employeeId, {
			relations: ['jobPresets']
		});
		return employee.jobPresets;
	}

	async saveEmployeePreset(request: EmployeePresetInput) {
		return this.commandBus.execute(new SaveEmployeePresetCommand(request));
	}

	deleteCriterion(creationId: string, request: any) {
		if (request.employeeId) {
			this.employeeUpworkJobsSearchCriterionRepository.delete(creationId);
		} else {
			this.jobPresetUpworkJobSearchCriterionRepository.delete(creationId);
		}
	}
}
