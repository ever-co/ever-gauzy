import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { JobPreset } from './job-preset.entity';
import { GetJobPresetInput } from '@gauzy/models';
import { CrudService } from '../core/crud/crud.service';
import { JobPresetUpworkJobSearchCriterion } from './job-preset-upwork-job-search-criterion.entity';
import { EmployeeUpworkJobsSearchCriterion } from './employee-upwork-jobs-search-criterion.entity';
import { CommandBus } from '@nestjs/cqrs';
import { CreateJobPresetCommand } from './commands/create-job-preset.command';

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
		>
	) {
		super(JobPresetRepository);
	}

	public async getAll(request?: GetJobPresetInput) {
		return await this.JobPresetRepository.find({
			join: {
				alias: 'job_preset',
				innerJoin: {
					employee: 'job_preset.employees'
				}
			},
			relations: ['jobPresetCriterion'],
			order: {
				name: 'ASC'
			},
			where: (qb: SelectQueryBuilder<JobPreset>) => {
				qb.where({
					deletedAt: null
				});
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
					qb.andWhere('"employees"."employeeId" = :employeeId', {
						employeeId: request.employeeId
					});
				}
			}
		});
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
}
