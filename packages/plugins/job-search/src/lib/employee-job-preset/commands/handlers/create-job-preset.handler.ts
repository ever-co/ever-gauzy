import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext, TypeOrmEmployeeRepository } from '@gauzy/core';
import { JobPresetUpworkJobSearchCriterion } from '../../job-preset-upwork-job-search-criterion.entity';
import { JobPreset } from '../../job-preset.entity';
import { CreateJobPresetCommand } from '../create-job-preset.command';
import { TypeOrmJobPresetRepository } from '../../repository/type-orm-job-preset.repository';
import { TypeOrmJobPresetUpworkJobSearchCriterionRepository } from '../../repository/type-orm-job-preset-upwork-job-search-criterion.repository';

@CommandHandler(CreateJobPresetCommand)
export class CreateJobPresetHandler implements ICommandHandler<CreateJobPresetCommand> {

	constructor(
		private readonly typeOrmJobPresetRepository: TypeOrmJobPresetRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly typeOrmJobPresetUpworkJobSearchCriterionRepository: TypeOrmJobPresetUpworkJobSearchCriterionRepository
	) { }

	/**
	 * Executes the command to create a job preset.
	 *
	 * @param command The command containing the input data for creating the job preset.
	 * @returns A Promise that resolves to the created job preset.
	 */
	public async execute(command: CreateJobPresetCommand): Promise<JobPreset> {
		const { input } = command;

		// Set tenantId
		input.tenantId = RequestContext.currentTenantId();

		// Set organizationId if not provided in the input
		if (!input.organizationId) {
			const employeeId = RequestContext.currentEmployeeId();
			if (employeeId) {
				const employee = await this.typeOrmEmployeeRepository.findOneBy({ id: employeeId });
				input.organizationId = employee.organizationId;
			}
		}

		// Create a new job preset
		const jobPreset = new JobPreset(input);
		delete jobPreset.jobPresetCriterions; // Remove jobPresetCriterions property from input
		await this.typeOrmJobPresetRepository.save(jobPreset);

		// Prepare job preset criteria
		let jobPresetCriterion: JobPresetUpworkJobSearchCriterion[] = [];
		if (input.jobPresetCriterions && input.jobPresetCriterions.length > 0) {
			jobPresetCriterion = input.jobPresetCriterions.map((criterion) =>
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
