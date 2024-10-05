import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext } from '@gauzy/core';
import { JobPresetUpworkJobSearchCriterion } from '../../job-preset-upwork-job-search-criterion.entity';
import { JobPreset } from '../../job-preset.entity';
import { CreateJobPresetCommand } from '../create-job-preset.command';
import { TypeOrmJobPresetRepository } from '../../repository/type-orm-job-preset.repository';
import { TypeOrmJobPresetUpworkJobSearchCriterionRepository } from '../../repository/type-orm-job-preset-upwork-job-search-criterion.repository';
import { PermissionsEnum } from '@gauzy/contracts';

@CommandHandler(CreateJobPresetCommand)
export class CreateJobPresetHandler implements ICommandHandler<CreateJobPresetCommand> {
	constructor(
		private readonly typeOrmJobPresetRepository: TypeOrmJobPresetRepository,
		private readonly typeOrmJobPresetUpworkJobSearchCriterionRepository: TypeOrmJobPresetUpworkJobSearchCriterionRepository
	) {}

	/**
	 * Executes the command to create a job preset.
	 *
	 * @param command The command containing the input data for creating the job preset.
	 * @returns A Promise that resolves to the created job preset.
	 */
	public async execute(command: CreateJobPresetCommand): Promise<JobPreset> {
		const { input } = command;

		// Set tenantId
		input.tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		// If the current user has the permission to change the selected employee, use their ID
		if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			input.employees.push({ employeeId: RequestContext.currentEmployeeId() });
		}

		// Create a new job preset
		const jobPreset = new JobPreset(input);
		delete jobPreset.jobPresetCriterions; // Remove jobPresetCriterions property from input
		await this.typeOrmJobPresetRepository.save(jobPreset);

		// Prepare job preset criteria
		let jobPresetCriterion: JobPresetUpworkJobSearchCriterion[] = [];
		if (input.jobPresetCriterions && input.jobPresetCriterions.length > 0) {
			jobPresetCriterion = input.jobPresetCriterions.map(
				(criterion) =>
					new JobPresetUpworkJobSearchCriterion({
						...criterion,
						jobPresetId: jobPreset.id
					})
			);

			// Delete existing job preset criteria
			await this.typeOrmJobPresetUpworkJobSearchCriterionRepository.delete({
				jobPresetId: jobPreset.id
			});

			// Save new job preset criteria
			await this.typeOrmJobPresetUpworkJobSearchCriterionRepository.save(jobPresetCriterion);

			// Update job preset with the new job preset criteria
			jobPreset.jobPresetCriterions = jobPresetCriterion;
		}

		return jobPreset;
	}
}
