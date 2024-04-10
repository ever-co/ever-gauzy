import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { SelectQueryBuilder } from 'typeorm';
import { isNotEmpty } from 'class-validator';
import {
	IEmployeePresetInput,
	IGetJobPresetCriterionInput,
	IGetJobPresetInput,
	IGetMatchingCriterions,
	IJobPreset,
	IMatchingCriterions
} from '@gauzy/contracts';
import { isPostgres } from '@gauzy/config';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { JobPreset } from './job-preset.entity';
import {
	CreateJobPresetCommand,
	SaveEmployeeCriterionCommand,
	SaveEmployeePresetCommand,
	SavePresetCriterionCommand
} from './commands';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmJobPresetRepository } from './repository/type-orm-job-preset.repository';
import { MikroOrmJobPresetRepository } from './repository/mikro-orm-job-preset.repository';
import { TypeOrmJobPresetUpworkJobSearchCriterionRepository } from './repository/type-orm-job-preset-upwork-job-search-criterion.repository';
import { TypeOrmEmployeeUpworkJobsSearchCriterionRepository } from './repository/typeorm-orm-employee-upwork-jobs-search-criterion.entity.repository';
import { TypeOrmEmployeeRepository } from './../employee/repository/type-orm-employee.repository';

@Injectable()
export class JobPresetService extends TenantAwareCrudService<JobPreset> {
	constructor(
		private readonly typeOrmJobPresetRepository: TypeOrmJobPresetRepository,
		private readonly mikroOrmJobPresetRepository: MikroOrmJobPresetRepository,
		private readonly typeOrmJobPresetUpworkJobSearchCriterionRepository: TypeOrmJobPresetUpworkJobSearchCriterionRepository,
		private readonly typeOrmEmployeeUpworkJobsSearchCriterionRepository: TypeOrmEmployeeUpworkJobsSearchCriterionRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly commandBus: CommandBus,
	) {
		super(typeOrmJobPresetRepository, mikroOrmJobPresetRepository);
	}

	/**
	 *
	 * @param request
	 * @returns
	 */
	public async getAll(request?: IGetJobPresetInput) {
		const tenantId = RequestContext.currentTenantId() || request.tenantId;
		const { organizationId, search, employeeId } = request;
		const likeOperator = isPostgres() ? 'ILIKE' : 'LIKE';

		const query = this.typeOrmRepository.createQueryBuilder('job_preset');
		query.setFindOptions({
			join: {
				alias: 'job_preset',
				leftJoin: {
					employees: 'job_preset.employees'
				}
			},
			relations: {
				jobPresetCriterions: true
			},
			order: {
				name: 'ASC'
			}
		});
		query.where((qb: SelectQueryBuilder<JobPreset>) => {
			qb.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), { tenantId });

			if (isNotEmpty(organizationId)) {
				qb.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), {
					organizationId
				});
			}
			if (isNotEmpty(search)) {
				qb.andWhere(p(`"${query.alias}"."name" ${likeOperator} :search`), {
					search: `%${search}%`
				});
			}
			if (isNotEmpty(employeeId)) {
				qb.andWhere(p(`"employees"."id" = :employeeId`), {
					employeeId
				});
			}
		});
		return await query.getMany();
	}

	public async get(id: string, request?: IGetJobPresetCriterionInput) {
		const query = this.typeOrmRepository.createQueryBuilder();
		query.leftJoinAndSelect(`${query.alias}.jobPresetCriterions`, 'jobPresetCriterions');
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

	/**
	 *
	 * @param presetId
	 * @returns
	 */
	public getJobPresetCriterion(presetId: string) {
		return this.typeOrmJobPresetUpworkJobSearchCriterionRepository.findBy({
			jobPresetId: presetId
		});
	}

	/**
	 *
	 * @param input
	 * @returns
	 */
	public getEmployeeCriterion(input: IGetMatchingCriterions) {
		return this.typeOrmEmployeeUpworkJobsSearchCriterionRepository.findBy({
			...(input.jobPresetId ? { jobPresetId: input.jobPresetId } : {}),
			employeeId: input.employeeId
		});
	}

	/**
	 *
	 * @param request
	 * @returns
	 */
	public async createJobPreset(request?: IJobPreset) {
		return this.commandBus.execute(
			new CreateJobPresetCommand(request)
		);
	}

	/**
	 *
	 * @param request
	 * @returns
	 */
	async saveJobPresetCriterion(request: IMatchingCriterions) {
		return this.commandBus.execute(
			new SavePresetCriterionCommand(request)
		);
	}

	/**
	 *
	 * @param request
	 * @returns
	 */
	async saveEmployeeCriterion(request: IMatchingCriterions) {
		return this.commandBus.execute(
			new SaveEmployeeCriterionCommand(request)
		);
	}

	/**
	 *
	 * @param employeeId
	 * @returns
	 */
	async getEmployeePreset(employeeId: string) {
		const employee = await this.typeOrmEmployeeRepository.findOne({
			where: {
				id: employeeId
			},
			relations: {
				jobPresets: true
			}
		});
		return employee.jobPresets;
	}

	/**
	 *
	 * @param request
	 * @returns
	 */
	async saveEmployeePreset(request: IEmployeePresetInput) {
		return this.commandBus.execute(
			new SaveEmployeePresetCommand(request)
		);
	}

	/**
	 *
	 * @param creationId
	 * @param employeeId
	 * @returns
	 */
	deleteEmployeeCriterion(creationId: string, employeeId: string) {
		return this.typeOrmEmployeeUpworkJobsSearchCriterionRepository.delete({
			id: creationId,
			employeeId: employeeId
		});
	}

	/**
	 *
	 * @param creationId
	 * @returns
	 */
	deleteJobPresetCriterion(creationId: string) {
		return this.typeOrmJobPresetUpworkJobSearchCriterionRepository.delete(creationId);
	}
}
