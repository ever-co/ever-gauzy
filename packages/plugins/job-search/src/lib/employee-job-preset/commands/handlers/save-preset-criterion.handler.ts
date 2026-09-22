import { IMatchingCriterions, PermissionsEnum } from '@gauzy/contracts';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
		input.tenantId = RequestContext.currentTenantId() ?? input.tenantId;
		if (!input.tenantId) {
			throw new ForbiddenException('Tenant context is required');
		}

		// If the current user has the permission to change the selected employee, use their ID
		if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			input.employeeId = RequestContext.currentEmployeeId();
		}

		// Set organizationId if not provided in the input (raw repository: scope to the tenant, and
		// only ever look an employee up by a real id).
		if (!input.organizationId && input.employeeId) {
			const employee = await this.typeOrmEmployeeRepository.findOneBy({
				id: input.employeeId,
				tenantId: input.tenantId
			});
			if (!employee) {
				throw new NotFoundException(`Employee with id ${input.employeeId} not found`);
			}
			input.organizationId = employee.organizationId;
		}

		// Create a new JobPresetUpworkJobSearchCriterion instance with the input data
		const creation = new JobPresetUpworkJobSearchCriterion(input);

		// Save the created instance to the database
		await this.typeOrmJobPresetUpworkJobSearchCriterionRepository.save(creation);

		// Return the saved preset criterion
		return creation;
	}
}
