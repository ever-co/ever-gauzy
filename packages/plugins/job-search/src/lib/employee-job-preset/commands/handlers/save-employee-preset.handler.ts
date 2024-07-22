import { In } from 'typeorm';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GauzyAIService } from '@gauzy/plugin-integration-ai';
import { TypeOrmEmployeeRepository } from '@gauzy/core';
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
		const { employeeId } = input;

		// Find the employee with related data
		let employee = await this._typeOrmEmployeeRepository.findOne({
			where: { id: employeeId },
			relations: ['user', 'organization', 'customFields.jobPresets']
		});

		// Find the job preset with related criteria
		const jobPreset = await this._typeOrmJobPresetRepository.findOne({
			where: { id: In(input.jobPresetIds) },
			relations: { jobPresetCriterions: true }
		});

		// Map job preset criteria to employee criterions
		const employeeCriterions = jobPreset.jobPresetCriterions.map(
			(item) => new EmployeeUpworkJobsSearchCriterion({ ...item, employeeId })
		);

		// Update employee custom fields with job presets
		employee.customFields['jobPresets'] = input.jobPresetIds.map((id) => new JobPreset({ id }));
		await this._typeOrmEmployeeRepository.save(employee);

		// Delete existing employee job search criteria
		await this._typeOrmEmployeeUpworkJobsSearchCriterionRepository.delete({ employeeId });

		// Save new employee job search criteria
		await this._typeOrmEmployeeUpworkJobsSearchCriterionRepository.save(employeeCriterions);

		// Sync Gauzy employee job search criteria
		this._gauzyAIService.syncGauzyEmployeeJobSearchCriteria(employee, employeeCriterions);

		// Find the employee with related data
		employee = await this._typeOrmEmployeeRepository.findOne({
			where: { id: employeeId },
			relations: ['customFields.jobPresets']
		});

		return employee.customFields['jobPresets'];
	}
}
