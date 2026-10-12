import { In } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PermissionsEnum } from '@gauzy/contracts';
import { GauzyAIService } from '@gauzy/plugin-integration-ai';
import { parseFindOptionsRelations, RequestContext, TypeOrmEmployeeRepository } from '@gauzy/core';
import { EmployeeUpworkJobsSearchCriterion } from '../../employee-upwork-jobs-search-criterion.entity';
import { JobPreset } from '../../job-preset.entity';
import { SaveEmployeePresetCommand } from '../save-employee-preset.command';
import { TypeOrmJobPresetRepository } from '../../repository/type-orm-job-preset.repository';
import { TypeOrmEmployeeUpworkJobsSearchCriterionRepository } from '../../repository/type-orm-employee-upwork-jobs-search-criterion.repository';

@CommandHandler(SaveEmployeePresetCommand)
export class SaveEmployeePresetHandler implements ICommandHandler<SaveEmployeePresetCommand> {
	constructor(
		private readonly _typeOrmJobPresetRepository: TypeOrmJobPresetRepository,
		private readonly _typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly _typeOrmEmployeeUpworkJobsSearchCriterionRepository: TypeOrmEmployeeUpworkJobsSearchCriterionRepository,
		private readonly _gauzyAIService: GauzyAIService
	) {}

	/**
	 * Saves employee presets and syncs job search criteria.
	 *
	 * @param command The SaveEmployeePresetCommand object containing input data.
	 * @returns A Promise resolving to an array of JobPreset objects.
	 */
	public async execute(command: SaveEmployeePresetCommand): Promise<JobPreset[]> {
		const { input } = command;
		const tenantId = RequestContext.currentTenantId();

		// Resolve the target employee fail-closed. A caller without CHANGE_SELECTED_EMPLOYEE may only
		// touch their own record; everyone else must name a real employee of their own tenant. Every
		// repository call below is a RAW TypeORM lookup, and `{ employeeId }` with a null value used to
		// be dropped from the SQL — the delete below then became an unfiltered DELETE of every tenant's
		// search criteria (GHSA-44pv-34gx-q9p4 class), so the id must never be empty here.
		const employeeId = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
			? input.employeeId
			: RequestContext.currentEmployeeId() ?? RequestContext.currentUser()?.employeeId;
		if (!employeeId) {
			throw new BadRequestException('employeeId is required');
		}
		if (!tenantId) {
			throw new ForbiddenException('Tenant context is required');
		}
		if (!Array.isArray(input.jobPresetIds) || input.jobPresetIds.length === 0) {
			throw new BadRequestException('jobPresetIds is required');
		}

		// Find the employee with related data — scoped to the caller's tenant.
		let employee = await this._typeOrmEmployeeRepository.findOne({
			where: { id: employeeId, tenantId },
			relations: parseFindOptionsRelations(['user', 'organization', 'customFields.jobPresets'])
		});
		if (!employee) {
			throw new NotFoundException(`Employee with id ${employeeId} not found`);
		}

		// Find ALL requested job presets with their criteria — in this tenant. Every requested id must
		// resolve, or a foreign / unknown preset id would be stored on the employee anyway.
		const jobPresetIds = [...new Set(input.jobPresetIds)];
		const jobPresets = await this._typeOrmJobPresetRepository.find({
			where: { id: In(jobPresetIds), tenantId },
			relations: { jobPresetCriterions: true }
		});
		if (jobPresets.length !== jobPresetIds.length) {
			throw new NotFoundException('Job preset not found');
		}

		// Map every preset's criteria to employee criterions
		const employeeCriterions = jobPresets.flatMap((jobPreset) =>
			(jobPreset.jobPresetCriterions ?? []).map(
				(item) => new EmployeeUpworkJobsSearchCriterion({ ...item, employeeId })
			)
		);

		// Update employee custom fields with the (verified) job presets
		employee.customFields['jobPresets'] = jobPresets.map(({ id }) => new JobPreset({ id }));
		await this._typeOrmEmployeeRepository.save(employee);

		// Delete existing employee job search criteria — for THIS employee of THIS tenant only.
		await this._typeOrmEmployeeUpworkJobsSearchCriterionRepository.delete({ employeeId, tenantId });

		// Save new employee job search criteria
		await this._typeOrmEmployeeUpworkJobsSearchCriterionRepository.save(employeeCriterions);

		// Sync Gauzy employee job search criteria
		this._gauzyAIService.syncGauzyEmployeeJobSearchCriteria(employee, employeeCriterions);

		// Find the employee with related data
		employee = await this._typeOrmEmployeeRepository.findOne({
			where: { id: employeeId, tenantId },
			relations: parseFindOptionsRelations(['customFields.jobPresets'])
		});

		return employee.customFields['jobPresets'];
	}
}
