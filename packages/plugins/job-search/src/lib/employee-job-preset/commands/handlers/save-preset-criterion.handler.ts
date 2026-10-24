import { IMatchingCriterions, PermissionsEnum } from '@gauzy/contracts';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext, TypeOrmEmployeeRepository } from '@gauzy/core';
import { JobPresetUpworkJobSearchCriterion } from '../../job-preset-upwork-job-search-criterion.entity';
import { SavePresetCriterionCommand } from '../save-preset-criterion.command';
import { TypeOrmJobPresetUpworkJobSearchCriterionRepository } from '../../repository/type-orm-job-preset-upwork-job-search-criterion.repository';
import { TypeOrmJobPresetRepository } from '../../repository/type-orm-job-preset.repository';

@CommandHandler(SavePresetCriterionCommand)
export class SavePresetCriterionHandler implements ICommandHandler<SavePresetCriterionCommand> {
	constructor(
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly typeOrmJobPresetUpworkJobSearchCriterionRepository: TypeOrmJobPresetUpworkJobSearchCriterionRepository,
		private readonly typeOrmJobPresetRepository: TypeOrmJobPresetRepository
	) {}

	/**
	 * Executes the SavePresetCriterionCommand to save a preset criterion.
	 *
	 * @param command The command containing the input data for saving the preset criterion.
	 * @returns The saved preset criterion.
	 */
	public async execute(command: SavePresetCriterionCommand): Promise<IMatchingCriterions> {
		const { input } = command;
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new ForbiddenException('Tenant context is required');
		}
		input.tenantId = tenantId;

		// The preset (from the route) must be one of this tenant, and an id may only name one of its own criteria:
		// the raw `save` below updates whatever row the id names, in any tenant, and moves it into this one
		// (an empty id would be dropped from the SQL and match any preset of the tenant)
		if (!input.jobPresetId) {
			throw new BadRequestException('jobPresetId is required');
		}
		const jobPreset = await this.typeOrmJobPresetRepository.findOneBy({ id: input.jobPresetId, tenantId });
		if (!jobPreset) {
			throw new NotFoundException('Job preset not found');
		}
		if (
			input.id &&
			!(await this.typeOrmJobPresetUpworkJobSearchCriterionRepository.findOneBy({
				id: input.id,
				jobPresetId: jobPreset.id,
				tenantId
			}))
		) {
			throw new NotFoundException('Job preset criterion not found');
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
