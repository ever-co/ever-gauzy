import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as _ from 'underscore';
import { RequestContext } from '../../../core/context/request-context';
import { Employee } from '../../../employee/employee.entity';
import { JobPresetUpworkJobSearchCriterion } from '../../job-preset-upwork-job-search-criterion.entity';
import { JobPreset } from '../../job-preset.entity';
import { CreateJobPresetCommand } from '../create-job-preset.command';

@CommandHandler(CreateJobPresetCommand)
export class CreateJobPresetHandler
	implements ICommandHandler<CreateJobPresetCommand> {
	constructor(
		@InjectRepository(JobPreset)
		private readonly jobPresetRepository: Repository<JobPreset>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,
		@InjectRepository(JobPresetUpworkJobSearchCriterion)
		private readonly jobPresetUpworkJobSearchCriterionRepository: Repository<
			JobPresetUpworkJobSearchCriterion
		>
	) {}

	public async execute(command: CreateJobPresetCommand): Promise<JobPreset> {
		const { input } = command;

		if (!input.organizationId) {
			const user = RequestContext.currentUser();
			const employee = await this.employeeRepository.findOne(
				user.employeeId
			);
			input.organizationId = employee.organizationId;
		}
		input.tenantId = RequestContext.currentTenantId();

		const jobPreset = new JobPreset(input);

		delete jobPreset.jobPresetCriterions;
		await this.jobPresetRepository.save(jobPreset);

		let jobPresetCriterion: JobPresetUpworkJobSearchCriterion[] = [];

		if (input.jobPresetCriterions && input.jobPresetCriterions.length > 0) {
			jobPresetCriterion = input.jobPresetCriterions.map(
				(criterion) =>
					new JobPresetUpworkJobSearchCriterion({
						...criterion,
						jobPresetId: jobPreset.id
					})
			);

			await this.jobPresetUpworkJobSearchCriterionRepository.delete({
				jobPresetId: jobPreset.id
			});

			await this.jobPresetUpworkJobSearchCriterionRepository.save(
				jobPresetCriterion
			);

			jobPreset.jobPresetCriterions = jobPresetCriterion;

			// jobPreset.jobPresetCriterion = jobPresetCriterion;
			// await this.jobPresetRepository.save(jobPreset);
		}
		return jobPreset;
	}
}
