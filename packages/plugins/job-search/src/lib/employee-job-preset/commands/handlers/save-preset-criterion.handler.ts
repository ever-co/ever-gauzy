import { IMatchingCriterions } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext, TypeOrmEmployeeRepository } from '@gauzy/core';
import { JobPresetUpworkJobSearchCriterion } from '../../job-preset-upwork-job-search-criterion.entity';
import { SavePresetCriterionCommand } from '../save-preset-criterion.command';
import { TypeOrmJobPresetUpworkJobSearchCriterionRepository } from '../../repository/type-orm-job-preset-upwork-job-search-criterion.repository';

@CommandHandler(SavePresetCriterionCommand)
export class SavePresetCriterionHandler implements ICommandHandler<SavePresetCriterionCommand> {
	constructor(
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly typeOrmJobPresetUpworkJobSearchCriterionRepository: TypeOrmJobPresetUpworkJobSearchCriterionRepository
	) {}

	/**
	 * Executes the SavePresetCriterionCommand to save a preset criterion.
	 *
	 * @param command The command containing the input data for saving the preset criterion.
	 * @returns The saved preset criterion.
	 */
	public async execute(command: SavePresetCriterionCommand): Promise<IMatchingCriterions> {
		const { input } = command;
		input.tenantId = RequestContext.currentTenantId();

		// If organizationId is not provided in the input, retrieve it from the current user's employee data
		if (!input.organizationId) {
			const employeeId = RequestContext.currentEmployeeId();
			if (employeeId) {
				const employee = await this.typeOrmEmployeeRepository.findOneBy({ id: employeeId });
				input.organizationId = employee.organizationId;
			}
		}

		// Create a new JobPresetUpworkJobSearchCriterion instance with the input data
		const creation = new JobPresetUpworkJobSearchCriterion(input);

		// Save the created instance to the database
		await this.typeOrmJobPresetUpworkJobSearchCriterionRepository.save(creation);

		// Return the saved preset criterion
		return creation;
	}
}
