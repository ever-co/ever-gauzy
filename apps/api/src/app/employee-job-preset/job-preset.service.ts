import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { JobPreset } from './job-preset.entity';
import {
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
import { RequestContext } from '../core/context';

@Injectable()
export class JobPresetService extends CrudService<JobPreset> {
	constructor(
		private readonly commandBus: CommandBus,
		@InjectRepository(JobPreset)
		private readonly JobPresetRepository: Repository<JobPreset>,
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
		super(JobPresetRepository);
	}

	public async getAll(request?: GetJobPresetInput) {
		const data = await this.JobPresetRepository.find({
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
		const data = await this.JobPresetRepository.findOne(id, {
			join: {
				alias: 'job_preset',
				leftJoin: {
					employees: 'job_preset.employees'
				}
			},
			relations: [
				'jobPresetCriterion',
				...(request.employeeId ? ['employeeCriterion'] : [])
			],
			where: (qb: SelectQueryBuilder<JobPreset>) => {
				qb.where('true = true');

				if (request.employeeId) {
					qb.andWhere('"employees"."id" = :employeeId', {
						employeeId: request.employeeId
					});
				}
			}
		});

		return data;
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
		if (!request.organizationId) {
			const user = RequestContext.currentUser();
			const employee = await this.employeeRepository.findOne(
				user.employeeId
			);
			request.organizationId = employee.organizationId;
		}
		request.tenantId = RequestContext.currentTenantId();

		if (request.employeeId) {
			const creation = new EmployeeUpworkJobsSearchCriterion(request);
			await this.employeeUpworkJobsSearchCriterionRepository.save(
				creation
			);
			return creation;
		} else {
			const creation = new JobPresetUpworkJobSearchCriterion(request);
			console.log(creation);
			await this.jobPresetUpworkJobSearchCriterionRepository.save(
				creation
			);
			return creation;
		}
	}

	deleteCriterion(creationId: string, request: any) {
		if (request.employeeId) {
			this.employeeUpworkJobsSearchCriterionRepository.delete(creationId);
		} else {
			this.jobPresetUpworkJobSearchCriterionRepository.delete(creationId);
		}
	}
}
