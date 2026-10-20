import { ForbiddenException, NotFoundException } from '@nestjs/common';
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

		// The caller's tenant, and no other: the writes below go through raw repositories, which scope nothing
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new ForbiddenException('Tenant context is required');
		}
		input.tenantId = tenantId;

		// An id updates a preset, which must be one of this tenant: a raw `save` with the id of another tenant's
		// preset updated that preset and moved it into this tenant
		if (input.id && !(await this.typeOrmJobPresetRepository.findOneBy({ id: input.id, tenantId }))) {
			throw new NotFoundException('Job preset not found');
		}

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
			// New rows of this preset: the preset's criteria are replaced below, so a criterion id from the request
			// would only update a row of another preset (or tenant) through the raw `save`
			jobPresetCriterion = input.jobPresetCriterions.map(
				(criterion) =>
					new JobPresetUpworkJobSearchCriterion({
						...criterion,
						id: undefined,
						jobPresetId: jobPreset.id,
						tenantId,
						organizationId: jobPreset.organizationId
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
