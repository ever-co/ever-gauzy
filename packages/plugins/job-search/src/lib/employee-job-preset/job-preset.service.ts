import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult, SelectQueryBuilder } from 'typeorm';
import { isNotEmpty } from 'class-validator';
import {
	ID,
	IEmployeePresetInput,
	IGetJobPresetCriterionInput,
	IGetJobPresetInput,
	IGetMatchingCriterions,
	IJobPreset,
	IMatchingCriterions,
	PermissionsEnum
} from '@gauzy/contracts';
import { LIKE_OPERATOR, RequestContext, TenantAwareCrudService, TypeOrmEmployeeRepository } from '@gauzy/core';
import { prepareSQLQuery as p } from '@gauzy/core';
import { JobPreset } from './job-preset.entity';
import {
	CreateJobPresetCommand,
	SaveEmployeeCriterionCommand,
	SaveEmployeePresetCommand,
	SavePresetCriterionCommand
} from './commands';
import { TypeOrmJobPresetRepository } from './repository/type-orm-job-preset.repository';
import { MikroOrmJobPresetRepository } from './repository/mikro-orm-job-preset.repository';
import { TypeOrmJobPresetUpworkJobSearchCriterionRepository } from './repository/type-orm-job-preset-upwork-job-search-criterion.repository';
import { TypeOrmEmployeeUpworkJobsSearchCriterionRepository } from './repository/type-orm-employee-upwork-jobs-search-criterion.repository';

@Injectable()
export class JobPresetService extends TenantAwareCrudService<JobPreset> {
	constructor(
		readonly typeOrmJobPresetRepository: TypeOrmJobPresetRepository,
		readonly mikroOrmJobPresetRepository: MikroOrmJobPresetRepository,
		private readonly typeOrmJobPresetUpworkJobSearchCriterionRepository: TypeOrmJobPresetUpworkJobSearchCriterionRepository,
		private readonly typeOrmEmployeeUpworkJobsSearchCriterionRepository: TypeOrmEmployeeUpworkJobsSearchCriterionRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly commandBus: CommandBus
	) {
		super(typeOrmJobPresetRepository, mikroOrmJobPresetRepository);
	}

	/**
	 * Retrieves all job presets optionally filtered by tenant ID, organization ID, search string, or employee ID.
	 *
	 * @param request Additional parameters for filtering the job presets.
	 * @returns A Promise that resolves to an array of job presets.
	 */
	public async getAll(request?: IGetJobPresetInput) {
		// Tenant ID is required for the query
		const tenantId = RequestContext.currentTenantId() || request?.tenantId;
		// Extract parameters from the request object
		let { organizationId, search, employeeId } = request || {};

		// If the user does not have the permission to change selected employee, use the current employee ID
		if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			employeeId = RequestContext.currentEmployeeId();
		}

		// Create a query builder for the JobPreset entity
		const query = this.typeOrmRepository.createQueryBuilder('job_preset');

		// Set the find options for the query
		query.setFindOptions({
			join: {
				alias: 'job_preset', // Alias for the job preset table
				leftJoin: { employees: 'job_preset.employees' } // Left join employees relation
			},
			// Include job preset criterions in the query result
			relations: { jobPresetCriterions: true },
			// Order the results by job preset name in ascending order
			order: { name: 'ASC' }
		});

		// Add conditions to the query using the query builder
		query.where((qb: SelectQueryBuilder<JobPreset>) => {
			// Filter by tenant ID
			qb.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), { tenantId });

			// Filter by organization ID if provided
			if (isNotEmpty(organizationId)) {
				qb.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), { organizationId });
			}

			// Filter by search string if provided
			if (isNotEmpty(search)) {
				qb.andWhere(p(`"${query.alias}"."name" ${LIKE_OPERATOR} :search`), { search: `%${search}%` });
			}

			// Filter by employee ID if provided
			if (isNotEmpty(employeeId)) {
				qb.andWhere(p(`"employees"."id" = :employeeId`), { employeeId });
			}
		});

		// Execute the query and return the result
		return await query.getMany();
	}

	/**
	 * Retrieves a job preset by its ID along with its job preset criteria and employee criteria if requested.
	 *
	 * @param id The ID of the job preset to retrieve.
	 * @param request Additional parameters for the query, such as employeeId for fetching employee criteria.
	 * @returns A Promise that resolves to the retrieved job preset.
	 */
	public async get(id: ID, request?: IGetJobPresetCriterionInput) {
		const query = this.typeOrmRepository.createQueryBuilder();

		// Left join job preset criterions
		query.leftJoinAndSelect(`${query.alias}.jobPresetCriterions`, 'jobPresetCriterions');

		// Left join employee criterions if employeeId is provided in the request
		if (request?.employeeId) {
			const { employeeId } = request;
			query.leftJoinAndSelect(
				`${query.alias}.employeeCriterions`,
				'employeeCriterions',
				'employeeCriterions.employeeId = :employeeId',
				{ employeeId }
			);
		}

		// Filter by job preset ID
		query.andWhere(`${query.alias}.id = :id`, { id });

		// Execute the query and return the result
		return await query.getOne();
	}

	/**
	 * Retrieves job preset criterion based on the preset ID.
	 * @param presetId The ID of the job preset.
	 * @returns A Promise that resolves to an array of job preset criterion.
	 */
	public async getJobPresetCriterion(presetId: string) {
		// Use the job preset ID to find related job preset criterion
		return await this.typeOrmJobPresetUpworkJobSearchCriterionRepository.findBy({ jobPresetId: presetId });
	}

	/**
	 * Retrieves employee criteria based on the provided input.
	 * @param input The input data for retrieving employee criteria.
	 * @returns A Promise that resolves to the employee criteria matching the input.
	 */
	public async getEmployeeCriterion(input: IGetMatchingCriterions) {
		return await this.typeOrmEmployeeUpworkJobsSearchCriterionRepository.findBy({
			...(input.jobPresetId ? { jobPresetId: input.jobPresetId } : {}),
			employeeId: input.employeeId
		});
	}

	/**
	 * Creates a new job preset using the provided request data.
	 * @param request The request data for creating the job preset.
	 * @returns A Promise that resolves to the created job preset.
	 */
	public async createJobPreset(request: IJobPreset) {
		return await this.commandBus.execute(new CreateJobPresetCommand(request));
	}

	/**
	 * Saves job preset criterion based on the provided criteria.
	 * @param request The criteria for saving job preset criterion.
	 * @returns A Promise that resolves to the result of the command execution.
	 */
	async saveJobPresetCriterion(request: IMatchingCriterions) {
		// Execute the SavePresetCriterionCommand with the provided criteria
		return this.commandBus.execute(new SavePresetCriterionCommand(request));
	}

	/**
	 * Saves employee criterion based on the provided criteria.
	 * @param request The criteria for saving employee criterion.
	 * @returns A Promise that resolves to the result of the command execution.
	 */
	async saveEmployeeCriterion(request: IMatchingCriterions) {
		// Execute the SaveEmployeeCriterionCommand with the provided criteria
		return this.commandBus.execute(new SaveEmployeeCriterionCommand(request));
	}

	/**
	 * Retrieves the job presets associated with the specified employee.
	 * @param employeeId The ID of the employee.
	 * @returns A Promise that resolves to the job presets associated with the employee.
	 */
	async getEmployeePreset(employeeId: ID): Promise<IJobPreset[]> {
		// Find the employee with the specified ID and include jobPresets relation
		const employee = await this.typeOrmEmployeeRepository.findOne({
			where: { id: employeeId },
			relations: ['customFields.jobPresets']
		});

		// Return the job presets associated with the employee
		return employee.customFields['jobPresets'];
	}

	/**
	 * Saves employee presets based on the provided input.
	 * @param request The input containing employee presets to be saved.
	 * @returns A Promise that resolves to the result of the command execution.
	 */
	async saveEmployeePreset(request: IEmployeePresetInput): Promise<IJobPreset[]> {
		// Execute the SaveEmployeePresetCommand with the provided input
		return await this.commandBus.execute(new SaveEmployeePresetCommand(request));
	}

	/**
	 * Deletes the employee criterion with the specified ID associated with the employee ID.
	 * @param creationId The ID of the employee criterion to be deleted.
	 * @param employeeId The ID of the employee.
	 * @returns A Promise that resolves to the result of the deletion operation.
	 */
	async deleteEmployeeCriterion(creationId: string, employeeId: string): Promise<DeleteResult> {
		// Delete the employee criterion with the specified ID associated with the employee ID
		return await this.typeOrmEmployeeUpworkJobsSearchCriterionRepository.delete({
			id: creationId,
			employeeId: employeeId
		});
	}

	/**
	 * Deletes the job preset criterion with the specified ID.
	 * @param creationId The ID of the job preset criterion to be deleted.
	 * @returns A Promise that resolves to the result of the deletion operation.
	 */
	async deleteJobPresetCriterion(creationId: string) {
		// Delete the job preset criterion with the specified ID
		return await this.typeOrmJobPresetUpworkJobSearchCriterionRepository.delete(creationId);
	}
}
