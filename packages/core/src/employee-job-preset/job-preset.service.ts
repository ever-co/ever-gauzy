import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { JobPreset } from './job-preset.entity';
import {
	IEmployeePresetInput,
	IGetJobPresetCriterionInput,
	IGetJobPresetInput,
	IGetMatchingCriterions,
	IJobPreset,
	IMatchingCriterions
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { JobPresetUpworkJobSearchCriterion } from './job-preset-upwork-job-search-criterion.entity';
import { EmployeeUpworkJobsSearchCriterion } from './employee-upwork-jobs-search-criterion.entity';
import { CommandBus } from '@nestjs/cqrs';
import { Employee } from '../employee/employee.entity';
import {
	CreateJobPresetCommand,
	SaveEmployeeCriterionCommand,
	SaveEmployeePresetCommand,
	SavePresetCriterionCommand
} from './commands';

@Injectable()
export class JobPresetService extends TenantAwareCrudService<JobPreset> {
	constructor(
		private readonly commandBus: CommandBus,

		@InjectRepository(JobPreset)
		private readonly jobPresetRepository: Repository<JobPreset>,

		@InjectRepository(JobPresetUpworkJobSearchCriterion)
		private readonly jobPresetUpworkJobSearchCriterionRepository: Repository<JobPresetUpworkJobSearchCriterion>,

		@InjectRepository(EmployeeUpworkJobsSearchCriterion)
		private readonly employeeUpworkJobsSearchCriterionRepository: Repository<EmployeeUpworkJobsSearchCriterion>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {
		super(jobPresetRepository);
	}

	public async getAll(request?: IGetJobPresetInput) {
		const data = await this.jobPresetRepository.find({
			join: {
				alias: 'job_preset',
				leftJoin: {
					employees: 'job_preset.employees'
				}
			},
			relations: ['jobPresetCriterions'],
			order: {
				name: 'ASC'
			},
			where: (qb: SelectQueryBuilder<IJobPreset>) => {
				const tenantId = RequestContext.currentTenantId();
				qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId });
				if (request.search) {
					qb.andWhere('name LIKE :search', {
						search: request.search
					});
				}
				if (request.organizationId) {
					qb.andWhere(
						`"${qb.alias}"."organizationId" = :organizationId`,
						{
							organizationId: request.organizationId
						}
					);
				}
				if (request.employeeId) {
					qb.andWhere(`"employees"."id" = :employeeId`, {
						employeeId: request.employeeId
					});
				}
			}
		});
		return data;
	}

	public async get(id: string, request?: IGetJobPresetCriterionInput) {
		const query = this.jobPresetRepository.createQueryBuilder();
		query.leftJoinAndSelect(
			`${query.alias}.jobPresetCriterions`,
			'jobPresetCriterions'
		);
		if (request.employeeId) {
			query.leftJoinAndSelect(
				`${query.alias}.employeeCriterions`,
				'employeeCriterions',
				'employeeCriterions.employeeId = :employeeId',
				{ employeeId: request.employeeId }
			);
		}
		query.andWhere(`${query.alias}.id = :id`, { id });

		return query.getOne();
	}

	public getJobPresetCriterion(presetId: string) {
		return this.jobPresetUpworkJobSearchCriterionRepository.find({
			where: {
				jobPresetId: presetId
			}
		});
	}

	public getEmployeeCriterion(input: IGetMatchingCriterions) {
		return this.employeeUpworkJobsSearchCriterionRepository.find({
			where: {
				...(input.jobPresetId ? { jobPresetId: input.jobPresetId } : {}),
				employeeId: input.employeeId
			}
		});
	}

	public async createJobPreset(request?: IJobPreset) {
		return this.commandBus.execute(new CreateJobPresetCommand(request));
	}

	async saveJobPresetCriterion(request: IMatchingCriterions) {
		return this.commandBus.execute(new SavePresetCriterionCommand(request));
	}

	async saveEmployeeCriterion(request: IMatchingCriterions) {
		return this.commandBus.execute(
			new SaveEmployeeCriterionCommand(request)
		);
	}

	async getEmployeePreset(employeeId: string) {
		const [employee] = await this.employeeRepository.find({
			where: {
				id: employeeId
			},
			relations: {
				jobPresets: true
			}
		});
		return employee.jobPresets;
	}

	async saveEmployeePreset(request: IEmployeePresetInput) {
		return this.commandBus.execute(new SaveEmployeePresetCommand(request));
	}

	deleteEmployeeCriterion(creationId: string, employeeId: string) {
		return this.employeeUpworkJobsSearchCriterionRepository.delete({
			id: creationId,
			employeeId: employeeId
		});
	}

	deleteJobPresetCriterion(creationId: string) {
		return this.jobPresetUpworkJobSearchCriterionRepository.delete(
			creationId
		);
	}
}
